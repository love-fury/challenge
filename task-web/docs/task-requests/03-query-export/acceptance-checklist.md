# 03 Query Export Acceptance Checklist

## Acceptance Mapping

- `Search text`
  - canonical surface offset이 정의돼 있다.
  - context window 규칙이 정의돼 있다.
  - paragraph/table/image association 경로가 정의돼 있다.
  - page association은 optional이며 upstream blocker를 명시했다.
- `Export to Markdown`
  - heading level rule이 정의돼 있다.
  - bold/italic marker rule이 정의돼 있다.
  - table/image rendering rule이 정의돼 있다.
  - lossy formatting warning policy가 정의돼 있다.
- `structured JSON with all formatting metadata`
  - discovery snapshot envelope와 node-level raw metadata preservation rule이 정의돼 있다.
  - exact read-path 미확정 field는 optional+raw 병행 규칙으로 관리한다.

## Pure Helper Fixture Candidates

- paragraph with heading + bold text only
- paragraph with mixed inline runs: plain / italic / bold / bold+italic
- two paragraphs on different `pageIndex`
- table with formatted header cells and one ragged row
- image with `altText`, `caption`, and `source`
- image with missing `source`
- paragraph carrying non-Markdown formatting (`color`, `alignment`, `lineSpacing`)
- paragraph with run text mismatch against full paragraph text

## Pure Test Scenario Candidates

- search is case-insensitive by default and returns canonical offsets
- search can anchor a match to paragraph metadata
- search can anchor a match to table cell metadata
- search marks `crossedSeparator=true` when a query spans `\t` or `\n`
- Markdown export renders heading, bold, italic, table, and image
- Markdown export emits warnings for non-Markdown formatting and missing image source
- Markdown export falls back when inline run text does not reconstruct the full paragraph
- structured JSON export preserves raw evidence fields unchanged

## Current Blockers From Upstream

- inline run exact semantics are not finalized in `02-read`
- table/image discriminator is not confirmed from live read-path
- page boundary exact path is still candidate-only

이 blocker들이 남아 있는 동안 `03-query-export`는 discovery helper와 rule 문서 수준에서 acceptance를 준비하고, public SDK contract는 동결하지 않는다.
