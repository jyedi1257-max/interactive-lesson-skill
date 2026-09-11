#!/usr/bin/env node
// 수업자료를 패들렛 보드로 만든다.
// Node 18 이상에서 추가 설치 없이 동작한다.
// 사용법: node scripts/create-board.mjs board.json
//        node scripts/create-board.mjs --check

import { readFile } from "node:fs/promises";
import process, { argv, env, stdout } from "node:process";

const API = "https://api.padlet.dev/v1";
const HEADERS = {
  "X-API-KEY": env.PADLET_API_KEY ?? "",
  "Content-Type": "application/vnd.api+json",
  Accept: "application/vnd.api+json",
};
const POLL_INTERVAL_MS = 3000;
const POLL_TIMEOUT_MS = 120000;
const COLORS = new Set(["red", "orange", "green", "blue", "purple"]);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const say = (...parts) => console.log(...parts);
const normalize = (value) => String(value ?? "").replace(/\s+/g, " ").trim();

// 즉시 종료하지 않고 던진다. 실행 중인 요청이 있을 때 바로 끝내면
// 윈도우에서 Node가 assertion 오류를 내며 죽는다.
class Stop extends Error {
  constructor(message, hint, code = 1) {
    super(message);
    this.hint = hint;
    this.code = code;
  }
}

function fail(message, hint) {
  throw new Stop(message, hint);
}

function requireKey() {
  const key = env.PADLET_API_KEY;
  if (!key) {
    fail(
      "PADLET_API_KEY 환경변수가 없습니다.",
      "키를 환경변수에 넣은 뒤 다시 실행하세요. 키를 명령줄이나 파일에 직접 적지 마세요.",
    );
  }
  if (!key.startsWith("pdltp_")) {
    say("주의: 키가 pdltp_ 로 시작하지 않습니다. 개발자 API 키가 맞는지 확인하세요.");
  }
}

