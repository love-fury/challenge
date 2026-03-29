# 03 Query Export Handoff

## Conversation Context

- 사용자는 `03-query-export`를 문서가 아니라 실제 코드 경로 기준으로 점검하길 원했고, 미완료 항목을 우선순위 순서로 처리하길 요청했다.
- 현재 결정은 discovery helper를 그대로 방치하지 않고, 공개 SDK search/Markdown/structured JSON 경로에 adapter로 연결하는 것이다.
- 다만 exact read fidelity blocker는 그대로 기록한다. public wiring이 됐다고 해서 upstream `02-read` 미확정 해석을 확정 사실로 승격하지 않는다.
- 기록은 계속 짧게 유지하되, 이번 handoff에는 실제 통합 완료 범위와 남은 blocker를 분리해서 적는다.

## To Downstream

- discovery-only helper entrypoint:
  - `src/hancom/discovery/03-query-export/queryExport.ts`
  - canonical search surface builder, anchored search result, Markdown export, structured JSON export를 재현 가능하게 제공한다.
- public wiring:
  - `src/utils/queryExport.ts`
  - `src/utils/search.ts`
  - `src/utils/markdown.ts`
  - `src/utils/json.ts`
  - `src/operations/search.ts`
  - `src/operations/markdown.ts`
  - `src/operations/json.ts`
  - `src/HancomDocsClient.ts`
  - 현재 `HancomDocsClient.search()` / `exportMarkdown()` / `exportJson()`는 query-export snapshot adapter를 경유한다.
- repro fixture / example:
  - `examples/discovery/03-query-export/sampleSnapshot.ts`
  - `examples/discovery/03-query-export/query-export-report.ts`
  - sample output: `tmp/discovery/03-query-export/query-export-report.txt`
- tests:
  - `tests/queryExport.test.ts`
  - public search anchor metadata, separator-crossing search, Markdown loss warning, structured JSON raw evidence preservation을 직접 검증한다.
- 문서 규칙:
  - `semantics.md`: canonical text assembly, offset/context, anchor path, boundary semantics
  - `export-rules.md`: Markdown/JSON preservation 범위와 warning policy
  - `acceptance-checklist.md`: acceptance 매핑과 fixture/test 후보
- public SDK integration 전제:
  - adapter wiring은 완료됐지만, exported metadata의 exactness는 여전히 `02-read` snapshot 품질에 묶여 있다.
  - `exportJson()`는 이제 structured JSON envelope를 반환한다. raw `HancomDocument`는 내부 bridge read 결과로만 남아 있다.
  - `02-read`가 inline runs / table-image discriminator / page boundary를 확정하면 현재 adapter의 provisional field를 다시 조여야 한다.

## Needs From Upstream

- `02-read`: normalized snapshot에 최소 `node kind`, `page index`, `paragraph formatting`, `inline runs`, `table cell formatting`, `image metadata`가 어떤 수준까지 들어오는지 정리 필요.
- `02-read`: inline run exact semantics와 `rawCsi` 해석이 확정돼야 Markdown bold/italic export를 discovery helper에서 public helper로 승격할 수 있다.
- `02-read`: table/image exact discriminator가 확정돼야 `Search text`, `Export to Markdown`, structured JSON export의 acceptance를 provisional이 아니라 confirmed로 바꿀 수 있다.
- `02-read`: page boundary exact path가 확정돼야 현재 adapter의 page metadata를 stable contract로 승격할 수 있다.
