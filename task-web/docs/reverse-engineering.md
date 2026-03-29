# Reverse Engineering Log

이 문서는 Hancom Docs editor 내부 구조를 찾는 과정의 작업 로그입니다.

## 운영 규칙

- 이 파일은 coordinator가 승격한 `confirmed` 사실만 기록한다.
- worker별 가설, 실험 중간 결과, 미확정 메모는 `docs/task-requests/<track>/findings.md`에 남긴다.
- 이 파일에 올리는 항목은 재현 가능한 probe, example, 또는 명시적인 object path 근거가 있어야 한다.

## 목표

- 문서 전체 텍스트를 어떤 내부 상태에서 읽을 수 있는지 찾기
- 문단/표/이미지 구조와 formatting metadata의 source를 찾기
- 쓰기/치환/표 삽입/저장을 어떤 내부 command 또는 keyboard sequence로 호출할지 찾기

## Working Hypotheses

- 앱 전역 객체에 editor instance 또는 document model이 노출되어 있을 수 있다.
- webpack runtime/module registry를 통해 내부 store를 역추적할 수 있다.
- 읽기와 쓰기는 동일한 entrypoint가 아닐 수 있다.

## Confirmed Facts

### 2026-03-29
- Probe:
  - Chrome DevTools MCP `Runtime.evaluate`
  - SDK runtime probe skeleton
