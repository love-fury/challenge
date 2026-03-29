# 04 Write Operation Matrix

## Evidence Sources

- Runtime menu catalog: `src/hancom/discovery/04-write/writeOperationCatalog.ts`
- Trace hook: `src/hancom/discovery/04-write/pageWriteTrace.ts`
- Live repro: `examples/discovery/04-write/trace-operation.ts`
- Captured evidence: `tmp/discovery/04-write/write-surface-catalog.json`, `tmp/discovery/04-write/write-operation-traces.json`

## Required Acceptance

| Capability | Primary trigger candidate | Observed evidence | Preconditions | Current SDK fallback | Verification path | Status |
| --- | --- | --- | --- | --- | --- | --- |
| Type text | raw CDP `Input.insertText` at current caret | current bridge already inserts text without UI command mapping | caret must already be inside editable text surface | same as primary | type into focused editor and confirm text-chain diff on read side | `implemented`, command path still unmapped |
| Find and replace | menu dataset `uiCommand=show`, `uiValue=dialog_find_replace` | dialog fill + `문서 전체` + `모두 바꾸기` executed live; alert returned `바꾸기를 1번 했습니다.` and text-chain mutation was confirmed before undo | editable document, replace target text known | `replaceAll()` now replays the confirmed dialog flow and returns the alert text / replacement count when available | run replace-all helper, confirm alert text, confirm text-chain changed, then undo | `implemented in SDK` |
| Create a table | menu dataset `uiCommand=show`, `uiValue=dialog_insert_table` | `2 x 2` dialog submit closed cleanly and immediately enabled `dialog_edit_table` and `c_insert_row_col_list` commands | caret must be in insertable text context | `insertTable()` now replays the confirmed dialog flow and returns the requested dimensions | open dialog, set row/col, click `만들기`, then confirm table command surfaces are enabled | `implemented in SDK` |
| Fill table cells | keyboard `Tab` traversal after first cell focus | table create leaves active table context; `c_insert_row_col_list` becomes enabled, which confirms cell/table focus precondition is established after creation | table must already exist and caret must already be in first cell | `fillTableCells()` uses `Input.insertText + Tab`; it still depends on the first cell focus precondition | create disposable table, rely on `Input.insertText + Tab`, then verify exact cell text once read-side table path exists | `conditional on exact cell read-back` |
| Save the document | keyboard `Cmd/Ctrl+S`, menu command `d_save` | `Cmd+S` traces `ActionManager.Tbr(-1, false)` twice; save menu surface exists and can be disabled when clean | focused editor tab | `save()` sends the shortcut path after hook lookup and returns the save timestamp plus observed before/after save-command state when available | mutate document, invoke save, then reconnect and confirm read-back matches the pre-disconnect saved text (`example:verify-save`) | `implemented in SDK` |

## Bonus Acceptance

| Capability | Primary trigger candidate | Observed evidence | Preconditions | Verification path | Status |
| --- | --- | --- | --- | --- | --- |
| Navigate to page | menu dataset `uiCommand=show`, `uiValue=dialog_goto` | selecting page `9` and clicking `가기` moved `#hcwoViewScroll.scrollTop` from `102` to `8340`; dialog closed afterwards | page list must already be populated by runtime | `gotoPage()` now replays the confirmed dialog flow and returns before/after scroll offsets | fill page number, click `가기`, then compare `#hcwoViewScroll.scrollTop` before/after | `implemented in SDK` |
| Insert images | menu dataset `uiCommand=show`, `uiValue=dialog_insert_image` plus raw CDP `DOM.setFileInputFiles` | local file dialog input can be marked in page context, populated through raw CDP, then submitted through the existing `넣기` confirm path | readable local file path required | `insertImage({ path })` now uses the confirmed file-upload flow and returns the resolved file path | 2026-03-29 live round-trip on target `5F78070AC295BA2AC39D866662823F43`: inserting `tmp/manual-test/grid-64.png` increased `readStructure()` image blocks `7 -> 8`, and `exportMarkdown()` emitted `![image 26.png](blob:...)` for the new block | `implemented and live-verified` |
| Insert/delete table rows | menu command `c_insert_row_col_list` / `c_remove_row_col_list` with `value=insert_upper_row|insert_lower_row|insert_left_col|insert_right_col|remove_row|remove_col` | after table creation, submenu entries became enabled; `insert_lower_row` click produced distinct action id `35474` (`PPt/LPt/yNt`) | live table selection required | `insertTableRow({ position, count? })` and `deleteTableRow({ count? })` now replay the enabled row commands against the active table selection | trace while caret is inside table, then verify action id and still-enabled table context; exact row-count read-back still depends on `02-read` | `implemented with active-selection limit` |

## User-Facing Failure Modes

- `typeText`: `"Current caret is not inside the Hancom editor text surface."`
- `replaceAll`: `"Replace-all requires a non-empty find string and an editable document; the SDK now replays the confirmed dialog flow."`
- `insertTable`: `"Table creation requires a positive size and an insertable caret context; the SDK now replays the confirmed dialog flow."`
- `fillTableCells`: `"Table cell fill still depends on a pre-existing focused first cell, and exact cell text read-back is not confirmed."`
- `save`: `"Save depends on a focused editor tab and the keyboard shortcut path; persistence should be verified on a disposable document copy by reconnecting and comparing read-back text."`
- `gotoPage`: `"Go-to-page requires a populated page list; verification currently depends on scroll container movement rather than exact page-boundary read facts."`
- `insertImage`: `"Image insertion requires a readable file path and an image dialog that can expose a usable file input."`
- `insertTableRow`: `"Row insertion requires an active table-cell selection and an explicit relative position (`above` or `below`)."`
- `deleteTableRow`: `"Row deletion requires an active table-cell selection because exact row addressing is not exposed yet."`

## Integration Notes

- Public SDK now promotes `replaceAll()`, `insertTable()`, `gotoPage()`, `insertImage({ path })`, `insertTableRow({ position, count? })`, and `deleteTableRow({ count? })`.
- `fillTableCells()` is still a keyboard traversal helper and should keep the first-cell focus precondition explicit.
- `save()` can already use `Cmd/Ctrl+S` as the primary reliable fallback, and `example:verify-save` now exercises the recommended acceptance path on a disposable document copy by reconnecting and comparing `readText()`.
- `gotoPage()` can verify effect with `#hcwoViewScroll.scrollTop` until read-side block page boundaries are promoted, and the SDK now also reports `resolvedPageNumber` from `HwpApp.hwpCaret.uIs.b8t` plus visible page-option hints from the goto dialog.
- `insertTableRow()` and `deleteTableRow()` currently operate on the active table selection only; exact table/row addressing should not be claimed until the read-side mapping exists.
