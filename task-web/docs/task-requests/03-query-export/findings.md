# 03 Query Export Findings

Append-only log. 각 항목은 날짜와 `hypothesis` / `observed` / `confirmed` / `failed` 태그를 포함한다.

## 2026-03-29

- `confirmed`: track initialized. Search/export 규칙과 pure helper 요구사항을 이 디렉터리에서 관리한다.
- `observed`: `searchDocument()`는 `bridge.readText()` 결과 전체 문자열에 대해 `findTextMatches()`를 적용한다. 현재 검색 semantics는 plain text, case sensitivity, fixed context window뿐이다.
- `observed`: `documentToMarkdown()`은 paragraph heading/bold/italic, plain table rows, image source/altText만 렌더링한다. inline style run, alignment, color, page boundary는 아직 반영되지 않는다.
- `observed`: 현재 fixture/test는 paragraph/table/image 변환과 단순 text search만 검증한다. 구조 fidelity가 올라가도 이를 수용할 normalized snapshot test fixture는 아직 없다.
- `next`: upstream이 안정화되면 paragraph 내부 inline runs, page index, table cell formatting, image metadata가 포함된 fixture와 export/search test를 추가해야 한다.
- `confirmed`: `docs/task-requests/03-query-export/semantics.md`, `export-rules.md`, `acceptance-checklist.md`를 추가해 canonical search surface, match association, Markdown/JSON export, warning/blocker 정책을 문서화했다.
- `confirmed`: `src/hancom/discovery/03-query-export/` 아래에 discovery-only normalized snapshot helper를 추가했다. `searchSnapshot()`은 paragraph/table/image anchor path와 optional page metadata를 반환하고, `exportSnapshotToMarkdown()` / `exportSnapshotToJson()`은 loss/warning 정책을 구현한다.
- `confirmed`: `examples/discovery/03-query-export/sampleSnapshot.ts`와 `query-export-report.ts`를 추가했다. `npx tsx examples/discovery/03-query-export/query-export-report.ts --query hancom --context 12` 실행 결과를 `tmp/discovery/03-query-export/query-export-report.txt`에 남겼다.
- `observed`: sample fixture 기준 search 결과는 `paragraph:1`와 `table:0/row:1/cell:1` anchor를 각각 반환했다. page association은 fixture metadata가 있을 때만 채워진다.
- `observed`: sample fixture 기준 Markdown export는 heading/bold/italic/table/image를 렌더링했고, `fontName`, `fontSize`, `color`, `alignment`, `lineSpacing`, ragged table에 대해 warning을 남겼다.
- `confirmed`: track-local `npx eslint src/hancom/discovery/03-query-export examples/discovery/03-query-export`는 통과했다.
- `observed`: repo-wide `npm run test`는 통과했다. `npm run typecheck`와 `npm run lint`는 각각 `02-read/styleSemanticProbe.ts`, `01-foundation/textChainDiscriminatorProbe.ts`의 기존 오류로 아직 green이 아니다. 이번 track 파일에서는 추가 오류를 남기지 않는 방향으로 정리했다.
- `confirmed`: public integration step을 진행했다. `src/utils/queryExport.ts`에서 `HancomDocument -> QueryExportSnapshot` 어댑터를 추가했고, `src/utils/search.ts`, `src/utils/markdown.ts`, `src/utils/json.ts`, `src/HancomDocsClient.ts`가 이제 query-export helper를 실제 SDK 경로에서 사용한다.
- `confirmed`: public search 결과는 기존 `blockId/blockIndex`를 유지하면서 `anchorPath`, `anchorNodeKind`, `paragraphIndex/tableIndex/rowIndex/cellIndex`, `crossedNodeBoundary`, `crossedSeparator`를 함께 반환하도록 확장했다.
- `confirmed`: public JSON export는 raw `readDocument()` passthrough가 아니라 structured envelope(`schemaVersion`, `generatedAt`, `nodeCount`, `warnings`, `provenance`, `nodes`)를 반환하도록 바뀌었다.
- `confirmed`: `tests/queryExport.test.ts`를 추가해 paragraph/table anchor, separator-crossing search, Markdown warning/fallback, structured JSON raw evidence preservation을 검증한다.
- `observed`: 현재 `npm run test`는 통과한다. 이번에 수정한 파일 범위에 대한 `npx eslint ...`도 통과했다. repo-wide `npm run typecheck` / `npm run lint`는 여전히 `src/hancom/HancomBridge.ts`, `src/hancom/pageFunctions.ts`의 기존 오류로 green이 아니다.
- `confirmed`: public SDK search/Markdown/structured JSON 경로를 `03-query-export` helper 기반 adapter로 연결했다. `HancomDocsClient.search()` / `exportMarkdown()`는 query-export snapshot adapter를 타고, `exportStructuredJson()`을 추가해 structured JSON envelope를 공개 surface에서 직접 반환한다.
- `confirmed`: `tests/queryExport.test.ts`를 추가해 paragraph/table anchor, separator-crossing search, Markdown loss warning, structured JSON raw evidence preservation을 직접 검증한다. 현재 `npm run test`는 green이다.
- `observed`: 현재 repo-wide `npm run typecheck`와 `npm run lint` red는 `src/hancom/pageFunctions.ts` 기존 오류에만 남아 있다. 이번 track 변경 파일에서는 추가 type/lint 오류를 남기지 않았다.
- `observed`: public SDK integration은 adapter 단계까지 올라왔지만, exported metadata fidelity는 여전히 upstream `02-read` snapshot 품질에 종속된다. inline run exact semantics, table/image discriminator, page boundary exact path가 잠기기 전까지 일부 field는 provisional이다.