- Observation:
  - `window.HwpApp`가 전역에 노출되어 있다.
  - current live editor page와 same-origin iframe 3개 전체 스캔 기준 `__HANCOM_AUTOMATION__`는 어느 window에도 존재하지 않았다.
  - 같은 live build의 `https://webhwp.hancomdocs.com/webhwp/js/main.js?20260225023319` 번들 문자열 검색에서도 `__HANCOM_AUTOMATION__`, `HANCOM_AUTOMATION`, `automation` 토큰은 관측되지 않았다.
  - `HwpApp` own key에 `Core`, `ActionManager`, `document`, `appState`, `UIAPI`, `Models`, `FontManager`, `clipboard`가 존재한다.
  - `HwpApp.document`는 난독화된 필드명을 가지지만 prototype method에는 `open`, `save`, `rename`이 명시적으로 남아 있다.
  - `HwpApp.ActionManager`는 constructor `gw`를 가지며 별도 prototype method 집합을 갖는다.
  - `HwpApp.UIAPI`에는 `makeEventActionObj`, `addEventAction`, `getSampleElementListByCmdName`, `findCommandWrapToParent` 같은 command-related helper가 있다.
  - `HwpApp.FontManager.GetFontListAll()`은 실제 폰트 목록을 반환한다.
  - 런타임에는 `webpackChunkwebapp`가 존재한다.
  - 페이지에는 canvas 2개와 iframe 3개가 있고, `#hwpEditorBoard` iframe 내부 body에는 `#hwpEditorBoardContent`가 존재한다.
  - 스냅샷과 body text에 스크린 리더 지원 문구가 존재하지만, 현재까지는 명시적 a11y API key는 찾지 못했다.
  - `HwpApp.document.Svr.G0i`는 `Aoi: Uint16Array`, `Csi: Uint32Array`, `tdi` 링크를 가진 text-chain node shape를 가진다.
  - `HwpApp.document.Svr.G0i.tdi.Aoi`를 UTF-16으로 디코딩하면 실제 본문 문장이 나온다.
  - `tdi` 체인을 따라가면 본문 문단과 `"\r"` paragraph-break node가 번갈아 나타난다.
  - text node에는 `sdi.Msi` style reference 후보가 붙어 있고, `Csi`는 run/style boundary 후보로 보인다.
  - text node의 `sdi.Msi`는 `Ivr.Y5n.n4n`와 `Ivr.$5n.n4n`의 동일 인덱스를 가리키는 것으로 보인다.
  - `Ivr.Y5n.n4n[styleRef]`에는 문자 스타일 후보가 들어 있으며, `aXt[*].DXt`에서 실제 폰트명이 나온다.
  - 예시로 `Y5n[144]`는 `맑은 고딕`, `12pt` 패턴을 보이고, `Y5n[117]`는 `바탕`, `14pt` 패턴을 보인다.
  - `Y5n[156]`는 `맑은 고딕 12pt`, `Y5n[160]`는 `HY헤드라인M 12pt` 패턴을 보이며, 샘플 문서의 섹션 제목 스타일과 대응한다.
  - `Y5n[styleRef].oqt`는 `0xC0C0C0` 같은 color-like 값을 가진다.
  - `Ivr.$5n.n4n[styleRef]`에는 문단 스타일 후보가 들어 있고, `FNi`는 150/160 같은 line-spacing candidate를 가진다.
  - sampled text node 전부에서 `Csi`는 ordered `(offset, charStyleCode)` pair로 복원됐고, 오른쪽 값은 `Ivr.Y5n.n4n[code]` char-style entry로 resolve됐다.
  - `hwpCaret.AMe.Cni.pos/type`는 current caret position을 제공했고, `node.Csi` pair 중 `start <= Cni.pos`인 마지막 pair를 고르면 active inline run을 복구할 수 있었다.
  - live `gotoPage()` verification에서 `hwpCaret.uIs.b8t`는 requested page `1,2,3,5,9`에 대해 exact하게 `1,2,3,5,9`로 따라왔다. current strongest interpretation은 active caret page number carrier다.
  - current caret 기준으로 `AMe.Eni.sdi.Msi -> Ivr.$5n.n4n[styleRef].FNi / 100`는 live grid comparable sample `35/35`에서 toolbar line-spacing input과 일치했다.
  - current caret 기준으로 `AMe.Kqi`는 일부 normal text sample에서 toolbar font-size input과 일치하지만, control-like node에서는 크게 벗어난다.
  - text-like current-caret sample 기준으로 toolbar font name/size는 base `Y5n[styleRef]`보다 active run `Y5n[charStyleCode]`와 훨씬 더 잘 맞았다.
  - current sample에서는 toolbar color `#000000`와 `Y5n[*].oqt=#c0c0c0`가 반복적으로 어긋났다. `oqt`는 visible text color와 다른 축일 수 있다.
  - live grid sample에서 toolbar align이 `both`와 `center`로 달라져도 `hwpCaret.Zys`, `hwpCaret.$ys`, `hwpCaret.Jys.Xli`는 전 sample에서 `2`로 유지됐다.
  - 같은 sample에서 para-style `Xli`는 `both`일 때도 `1/2/5/22`, `center`일 때 `10`이 관측됐다. 따라서 `Xli`는 direct alignment enum으로 보기 어렵다.
  - live probe 기준 `probeDocumentTextChain()`은 `traversedCount=129`, `textNodeCount=56`, `controlNodeCount=15`, `paragraphCount=53`을 반환했고, preview에 실제 한국어 본문이 노출되었다.
  - 현재 샘플 문서에서 `styleRef`는 다수의 분포를 가지며, 최소 `3, 36, 38 ... 156, 158, 159, 160, 161` 같은 인덱스가 관측되었다.
  - 현재 샘플 문서에서는 text-chain node의 child `vui.type`이 모두 `1`로만 관측되었고, 표/이미지 전용 type은 아직 확보하지 못했다.
  - control-like node는 주로 `Ooi=5`, `Hoi=1`, `idi=0` 패턴을 가진다.
  - SDK live 검증 기준 `readStructure()` fallback은 현재 샘플 문서에서 53개의 paragraph node를 반환했고, 첫 문단 문자열이 text-chain preview와 일치했다.
  - image-bearing live 문서에서 `HwpApp.document.Ivr.u6n.U4n`는 `18`개의 image registry entry를 반환했고, 각 entry는 `Qli`, `Xli`, `FFi`, `UFi`를 가졌다.
  - 같은 문서에서 `HwpApp.cache.images[FFi]`는 실제 `HTMLImageElement`를 반환하며 `src/currentSrc`, `naturalWidth`, `naturalHeight`를 직접 읽을 수 있었다.
  - image-bearing 문서에서도 `Loi[0].vui.type`는 계속 `1`이어서 image discriminator로는 충분하지 않았다.
  - image-bearing 문서의 control placeholder `Aoi`에는 `dces`, `dloc`, `pngp`, `dhgp`, ` lbt` 같은 ASCII-like token과 small id가 반복됐고, 일부 id는 `Ivr.u6n.U4n[*].Qli`에 직접 resolve됐다.
  - 같은 문서에서 `HwpApp.document.Ivr.j5n.n4n[*]`는 `Qli`, `Xli`, `qli`를 가진 object registry로 확인됐고, `Qli=1,2,9,11,17,18` 같은 `U4n` image id뿐 아니라 `19..24,26` 같은 non-`U4n` control id도 포함했다.
  - live canvas click으로 선택된 control node `01DCBF443E24F3E00000C0E3`, `01DCBF443E24F3EA0000C0E4`의 `Aoi`는 `19,21,22,23,24` 같은 id를 담았고, 이 id들은 `Ivr.j5n.n4n[*].Qli`에는 존재하지만 `Ivr.u6n.U4n[*].Qli`에는 존재하지 않았다.
  - 반대로 `U4n`에만 존재한다고 보였던 `1,2,9,11,17,18`도 `Ivr.j5n.n4n[*]` object entry는 갖고 있었지만, 현재 문서의 text-chain control placeholder에서는 직접 관측되지 않았다.
  - `17`, `18`을 포함한 위 unmatched id를 text-chain 전체에서 다시 스캔했을 때 `Aoi/hdi/udi/adi.Cci`에는 나타나지 않았고, 관측된 hit는 전부 `Csi` char-style code 충돌이었다.
  - live `probe-image-asset-anchors`를 `maxGraphNodes=200000`으로 실행했을 때 `visitedGraphNodes=131358`에서 full graph scan이 종료됐고, unanchored image asset `1,2,9,11,17,18`은 `document.Ivr.u6n.U4n[index]`, `document.Ivr.j5n.n4n[index]`, `document.Ivr.u6n.U4n[index].FFi`, `cache.images[FFi]`, `document.Ivr.j5n.n4n[index].qli` 외 ref가 추가로 나타나지 않았다.
  - 같은 probe에서 각 asset의 실제 `HTMLImageElement` identity도 추적했지만 `cache.images[FFi]` 외 ref가 추가로 나타나지 않았다. cached image element 자체를 잡는 별도 placement/render parent는 현재 문서에서는 관측되지 않았다.
  - 이후 같은 live target을 다시 스캔했을 때 direct image anchor 집합이 `1,3,4,10,12,13,14,15,16`으로 바뀌었고, `5,6,7,8`은 text-chain `Aoi/hdi/udi/adi.Cci` 전체에서 더 이상 관측되지 않았다.
  - `imageId=1` anchor node `01DCBF443E24F3540000C0D4`는 `Aoi=[11,27680,29794,1,...]` 같은 10-word placeholder를 가졌지만 decoded text에 Hangul-like garbage가 섞여 기존 `looksLikeControlText()` heuristic로는 control node로 분류되지 않았다.
  - `pageReadStructureFromTextChain()`는 image ref scan을 control-text heuristic보다 먼저 수행하도록 수정했고, 최신 live fallback은 exact image block `9`개를 복원했다.
  - `pageReadStructureFromTextChain()` fallback은 현재 live image 문서에서 direct image anchor `12`개를 `kind:"image"` node로 복원하고, `U4n`에만 존재하는 unanchored image asset id `1,2,9,11,17,18`은 warning으로 노출한다.
  - production fallback은 이제 recognized placeholder family 전체를 sliding scan으로 제거한 뒤 paragraph text를 복원한다. 즉 image-bearing span뿐 아니라 `j5n.n4n[*].Qli`와 exact join되는 embedded placeholder span도 structured read에서 먼저 걷어낸다.
  - raw `probeDocumentTextChain()`은 여전히 mixed `Aoi` word buffer를 그대로 보여 주는 디버깅 probe로 남기고, `readText()`는 structured fallback을 우선 사용하도록 바뀌었다.
  - selection-state grid probe 기준 plain-text 문서에서는 `modify_object_properties`, `e_insert_caption`, `c_insert_row_col_list`, `dialog_edit_table` 같은 widget signal이 sampled click 전체에서 한 번도 켜지지 않았다.
  - selection-state grid probe 기준 image/chart-heavy 문서에서는 `modify_object_properties`가 control-like caret node `Ooi=9`, `Jci=2099200`, `Noi=17`과 함께 반복적으로 enabled 되었다.
  - 같은 grid probe에서 `e_insert_caption`은 항상 동반되지 않았고, hidden caption submenu 성격이 강해서 selection signal로 승격하면 안 된다.
  - `selectionStateProbe`는 `getWidgetElementList()` wrapper snapshot과 direct DOM command census(`data-command`, `data-ui-value`)를 함께 읽도록 확장됐다.
  - write-side `create-table-row-command-followup` 기준 `c_insert_row_col_list`, `c_remove_row_col_list`, `dialog_edit_table`는 visible widget에는 드러나지 않아도 hidden command surface에서 `disabled=false`로 유지될 수 있었다.
  - 같은 follow-up에서 read-side `tableSelectionSignals`는 위 hidden-but-enabled table command surface와 함께 켜졌고, `modify_object_properties`도 object-secondary signal로 같이 켜졌다.
  - raw action bit `35474`는 row-command follow-up에서 함께 켜졌지만 exact table discriminator로는 아직 부족하다.
  - `create-table-structure-join-followup` 기준 table tick에서 `HwpApp.document.Svr._ie.length`는 `5 -> 10`으로 증가했고, 상위 `HwpApp.document.Svr`도 child collection `_ie` 길이 변화로 같이 반응했다.
  - 같은 tick에서 `HwpApp.document.Zvr.$bi`는 ownKeys가 `... qli, vie, _ie`에서 `... qli, cUt, gun, Tun, $9i, Lun, vqt, Mun`으로 크게 바뀌었고, scalar `j0i`, `Y0i`, `Q0i`, `mKi`, `qli`도 함께 변했다.
  - `HwpApp.document.Zvr.$bi.G0i`도 같은 tick에서 `Ooi`, `Noi`, `Xci`, `Jci`와 `Aoi.length`가 변했다.
  - deep follow-up 기준 `HwpApp.document.Svr._ie[*]` entry shape는 거의 고정이었고, 실제 variance는 child `hie`의 scalar `K7i`, `zXi`, `tyi`에서 드러났다.
  - deep follow-up 기준 `HwpApp.document.Zvr.$bi.z0i`는 table tick에서만 `qli`, `cUt`, `iin`, `SXt`, `gnn`, `Tnn`, `Snn`, `Dnn`, `Zci` 같은 scalar를 가진 object로 나타났다.
  - 같은 `z0i` child의 `Nji`는 `Ooi=5`, `koi=2`, `Noi=9`, `Hoi=1`, `Moi=1`를 가진 direct node-like object였다.
  - `HwpApp.document.Zvr.$bi.gun[0]` shape는 `Svr._ie[*]`와 거의 같았고, `Lun`, `vqt`, `Mun`은 숫자 배열이었다.
  - worker join probe 기준 table-context exact join path는 `HwpApp.document.Zvr.$bi._Vi.z0i -> HwpApp.document.Ivr.o6n.n4n[*].zli`였다. nested `.Oji/.kji/...` sibling의 `qli/cUt`도 같은 `o6n.zli` registry family로 exact resolve됐다.
  - 같은 join probe에서 `HwpApp.document.Zvr.$bi._Vi.z0i.*.Nji`의 `qli`는 `HwpApp.document.Svr.G0i` 또는 `HwpApp.document.Svr._Vi.G0i` text-chain control node id로 exact join됐다.
  - 같은 join probe에서 `HwpApp.document.Zvr.$bi._ie[*].V9i.sVi`, `_ie[*].hie.abi`, doc2에서는 `_ie[*].hie.Q7i`까지 `HwpApp.document.Ivr.o6n.n4n[*].zli`와 exact join됐다.
  - worker doc1/doc2의 2x2 table follow-up에서 `Svr._ie[*].hie` histogram은 `[{K7i:true,zXi:1,tyi:0},{false,2,1},{false,3,2},{false,4,3},{false,5,4}]`로 안정적으로 재현됐다.
  - worker doc2 follow-up에서는 exact table join branch가 살아 있었는데도 `tableSelectionSignals=[]`였다. hidden command surface proxy는 useful하지만 structural join보다 우선순위가 낮다.
  - `create-table-tab-walk` worker follow-up 기준 raw CDP `Input.dispatchKeyEvent(Tab)`는 editor 내부 caret traversal을 실제로 일으켰다. doc1 `3x3` run에서는 `caretNodeId`가 step마다 연속적으로 바뀌면서도 `tableSelectionSignals`는 유지됐다.
  - doc1에서는 table 내부 traversal 동안 `_ie.hie`가 고정 길이 `5`로 유지됐고 `zXi/tyi`도 `1..5 / 0..4`에 묶였다. `_ie.hie.{zXi,tyi}`를 active cell ordinal로 직접 해석하면 틀린다.
  - 같은 doc1 worker run에서 `Tab` 누적이 `rows*cols` 경계를 넘는 순간 `_ie.length`가 `5 -> 48`로 급증했다. `2x2`는 step4, `3x3`는 step9에서 재현됐고 caret node id prefix도 함께 바뀌었다.
  - doc2의 동일한 `3x3` worker run은 다른 profile을 보였다. `step0`은 `_ie=5`, 첫 `Tab` 이후는 `_ie=10`으로 유지됐고 doc1 같은 `48` burst는 step10까지 나타나지 않았다.
  - strongest current interpretation은 `_ie` cardinality가 active cell 수가 아니라 문서별 baseline과 table traversal phase를 반영하는 selection-context bucket이라는 것이다.
  - `create-table-tab-walk`는 이후 reverse walk(`Shift+Tab`)와 `transitionFromPrevious.{ieCountDelta, addedRegistryKeys, removedRegistryKeys}` capture로 확장됐다.
  - doc1 `2x2` reverse walk에서는 boundary burst(`_ie=48`)가 다시 재현됐지만, 직후 `Shift+Tab`은 caret와 registry set을 한 번 바꾸는 데 그쳤고 `_ie`는 계속 `48`으로 남았다.
  - doc2 `3x3` reverse walk에서는 `_ie=5`가 유지된 채 `caretNodeId`와 `z0i -> o6n.zli` target set만 backward rotation했다.
  - fresh worker(`:9335`)의 doc1 `3x3` rerun은 `step7+`에서 control-anchor node id로 진입했지만 `_ie=48` burst가 재현되지 않았다. doc1 large-phase trigger는 table dimensions만으로 고정되지 않고 selection history나 preceding context에 민감할 가능성이 높다.
  - current runtime re-check 기준 `HwpApp.document.Zvr.$bi.G0i`는 `Svr.G0i`와 동일한 `133`-node text chain을 노출했고 body에 없는 node id를 추가로 갖지 않았다.
  - 같은 re-check에서 `HwpApp.document.Svr._Vi.G0i`는 break node 하나만 가진 branch였고 text-bearing paragraph stream으로 보이지 않았다.
