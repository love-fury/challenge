# 05 Static Deob Findings

Append-only log. 각 항목은 날짜와 `hypothesis` / `observed` / `confirmed` / `failed` 태그를 포함한다.

## 2026-03-29

- `confirmed`: track initialized. 목적은 static deobfuscation을 runtime probe의 side-track으로 추가하는 것이다.
- `observed`: current repo는 runtime probe와 `Runtime.evaluate` 중심이며, bundle deobfuscation 전용 toolchain은 아직 없다.
- `observed`: current plan은 `webpackChunkwebapp` presence를 전제로 webpack-first static lane을 추가하고, recovered symbol/module name을 next runtime probe candidate로만 사용한다.
- `confirmed`: `npx --yes webcrack@latest --help` 기준 CLI surface는 `file`, `--output`, `--force`, `--no-unpack`, `--no-deobfuscate`, `--no-unminify`, `--mangle`를 직접 제공한다.
- `confirmed`: live Hancom editor target에서 `main.js + 35 chunk`를 전부 mirror했고 fetch 실패는 없었다.
- `confirmed`: webcrack은 이 bundle shape에서 source-tree unpack까지는 못 했지만, readable main/chunk output을 생성하는 데는 충분했다.
- `confirmed`: webpack runtime table를 직접 파싱해서 chunk-level보다 한 단계 더 내려간 `module id -> factory` 추출이 가능했다. 현재 live artifact 기준 extracted module count는 `73`이다.
- `confirmed`: heuristic reconstruction lane을 추가해서 named module copy와 top-level synthetic split을 생성했다. 현재 priority examples는 `main/5910 -> jquery_3_6_0`, `main/417 -> locale_async_context_loader`, `chunk-431/6971 -> webhwp_app_bootstrap`, `chunk-360/2595 -> ui_framework_model_store`, `chunk-774/8237 -> custom_font_catalog`이다.
- `observed`: source map이 없어서 원본 file tree 복원은 불가능하다. 현재 결과는 webpack module boundary + heuristic renaming/splitting까지이며, 그 이상은 confirmed source restoration이 아니라 reconstruction이다.
- `confirmed`: curated subset promotion lane을 추가했고 current official tracked corpus는 `artifacts/static-deob/hancom-webhwp-build-20260225023319`에 생성됐다.
- `observed`: current promoted corpus size는 약 `79M`이며, full scratch corpus(`136M`)보다 작지만 `readable/chunks`, `readable/modules`, `readable/heuristic/modules`, high-signal heuristic parts는 유지한다.
- `observed`: `src/HancomDocsClient.ts` audit 결과 public `search()`는 `bridge.readDocument()`를 통해 `hwpjson20` structured snapshot을 읽고 query-export helper로 검색한다. 이 경로는 `paragraph-read-serializer-stack` finding과 정렬된다.
- `observed`: 같은 audit 결과 public write/replace surface는 아직 direct `ActionManager.PPt/LPt/NPt/UIAPI.t4s` 호출로 승격되지 않았다. 현재 `replaceAll()`, `insertTable()`, `gotoPage()`, `insertImage()`, `insertTableRow()`, `deleteTableRow()`는 SDK-owned bridge가 `pageReplayWriteAction()`을 통해 dialog/data-command DOM surface를 replay한다.
- `observed`: `typeText()`는 raw CDP `Input.insertText`, `fillTableCells()`는 edit-mode 진입 후 `Input.insertText + Tab`, `save()`는 `Cmd/Ctrl+S` shortcut fallback에 머문다. static-deob finding은 exact runtime dispatcher candidate를 좁혔지만 SDK implementation은 아직 fallback-first다.
- `confirmed`: current public capability audit conclusion은 다음과 같다. `search()`는 static-deob-backed read path 위에서 usable하고, `replaceAll()`은 `caseSensitive=true`를 제외하면 fallback으로 usable하며, table/image/page/save row-mutation 계열은 live-validated fallback이 있으나 active selection, dialog visibility, file upload, shortcut focus 같은 precondition을 가진다.
- `observed`: 위 audit bullets는 사용자의 원래 질문인 "static deob 기준 CDP에서 어떤 runtime 함수를 호출하면 구현 가능한가"를 직접 답한 것은 아니다. 따라서 아래 bullets를 이 track의 corrected output으로 본다.
- `confirmed`: generic dispatcher root는 `window.HwpApp.ActionManager`다. static bundle에서 `fPt`, `LPt`, `PPt`, `cPt`, `dPt`, `NPt`가 한 class surface에 모여 있고, command tuple 생성과 property-bag execution이 이 경로로 수렴한다.
- `confirmed`: structured read/search의 strongest path는 `window.HwpApp.document.aPt().ENt().save("hwpjson20;")`다. challenge의 search capability는 current static evidence만 봐도 internal find dialog보다 이 serializer snapshot + client-side search가 더 견고하다.
- `confirmed`: find/replace direct command ids는 `33824=find_next`, `33809=replace_one`, `33810=replace_all`이다. replace dialog static path는 `ActionManager.fPt(commandId, cti) -> action.dPt(OPt, propBag) -> ActionManager.QAt(action, OPt)`이며, bag에는 최소 `vt.zct`, `vt.Qct`, `vt.Xct`, `vt.HWPITID_FNR_FIND_TYPE`가 들어간다.
- `confirmed`: `gotoPage`는 simple dispatcher `33697 (dt.kI)`와 dialog-backed action `33840 (dt.hC)`를 같이 봐야 한다. static `2590-u_i.js`는 `dialog_goto -> Cre:[dt.hC]`, action registry는 `mw[dt.hC] = { action: pw }`, executor는 `pw.dPt -> jQe -> QQe`를 가리킨다.
- `confirmed`: `insertTable` direct command id는 `35456 (dt.KL)`다. helper `jv.dPt`는 `fPt(dt.KL) -> cPt(tuple, bag) -> bag[vt.Uft=rowCount, vt.Wft=colCount] -> dPt(tuple, bag)` 순서를 보여준다.
- `confirmed`: table row mutation direct command ids는 `35473=insert_upper_row`, `35474=insert_lower_row`, `35477=delete_row`다. static registry와 `LPt` checks가 모두 보이며 active table context를 전제로 `PPt(commandId, cti)` 호출 후보가 가장 강하다.
- `confirmed`: `insertImage` direct command id는 `34736 (dt.pk)`다. static `Ow.prototype.OKs(url)`는 URL-based direct insert를 보여주지만, same dialog source `jy/dy`는 `location_type=from_computer`, file widget `from_computer`, `URL.createObjectURL(file)`, `/webhwp/handler/upload/image/base64/` async upload 경로도 직접 보여준다. current strongest interpretation은 URL path와 local file upload path가 둘 다 first-class라는 것이다.
- `confirmed`: `save` direct path는 `window.HwpApp.INt(true).PPt("d_save")`다. static bundle의 `saveActor.vsh()`와 related UI bridge calls에서 same command string이 직접 확인됐다.
- `observed`: write-side에서 property bag builder `gt.jHt(...)`와 key enum `vt.*`는 아직 deob symbol 단계다. command id와 dispatch order는 strong evidence지만, public SDK helper로 승격하려면 key-level live verification이 남아 있다.
- `confirmed`: 9222 live target에서 `window.HwpApp.ActionManager` prototype은 실제로 `fPt/QAt/LPt/PPt/cPt/dPt/lPt/NPt`를 노출했고, static `gw.prototype.*` dispatcher surface와 정렬됐다.
- `confirmed`: 9222 disposable doc에서 `read/search` path `document.aPt().ENt().save("hwpjson20;")`는 seed text와 subsequent mutation을 structured payload로 직접 반영했다.
- `confirmed`: static `2562-ny.js` 기준 `replaceAll` UI action은 `fPt(33810) -> action.dPt(OPt, bag)`다. 9222 live capture에서 성공 bag state는 `16384=find`, `16385=replace`, `16386=2(document whole)`, `16392=1`, `16406=1`로 관측됐고, 같은 key set를 사용한 dialog-less `tuple.action.dPt(tuple.OPt, bag)` direct replay가 `deltadeltadelta -> omega` mutation을 실제로 만들었다.
- `confirmed`: static `1540-jv.js` 기준 `insertTable` helper는 `fPt(35456) -> cPt -> dPt`다. 9222 live disposable doc에서 captured bag의 `16384/16385` numeric slot을 `2/3`으로 설정한 direct `ActionManager.dPt(tuple, bag)`가 table control insertion을 성공시켰다.
- `confirmed`: table row mutation direct commands `35474`와 `35477`는 9222 live disposable doc에서 각각 `rows 2 -> 3`과 `rows 3 -> 2`로 read-back이 바뀌었다.
- `confirmed`: 9222 housing doc live repro에서 `goto`는 `33840 (dt.hC)` 경로로 실제로 닫혔다. `ActionManager.PPt(33840, cti)`로 active dialog context를 만들고 `e_goto.J2s({ value:{ goto_input:'2', execute:'confirm' } })`를 직접 replay했을 때 `ActionManager.dPt(33840, bag)`가 실행됐고, 후킹된 core navigator는 `jQe(type=1,page=2,flag=false,last=false) -> true`, `RQe.cOn(..., how=7) -> true`를 반환했다. same run에서 current page가 `1 -> 2`로 바뀌었다.
- `observed`: static `saveActor.vsh()`는 `PPt(\"d_save\")`를 가리키지만, 9222 live target 두 문서 모두에서 `LPt('d_save')`가 disabled였고 `PPt('d_save')`는 `false`를 반환했다.
- `confirmed`: 9222 disposable doc live repro에서 local image insert는 실제로 성공했다. `PPt(34736, cti)`로 "그림 넣기" dialog를 열고 local `one-pixel.png`를 `from_computer` widget에 업로드하자 `넣기`가 활성화됐고, 클릭 후 `ActionManager.dPt(34736, bag)`가 실행됐다. network에는 `blob:` preview fetch와 `POST /webhwp/handler/upload/image/base64/<docId>?session=...`, 이어서 action POST가 관측됐고, read-back `hwpjson20` payload에는 `img.bi:"0000019D394E4E230000003E.png"` image control payload가 반영됐다.
