# Task Requests

Hancom Docs 병렬 탐색의 상태와 증거를 모아두는 사람용 문서다. 에이전트 행동 규칙은 이 디렉터리와 각 track 디렉터리의 `AGENTS.md`를 따른다.

## Files

- `board.md`: coordinator 현황판
- `<track>/request.md`: 작업 요청서와 subtask 정의
- `<track>/findings.md`: append-only 탐색 로그
- `<track>/status.json`: machine-readable 상태 파일, optional `subtasks`, 그리고 짧은 `conversation_context`
- `<track>/handoff.md`: downstream을 위한 짧은 전달 문서. 맨 앞에 `## Conversation Context`를 두어 사용자 의도와 대화 중 결정된 핵심을 짧게 남긴다.
- `<track>/*.md`: acceptance map, semantics, audit note 같은 track-local 지원 문서

## Conversation Context

- `status.json`의 `conversation_context`는 다음 shape를 따른다.

```json
{
  "conversation_context": {
    "user_goal": "One-sentence summary of what the user wants now.",
    "user_constraints": ["Explicit constraints or preferences the user stated."],
    "decisions": ["Key decisions locked during conversation."],
    "latest_user_request": "Most recent redirect or ask from the user.",
    "open_questions": []
  }
}
```

- 각 값은 짧게 유지하고, transcript 대신 의도, 제약, 결정만 남긴다.
- `handoff.md`의 `## Conversation Context`도 같은 내용을 사람용으로 3-5개 bullet 안에 압축한다.
- 실험 로그와 probe 증거는 계속 `findings.md`에만 둔다.

## Evidence Tags

- `hypothesis`: 아직 증거가 부족한 해석
- `observed`: probe에서 관측됐지만 의미 해석이 덜 끝난 사실
- `confirmed`: 재현 경로와 근거가 있는 사실
- `failed`: 시도했지만 유효한 경로가 아니었던 실험

## Promotion Rule

아래 조건을 모두 만족해야 `docs/reverse-engineering.md`로 승격한다.

- 재현 가능한 probe 또는 example 경로가 있다.
- object path, command sequence, 또는 data shape가 명시돼 있다.
- downstream track이 바로 재사용 가능한 수준으로 서술돼 있다.