- Conclusion:
  - read-path의 1순위는 `HwpApp.document` object graph다.
  - current live build에서는 `__HANCOM_AUTOMATION__`를 app-provided bridge로 가정하면 안 된다. 필요하면 CDP `Runtime.evaluate`로 별도 bridge를 주입할 수는 있지만, 현재 앱이 native hook를 제공하는 근거는 없다.
  - SDK production path는 `HancomDocsClient.connect()` 시점에 replay-backed write methods만 담은 SDK-owned `__HANCOM_AUTOMATION__` bridge를 page context에 설치하는 쪽으로 정리됐다. 즉 `__HANCOM_AUTOMATION__`가 보이더라도 native Hancom surface로 간주하면 안 된다.
  - 특히 `document.Svr.G0i -> tdi` 체인이 현재까지 가장 강한 full-text read-path다.
  - `readText()`는 위 text-chain fallback으로 SDK에서 바로 사용 가능한 수준까지 올라왔다.
  - `readStructure()`는 같은 체인에서 paragraph node를 복구하는 fallback으로 이미 연결되었고 live 문서에서 검증되었다.
  - current 문서에서는 별도 paragraph-text root 근거가 없다. `Zvr.$bi.G0i`는 body mirror이고 `Svr._Vi.G0i`는 paragraph source가 아니다.
  - formatting read-path의 현재 1순위는 `text node.sdi.Msi -> Ivr.Y5n/$5n` 매핑이다.
  - inline formatting read-path의 현재 1순위는 `text node.Csi -> ordered (offset, charStyleCode) -> Ivr.Y5n.n4n[code]` 매핑이다.
  - current-caret text formatting은 base `styleRef`보다 `AMe.Cni.pos + node.Csi`로 선택한 active run style을 우선해서 읽어야 한다.
  - `readParagraphFormatting()`는 automation hook이 없어도 text-chain + style-table fallback으로 `fontName`, `fontSize`, `color`, `lineSpacing`을 읽도록 연결되었다.
  - current-caret line spacing은 `AMe.Eni.sdi.Msi -> Ivr.$5n[styleRef].FNi` 경로가 가장 강하다.
  - exact child metadata path는 direct `node.vui`가 아니라 `node.Loi[0].vui.{type,pos}`다.
  - 두 live 문서 full scan 기준 `Loi[0].vui.type=1`, `Loi[0].vui.pos=-1`만 관측됐다. child metadata path는 확인됐지만 이 값만으로는 table/image/page를 분리하지 못한다.
  - 두 번째 live 문서(`2025년+5월+경제활동인구조사+청년층+부가조사+결과.hwp`)에서는 `paragraphCount=176`, `textNodeCount=319`, `controlNodeCount=39`, `paragraphsWithMultipleStyleRefs=58`, `nodesWithMultipleRunCandidates=126`이 관측됐다.
  - short control signature `Ooi=5`, `koi=2`, `Hoi=1`, `Moi=1`, `idi=0`, `textLength=6`가 두 문서에서 지배적으로 반복됐다.
  - 위 dominant control signature는 두 번째 문서에서 `(단위: 천명, %, %p)` 같은 caption 바로 앞에 반복 출현했다. 현재 strongest embedded-object anchor candidate지만 exact table/image/chart discriminator로는 아직 부족하다.
  - 두 번째 문서의 style table에서도 `wTi === bTi.Msi`가 char-style 전 entry에서 유지됐고 `vTi === 0`도 전 entry에서 유지됐다.
  - image read-path의 현재 1순위는 `document.Ivr.u6n.U4n` registry와 `cache.images[FFi]` payload다.
  - object placement discriminator의 현재 1순위는 `text-chain control node.Aoi` placeholder parser + `Ivr.j5n.n4n[Qli]` lookup이다.
  - image placement discriminator의 현재 1순위는 위 object placement path에 더해 `Ivr.u6n.U4n[Qli]`와 `cache.images[FFi]`를 결합하는 경로다.
  - `U4n` 전체를 문서 내 placed image 집합으로 바로 간주하면 안 된다. 현재 strongest interpretation은 `U4n = image asset registry`, `Aoi + j5n.n4n = placed object anchor subset`이다.
  - image placeholder discriminator는 단순 decoded-text heuristic보다 `Aoi` token parser가 더 우선이다. control node처럼 보이지 않는 mixed placeholder도 `Aoi -> j5n.n4n -> U4n -> cache.images`가 성립하면 exact image로 취급해야 한다.
  - 위 unmatched `1,2,9,11,17,18`은 current live graph scan 기준 non-registry placement parent가 없었고 cached `HTMLImageElement` identity도 `cache.images` 외 ref가 없었다. 따라서 현재 1순위 해석은 direct placed image가 아니라 registry-only asset 또는 다른 object 내부 sub-resource 쪽이다.
  - object-selection secondary signal의 현재 1순위는 `UIAPI.getWidgetElementList("modify_object_properties")` enablement와 current caret control signature의 결합이다.
  - table-selection secondary signal의 현재 1순위는 visible toolbar state가 아니라 hidden command surface까지 포함한 `c_insert_row_col_list` / `c_remove_row_col_list` / `dialog_edit_table` enablement census다.
  - table-bearing structural join의 현재 1순위 후보는 `HwpApp.document.Svr._ie`와 `HwpApp.document.Zvr.$bi`다.
  - table-bearing object discriminator의 현재 1순위 후보는 `Svr._ie[*].hie` scalar triple과 `Zvr.$bi._Vi.z0i` scalar bundle이다.
  - table-bearing exact registry join의 현재 1순위는 `Zvr.$bi._Vi.z0i.* -> Ivr.o6n.n4n[*].zli`다.
  - table-bearing control-anchor join의 현재 1순위는 `Zvr.$bi._Vi.z0i.*.Nji -> Svr.G0i / Svr._Vi.G0i` node id다.
  - `_ie[*].hie.abi/Q7i`와 `Ivr.o6n.n4n[*].zli` exact join은 `_ie`가 table cell/grid metadata pointer set일 가능성을 강화한다.
  - 하지만 `_ie.hie.{zXi,tyi}`와 `_ie.length`는 active cell ordinal을 직접 주지 않는다. traversal 동안 caret은 움직여도 `_ie`가 고정될 수 있고, `rows*cols` 경계 이후에는 broader phase bucket으로 급변할 수 있다.
  - reverse walk까지 포함한 현재 strongest 해석은 `z0i -> o6n.zli` target rotation이 current-cell/cell-neighborhood 쪽에 더 가깝고, `_ie` cardinality는 sticky한 traversal phase/state 쪽에 더 가깝다는 것이다.
  - 새 `pageProbeTableCellSemantics()` / `examples/discovery/02-read/probe-table-cell-semantics.ts`는 위 해석을 live step log로 고정하기 위한 probe다. 같은 tick의 `z5n` structural signature, current `z0i` carrier, `_ie.hie.{abi,Q7i}` join, caret node id를 한 번에 수집한다.
  - current active table cell paragraph를 직접 읽는 strongest current runtime path는 `hwpCaret.AMe.Eni.Aoi`와 `hwpCaret.AMe.Eni.sdi.Msi`, 그리고 pending insert queue `HwpApp.document.Evr.wVs.vqs[*]`를 함께 쓰는 것이다.
  - `Evr.wVs.vqs[*]`의 live table-cell insert entry는 `cmd="hInsert"`, `type=1`, `value.t=<inserted text>`, `value.cs=<char-style qli>`, `value.lk=<style-linked scalar>` shape를 가졌다.
  - 같은 queue entry의 `value.cs`는 `Ivr.Y5n.n4n[*].qli`와 exact join됐고, current cell text formatting read-back의 strongest char-style pointer가 되었다.
  - fresh `insertTable()` 직후 첫 cell에서 `Input.insertText`는 plain call만으로는 반영되지 않았다. 같은 CDP session에서 먼저 `Enter`, `F2`, `Escape`, 또는 `Tab`을 보내면 edit mode로 전이되고 그 뒤 `Input.insertText`가 live cell text로 반영됐다.
  - 위 fresh-table repro에서는 `Enter`와 `F2`가 가장 clean했고, `Escape`는 일부 run에서 leading IME/jamo artifact를 남길 수 있었다. 새 table first-cell write fallback의 현재 1순위 진입 키는 `Enter`다.
  - disposable live validation 기준 SDK-owned observed-table path는 실제 read-back까지 연결됐다. worker `:9335` target `51F687DD0C31A638D40A518B802C23C0`에서 `insertTable(2,2) -> fillTableCells(Q11..Q22) -> readDocument()`를 한 번만 수행했을 때 `sdk-observed-active-table` block과 cell text `Q11/Q12/Q21/Q22`가 `tmp/discovery/04-write/observed-table-readback-51f-9335.json`에 남았다.
  - 위 read-back은 SDK가 exact table reconstruction 대신 most-recent active table observation을 문서 끝에 주입한 결과다. current strongest interpretation은 write acceptance를 임시로 닫는 observed path이지, document-global canonical table read path가 아니다.
  - live runtime re-check에서 `window.HwpApp.document.aPt().ENt().save("hwpjson20;")`는 문자열이 아니라 structured object를 직접 반환했다.
  - 같은 `hwpjson20` payload의 top-level key는 `documentPr`, `dh`, `ro`, `sl`, `cs`, `bf`, `cp`, `tp`, `nu`, `bu`, `pp`, `st`, `mp`, `tc`, `ta`, `bi`였다.
  - `cp` entry는 char-shape table이고 sample entry에 `f1..f7` font family, `he` font size, `it` italic, `bo` bold, `tc` text color candidate가 직접 들어 있었다.
  - `pp` entry는 para-shape table이고 sample entry에 `ah` alignment candidate와 `lv` line-spacing 값이 직접 들어 있었다.
  - `st` entry는 style table이고 sample entry가 `na`, `en`, `pp`, `cp`를 함께 가져 paragraph style과 char style을 join할 수 있었다.
  - `ro[*]`는 paragraph-like payload를 가졌고 `tx`에 visible paragraph text 또는 embedded control token string, `tp`에 inline run boundary + char-shape id 배열, `pp`/`si`/`bf`에 paragraph-side references를 담고 있었다.
  - sample live paragraph `ro["01DCBF657F966AC20000D7B3"]`의 `tx`는 실제 본문 문장을 직접 담고 있었고, `tp`는 `[offset, charShapeId, ...]` 형태로 같은 문단의 run boundary를 제공했다.
  - `tx` embedded control token은 `<marker/signature/objectId>` 형태였고 current doc에서 `0B/74626C20/<objectId>` table marker와 `15/70676E70/<objectId>` page-number marker가 직접 관측됐다.
  - `cs[objectId]`는 위 `tx` control token의 exact join target이었다. current doc sample에서 `cs["...D799"]` 등은 `tr` row array와 `ch` cell-shape map을 가진 table payload였고, `cs["...D79C"]`는 `img.bi`를 가진 image payload였다.
  - same-doc summary에서 `paragraphCount=129`, `tokenParagraphCount=15`, `tokenCount=18`, `uniqueControlIds=18`이 관측됐고, joined control kind는 `table=14`, `pageNumber=1`, `other=3`, `missing=0`이었다.
  - same-doc `bi` asset array에는 `image/jpg`, `image/png` asset descriptor가 존재했다. 즉 current strongest structured read path는 `hwpjson20` payload의 `ro + tp + cp + pp + st + cs + bi` 조합이다.
  - 사용자 요청 정정 기준 이번 정리의 초점은 current SDK 구현 감사가 아니라 `05-static-deob`가 보여주는 CDP-callable runtime entrypoint다.
  - static-deob 기준 generic write dispatcher의 current strongest root는 `window.HwpApp.ActionManager`이며, core callable surface는 `fPt(commandId, cti?)`, `LPt(commandId, cti?)`, `PPt(commandId, cti?, callback?)`, `cPt(actionTuple, propertyBag?)`, `dPt(actionTuple, propertyBag?, callback?)`, `NPt(commandId)`다.
  - `search`/structured read의 current strongest path는 여전히 `window.HwpApp.document.aPt().ENt().save("hwpjson20;")`다. `6971.module.js`에서 same serializer path가 직접 확인됐고, challenge capability 기준 text search는 이 structured payload를 client-side query로 처리하는 경로가 가장 강하다.
  - find/replace 계열의 current strongest direct command id는 `33824=find_next (dt.nC)`, `33809=replace_one (dt.ZE)`, `33810=replace_all (dt.HWPAID_EDIT_ALL_REPLACE)`다.
  - replace dialog static path는 `cti.ENt().INt().fPt(commandId, cti) -> action.dPt(OPt, propBag) -> ActionManager.QAt(action, OPt)` 순서로 고정된다. property bag에는 최소 `vt.zct` find text, `vt.Qct` replace text, `vt.Xct` direction, `vt.HWPITID_FNR_FIND_TYPE`가 들어간다.
  - `gotoPage`는 두 경로로 갈라진다. simple dispatcher는 `33697 (dt.kI)`이고, dialog-backed generic goto action은 `33840 (dt.hC)`다. static `2590-u_i.js`는 `dialog_goto -> Cre:[dt.hC]`, static action registry는 `mw[dt.hC] = { action: pw }`, core executor는 `pw.dPt -> s.jQe -> QQe`를 가리킨다.
  - `insertTable`의 current strongest direct command id는 `35456 (dt.KL)`다. helper `jv.dPt`는 `ActionManager.fPt(dt.KL, cti) -> cPt(tuple, bag) -> bag[vt.Uft=rowCount, vt.Wft=colCount] -> dPt(tuple, bag)` 순서를 직접 보여준다.
  - table row mutation의 current strongest direct command ids는 `35473=insert_upper_row (dt.fM)`, `35474=insert_lower_row (dt.lM)`, `35477=delete_row (dt.vM)`다. static registry와 `LPt`/`PPt` usage가 모두 확인됐고, 실행 전제는 active table-cell selection이다.
  - `insertImage`의 current strongest direct command id는 `34736 (dt.pk)`다. static `Ow.prototype.OKs(url)`는 `ActionManager.fPt(dt.pk, cti)`로 tuple을 만든 뒤 `gt.jHt(ActionManager.lPt(dt.pk))` bag에 nested `vt.got` child bag과 `vt.z8=url`을 넣고 `action.dPt(OPt, bag)`를 호출한다. 다만 same dialog class `jy`/`dy`는 `location_type=from_computer`, `from_computer` file widget, `URL.createObjectURL(file)`, `/webhwp/handler/upload/image/base64/` async upload 경로도 직접 보여준다. 즉 current static interpretation은 URL path와 local file upload path가 둘 다 first-class다.
  - `save`의 current strongest direct path는 numeric command보다 document actor command string이다. `saveActor.vsh()`와 UI bridge path에서 `window.HwpApp.INt(true).PPt("d_save")`가 직접 확인됐다.
  - 위 mapping은 current public SDK implementation 여부와 별개로, static-deob가 보여준 runtime callable path다. 일부 property key 의미는 아직 deob symbol 상태이며, public API로 고정하려면 live verification이 추가로 필요하다.
  - 9222 live verification에서 `window.HwpApp.ActionManager`는 실제로 `fPt/QAt/LPt/PPt/cPt/dPt/lPt/NPt` prototype을 노출했고, 이 surface가 static `gw.prototype.*` 구현과 일치했다.
  - 9222 live verification에서 `window.HwpApp.document.aPt().ENt().save("hwpjson20;")`는 structured object를 반환했고, disposable doc read-back에 seed text `alpha beta gamma`와 later mutations `omega beta gamma`, table token `<0B/74626C20/...>`가 직접 반영됐다.
  - replaceAll은 static `2562-ny.js`의 `uAs(): fPt(dt.HWPAID_EDIT_ALL_REPLACE) -> i.dHt(vt.HWPITID_FNR_FIND_TYPE, ...) -> r.dPt(s, i)`와 live behavior가 맞았다. disposable doc에서 UI capture 기준 `16384=find`, `16385=replace`, `16386=2(document whole)`, `16392=1`, `16406=1` bag state가 관측됐고, 같은 key set로 dialog 없이 `tuple.action.dPt(tuple.OPt, bag)`를 직접 호출했을 때 `deltadeltadelta -> omega` replace가 성공했다.
  - 2026-03-29 `chrome-9333` live doc probe에서 same confirmed bag state는 이미 case-sensitive로 동작했다. real doc marker `[SDK_SAVE_CHECK_20260329]`를 임시 probe string `[SDK_CASEPROBE_mdis_MDIS_20260329]`로 바꾼 뒤 같은 `16384/16385/16386/16392/16406` key set만으로 `mdis -> mdis_caseprobe` replaceAll을 replay했을 때 결과는 `[SDK_CASEPROBE_mdis_caseprobe_MDIS_20260329]`였고 uppercase `MDIS`는 유지됐다. same exact marker path로 원문을 다시 `[SDK_SAVE_CHECK_20260329]`까지 복구했다. same run에서 `ActionManager.dPt(...)=false`가 돌아와도 mutation은 실제로 적용됐으므로, current strongest interpretation은 `33810`에 한해 boolean return이 success signal로 신뢰되지 않는다는 것이다.
  - insertTable은 static `1540-jv.js`의 `dPt(): i.iHt(vt.Uft/Wft) -> s.fPt(dt.KL, t.cti) -> s.cPt(r, i) -> s.dPt(r, i)`와 live behavior가 맞았다. disposable doc에서 default bag의 numeric slots `16384/16385`를 `2/3`으로 바꿔 `ActionManager.dPt(tuple, bag)`를 호출했을 때 table control count가 `0 -> 1`, row count가 `2`, cell-shape count가 `6`으로 증가했다.
  - table row mutation은 static command ids `35474=insert_lower_row`, `35477=delete_row`와 live behavior가 맞았다. 같은 disposable doc에서 freshly inserted table context 그대로 `ActionManager.PPt(35474, cti)`는 row count를 `2 -> 3`으로 늘렸고, 이어서 `ActionManager.PPt(35477, cti)`는 `3 -> 2`로 되돌렸다.
  - goto는 9222 live multi-page repro까지 닫혔다. housing doc에서 static `33840 (dt.hC) -> pw.dPt -> jQe -> QQe` 경로를 따라 `ActionManager.PPt(33840, cti)`로 active dialog context를 만든 뒤 `e_goto.J2s({ value: { goto_input: "2", execute: "confirm" } })`를 직접 replay했을 때 `ActionManager.dPt(33840, bag)`가 실제 실행됐고, 후킹된 core navigator는 `jQe(type=1,page=2,flag=false,last=false) -> true`, `RQe.cOn(..., how=7) -> true`를 반환했다. same run에서 current page는 `1 -> 2`, `#hcwoViewScroll.scrollTop`은 `0 -> 286`으로 바뀌었다.
  - save는 static `saveActor.vsh(): i && i.PPt("d_save")` path가 맞지만, 9222 live target 두 문서 모두에서 `window.HwpApp.INt(true).LPt("d_save")`가 `{ enable:false }`였고 `PPt("d_save")`는 `false`를 반환했다. current interpretation은 callable path 자체는 맞지만 current session/doc state가 explicit save를 허용하지 않는다는 것이다.
  - insertImage는 local file upload path까지 9222 live로 닫혔다. disposable doc에서 `ActionManager.PPt(34736, cti)`는 actual "그림 넣기" dialog를 열었고, `upload_file`로 local `one-pixel.png`를 `from_computer` widget에 넣자 `넣기` 버튼이 활성화됐다. static `jy/dy` source와 정렬되게 live network에는 `blob:` preview fetch 2건, `POST /webhwp/handler/upload/image/base64/<docId>?session=...`, 이어서 `POST /webhwp/handler/action/<docId>` 2건이 관측됐다. same run에서 `ActionManager.dPt(34736, bag)`가 실제 실행됐고, read-back `hwpjson20` payload에는 `img.bi:"0000019D394E4E230000003E.png"` image control payload와 `bi` asset array growth가 반영됐다.
  - logged-in worker `chrome-9333` live probe에서 `document.F_r('object:1;clientinfo:1;emptypara:0')`는 `5876` logical line을 반환했고, 이 중 `5589` line이 `;t...:row:col` table-cell marker를 가졌으며 `;x...` textbox marker는 `4`개뿐이었다.
  - same probe artifact `tmp/discovery/05-static-deob/fr-hwpjson-join-2026-03-29T11-41-10-449Z-7EB8B5B8/`에 `hwpjson20-snapshot.json`, `fr-lines.txt`, `summary.json`을 남겼다.
  - static `6971.module.js`의 `rs.xLn()`는 `rs.DLn()`으로 table-local name(`tN`)을 먼저 증가시킨 뒤 각 cell paragraph를 `rs.YOn()`으로 내보낸다. 따라서 empty/object-only table은 public `F_r()` line을 하나도 만들지 않아도 serializer-local 번호를 소비할 수 있다.
  - same live doc에서 anchored `hwpjson20` table control은 `75`개였지만 public `F_r()` table bucket은 `73`개였고 이름도 `t1..t7, t10..t75`로 나왔다. current strongest interpretation은 `t8`, `t9`가 empty/object-only table slot으로 name만 소비되고 line은 내보내지 않은 케이스라는 것이다.
  - static `rs.VLn()`는 `gso` object를 `rs.jLn() -> rs.KLn()`으로 넘기고, 이 branch는 textbox/textart child에 대해서만 `rs.LLn()`/`rs.PLn()`을 통해 public line을 만든다. pure image-bearing `gso`는 별도 `F_r()` marker를 만들지 않는다.
  - same live doc에서 `hwpjson20` image control `17`개는 `ro/sl tx` marker scan으로 모두 anchor를 찾았지만, `F_r()`는 section-title textbox `x1..x4`만 노출했다. current strongest interpretation은 image anchor/order는 `F_r`가 아니라 `hwpjson20 ro/sl tx` graph가 canonical surface이고, `F_r`는 table/textbox text recovery surface라는 것이다.
  - follow-up live `readStructure()` rerun에서는 top-level image block이 `0`이었고, 첫 non-empty table의 first cell에서 nested `image` block이 직접 복구됐다. sample은 `tableId=01DCBF73168A94F000003FA9`, `cell(0,0)`, `controlId=01DCBF73168A94FA00003FAA`, `source=01DCBF7316A4D32E00008539.jpg`였다.
  - current strongest interpretation은 `sl.hp -> sl[np...]` paragraph chain이 table cell text뿐 아니라 cell-local image/object placement도 함께 보존한다는 것이다. canonical table read는 `ch` metadata-only parser가 아니라 `tr[*].so -> sl[cell] -> hp/np` block walk로 가야 한다.
  - source re-read 기준 table insert/delete aggregate command는 direct row ids와 별도다. `1556-h.js`는 `dt.uM` aggregate insert command에 property bag `vt.F4`를 쓰고 `vt.Nct`/`vt.Hct`를 direction/count override로 받는다. `1557-u.js`는 `dt.cM` aggregate delete command에 property bag `vt.B4`를 쓰고 `vt.xct`를 delete kind override로 받는다.
  - 같은 source re-read에서 single-shot direct ids `dt.fM/lM/oM/aM`는 결국 `cti.yJn().h0t(false, positionKind, count)`로 수렴하고, `dt.vM/dM`는 `cti.yJn().K2t(false, deleteKind)`로 수렴한다. 따라서 current SDK가 쓰는 `35473/35474/35477` direct path는 dialog helper의 축약 경로로 해석하는 것이 가장 강하다.
  - `h_.OnIsEnabled`는 `cti.yJn().h0t(true, 0, 0)`, `u_.OnIsEnabled`는 `cti.yJn().K2t(true, kind)`를 사용한다. 즉 row insert enable probe는 row-specific라기보다 generic table insertability gate에 가깝고, delete row enable probe는 delete kind별 gate가 더 직접적이다.
  - source만으로는 current table cell text edit 진입용 dedicated `ActionManager` command를 아직 확인하지 못했다. 현재 strongest interpretation은 `Enter/F2/Tab` 같은 key path가 editor state를 바꾸고, 실제 text commit은 pending insert queue `HwpApp.document.Evr.wVs.vqs[*]`와 caret-local cell text read-back으로 확인하는 흐름이라는 것이다.
  - 이 가설을 재현하기 위한 live probe entry는 `research/hancom/05-static-deob/examples/probe-table-edit-surface.ts`다. 이 probe는 `ActionManager` method hook과 `.hcwo_selected_cell` DOM class, direct command state, pending insert queue, caret-local state를 키 시퀀스별로 함께 기록한다.
  - 2026-03-29 live click repro에서 first-page visible info table bottom cell area `(x≈220,y≈520)`를 raw mouse event로 클릭하면 `.hcwo_selected_cell` DOM signal과 row command enablement는 계속 `false`였지만 `pageReadCurrentTableCellState()`는 empty paragraph block을 안정적으로 반환했다. current strongest interpretation은 text-caret-in-cell state와 toolbar-level cell-selection state가 분리되어 있다는 것이다.
  - same live repro에서 clicked cell에 `Enter`를 보낸 직후 pending insert queue는 `hInsert/type=998`로 바뀌었고 current cell paragraph id도 새 node id로 전환됐다. 반면 `F2` 추가 입력은 same snapshot 기준 별도 observable state change를 만들지 않았다.
  - same live repro에서 raw CDP `Tab`은 table traversal 대신 current cell paragraph에 literal tab/jamo-like text(`"\tྠĀ   \t"`)를 삽입했고 queue type도 `18`로 바뀌었다. 이어서 `Shift+Tab`은 queue를 `hUpdate/type=36`로 바꾸고 paragraph style variant를 바꿨지만 row command enablement는 여전히 켜지지 않았다.
  - same live repro에서 source-backed shortcut candidate `F5`도 current-cell state를 row-command-enabled selection으로 승격하지 못했다. click 후 `F5` 직후에도 `.hcwo_selected_cell` count와 `ActionManager.OnIsEnabled(35473/35474/35477)`는 계속 `false`였다.
  - 따라서 current live doc에서는 raw `Input.dispatchKeyEvent(Tab)`를 generic table-cell traversal primitive로 가정하면 위험하다. worker/disposable doc에서 관측된 traversal behavior는 문서/selection state에 의존하며, production fallback으로 바로 승격하면 real doc cell content를 오염시킬 수 있다.
