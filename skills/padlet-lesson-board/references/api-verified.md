# 패들렛 API 검증 패턴

2026년 9월 기준으로 확인한 내용입니다. 패들렛 API는 아직 바뀌는 중이라, 맞지 않으면 `https://docs.padlet.dev/llms.txt`에서 먼저 확인하세요. 문서 주소 끝에 `.md`를 붙이면 스키마를 읽을 수 있습니다.

## 인증

- 기본 주소: `https://api.padlet.dev/v1`
- 헤더
  - `X-API-KEY: <키>`
  - `Content-Type: application/vnd.api+json`
  - `Accept: application/vnd.api+json`
- 계정 확인: `GET /me`

키는 환경변수에서만 읽습니다. 기록, 대화, 명령줄에 남기지 않습니다.

## 새 보드 만들기

일반 `POST /boards`는 개인 키로 거부될 수 있습니다.

```
You must use a zapier integration to access this endpoint.
```

확인된 대안은 AI Recipe입니다.

```http
POST /ai-recipe-boards
```

```json
{
  "data": {
    "type": "ai_recipe_board",
    "attributes": {
      "boardCreationInstructions": "수업 대상, 제목, 섹션, 카드 내용을 구체적으로 적는다",
      "role": "teacher"
    }
  }
}
```

응답에서 `data.attributes.statusUrl`을 얻고 약 3초마다 조회합니다. 관찰된 상태 흐름은 `in_progress`에서 `success`였습니다. 실제 측정에서 12초에서 21초가 걸렸고, 최대 2분으로 제한합니다.

완료된 보드는 `data.attributes.board`에 들어 있고 다음 값을 씁니다.

- `board.id`
- `board.attributes.title`
- `board.attributes.webUrl.live`
- `board.attributes.webUrl.slideshow`
- `board.attributes.webUrl.qrCode`

### AI Recipe에 카드까지 맡기지 않습니다

**같은 지시문으로 두 번 돌리면 결과가 다릅니다.** 실제로 측정한 내용입니다.

- 1회차: 지시한 카드 6개를 제대로 만듦
- 2회차: 같은 지시문인데 **제목이 빈 카드 6개**를 만듦

여기에 공개 API에 삭제가 없다는 점이 겹치면 문제가 커집니다. 잘못 생긴 카드를 지우지 못한 채 빠진 카드를 채우면 카드가 12개가 됩니다.

그래서 **구역 골격만 AI Recipe에 맡기고 카드는 직접 만듭니다.**

```
제목이 "..." 인 수업 보드를 만든다.

아래 이름의 구역만 순서대로 만든다.
1. 표정 풀기
2. 어울리는 말 고르기

중요: 게시물(카드)은 하나도 만들지 않는다. 구역만 만들고 비워 둔다.
예시 카드, 안내 카드, 환영 카드도 만들지 않는다.
```

이렇게 하면 결과가 매번 같습니다. 그래도 카드가 생기면 지울 수 없으므로, 만들기 전 개수를 세어 두고 남은 것은 사용자에게 알립니다.

## 삭제와 수정이 없습니다

문서 색인에 있는 엔드포인트는 다음이 전부입니다.

- 만들기: AI Recipe 보드, 게시물, 댓글, 반응
- 읽기: 보드, 게시물 첨부, 사용자, 조직, AI Recipe 상태

**DELETE도 PATCH도 없습니다.** 한번 만든 카드는 API로 지우거나 고칠 수 없고, 패들렛 웹에서 손으로 처리해야 합니다. 그래서 만들기 전에 검증하는 편이 훨씬 쌉니다.

## 카드 만들기

`subject`와 `body`는 반드시 `attributes.content` 안에 둡니다. `attributes` 바로 아래에 넣으면 카드가 비어서 생성됩니다.

```http
POST /boards/{board_id}/posts
```

```json
{
  "data": {
    "type": "post",
    "attributes": {
      "content": {
        "subject": "제목",
        "body": "본문"
      },
      "color": "blue"
    },
    "relationships": {
      "section": {
        "data": { "id": "sec_..." }
      }
    }
  }
}
```

색은 `red`, `orange`, `green`, `blue`, `purple` 중 하나입니다. 섹션을 빼면 기본 위치에 붙습니다.

## 투표

학생이 고르는 활동은 댓글 안내가 아니라 실제 투표로 만듭니다.

```json
{
  "content": {
    "subject": "친구가 넘어졌어요",
    "attachment": {
      "poll": {
        "question": "어떤 말을 할까요",
        "choices": ["괜찮아?", "같이 가자", "여기 앉아"]
      }
    }
  }
}
```

선택지는 2개에서 4개입니다. 만든 뒤 다시 조회해서 `attachment.poll`이 있는지 확인합니다.

`question`에 `subject`와 같은 문자열을 넣으면 화면에서 같은 문장이 카드 제목 자리와 투표 질문 자리에 두 번 나옵니다. 서로 다른 문장을 넣습니다.

## 그림

```json
{
  "content": {
    "subject": "웃는 얼굴",
    "attachment": { "url": "https://example.com/smile.png", "caption": "짧은 설명" }
  }
}
```

주소는 공개된 곳이어야 합니다. 본문에 주소를 그대로 적지 말고 첨부로 넣습니다.

읽기 API에 `previewImageUrl`이 없어도 실제로는 보일 수 있습니다. 등록 성공만으로 표시 완료로 보지 말고, 보드를 열어 그림이 실제로 뜨는지 확인합니다.

**확인하지 못한 것**: 내 컴퓨터에 있는 파일을 올리는 업로드 경로는 확인하지 못했습니다. 확인되지 않은 업로드나 PATCH 엔드포인트를 추측해서 부르지 않습니다.

## 보드 확인

```http
GET /boards/{board_id}?include=posts,sections,comments
```

- 응답 `included`에서 `type`이 `section`인 것과 `post`인 것을 나눕니다
- 카드 제목: `attributes.content.subject`
- 카드 본문: `attributes.content.bodyHtml` 또는 `attributes.content.body`
- 섹션 연결: `relationships.section.data.id`

## 구현 선택

패들렛 API 앞단의 클라우드플레어가 파이썬 기본 `urllib`의 사용자 에이전트를 막을 수 있습니다. 확인된 구현은 Node 18 이상의 전역 `fetch`입니다. 파이썬 요청이 막히면 반복하지 말고 Node로 옮깁니다.

## 안전

- 키 원문을 기록에 출력하지 않습니다
- 셸 명령줄에 키를 직접 적지 않습니다. 환경변수에서 읽습니다
- 임시로 저장한 인증 정보는 작업 뒤 지웁니다
- 이 문서에는 실제 키, 사용자 계정, 보드 아이디를 적지 않습니다
