# Architecture

## Objective

Build a TypeScript SDK that attaches to an already-running Chrome instance, finds a Hancom Docs editor tab, and exposes high-level document read/write operations over raw Chrome DevTools Protocol.

## Key Technical Insight

Hancom Docs renders the editor on `<canvas>`, but the document is still present in page-runtime objects. The practical breakthrough is not DOM scraping; it is `Runtime.evaluate` into `HwpApp` internals.

The current canonical read path is:

- structured document snapshot: `HwpApp.document.aPt().ENt().save("hwpjson20;")`
- paragraph text and run boundaries: `ro[*].tx` and `ro[*].tp`
- character formatting: `cp[*]`
- paragraph formatting: `pp[*]` and `st[*]`
- structured controls: `tx` embedded control tokens joined through `cs[objectId]`
- image assets: `cs[objectId].img.bi -> bi[*]`
- exact current page for the active caret: `HwpApp.hwpCaret.uIs.b8t`
- file insert: `dialog_insert_image -> <input type=\"file\"> -> DOM.setFileInputFiles -> insert confirm`

## Runtime Structure

1. `src/client`
   - discovers Chrome targets from the remote debugging endpoint
   - opens the page WebSocket
   - sends raw CDP commands such as `Runtime.evaluate`, `Input.dispatchKeyEvent`, and mouse events
2. `src/hancom`
   - runs page-context probes against `HwpApp`
   - installs an SDK-owned `__HANCOM_AUTOMATION__` bridge on `connect()` for supported write helpers
   - centralizes confirmed runtime paths in the bridge/page functions
   - normalizes the `hwpjson20` runtime snapshot into `HancomDocument`, paragraph/table/image blocks, and formatting summaries
3. `src/operations`
   - builds challenge-facing features such as search, Markdown export, replace, table write helpers, and save
   - keeps browser interaction at raw CDP level, including DOM-backed file upload for images

## Reading Approach

The live Hancom page does not expose a native `__HANCOM_AUTOMATION__` hook. `HancomDocsClient.connect()` still installs the SDK-owned bridge for supported write helpers, but read-side canonical data now comes directly from the runtime `hwpjson20` serializer. Production `readDocument()` evaluates `save("hwpjson20;")` and joins:

- `fontName`: `cp[*].f1..f7`
- `fontSize`: `cp[*].he / 100`
- `bold`: `cp[*].bo`
- `italic`: `cp[*].it`
- `color`: `cp[*].tc` with Hancom BGR-to-RGB conversion
- `lineSpacing`: `pp[*].lv / 100`
- `alignment`: preserved as a raw candidate until `pp[*].ah` enum mapping is confirmed

`probeDocumentTextChain()` remains available for discovery and debugging, but it is no longer part of the production read success path.

## Limitations

- exact `hwpjson20` table row/cell payload semantics are newer than the legacy text-chain probes, so row/cell extraction should still be treated as an exact-parser surface that needs live regression coverage.
- table semantic work is now tracked with a dedicated probe that snapshots `z5n` structure together with current `z0i/_ie -> o6n.zli` joins during live `Tab` and `Shift+Tab` walks.
- Exact block-level page boundaries remain bonus-only. The SDK can now read the active caret page exactly via `HwpApp.hwpCaret.uIs.b8t`, but it does not yet populate `block.pageRange`.
- Loaded image assets in `bi` are not automatically document images; only direct control-token joins through `cs[objectId].img.bi` become `ImageBlock`s.
- image insertion is file-only in the public SDK surface.

## Validation

- unit tests cover pure transforms such as Markdown rendering, search helpers, and document summaries
- live validation uses example scripts against a real Chrome CDP target
- confirmed runtime paths and failures are recorded in `docs/reverse-engineering.md`