- `probe-table-source-features` follow-up으로 확인한 `HwpApp.UIAPI.D0s`는 main editor selection helper가 아니라 dialog-local helper였다. live main editor에서는 `DialogManager.getDialogShowing()`가 `null`이어서 `getCellTableEl()` / `getSelectedCellElement()`가 그대로 `TypeError`를 던졌고, `getSelectCellInfo()`는 빈 객체를 반환했다.
- same target에서 `examples/sdk-demo.ts table-smoke 'A,B;C,D' above 1 1`은 API 레벨에서는 성공했지만, live read-back text와 small table census 기준 새 2x2 table에는 `A/B/C/D` 외에 `ㅚ`, `걱`, 탭/제어문자 계열 오염이 함께 남았다. current interpretation은 `fillTableCells()` fallback이 same-session observed-table path에서는 통과해도 clean text write는 아직 보장하지 못한다는 것이다.
- source-derived aggregate row probe `research/hancom/05-static-deob/examples/probe-table-aggregate-commands.ts`에서는 `pageReadDirectCommandState(35470/35475/35477)`가 모두 live에서 callable했고, aggregate insert `35470` with `{16384:2,16385:1}` / `{16384:3,16385:1}`과 aggregate delete `35475` with `{16384:1}`는 모두 `ok:true`를 반환했다.
- 다만 same live 문서에서는 create-table target이 기존 outer table cell 안으로 nested table로 흡수될 수 있어, simple last-table summary만으로는 aggregate row delta를 안정적으로 읽어내지 못했다. current interpretation은 command surface는 닫혔지만 semantic verification에는 stronger active-table locator가 필요하다는 것이다.
- live export cleanup rerun(`tmp/exports/hancom-export-20260329-2226-cleaned2.json`) 기준 `dominantTextStyle` mismatch, literal `<1F>/<0A>` token leakage, empty `table.rows[*].cells[*].blocks=[]`는 모두 해소됐다. current parsed export census는 `paragraphs=6580`, `tokenParagraphs=0`, `cellsWithoutBlocks=0`였다.
- same cleaned export 기준 남은 known issue는 warning `20`건뿐이다. 구성은 unclassified control `17`건(`secd`, `cold`, `pghd`, `gso`, `nwno`)과 unanchored image `3`건이다. current implementation은 이 control들을 warning으로만 남기고 public block으로 승격하지 않으므로, full-fidelity structured read로는 아직 미완이다.
- same cleaned export의 image source `19`개는 전부 session/doc-scoped `https://webhwp.hancomdocs.com/webhwp/resource/<docId>/...` URL이었다. current read에는 충분하지만 long-lived export artifact의 stable asset identity로 보긴 어렵다.
- user intent note: 이번 단계에서는 remaining issue를 기록만 하고 추가 구현/분류 작업은 진행하지 않기로 결정했다.
- SDK implementation now routes `save()` through a dedicated save-actor helper instead of `Cmd/Ctrl+S`. current production path reads `HwpApp.INt(true).LPt("d_save")` state, treats disabled+clean state as a no-op success, and executes `HwpApp.INt(true).PPt("d_save")` when the actor is enabled.
- SDK implementation now routes `insertImage({ path })` through the dialog-less exact path: local file bytes are converted to a page-local `blob:` URL, then `ActionManager.fPt(34736, cti) -> gt.jHt(518) -> bag.KHt(615,615) -> child[16414]=blobUrl, child[16415]=1, child[16436]=1 -> actionManager.dPt(tuple, bag)` is replayed directly.
- `readStructure()` canonical merge를 기준으로 `ro`와 `sl` 텍스트 체인 병합, table-cell chain 추적, 그리고 control anchor 경로를 보강했다. 다만 글로벌 문서 순서 보존/`F_r()` 순열 정합성, 이미지 anchor 순서 정규화, `sl`/`ro` 중복 규칙, row/col span 복원은 아직 미완이다.
- write-path의 1순위는 `ActionManager`와 `UIAPI` command mapping이다.
  - `webpackChunkwebapp`는 의미 복원 보조 수단으로 유지한다.
  - 접근성 경로는 fallback probe로만 유지한다.
