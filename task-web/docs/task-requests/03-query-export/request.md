# 03 Query Export

## Goal

structured read 결과를 기반으로 search, Markdown export, structured JSON export 규칙을 정리한다. 이 track은 Hancom 내부 object를 더 파고들기보다, 읽은 모델을 어떻게 질의하고 외부 포맷으로 바꿀지 정의한다.
`task-web.md` 기준으로는 `Search text`, `Export to Markdown`, bonus의 `structured JSON with all formatting metadata`를 직접 만족시키는 것이 목적이다.
이 track은 mutation owner가 아니며, `Find and replace` 같은 write capability의 verification semantics만 보조한다.

## In Scope

- 검색 offset, context window, paragraph/page context 규칙
- Markdown heading, bold/italic, table, image 변환 규칙
- structured JSON export shape 초안
- pure helper test fixture 요구사항 정리

## Out Of Scope

- Hancom 내부 runtime object path 추가 탐색
- write command path 탐색
- cursor navigation 구현

## Owned Files

- `docs/task-requests/03-query-export/*`
- `src/hancom/discovery/03-query-export/*`
- `examples/discovery/03-query-export/*`
- `tmp/discovery/03-query-export/*`

## Probe Checklist

- search 결과에 필요한 최소 metadata를 정리한다.
- Markdown에서 보존할 formatting과 손실 허용 범위를 정리한다.
- JSON export의 top-level shape와 node-level 필드를 정리한다.
- 현재 sample fixture로 검증 가능한 pure helper 시나리오를 정리한다.

## Subtasks

### `search-semantics`

- match boundary, context window, paragraph / page association 규칙을 고정한다.
- replace verification에 재사용 가능한 search acceptance를 제공한다.

### `markdown-export`

- heading, inline emphasis, table, image export 규칙과 warning policy를 정리한다.
- upstream read fidelity가 부족한 경우 blocker를 명시한다.

### `json-export`

- structured JSON top-level shape와 node schema를 정리한다.
- unsupported metadata는 placeholder가 아니라 blocker 또는 optional field로 남긴다.

## Success Criteria

- `02-read` 결과만 있으면 search/export helper 구현이 가능한 수준의 규칙 문서가 있다.
- Markdown과 JSON export의 손실/경고 정책이 명시돼 있다.
- pure test 케이스 후보가 정리돼 있다.
- search 규칙이 query match, surrounding context, paragraph association acceptance를 직접 커버한다.
- Markdown 규칙이 heading, bold/italic, table, image acceptance를 직접 커버하거나, 미충족 시 upstream blocker를 명시한다.
- JSON export 규칙이 `02-read/normalized-snapshot` dependency를 전제로 하고, snapshot이 잠기기 전까지 미정 필드를 blocker로 유지한다.

## Handoff Contract

- 규칙은 input node shape와 output example을 함께 적는다.
- search는 match boundary, context window, paragraph association을 같이 적는다.
- export는 lossy conversion일 경우 경고 조건을 명시한다.
- write verification에 재사용되는 규칙은 capability dependency까지 같이 적는다.
