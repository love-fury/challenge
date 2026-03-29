# Discovery Board

Coordinator-owned file. Worker는 직접 수정하지 않는다.

## Current Mode

- phase: discovery
- coordination: 4 tracks + in-track subtasks
- write-scope: docs + probes
- promotion-target: `docs/reverse-engineering.md`
- shared-freeze: `src/HancomDocsClient.ts`, `src/models/types.ts`, `src/hancom/HancomBridge.ts`

## Tracks

| Track | Goal | Upstream | Downstream | Status | Owner | Last Update | Promotion |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `01-foundation` | runtime inventory, command surface, acceptance coverage audit | none | `02-read`, `03-query-export`, `04-write` | live-confirmed | coordinator | 2026-03-29 | ready |
| `02-read` | text-chain, style mapping, normalized snapshot, rich structure | `01-foundation` | `03-query-export`, `04-write` | inline-run-probed | unassigned | 2026-03-29 | pending |
| `03-query-export` | search semantics, Markdown, JSON export rules | `02-read` | none | discovery-artifacts-added | unassigned | 2026-03-29 | pending |
| `04-write` | input, replace, table/image/page/save command path | `01-foundation`, `02-read` | none | completed | codex | 2026-03-29 | ready |

## Subtasks

- `01-foundation`
  - `acceptance-map`: 요구사항별 owner, verification dependency, runtime evidence map 유지
  - `runtime-audit`: downstream이 foundation-confirmed object path와 모순되지 않는지 감사
  - `command-audit`: write-side command claim이 traced surface와 연결되는지 감사
- `02-read`
  - `normalized-snapshot`: downstream 공용 read contract 정의
  - `rich-structure`: table / image / page discriminator 확보
  - `style-semantics`: inline run, bold / italic / alignment 의미 해석
- `03-query-export`
  - `search-semantics`: offset, context, paragraph / page association 규칙
  - `markdown-export`: heading / inline emphasis / table / image export 규칙
  - `json-export`: structured JSON top-level shape와 warning / blocker 정책
- `04-write`
  - `core-write`: type text, replace, save
  - `table-write`: insert table, fill cells, row insert / delete
  - `nav-media-write`: go to page, insert image

## Foundation Audit Limits

- `01-foundation`은 downstream 구현의 최종 correctness owner가 아니다.
- foundation은 exact runtime path, command surface, acceptance coverage mapping만 감사한다.
- 기능 acceptance와 user-facing 완료 판정은 owner track이 유지한다.

## Coordinator Checklist

- 각 track의 `status.json`에서 blocker와 `ready_for_promotion`을 확인한다.
- foundation acceptance map과 subtask dependency를 최신 상태로 유지한다.
- `handoff.md`에 있는 cross-track 요청을 upstream/downstream에 반영한다.
- confirmed 사실만 `docs/reverse-engineering.md`로 승격한다.
- shared file 변경이 필요한 경우 별도 통합 task로 승격한다.
