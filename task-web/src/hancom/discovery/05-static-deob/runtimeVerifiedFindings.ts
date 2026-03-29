/* eslint-disable max-lines */
import type { StaticVerifiedFinding } from "./model.js";

export const STATIC_RUNTIME_VERIFIED_FINDINGS: StaticVerifiedFinding[] = [
  {
    key: "document-model-core",
    kind: "runtime-join",
    capability: "read/write model join",
    summary:
      "Document ctor `To` owns `Ivr = new qs(this)` and `Svr = new lh(this)`. `qs` is the style/resource registry aggregate and `lh extends rr` is the root branch/container that backs the runtime text-chain.",
    staticEvidence: [
      {
        path: "tmp/discovery/05-static-deob/full-mirror-doc1-all/readable/modules/chunks/431/6971.module.js",
        symbols: ["To", "qs", "lh", "rr"],
        note:
          "`To.cvr()` assigns `this.Ivr = new qs(this)` / `this.Svr = new lh(this)`; `qs` owns `Y5n/$5n/u6n/o6n`; `lh` extends `rr` and owns `_ie`."
      }
    ],
    runtimeEvidence: [
      "`window.HwpApp.document` exists live and matches the `To` surface shape.",
      "Read probes already resolve paragraph text from `document.Svr.G0i` and formatting registries from `document.Ivr.Y5n/$5n`."
    ],
    unresolved: []
  },
  {
    key: "caret-layout-wrapper",
    kind: "runtime-join",
    capability: "read caret/page geometry",
    summary:
      "`hwpCaret.AMe` is `lr`, not `Gn`. The inheritance chain is `Gn -> le -> ce -> lr`, where `lr` carries page/line/layout cache and serializes caret geometry.",
    staticEvidence: [
      {
        path: "tmp/discovery/05-static-deob/full-mirror-doc1-all/readable/modules/chunks/431/6971.module.js",
        symbols: ["Gn", "le", "ce", "lr", "_d"],
        note:
          "`_d.Kys()` sets `this.AMe = new lr()`; `Gn` owns `Eni/Cni`; `lr.f9i()` emits page/rect payload fields."
      }
    ],
    runtimeEvidence: [
      "`pageReadCaretState()` successfully reads `hwpCaret.AMe.Eni/Cni` and current page state from the live editor.",
      "Page/caret probes stay coherent while moving across inserted table cells."
    ],
    unresolved: []
  },
  {
    key: "paragraph-read-serializer-stack",
    kind: "read",
    capability: "read text + formatting payload",
    summary:
      "The high-signal serializer stack is `ts.HOn/POn/LOn/ufr` for paragraph text and run boundaries, plus `ts.FHn/UHn/GHn` and `Ub.Save/DXs` for formatted fragment JSON.",
    staticEvidence: [
      {
        path: "tmp/discovery/05-static-deob/full-mirror-doc1-all/readable/modules/chunks/431/6971.module.js",
        symbols: ["ts.HOn", "ts.POn", "ts.LOn", "ts.ufr", "ts.FHn", "ts.UHn", "Ub.Save", "Ub.DXs"],
        note:
          "`HOn` extracts text, `POn` char-shape segments, `LOn` control runs, `FHn/UHn` emit shape JSON, and `Ub.Save()` packages formatted fragment snapshots."
      }
    ],
    runtimeEvidence: [
      "Current SDK read helpers decode paragraph text from the live text-chain and map char/para style tables to font name, font size, bold/italic, color, and line spacing.",
      "Inserted bold/italic runs and paragraph style mutations show up immediately in the runtime style tables, matching the serializer-oriented static path."
    ],
    unresolved: [
      "Document-wide exact table/image reconstruction still needs to reuse the control/object portions of this serializer stack."
    ]
  },
  {
    key: "hwpjson20-table-cell-metadata-gap",
    kind: "gap",
    capability: "read table cells from hwpjson20",
    summary:
      "The `hwpjson20` table control payload does not carry cell text directly in `cs[tableId].ch`. Static serializer code shows that `tr`/`ch` are cell-address and geometry metadata only, so exact cell text must be recovered by following the table's `sl` paragraph graph instead.",
    staticEvidence: [
      {
        path: "tmp/discovery/05-static-deob/full-mirror-doc1-all/readable/modules/chunks/431/6971.module.js",
        symbols: ["ts.Lxn", "t.nkn"],
        note:
          "`ts.Lxn` serializes table controls into `tr` and `ch`; `t.nkn()` writes only `ac/ar/sc/sr/sw/sh`, which matches cell address/span and size metadata rather than paragraph text."
      }
    ],
    runtimeEvidence: [
      "Live `hwpjson20` snapshots expose table controls under `cs[controlId].tr/ch`, but sampled `ch[cellId]` entries only carry keys like `ac`, `ar`, `sc`, `sr`, `sw`, and `sh`.",
      "On the current logged-in document, `cs[tableId].tr[*][*].so` points into `snapshot.sl`, `sl[cellId].hp` points to the first paragraph node, and the linked `sl[paragraphId].tx/np` chain carries the actual cell paragraph content.",
      "A sampled first table cell resolved as `tr[0][0].so -> sl[cellId].hp -> sl[paragraphId].tx = '<0B/67736F20/...>'`, proving that cell text/object content lives in the `sl` paragraph graph rather than in `ch[cellId]`.",
      "Walking that chain across the current document resolved `5406/5406` table cells with no missing `hp` or `np` breakage."
    ],
    unresolved: [
      "The current parser still treats table cells as metadata-only; it must follow `tr[*].so -> sl[cellId].hp -> sl[paragraphId].np` to recover exact cell blocks."
    ]
  },
  {
    key: "hwpjson20-ro-sl-anchor-graph",
    kind: "read",
    capability: "read unified paragraph/table/image anchors from hwpjson20",
    summary:
      "The real `hwpjson20` anchor graph is not `ro` alone. Control markers are carried inside `tx` strings across both `ro` and `sl`, and `sl[cellId].hp -> sl[paragraphId].np` links recover nested paragraph order inside table cells and object-bearing sublists.",
    staticEvidence: [
      {
        path: "tmp/discovery/05-static-deob/full-mirror-doc1-all/readable/modules/chunks/431/6971.module.js",
        symbols: ["Ub.Save", "Ub.DXs", "ts.Lxn", "tr", "ch", "so", "li"],
        note:
          "The serializer stack emits paragraph `tx` payloads and table row/cell references; live `hwpjson20` snapshots surface those references as `tr[*].so/li` plus `sl/.../hp/np` paragraph chains."
      }
    ],
    runtimeEvidence: [
      "On the current live document, scanning all `tx` strings across `snapshot.ro` and `snapshot.sl` found control markers for every table and every image control in the file.",
      "The combined `ro + sl` scan referenced `75/75` table controls and `17/17` image controls via markers such as `<0B/74626C20/...>` and `<0B/67736F20/...>`.",
      "Sample image-bearing records came from both top-level paragraphs (`ro`) and nested sublists (`sl`), proving that `ro` alone is an incomplete source for document-order object anchors.",
      "For the current document, all top-level table references appeared in `ro` and no nested table references appeared in `sl`, while image-bearing records appeared in both scopes."
    ],
    unresolved: [
      "A canonical reader still needs to walk `ro` and nested `sl` paragraph chains in one stable document order rather than appending unanchored image blocks afterward."
    ]
  },
  {
    key: "fr-line-export-structure",
    kind: "read",
    capability: "read structure + markdown-oriented linear export",
    summary:
      "`document.F_r()` is a distinct line serializer, not the `hwpjson20` object serializer. It emits paragraph lines with style/list markers and table-cell addresses, making it the strongest current path for exact table cell text and Markdown-friendly ordering.",
    staticEvidence: [
      {
        path: "tmp/discovery/05-static-deob/full-mirror-doc1-all/readable/modules/chunks/431/6971.module.js",
        symbols: ["F_r", "us.xvn", "rs.rOn", "rs.yLn", "rs.xLn", "rs.YOn"],
        note:
          "`document.F_r()` instantiates `us`; `us.QAn()` builds `rs.pLn` and returns `rs.yLn(rs.pLn)`. `rs.xLn()` emits table `rowAddr/colAddr/rowSpan/colSpan` into clientInfo, and `rs.YOn()` serializes paragraph text lines for each addressed cell."
      }
    ],
    runtimeEvidence: [
      "Live `window.HwpApp.document.F_r('object:1;clientinfo:1;emptypara:0')` returned `5876` logical lines rather than plain text.",
      "Of those lines, `5589` carried table-cell parent markers and only `4` carried `;x...` textbox markers.",
      "The returned lines included markers like `<$p8:0;s바탕글 사본16;t4:0:0$>담당 부서`, proving that `F_r()` carries style markers (`;s...`) and table coordinates (`;t<tableId>:row:col`).",
      "Turning `clientinfo` off removed the `;t...:row:col` payload while keeping line text, confirming that the table addressing is an intentional serializer option rather than an incidental artifact.",
      "Static `rs.xLn()` calls `rs.DLn()` before walking cells, so serializer-local table names are consumed even for object slots that later emit no public lines under `emptypara:0`.",
      "On the current document, public table names ran as `t1..t7, t10..t75`; the missing `t8` and `t9` slots align with top-level `hwpjson20` table controls whose token paragraphs contain only the control marker and no emitted cell paragraphs.",
      "The observed `;x1`..`;x4` lines contained section-title textbox content such as `Ⅰ. 2025년 5월 청년층 부가조사 결과(요약)` rather than stable image markers."
    ],
    unresolved: [
      "`rs.DLn()` generates sequential object names such as `t1` and `x1`; these are serializer-local ids, not the original control ids from `hwpjson20`.",
      "`rs.xLn()` computes `rowSpan/colSpan`, but `rs.yLn()` does not expose them in the returned string; current public `F_r()` output gives exact row/col addresses but not exact spans.",
      "`;x...` lines are useful for textbox/title blocks on the tested document, but they do not provide a complete image-placement join on their own."
    ]
  },
  {
    key: "fr-table-text-path",
    kind: "read",
    capability: "read exact table cell text and markdown-friendly table order",
    summary:
      "`F_r()` is currently the strongest public surface for exact table cell text because it emits one logical line per paragraph with explicit `tableName:row:col` coordinates.",
    staticEvidence: [
      {
        path: "tmp/discovery/05-static-deob/full-mirror-doc1-all/readable/modules/chunks/431/6971.module.js",
        symbols: ["F_r", "rs.xLn", "rs.YOn", "rs.yLn"],
        note:
          "`rs.xLn()` resolves table address metadata for each paragraph and `rs.YOn()` emits the paragraph line that `rs.yLn()` later joins into the public `F_r()` string."
      }
    ],
    runtimeEvidence: [
      "Parsing the live `F_r()` output grouped the current document into `73` table-name buckets with usable row/col addresses and actual cell paragraph text.",
      "Early tables resolved cleanly, for example `t3` as row `0` with columns `0..3` and cell texts `보도시점`, `2025. 7. 24.(목) 12:00`, `배포`, `2025. 7. 24.(목) 08:30`.",
      "Multi-paragraph cells also survive the export: one sampled cell under `t4:0:0` produced both `2025년 5월 경제활동인구조사` and `청년층 부가조사 결과`.",
      "The current document also shows a concrete gap between anchored table controls (`75`) and emitted `F_r()` table buckets (`73`), which matches the static `rs.xLn() -> rs.DLn() -> rs.YOn()` sequencing for empty table objects."
    ],
    unresolved: [
      "`F_r()` table names (`t1`, `t2`, ...) still need an ordering/join strategy back to `hwpjson20` controls if one canonical block stream is required; simple ordinal matching breaks once empty table objects consume serializer-local names.",
      "Public `F_r()` output still omits exact `rowSpan/colSpan`."
    ]
  },
  {
    key: "image-structure-split-surface",
    kind: "gap",
    capability: "read image blocks in document order",
    summary:
      "Image reconstruction is no longer blocked by missing control anchors, but it is still split across two surfaces. `hwpjson20` exposes image controls and asset ids, while document order must be recovered from control markers embedded in `ro/sl` paragraph `tx` strings.",
    staticEvidence: [
      {
        path: "tmp/discovery/05-static-deob/full-mirror-doc1-all/readable/modules/chunks/431/6971.module.js",
        symbols: ["cs", "rc.img.bi", "rs.LLn", "rs.KLn", "rs.VLn", "FPn"],
        note:
          "`hwpjson20`-style control payloads carry image refs under `rc.img.bi`, while the `F_r()` serializer routes object-bearing controls through `LLn/KLn/VLn` and labels textbox-like parents with `FPn`."
      }
    ],
    runtimeEvidence: [
      "Live `hwpjson20` snapshots on the logged-in document expose `17` image controls with `cs[controlId].rc.img.bi` asset refs.",
      "Scanning `tx` strings across `snapshot.ro` and `snapshot.sl` found marker references for all `17` image controls, including pure-image paragraphs like `<0B/67736F20/...>` and mixed records such as `부<0B/67736F20/...>`.",
      "The tested `F_r()` output still exposed only `4` `;x...` textbox lines, so `F_r()` alone is not the canonical image-placement surface for this document.",
      "Among the current image-bearing paragraph records, `15` were effectively pure-image paragraphs and only `1` mixed visible text with an image token.",
      "Static `rs.VLn()` routes `gso` controls into `rs.jLn() -> rs.KLn()`, and that branch only emits public lines for textbox/textart children (`rs.LLn/PLn`); pure image-bearing `gso` records do not generate dedicated `F_r()` markers."
    ],
    unresolved: [
      "The current parser only walks `ro`, so image-bearing `sl` paragraphs are still treated as unanchored blocks.",
      "A canonical block stream still needs to merge top-level `ro` paragraphs with nested `sl` paragraph chains without double-counting mixed control records."
    ]
  },
  {
    key: "hr-clipboard-surface",
    kind: "gap",
    capability: "HTML/clipboard export side path",
    summary:
      "`document.H_r()` is a separate export path built on `as.CBn()` and clipboard-oriented serialization. Static code shows HTML/table/image generation there, but it is not the preferred SDK read path under the current canvas/CDP constraints.",
    staticEvidence: [
      {
        path: "tmp/discovery/05-static-deob/full-mirror-doc1-all/readable/modules/chunks/431/6971.module.js",
        symbols: ["H_r", "as.CBn", "clipboard;", "<table", "<img"],
        note:
          "`document.H_r()` wraps `as.CBn()`. Nearby clipboard/export code emits HTML with `<table` and `<img>` tags and uses `clipboard;` format strings."
      }
    ],
    runtimeEvidence: [
      "Internal UI helpers call `window.HwpApp.document.H_r('')` and `window.HwpApp.document.H_r('clipboard;')` in clipboard/view flows rather than the structured `hwpjson20` path.",
      "The same module also exposes `document.F_r('')` separately for line-oriented export, which is a stronger fit for structure-aware parsing than clipboard HTML.",
      "On the current logged-in document, both `H_r('')` and `H_r('clipboard;')` returned plain text-like output with no `<table>` or `<img>` tags, so this path did not improve structure recovery."
    ],
    unresolved: [
      "This path may be useful as secondary evidence, but it remains outside the preferred raw-CDP structured read strategy and should not become the primary SDK read surface without stronger justification."
    ]
  },
  {
    key: "write-command-dispatcher",
    kind: "write",
    capability: "write command execution",
    summary:
      "The command-driven write path is `ActionManager.PPt -> fPt -> NPt -> UIAPI.t4s/m2s`. `LPt` is the enable/update probe surface.",
    staticEvidence: [
      {
        path: "tmp/discovery/05-static-deob/full-mirror-doc1-all/readable/modules/chunks/431/6971.module.js",
        symbols: ["gw", "PPt", "LPt", "OnIsEnabled", "fPt", "dPt", "cPt", "EPt", "NPt", "UIAPI.t4s", "UIAPI.m2s"],
        note:
          "`gw` is the `ActionManager` constructor; deob write/updater modules route dialog and toolbar actions through `PPt/LPt` and UI dispatcher updates."
      }
    ],
    runtimeEvidence: [
      "`window.HwpApp.ActionManager.constructor.name === 'gw'` on the live editor tab.",
      "`ActionManager` exposes `PPt/LPt/OnIsEnabled/fPt/dPt/cPt/EPt/NPt/yNt/Tbr` live.",
      "`UIAPI` exposes `t4s/m2s/RMs/OMs/getSampleElementListByCmdName/findCommandWrapToParent` live."
    ],
    unresolved: []
  },
  {
    key: "write-dialog-command-ids",
    kind: "write",
    capability: "insert table / insert image",
    summary:
      "Live dialog launchers confirm numeric command ids for at least two required write surfaces: table insert is `35456`; image insert is `34736`.",
    staticEvidence: [
      {
        path: "tmp/discovery/05-static-deob/full-mirror-doc1-all/readable/heuristic/parts/chunk-431/6971-webhwp_app_bootstrap/2673-de.js",
        symbols: ["insert_image", "LPt", "pk", "TG", "SG", "DG", "AG", "xG", "NG"],
        note:
          "Heuristic module names and updater code expose `insert_image` and dialog-oriented `LPt` probes; the exact ids are resolved only at runtime."
      }
    ],
    runtimeEvidence: [
      "Clicking `dialog_insert_table` produced `ActionManager.PPt(35456, HwpApp.document)` then `UIAPI.t4s('update','ui','show','dialog_insert_table')` and `UIAPI.t4s(...,'t_create_table',...,'row_count')`.",
      "Clicking `dialog_insert_image` produced `ActionManager.PPt(34736, HwpApp.document)` then `UIAPI.t4s('update','ui','show','dialog_insert_image')` and `UIAPI.t4s(...,'i_insert_image',...,'from_computer')`.",
      "`ActionManager.LPt(35456)` and `LPt(34736)` both returned `{ enable: true, update: false }` in the tested context."
    ],
    unresolved: [
      "Formatting commands are still identified by toolbar/data-command surfaces rather than stable numeric ids."
    ]
  },
  {
    key: "live-inline-format-mutation",
    kind: "write",
    capability: "type text + bold/italic",
    summary:
      "Typing and inline formatting mutate the live char-style table exactly as expected. New char-style entries appear in `Ivr.Y5n` and new run boundaries appear in `node.Csi`.",
    staticEvidence: [
      {
        path: "tmp/discovery/05-static-deob/full-mirror-doc1-all/readable/modules/chunks/431/6971.module.js",
        symbols: ["Zn.Aoi", "Zn.Csi", "qs.Y5n"],
        note:
          "`Zn.Aoi` stores UTF-16 text, `Zn.Csi` stores run boundaries, and `qs.Y5n` stores char-style entries addressed by those run codes."
      }
    ],
    runtimeEvidence: [
      "Typing ` [MCP-WRITE]` appended text at the live caret node without changing the paragraph style.",
      "After `Meta+B` and typing `[B]`, the current node gained a new char-style code `64` with `bold=true`.",
      "After `Meta+I` and typing `[I]`, the current node gained a new char-style code `239` with `bold=true` and `italic=true`."
    ],
    unresolved: []
  },
  {
    key: "live-paragraph-style-mutation",
    kind: "write",
    capability: "paragraph alignment + line spacing",
    summary:
      "Paragraph style mutation is applied by replacing the paragraph style ref in `$5n`. A live dialog edit changed line spacing from `1.6` to `2.0` and changed the backing style ref.",
    staticEvidence: [
      {
        path: "tmp/discovery/05-static-deob/full-mirror-doc1-all/readable/modules/chunks/431/6971.module.js",
        symbols: ["qs.$5n", "ts.UHn"],
        note:
          "`$5n` is the para-style registry and `UHn` is the serializer that exposes alignment/line-height fields."
      }
    ],
    runtimeEvidence: [
      "Opening `문단 모양` showed baseline `양쪽 정렬` and `줄 간격 160%`.",
      "Changing the dialog to `가운데 정렬` and `200%` changed the current node `styleRef` from `47` to `162`.",
      "The new para-style entry exposed `lineSpacing: 2.0` and raw `cUt: 396`."
    ],
    unresolved: [
      "The current alignment decoder does not yet map para-style `cUt=396` back to `center`."
    ]
  },
  {
    key: "live-table-image-write",
    kind: "write",
    capability: "create table / fill cells / insert image",
    summary:
      "Required structural writes succeed live. Table insert moves the caret into a new cell node, and image insert increases the object/image registry count.",
    staticEvidence: [
      {
        path: "tmp/discovery/05-static-deob/full-mirror-doc1-all/readable/modules/chunks/431/6971.module.js",
        symbols: ["qs.u6n", "Xs.U4n", "rr._ie", "lh._ie"],
        note:
          "`u6n/U4n` is the object-image registry path and `lh._ie` is the branch/container slot path used by layout-bearing structures such as tables."
      }
    ],
    runtimeEvidence: [
      "Creating a `1x1` table through the live dialog succeeded and moved the caret to node `0000019D392E8CEA670600B5`.",
      "Typing `T1` after the insert produced live cell text `T1\\r` at that new node.",
      "The live text-chain tail gained a control placeholder node with `controlCode=11`, token `\" lbt\"`, object-id payload, and `Jci=2048`; this is the current exact-path lead for table block reconstruction.",
      "Inserting a `data:image/svg+xml,...` image through the live `웹 주소` flow increased `document.Ivr.u6n.U4n.length` from `3` to `4`.",
      "The newest image-registry entry exposed `{ Qli: 4, Xli: 1, FFi: '0000019D392F2FE90000011E.png', UFi: 'png' }`.",
      "Global control placeholder scans also exposed stable token families such as `\" lbt\"`, `\"dloc\"`, `\"pngp\"`, and `\"dces\"`, which should be reconciled against `j5n/u6n` registry joins."
    ],
    unresolved: [
      "`readStructure()` still does not reconstruct document-wide `table` and `image` blocks from these live writes."
    ]
  },
  {
    key: "live-save-surface",
    kind: "write",
    capability: "save document",
    summary:
      "Save is runtime-verified. Dirty state enables `d_save`; `Meta+S` clears the dirty state and disables the save surface again.",
    staticEvidence: [
      {
        path: "tmp/discovery/05-static-deob/full-mirror-doc1-all/readable/modules/chunks/431/6971.module.js",
        symbols: ["ActionManager", "Tbr"],
        note:
          "The deob write path includes `ActionManager` methods and save-related command surfaces; runtime shortcut handling still needs live tracing."
      }
    ],
    runtimeEvidence: [
      "After text/style/table/image mutations, the save command surface became enabled.",
      "After `Meta+S`, the save command surface became disabled again.",
      "A short runtime trace captured `ActionManager.Tbr(-1, false)` during save handling."
    ],
    unresolved: [
      "Reload-after-save persistence should still be rechecked on a disposable copy as part of acceptance."
    ]
  },
  {
    key: "remaining-acceptance-gaps",
    kind: "gap",
    capability: "challenge completion gaps",
    summary:
      "The remaining blockers are read-side exactness rather than write execution.",
    staticEvidence: [
      {
        path: "tmp/discovery/05-static-deob/full-mirror-doc1-all/readable/modules/chunks/431/6971.module.js",
        symbols: ["ts.skn", "ts.ckn", "Ub.Save", "ts.UHn"],
        note:
          "Static code already exposes the serializer and control dispatch surfaces needed to finish exact table/image reconstruction and paragraph alignment decoding."
      }
    ],
    runtimeEvidence: [
      "Write-side required capabilities have been exercised live via MCP on the editor tab.",
      "The current SDK still reads `ro`-centric paragraph structure better than the real document-wide `ro + sl` paragraph graph.",
      "`F_r()` now gives an exact table-text path, and live `hwpjson20` scanning proved that all current table and image controls are anchorable through `ro/sl` `tx` markers.",
      "The remaining work is to turn those confirmed surfaces into one canonical block stream rather than treating images as appended unanchored controls."
    ],
    unresolved: [
      "Canonical `readStructure()` that walks `ro` plus nested `sl.hp/np` chains and optionally uses `F_r()` as a table-order cross-check.",
      "Image/paragraph/table merge logic for mixed `tx` records that contain both visible text and control markers.",
      "Cell span reconstruction when only public `F_r()` output is available.",
      "Heading-level reconstruction for Markdown export.",
      "Alignment decode for mutated paragraph styles such as `cUt=396`."
    ]
  }
];