- Next:
  - `hwpjson20` payload를 SDK `HancomDocument` shape로 변환하는 exact parser는 bridge에 연결됐다.
  - public write APIs를 DOM replay/shortcut fallback에서 exact `ActionManager` / `UIAPI` dispatcher 호출로 치환할 수 있는지 operation별로 다시 좁히기
  - 다음 단계는 `tx` control token marker enum과 `cs` payload kind를 더 넓게 live 검증하기
  - `cp.tc` color field와 visible `#RRGGBB` 변환 규칙을 확정하기
  - `pp.ah` 등 para-shape scalar를 public alignment enum으로 확정하기
  - 메뉴 interaction 전후 `ActionManager`/`UIAPI` 호출 경로를 가로채서 command dispatcher를 식별하기
  - probe 결과를 SDK bridge의 named method로 승격하기

## Candidate Entry Points

- `window` 전역 스캔
- application bootstrap object
- Redux-like store, service locator, event bus
- exposed command dispatcher
- `HwpApp.document` object graph
- `HwpApp.document.Svr.G0i` text chain
- `HwpApp.ActionManager` prototype methods
- `HwpApp.UIAPI` command helpers
- `webpackChunkwebapp` module runtime

## Failed Paths

### 2026-03-29
- `chrome://inspect/#remote-debugging` a11y snapshot만으로는 문서 내용이나 포맷팅 구조를 직접 얻을 수 없었다.
- top-level method name 검색만으로는 `text`, `paragraph`, `table` 같은 의미 있는 document API를 찾지 못했다.

## Notes Template

날짜별로 아래 형식으로 추가:

```md
### YYYY-MM-DD
- Probe:
- Observation:
- Conclusion:
- Next:
```
