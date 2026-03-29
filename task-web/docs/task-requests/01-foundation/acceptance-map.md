# 01 Foundation Acceptance Map

이 문서는 `task-web.md`의 required / bonus capability를 owner track, verification dependency, runtime evidence 관점으로 묶어 둔 foundation-owned audit 문서다.
기능 구현의 완료 판정은 각 owner track이 담당하고, foundation은 exact runtime 근거와 coverage mapping만 감사한다.

## Audit Policy

- foundation은 다른 track의 구현 correctness 전체를 승인하지 않는다.
- foundation은 아래 항목만 감사한다.
  - 각 요구사항이 owner track과 subtask를 가진다.
  - exact runtime path 또는 command surface와 연결되는 증거가 있다.
  - verification dependency가 명시돼 있다.
  - fallback이 완료 capability처럼 서술되지 않는다.
- downstream이 foundation-confirmed 사실과 다른 해석을 쓰려면 repro 또는 evidence를 추가해야 한다.

## Required Capabilities

| Capability | Owner | Subtask | Verification Dependency | Foundation Audit Focus |
| --- | --- | --- | --- | --- |
| Read the full document text | `02-read` | `normalized-snapshot` | direct read-path from `HwpApp.document.Svr.G0i -> tdi` | text-chain root와 paragraph boundary 근거 유지 |
| Read document structure | `02-read` | `rich-structure` | paragraph / table / image discriminator evidence | paragraph-only fallback을 구조 완료로 오인하지 않기 |
| Read formatting | `02-read` | `style-semantics` | char-style / para-style mapping evidence | `Y5n`, `$5n`, `Csi` 해석 근거 유지 |
| Search text | `03-query-export` | `search-semantics` | `02-read/normalized-snapshot` 또는 exact text read-path | search가 자체 read fallback을 숨기지 않기 |
| Export to Markdown | `03-query-export` | `markdown-export` | `02-read/normalized-snapshot` | heading / inline emphasis / table / image blocker 명시 |
| Type text | `04-write` | `core-write` | command trace 또는 keyboard fallback evidence | exact command와 fallback을 구분해서 서술 |
| Find and replace | `04-write` | `core-write` | `03-query-export/search-semantics` for verification | replace trigger path와 verification path를 분리 |
| Create a table | `04-write` | `table-write` | `02-read/rich-structure` for read-back | write command와 table read-back dependency를 같이 기록 |
| Fill table cells | `04-write` | `table-write` | `02-read/rich-structure` for cell read-back | caret / cell navigation precondition과 read-back dependency 유지 |
| Save the document | `04-write` | `core-write` | dirty-state creation + reload/read-back verification | save command trace와 shortcut fallback 구분 |

## Bonus Capabilities

| Capability | Owner | Subtask | Verification Dependency | Foundation Audit Focus |
| --- | --- | --- | --- | --- |
| Navigate to a specific page number | `04-write` | `nav-media-write` | `02-read/rich-structure` page fact | page command claim이 page boundary evidence와 연결되는지 확인 |
| Insert/delete table rows | `04-write` | `table-write` | `02-read/rich-structure` table context | selection precondition과 row diff verification 명시 |
| Read paragraph style | `02-read` | `style-semantics` | para-style exact field mapping | `lineSpacing`, `alignment`를 근거 수준에 맞게 구분 |
| Insert images | `04-write` | `nav-media-write` | `02-read/rich-structure` + `03-query-export/markdown-export` | image insert command와 image node/export read-back dependency 유지 |
| Export structured JSON with all formatting metadata | `03-query-export` | `json-export` | `02-read/normalized-snapshot` | JSON shape가 unsupported field를 확정하지 않도록 감사 |

## Cross-Track Risks

- table 계열 capability는 `04-write` 단독으로 완료되지 않는다. `02-read/rich-structure`가 table discriminator와 read-back shape를 제공해야 한다.
- image insert는 `04-write` command path만으로는 충분하지 않다. `02-read`가 image node를 복원하고 `03-query-export`가 export 정책을 반영해야 한다.
- page navigation은 `04-write` command path와 `02-read` page boundary fact가 함께 필요하다.
- find-and-replace는 실행 owner가 `04-write`지만 verification semantics는 `03-query-export`가 제공한다.
- structured JSON export는 owner가 `03-query-export`지만 input contract는 `02-read/normalized-snapshot`이 먼저 잠겨야 한다.
