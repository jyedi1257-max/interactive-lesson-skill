# Claude Code·Codex 등 에이전트에서 사용하기

설치할 원본은 `skills/redesign-interactive-lessons/` 폴더 전체입니다. 참고자료와 아이콘의 상대 경로를 유지하세요. `agents/openai.yaml`은 OpenAI 환경용 메타데이터이며 다른 에이전트에 자동으로 적용되는 설정으로 간주하지 않습니다.

## 준비

저장소를 다운로드해 압축을 풀거나 다음 명령으로 내려받습니다. Git 명령은 Git이 설치된 경우에 사용합니다.

```bash
git clone https://github.com/jyedi1257-max/interactive-lesson-skill.git
cd interactive-lesson-skill
```

기존 같은 이름의 스킬이 있으면 내용을 비교하고 백업한 뒤 교체하세요. 프로젝트 설치와 개인 설치 중 하나를 선택해 중복을 피합니다. 사용자 활동지는 공개 저장소 폴더 밖에 보관하세요.

## Claude Code

개인 설치 위치는 `~/.claude/skills/redesign-interactive-lessons/`, 프로젝트 전용 위치는 `<작업 프로젝트>/.claude/skills/redesign-interactive-lessons/`입니다. 전체 폴더를 해당 위치에 복사합니다. Claude Code의 개인 설치는 로컬 컴퓨터 기준이며 Cowork·클라우드 세션으로 자동 전달되지 않습니다. [Claude Code 공식 문서](https://code.claude.com/docs/en/skills)

macOS/Linux/WSL에서 처음 개인 설치할 때, 저장소 폴더 안에서 실행:

```bash
mkdir -p "$HOME/.claude/skills"
if [ -e "$HOME/.claude/skills/redesign-interactive-lessons" ]; then
  echo "같은 이름의 스킬이 있습니다. 비교 후 업데이트하세요."
else
  cp -R skills/redesign-interactive-lessons "$HOME/.claude/skills/"
fi
```

Windows에서는 실제 Claude Code를 실행하는 환경의 사용자 홈을 기준으로 복사합니다. 네이티브 Windows라면 사용자 폴더의 `.claude/skills/`, WSL이라면 WSL 안의 `~/.claude/skills/`입니다.

Claude Code에서 확인하고 사용:

```text
/redesign-interactive-lessons
내 활동지를 분석해서 수업활동과 지도안으로 개선해줘.
수업 시간과 대상 등 빠진 기본정보가 있으면 먼저 물어봐.
```

명령이 나타나지 않으면 폴더 바로 아래에 `SKILL.md`가 있는지, 폴더가 한 겹 더 들어가 있지 않은지, 실행 환경과 설치 위치가 같은지 확인하세요.

## Codex CLI·IDE

개인 설치 위치는 `~/.agents/skills/redesign-interactive-lessons/`, 프로젝트 전용 위치는 `<작업 프로젝트>/.agents/skills/redesign-interactive-lessons/`입니다. [OpenAI 공식 문서](https://learn.chatgpt.com/docs/build-skills)

macOS/Linux/WSL에서 처음 개인 설치할 때:

```bash
mkdir -p "$HOME/.agents/skills"
if [ -e "$HOME/.agents/skills/redesign-interactive-lessons" ]; then
  echo "같은 이름의 스킬이 있습니다. 비교 후 업데이트하세요."
else
  cp -R skills/redesign-interactive-lessons "$HOME/.agents/skills/"
fi
```

Windows에서는 Codex를 실행하는 환경의 사용자 홈 아래 `.agents/skills/`에 복사합니다. CLI·IDE에서 `/skills`로 확인하거나 다음처럼 호출합니다. ChatGPT에서 관리하는 개인 스킬 설치는 [별도 안내](chatgpt.md)를 따릅니다.

```text
$redesign-interactive-lessons 첨부 활동지를 분석해서 수업활동과 지도안으로 개선해줘.
```

## 그 밖의 에이전트

해당 에이전트가 `SKILL.md` 형식을 지원하면 공식 문서의 설치 위치에 전체 폴더를 넣습니다. 이름이 같은 기능이어도 설치 경로와 호출 방식은 다를 수 있습니다. 지원 여부가 불명확하면 다음처럼 파일 읽기를 명시적으로 요청합니다.

> skills/redesign-interactive-lessons/SKILL.md를 읽고 연결된 참고자료를 필요한 만큼 확인해줘. 그 지침에 따라 내 활동지를 분석하고 수업안을 작성해줘. 먼저 빠진 기본정보를 확인해줘.

파일을 직접 읽을 수 없는 에이전트에는 [전체 지침](../prompts/chatgpt-instructions.md)을 제공할 수 있습니다. Hermes를 포함한 기타 에이전트의 자동 설치·호출은 이 배포본에서 실기 검증하지 않았습니다.

## 파일 읽기와 노션은 별개

스킬은 작업 방법을 제공합니다. PDF·이미지 읽기 도구나 노션 접근 권한을 설치하지 않습니다. 필요한 자료를 읽지 못하면 텍스트나 지원되는 파일로 제공하세요. 노션 자동 반영은 [노션 연동 안내](notion.md)를 따릅니다.
