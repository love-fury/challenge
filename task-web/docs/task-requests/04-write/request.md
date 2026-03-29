# 04 Write

## Goal

cursor 기준 편집을 어떤 command path 또는 keyboard fallback으로 수행할지 찾는다. text input, replace, table/image/page/save를 operation 단위로 분해해서 command surface와 실패 모드를 정리한다.
`task-web.md` 기준으로는 `Type text`, `Find and replace`, `Create a table`, `Fill table cells`, `Save the document`를 required acceptance로, `Navigate to a specific page number`, `Insert images`, `Insert/delete table rows`를 bonus acceptance로 본다.
table / image / page 계열 acceptance는 `02-read`의 read-back fact와 `03-query-export`의 verification semantics에 의존할 수 있음을 명시적으로 다룬다.

## In Scope

- `ActionManager` / `UIAPI` command mapping
- 메뉴 interaction과 internal command의 상관관계 추적
- text input, replace, table create/fill, image insert, page navigate, save fallback matrix
- command 실패 시 keyboard fallback 조건 정리

## Out Of Scope

- 문서 구조 복원
- Markdown/JSON export 규칙
- 공용 SDK method 통합

## Owned Files

- `docs/task-requests/04-write/*`
- `src/hancom/discovery/04-write/*`
- `examples/discovery/04-write/*`
- `tmp/discovery/04-write/*`

## Probe Checklist

- 메뉴 동작 전후 `ActionManager`와 `UIAPI` 호출 흔적을 기록한다.
- text input, replace, table create/fill, image insert, page 이동, save의 command 후보를 분류한다.
- command path가 없을 때 가능한 keyboard fallback을 정의한다.
- operation별 precondition과 failure mode를 정리한다.

## Subtasks

### `core-write`

- `typeText`, `replaceAll`, `save`를 다룬다.
- exact command path와 keyboard fallback을 분리해서 기록한다.

### `table-write`

- `insertTable`, `fillTableCells`, bonus `insert/delete table rows`를 다룬다.
- table selection, caret 위치, read-back dependency를 같이 정리한다.

### `nav-media-write`

- bonus `goToPage`, `insertImage`를 다룬다.
- dialog open trace와 실제 confirm / dispatch trace를 분리해서 기록한다.

## Success Criteria

- operation별 command candidate와 fallback matrix가 있다.
- 최소 1개의 repro 가능한 write-side probe 또는 example이 남아 있다.
- 공용 SDK 통합 전에 필요한 shared change 목록이 분리돼 있다.
- required write capability 각각에 대해 trigger path, expected effect, fallback, verification 방법이 명시돼 있다.
- table / image / page 계열은 `02-read` read-back dependency, replace는 `03-query-export` verification dependency가 명시돼 있다.

## Handoff Contract

- operation 단위로 `candidate`, `trigger`, `expected effect`, `risk`, `fallback`을 같이 적는다.
- command 이름만 남기지 말고, 어떤 UI action과 연결됐는지 증거를 함께 남긴다.
- 실패 모드는 user-facing error 메시지 초안까지 함께 적는다.
- verification이 다른 track에 의존하면 dependency를 같이 적는다.