async function call(method, path, body) {
  const url = path.startsWith("http") ? path : `${API}${path}`;
  let response;
  try {
    response = await fetch(url, {
      method,
      headers: HEADERS,
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch (error) {
    fail(`요청을 보내지 못했습니다: ${error.message}`, "인터넷 연결과 Node 버전(18 이상)을 확인하세요.");
  }

  const text = await response.text();
  let parsed = null;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    // 본문이 JSON이 아니면 그대로 둔다
  }

  if (!response.ok) {
    const detail = parsed?.errors?.[0]?.detail ?? parsed?.message ?? text.slice(0, 300);
    if (response.status === 401) {
      fail("401. 키가 틀렸거나 만료되었습니다.", "패들렛에서 키를 다시 확인하세요.");
    }
    if (typeof detail === "string" && detail.includes("zapier")) {
      fail(
        "이 엔드포인트는 개인 키로 쓸 수 없습니다.",
        "새 보드는 ai-recipe-boards 경로로 만듭니다. 이 스크립트는 그 경로를 씁니다.",
      );
    }
    fail(`${method} ${path} 실패 (${response.status})`, String(detail));
  }
  return parsed;
}

// 설정 파일을 읽는다. json은 그대로, yaml은 js-yaml이 있을 때만 읽는다.
async function loadPlan(file) {
  let raw;
  try {
    raw = await readFile(file, "utf8");
  } catch {
    fail(`파일을 열지 못했습니다: ${file}`);
  }

  if (/\.ya?ml$/i.test(file)) {
    try {
      const { default: yaml } = await import("js-yaml");
      return yaml.load(raw);
    } catch {
      fail(
        "yaml 파일을 읽으려면 js-yaml이 필요합니다.",
        "js-yaml을 설치하거나, 같은 내용을 board.json 으로 저장해 쓰세요.",
      );
    }
  }

  try {
    return JSON.parse(raw);
  } catch (error) {
    fail(`설정 파일 형식이 올바르지 않습니다: ${error.message}`);
  }
}

function validatePlan(plan) {
  const problems = [];
  if (!plan || typeof plan !== "object") problems.push("최상위가 객체가 아닙니다.");
  if (!plan?.보드제목) problems.push("보드제목이 없습니다.");
  if (!Array.isArray(plan?.섹션) || plan.섹션.length === 0) problems.push("섹션이 비어 있습니다.");

  for (const [si, section] of (plan?.섹션 ?? []).entries()) {
    if (!section?.이름) problems.push(`섹션 ${si + 1}: 이름이 없습니다.`);
    if (!Array.isArray(section?.카드) || section.카드.length === 0) {
      problems.push(`섹션 '${section?.이름 ?? si + 1}': 카드가 비어 있습니다.`);
      continue;
    }
    for (const [ci, card] of section.카드.entries()) {
      const where = `섹션 '${section.이름}' 카드 ${ci + 1}`;
      if (!card?.제목) problems.push(`${where}: 제목이 없습니다.`);
      if (card?.투표 && (!Array.isArray(card.투표) || card.투표.length < 2 || card.투표.length > 4)) {
        problems.push(`${where}: 투표 선택지는 2개에서 4개여야 합니다.`);
      }
      if (card?.색 && !COLORS.has(card.색)) {
        problems.push(`${where}: 색은 ${[...COLORS].join(", ")} 중 하나여야 합니다.`);
      }
      if (card?.이미지 && !/^https?:\/\//.test(card.이미지)) {
        problems.push(`${where}: 이미지는 공개된 http 주소여야 합니다. 내 컴퓨터 파일 경로는 아직 쓸 수 없습니다.`);
      }
      if (card?.투표 && card?.이미지) {
        problems.push(`${where}: 한 카드에 투표와 이미지를 함께 넣을 수 없습니다. 카드를 나누세요.`);
      }
      if (card?.질문 && !card?.투표) {
        problems.push(`${where}: 질문은 투표가 있는 카드에만 씁니다.`);
      }
    }
  }

  if (problems.length) {
    console.error("\n설정 파일을 고쳐 주세요.");
    for (const problem of problems) console.error(`  - ${problem}`);
    throw new Stop("설정 파일에 고칠 곳이 있습니다.");
  }
}

// AI Recipe에 넘길 지시문을 만든다.
//
// 카드까지 맡기지 않고 섹션 골격만 만들게 한다. AI Recipe 결과는 실행할 때마다
// 달라서, 어떤 때는 제목이 빈 카드를 만든다. 공개 API에는 삭제와 수정이 없어서
// 한번 잘못 생긴 카드는 웹에서 손으로 지워야 한다. 그래서 카드는 전부 이 스크립트가
// 직접 만든다.
function buildInstructions(plan) {
  return [
    `제목이 "${plan.보드제목}" 인 수업 보드를 만든다.`,
    "학생이 보는 화면이므로 교사용 단계명이나 소요시간을 넣지 않는다.",
    "",
    "아래 이름의 구역만 순서대로 만든다.",
    ...plan.섹션.map((section, index) => `${index + 1}. ${section.이름}`),
    "",
    "중요: 게시물(카드)은 하나도 만들지 않는다. 구역만 만들고 비워 둔다.",
    "예시 카드, 안내 카드, 환영 카드도 만들지 않는다.",
  ].join("\n");
}

async function createBoard(plan) {
  say("보드를 만드는 중입니다. 최대 2분 걸립니다.");
  const created = await call("POST", "/ai-recipe-boards", {
    data: {
      type: "ai_recipe_board",
      attributes: {
        boardCreationInstructions: buildInstructions(plan),
        role: "teacher",
      },
    },
  });

  const statusUrl = created?.data?.attributes?.statusUrl;
  if (!statusUrl) fail("응답에 statusUrl이 없습니다.", "패들렛 API 형식이 바뀌었을 수 있습니다.");

  const deadline = Date.now() + POLL_TIMEOUT_MS;
  let status = "in_progress";
  let payload = null;

  while (Date.now() < deadline) {
    await sleep(POLL_INTERVAL_MS);
    payload = await call("GET", statusUrl);
    status = payload?.data?.attributes?.status ?? status;
    stdout.write(`  상태: ${status}          \r`);
    if (status === "success") break;
    if (status === "failed" || status === "error") {
      fail("보드 생성이 실패했습니다.", JSON.stringify(payload?.data?.attributes ?? {}).slice(0, 300));
    }
  }
  say("");

  if (status !== "success") {
    fail("2분 안에 보드 생성이 끝나지 않았습니다.", "잠시 뒤 다시 시도하세요.");
  }

  const board = payload?.data?.attributes?.board;
  if (!board?.id) fail("생성된 보드 정보를 찾지 못했습니다.");
  return board;
}

function cardPayload(card, sectionId) {
  const content = { subject: card.제목 };
  if (card.본문) content.body = card.본문;
  if (card.투표) {
    // 질문을 따로 주지 않으면 제목이 카드 위와 투표 위에 두 번 나온다.
    const question = card.질문 ?? card.본문 ?? card.제목;
    content.attachment = { poll: { question, choices: card.투표 } };
  } else if (card.이미지) {
    content.attachment = { url: card.이미지 };
  }

  const attributes = { content };
  if (card.색) attributes.color = card.색;

  const data = { type: "post", attributes };
  if (sectionId) data.relationships = { section: { data: { id: sectionId } } };
  return { data };
}

function splitIncluded(detail) {
  const included = detail?.included ?? [];
  return {
    sections: included.filter((item) => item.type === "section"),
    posts: included.filter((item) => item.type === "post"),
  };
}

async function fillCards(boardId, plan) {
  const detail = await call("GET", `/boards/${boardId}?include=posts,sections`);
  const { sections, posts } = splitIncluded(detail);

  const sectionByName = new Map(
    sections.map((section) => [
      normalize(section.attributes?.title ?? section.attributes?.name),
      section.id,
    ]),
  );

  const missingSections = plan.섹션
    .map((section) => section.이름)
    .filter((name) => !sectionByName.has(normalize(name)));

  // 카드를 만들지 말라고 했는데도 생긴 것들. 지울 방법이 없으므로 알리기만 한다.
  const strays = posts.map((post) => normalize(post.attributes?.content?.subject) || "(제목 없음)");

  const existing = new Set(posts.map((post) => normalize(post.attributes?.content?.subject)));
  let added = 0;
  for (const section of plan.섹션) {
    const sectionId = sectionByName.get(normalize(section.이름)) ?? null;
    for (const card of section.카드) {
      if (existing.has(normalize(card.제목))) continue;
      await call("POST", `/boards/${boardId}/posts`, cardPayload(card, sectionId));
      existing.add(normalize(card.제목));
      added += 1;
    }
  }
  return { added, strays, missingSections };
}

async function verify(boardId, plan) {
  const detail = await call("GET", `/boards/${boardId}?include=posts,sections`);
  const { sections, posts } = splitIncluded(detail);

  const wanted = plan.섹션.flatMap((section) => section.카드.map((card) => normalize(card.제목)));
  const have = new Set(posts.map((post) => normalize(post.attributes?.content?.subject)));

  return {
    sections: sections.length,
    posts: posts.length,
    missing: wanted.filter((title) => !have.has(title)),
    empty: posts.filter((post) => !normalize(post.attributes?.content?.subject)).length,
    polls: posts.filter((post) => post.attributes?.content?.attachment?.poll).length,
    wantedPolls: plan.섹션.flatMap((section) => section.카드.filter((card) => card.투표)).length,
  };
}

async function check() {
  requireKey();
  const me = await call("GET", "/me");
  say("키가 정상입니다.");
  const attributes = me?.data?.attributes ?? {};
  for (const field of ["name", "username"]) {
    if (attributes[field]) say(`  ${field}: ${attributes[field]}`);
  }
}

function usage() {
  say("사용법:");
  say("  node scripts/create-board.mjs --check          키가 살아 있는지 확인");
  say("  node scripts/create-board.mjs board.json       보드 만들기");
  say("");
  say("키는 PADLET_API_KEY 환경변수에 둡니다.");
}

async function main() {
  const arg = argv[2];

  if (!arg || arg === "--help" || arg === "-h") return usage();
  if (arg === "--check") return check();

  requireKey();
  const plan = await loadPlan(arg);
  validatePlan(plan);

  const board = await createBoard(plan);
  say(`보드를 만들었습니다: ${board.attributes?.title ?? plan.보드제목}`);

  const { added, strays, missingSections } = await fillCards(board.id, plan);
  say(`카드 ${added}개를 넣었습니다.`);

  const result = await verify(board.id, plan);

  say("");
  say("== 결과 ==");
  say(`보드 제목   ${board.attributes?.title ?? plan.보드제목}`);
  say(`섹션        ${result.sections}개`);
  say(`카드        ${result.posts}개`);
  say(`투표        ${result.polls}개 (요청 ${result.wantedPolls}개)`);
  say(`보드 링크   ${board.attributes?.webUrl?.live ?? "확인 필요"}`);
  say(`슬라이드    ${board.attributes?.webUrl?.slideshow ?? "확인 필요"}`);
  say(`QR          ${board.attributes?.webUrl?.qrCode ?? "확인 필요"}`);
  say("");

  const warnings = [];
  if (missingSections.length) {
    warnings.push(`만들어지지 않은 구역: ${missingSections.join(", ")}. 그 카드는 기본 위치에 붙었습니다.`);
  }
  if (strays.length) {
    warnings.push(
      `요청하지 않았는데 생긴 카드 ${strays.length}개: ${strays.join(", ")}. ` +
        "패들렛 API에는 삭제 기능이 없으니 보드를 열어 직접 지우세요.",
    );
  }
  if (result.missing.length) warnings.push(`보드에 없는 카드: ${result.missing.join(", ")}`);
  if (result.polls < result.wantedPolls) warnings.push("투표가 요청보다 적습니다.");

  if (warnings.length) {
    say("검증: 확인이 필요합니다.");
    for (const warning of warnings) say(`  - ${warning}`);
    say("");
    say("보드를 열어 직접 확인한 뒤 학생에게 안내하세요.");
    process.exitCode = 2;
    return;
  }

  say("검증: 요청한 구조와 맞습니다.");
  say("링크가 실제로 열리는지 한 번 확인한 뒤 안내하세요.");
}

try {
  await main();
} catch (error) {
  if (error instanceof Stop) {
    console.error(`\n오류: ${error.message}`);
    if (error.hint) console.error(`힌트: ${error.hint}`);
    process.exitCode = error.code;
  } else {
    console.error(`\n예상하지 못한 오류: ${error?.message ?? error}`);
    process.exitCode = 1;
  }
}
