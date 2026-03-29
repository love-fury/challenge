# 01 Foundation Handoff

## Conversation Context

- 사용자는 Hancom Docs Automation SDK 작업 전반에서 에이전트가 기술 결론뿐 아니라 짧은 대화 맥락도 남기길 원한다.
- 기록은 길 필요 없고, 사용자가 무엇을 원했는지와 대화 중 고정된 핵심 결정만 남겨야 한다.
- 이 저장소의 기록 방식은 `status.json`의 machine-readable `conversation_context`와 `handoff.md`의 짧은 사람용 요약을 함께 두는 하이브리드로 고정됐다.
- foundation handoff는 runtime inventory 요약에 더해 이 사용자 의도와 기록 규칙도 다음 에이전트가 유지하도록 전달해야 한다.

## To Downstream

- `02-read`, `04-write`: editor target candidate는 `url includes /webhwp/`, query `mode=HWP_EDITOR`, top-level `HwpApp` 존재, top-level canvas `2개`, iframe `3개`, `#hwpEditorBoardContent`를 가진 iframe `1개` 조합이다.
  evidence: `examples/discovery/01-foundation/editor-topology.ts`, `tmp/discovery/01-foundation/editor-topology.json`
  risk: iframe index는 바뀔 수 있으니 `iframe[2]`를 하드코딩하지 말고 `#hwpEditorBoardContent` 존재 여부를 marker로 써야 한다.
- `02-read`, `04-write`: runtime root는 top-level page context다. iframe 내부를 primary probe root로 삼지 말고 `HwpApp`를 바로 읽어라.
- `02-read`: `probeRuntimeInventory()`와 `inspectEditorFrames()`를 먼저 사용하면 text-chain probe 전에 editor frame/topology와 `HwpApp.document` surface를 빠르게 확인할 수 있다.
- `02-read`: exact direct read entrypoint는 `HwpApp.document.Svr.G0i`다. node field는 `Aoi`, `Csi`, `sdi.Msi`, `qli`, `tdi`로 고정해서 probe하면 된다.
- `02-read`: `HwpApp.document.Svr._Vi.G0i`도 node-like secondary root 후보다.
  evidence: `examples/discovery/01-foundation/text-chain-graph-scan.ts`, `tmp/discovery/01-foundation/text-chain-graph-scan.json`
  risk: live sample에서는 main `G0i`의 `tdi` chain에서 관측되지 않았으므로 same-chain alias인지, selection/cache root인지 아직 미확정이다.
- `02-read`: sampled node own path 중 안정적으로 반복된 것은 `Loi`, `$ci`, `tdi`, `sdi`, `hdi`, `udi`, `adi.Cci`다.
  evidence: `examples/discovery/01-foundation/text-chain-graph-scan.ts`, `tmp/discovery/01-foundation/text-chain-graph-scan.json`
  risk: 의미 해석은 아직 금지한다. 특히 `$ci`는 backward-like link로 보이지만 public 의미로 고정하지 마라.
- `02-read`: direct `node.vui.type`는 현재 문서에서 끝까지 `null`이었지만, `node.Loi[0].vui.type`은 live sample 전체에서 direct scalar `1`로 읽혔다. current exact discriminator candidate path는 `HwpApp.document.Svr.G0i.Loi[0].vui.type`이다.
  evidence: `examples/discovery/01-foundation/text-chain-discriminator-probe.ts`, `tmp/discovery/01-foundation/text-chain-discriminator-probe.json`
  risk: 현재 문서는 `type=1`밖에 없으므로 의미를 확정하면 안 된다.
- `02-read`: `Loi[0].vui.pos`는 live sample에서 `-1` 또는 `0`만 관측됐다. text/control 구분 보조 신호일 수 있지만 아직 confirmed semantics가 아니다.
- `02-read`: `adi.Cci`는 현재 문서에서 모든 sample이 empty array였다.
  evidence: `examples/discovery/01-foundation/text-chain-discriminator-probe.ts`, `tmp/discovery/01-foundation/text-chain-discriminator-probe.json`
  risk: path는 유지하되, non-empty payload가 나오는 richer document 전까지는 exact 구조 source로 승격하지 마라.
- `02-read`: `_Vi.G0i`는 main `G0i`의 sampled `tdi`/`$ci` chain에 속하지 않았다. alternate traversal root일 가능성이 크다.
- `02-read`: current live sample에서 `main:tdi`와 `main:$ci`는 동일한 `129` node set을 덮었고, `secondary:tdi`/`secondary:$ci`는 각각 `1` node만 가진 disjoint chain이었다.
  evidence: `examples/discovery/01-foundation/text-chain-chain-comparison.ts`, `tmp/discovery/01-foundation/text-chain-chain-comparison.json`
  risk: singleton `_Vi.G0i`의 의미는 아직 미확정이므로 traversal fallback으로 승격하지 마라.
- `02-read`: 다른 live 문서(`2025년+5월+경제활동인구조사+청년층+부가조사+결과.hwp`)의 `400/163 overlap` 관측은 sample limit artifact였다. full scan(`maxNodes=5000`) 기준으로는 `main:tdi`와 `main:$ci`가 다시 같은 `637` node set을 덮었다.
  evidence: `tmp/discovery/01-foundation/text-chain-chain-comparison-youth-survey-full.json`
  risk: `$ci` semantics는 작은 sample로 확정하면 안 된다.
- `02-read`: `_Vi.G0i` alternate-root 해석은 두 문서에서 동일하게 유지됐다. 두 문서 모두 `secondary:tdi`/`secondary:$ci`가 `1` node singleton이고 main chain overlap이 `0`이었다.
- `02-read`: current document 기준 `Loi[0].vui.pos` histogram은 `-1 x119`, `0 x10`이다. node type semantics는 아직 모르지만, candidate discriminator 보조축으로는 유지할 가치가 있다.
- `02-read`: 다른 live 문서 full scan에서는 `Loi[0].vui.pos`가 `637` node 전체에서 전부 `-1`이었다. `pos`도 doc-invariant 값으로 가정하면 안 된다.
- `02-read`, `04-write`: foundation breadth-first option map은 `docs/task-requests/01-foundation/exploration-options.md`를 먼저 보라. table-first 다음 분기 후보와 evidence가 정리돼 있다.
- `02-read`, `04-write`: breadth-first path coverage와 subagent assignment source of truth는 `docs/task-requests/01-foundation/exploration-registry.json`이다. 사람용 운영 규칙은 `docs/task-requests/01-foundation/exploration-registry.md`를 보라.
- `02-read`, `04-write`: top-level `HwpApp` own key inventory는 live seed 기준 `106개`다. 새 top-level key가 생기면 registry부터 갱신해야 한다.
  evidence: `examples/discovery/01-foundation/exploration-registry-seed.ts`, `tmp/discovery/01-foundation/exploration-registry-seed-youth-survey.json`
- `02-read`, `04-write`: document model 밖 table-first branch에서는 `HwpApp.UIAPI.getWidgetElementList`, `findContainerNodeToParent`, `getContainerSizeInfo`를 가장 먼저 보라.
  evidence: `docs/task-requests/01-foundation/exploration-options.md`
  risk: 아직 live invocation shape는 미확정이므로 실제 호출 전 `fn.length`, `fn.name`, `Function.prototype.toString.call(fn)`부터 확인해야 한다.
- `02-read`, `04-write`: live census 기준 `getWidgetElementList("c_insert_row_col_list")`와 `getWidgetElementList("c_remove_row_col_list")`는 각각 `HTMLDivElement 2개`를 반환했고, title-bar branch ancestor trail에 `class="table_view title_panel"`와 `data-name="table"`가 직접 나타났다.
  evidence: `examples/discovery/01-foundation/widget-state-census.ts`, `tmp/discovery/01-foundation/widget-state-census-youth-survey.json`
  risk: 현재는 non-table context snapshot이라 subgroup class가 `disable disabled`다. table cell click 후 class 제거 여부를 다시 비교해야 한다.
- `02-read`, `04-write`: `examples/discovery/01-foundation/table-context-transition-grid.ts`는 raw CDP click grid와 widget/enablement snapshot을 묶어 table-context 좌표를 찾는 기본 locator probe다.
  evidence: `tmp/discovery/01-foundation/table-context-transition-grid-youth-survey.json`
  risk: default grid(`42 clicks`)에서는 `tableContextPositive=0`이었다. coarse viewport click만으로는 table cell locator를 못 잡으므로, 다음 단계는 denser grid 또는 document-derived coordinate seed가 필요하다.
- `02-read`, `04-write`: `examples/discovery/01-foundation/table-context-ui-action-trace.ts`는 `UIAPI.getWidgetElementList`, `findContainerNodeToParent`, `findCommandWrapToParent`, `getContainerSizeInfo`, `getSampleElementListByCmdName`, `getSampleElementListToDescObj`, `makeEventActionObj`, `addEventAction`, `ActionManager.OnIsEnabled`, `SetUIEventListener`를 한 번에 wrap해서 click-time 함수 집합을 채집한다.
  evidence: `tmp/discovery/01-foundation/table-context-ui-action-trace-youth-survey-worker-9333.json`
  risk: baseline snapshot 함수와 섞이지 않도록 click 직후 trace를 먼저 읽고, state snapshot은 clear 뒤에 별도로 읽어야 한다.
- `02-read`, `04-write`: `Object.getPrototypeOf(HwpApp.ActionManager).OnIsEnabled.call(HwpApp.ActionManager, 35456)`은 현재 문맥에서 `true`, `35474`는 `false`였다.
  evidence: `examples/discovery/01-foundation/widget-state-census.ts`, `tmp/discovery/01-foundation/widget-state-census-youth-survey.json`
  risk: action id semantics는 write evidence와 함께만 해석하라. 특히 `35474`는 table cell click 후 다시 확인이 필요하다.
- `02-read`, `04-write`: worker `9333`의 youth-survey target에서 `table-context-ui-action-trace` default `3 x 3` sweep을 다시 돌리면 positive offset이 `(520,180)`, `(160,320)`, `(320,520)`, `(520,520)`로 잡힌다. 이 네 점은 current reliable table-context seed다.
  evidence: `tmp/discovery/01-foundation/table-context-ui-action-trace-youth-survey-worker-9333.json`
- `02-read`, `04-write`: current strongest positive 판정은 `OnIsEnabled(35474)=true`와 row/col widget disabled-state 해제의 동시 충족이다. baseline은 `35474=false`, `disabledAncestorCount=[2,2]`이고 positive sample은 최소 한쪽 panel에서 `disabledAncestorCount=0`으로 바뀌었다.
  evidence: `tmp/discovery/01-foundation/table-context-ui-action-trace-youth-survey-worker-9333.json`
- `02-read`, `04-write`: table-context secondary signal로는 `c_insert_row_col_list`, `c_remove_row_col_list`, `dialog_edit_table` enablement가 가장 강하다. direct table source는 아니지만 "현재 선택이 표 안인가"를 라벨링하는 데 유효하다.
- `02-read`, `04-write`: non-model probe는 `UIAPI` widget/container hook, table-context transition trace, secondary UI-state snapshot, transient overlay observer 순으로 쌓아라. DOM/a11y는 primary truth source로 승격하지 마라.
- `02-read`, `04-write`: `ActionManager` trace에서 `35456/35474`가 broad click sweep 전반에 반복될 수 있다. action id 존재 여부만으로 table-context positive를 판정하지 말고, `widget disabled-state`와 `OnIsEnabled(35474)` direct bit를 먼저 보라.
- `02-read`, `04-write`: current click-time trace에서 실제로 살아 움직인 함수는 `getWidgetElementList`, `findContainerNodeToParent`, `findCommandWrapToParent`, `isUiMenuFocus`, `isTitleBarMenuOn`, `OnIsEnabled`였다. 일부 sample에서는 `getSampleElementListByCmdName("collabo_user")`가 보였지만 `getContainerSizeInfo`, `getSampleElementListToDescObj`, `makeEventActionObj`, `addEventAction`, `SetUIEventListener`는 아직 안 불렸다.
  evidence: `tmp/discovery/01-foundation/table-context-ui-action-trace-youth-survey-worker-9333.json`
  risk: command-helper 쪽은 table cell click만으로는 충분하지 않을 수 있다. 다음 단계는 positive 좌표에서 title/context menu open이나 dialog launch를 함께 걸어 richer interaction을 만들어야 한다.
- `02-read`: document model 쪽 새 off-main 후보는 `HwpApp.document.Zvr.$bi`다. `Zvr.$bi.G0i`는 node-like root이고 `Svr.G0i` main chain과 겹치지 않는다.
  evidence: `examples/discovery/01-foundation/breadth-first-option-sweep.ts`, `tmp/discovery/01-foundation/breadth-first-option-sweep-youth-survey.json`
  risk: 아직 full recursive control-root probe는 없으므로 table/image root로 확정하지 마라.
- `02-read`: `HwpApp.document.Svr._ie`는 repeated object array, `HwpApp.document.Ivr.{o6n,h6n,u6n,z5n}`는 non-style property-table 후보로 확인됐다.
  evidence: `examples/discovery/01-foundation/breadth-first-option-sweep.ts`, `tmp/discovery/01-foundation/breadth-first-option-sweep-youth-survey.json`
  risk: 의미 해석 대신 join probe를 먼저 만들고 `styleRef`나 control root와 교차해라.
- `02-read`: `examples/discovery/01-foundation/document-graph-cross-join.ts` 기준 youth-survey 문서에서 `Svr._Vi`와 `Zvr.$bi`는 같은 control-root family shape를 가지지만 alias는 아니었다. 두 branch의 `G0i`는 각각 singleton chain(`tdi=1`, `$ci=1`)이고 main chain overlap이 `0`이었다.
  evidence: `tmp/discovery/01-foundation/document-graph-cross-join-youth-survey.json`
  risk: container shape similarity만으로 같은 semantic role로 승격하지 마라. `_Vi`와 `$bi`의 deeper child(`z0i`, `gun`, `_Vi`)를 exact relation probe로 다시 확인해야 한다.
- `02-read`: `Svr._ie[*]`와 `_Vi.gun[*]` shallow sample은 모두 같은 scalar pattern(`ubi=0`, `cZi=0`, `dZi=false`, `Y9i=1`, `v8i=0`)만 보였고 depth-2 범위에서 node descendant가 없었다.
  evidence: `tmp/discovery/01-foundation/document-graph-cross-join-youth-survey.json`
  risk: `_ie`를 table/image root로 성급히 취급하지 말고, catalog/registry 가능성을 먼저 둬라.
- `02-read`: current `Ivr` non-style table candidates 중 populated child array가 가장 강한 것은 `o6n.n4n(118)`, `h6n.$0n(7)`, `h6n.e2n`, `u6n.U4n(18)`, `z5n.n4n(10)`이다. table-first 다음 probe는 이 child arrays/records를 exact discriminator 후보로 승격하는 쪽이 맞다.
  evidence: `tmp/discovery/01-foundation/document-graph-cross-join-youth-survey.json`
  risk: current cross-join은 shallow depth만 봤으므로, table/cell/image semantics는 child payload를 더 직접 읽기 전까지 확정 금지다.
- `02-read`, `04-write`: 새 `chrome-workers` Chrome 프로세스를 다시 띄운 뒤에도 이번 라운드의 실제 attach/probe는 worker `9333`의 editor target `A3E565BFDE99512E6DE605079EAD9D50`에서 수행했다.
- `02-read`: `Ivr.z5n.n4n[*].PLi[*].type` histogram은 current document에서 `0 x80`, `1 x3`, `3 x1`로 갈렸고 parent sample은 `cUt=0`, `yTi=true` 패턴을 유지했다. 현재 foundation에서 가장 강한 table-structure discriminator path는 `HwpApp.document.Ivr.z5n.n4n[*].PLi[*].type`이다.
  evidence: `examples/discovery/01-foundation/ivr-table-image-split.ts`, `tmp/discovery/01-foundation/ivr-table-image-split-youth-survey-worker-9333.json`
  risk: semantic label은 아직 inference다. live table selection과 결합해 다시 확인해야 한다.
- `02-read`: `examples/discovery/01-foundation/z5n-pli-exact-nested.ts` 기준 `type=0`은 주로 `parent Xli=1/18`, `type=1`은 `parent Xli=1/5/6`, `type=3`은 `parent Xli=1`에서만 관측됐다. current table branch에서는 `type` 단독보다 `type + parent Xli + J6t/Z6t` 조합으로 해석해야 한다.
  evidence: `tmp/discovery/01-foundation/z5n-pli-exact-nested-youth-survey-worker-9333.json`
  risk: 아직 live selection state와 직접 결합하지 않았으므로 semantic label은 고정하지 마라.
- `02-read`: `examples/discovery/01-foundation/z5n-pli-cluster.ts` 기준 현재 문서의 `PLi[*]` triple은 `0|0|0`, `0|3|0`, `1|3|0`, `3|3|0` 네 bucket뿐이다. 특히 `Xli=18` parent cluster는 `39개` 전부 `0|0|0`이고, rare `type=1/3`은 `Xli=1/5/6`에서만 나온다.
  evidence: `tmp/discovery/01-foundation/z5n-pli-cluster-youth-survey-worker-9333.json`
  risk: `type`보다 `triple + parent Xli`를 먼저 쓰고, selection join 전에는 table semantic을 고정하지 마라.
- `02-read`: `Ivr.u6n.U4n[*]` extension histogram은 `bmp x9`, `png x6`, `jpg x3`였고 sampled parent는 `cUt=1`, `Xli=3`, file-like name을 직접 담았다. image-like payload branch 후보로는 현재 가장 강하다.
  evidence: `examples/discovery/01-foundation/ivr-table-image-split.ts`, `tmp/discovery/01-foundation/ivr-table-image-split-youth-survey-worker-9333.json`
  risk: 이미지 semantic은 payload-shape inference다. promoted contract가 아니라 working hypothesis로만 유지해라.
- `02-read`: `examples/discovery/01-foundation/o6n-zli-join.ts` 기준 `u6n.U4n[*].Qli`는 `u6n.F4n[*].id/vti`와 각각 `18개` exact overlap을 보였다. current image-like branch에서는 `Qli`가 internal registry join key로 동작한다.
  evidence: `tmp/discovery/01-foundation/o6n-zli-join-youth-survey-worker-9333.json`
  risk: 이 join은 `u6n` 내부에 한정된다. 외부 graph나 control root와의 join으로 과잉해석하면 안 된다.
- `02-read`: `o6n.qli`, `o6n.zli.qli`는 `z5n.qli`나 `u6n.FFi`와 overlap이 `0`이었다. current evidence에서는 `o6n.zli`를 table/image primary bridge로 두지 말고 cell metadata 또는 별도 registry 후보로 낮춰라.
  evidence: `tmp/discovery/01-foundation/o6n-zli-join-youth-survey-worker-9333.json`
- `02-read`, `04-write`: `chrome-workers` 재현에서는 `npm run example:chrome-workers -- launch ...`로 `9334`를 새로 띄웠지만, 실제 foundation attach/probe는 이미 `ready_for_attach`였던 `9333`에서 수행했다. 이 라운드에서 `--port 9333`로 남은 artifact를 authoritative evidence로 봐라.
- `02-read`, `04-write`: worker `9333` focused rerun 기준 positive table band는 현재 viewport에서 `yOffset=180/220/260`이며, positive `xOffset`은 각각 `[300,420..840]`, `[480..840]`, `[300..840]`다. 다음 live interaction probe는 이 band 위에서만 돌려라.
  evidence: `tmp/discovery/01-foundation/table-context-transition-grid-youth-survey-worker-9333-focused.json`
- `02-read`, `04-write`: `ActionManager.OnIsEnabled(35474)`는 이제 baseline-only bit가 아니다. focused positive band 전반에서 `true`로 뒤집혔고 `c_insert_row_col_list`는 일관되게 enabled state로 풀렸다.
  evidence: `tmp/discovery/01-foundation/table-context-transition-grid-youth-survey-worker-9333-rerun.json`, `tmp/discovery/01-foundation/table-context-transition-grid-youth-survey-worker-9333-focused.json`
- `02-read`, `04-write`: `examples/discovery/01-foundation/table-context-positive-seed-sweep.ts` 기준 focused seed `(520,180)`, `(320,320)`, `(520,320)`, `(160,320)`, `(520,520)` 중 `3/5`가 `tableContextPositive=true`였다. positive sample은 공통으로 `OnIsEnabled(35474)=true`, `enabledActionIds=[35456,35474]`, `selectionObjectSignals=["modify_object_properties"]`를 보였고, `selectionTableSignals`는 최소 `["c_insert_row_col_list","dialog_edit_table"]`였다.
  evidence: `tmp/discovery/01-foundation/table-context-positive-seed-sweep-youth-survey-worker-9333.json`
- `02-read`: 같은 focused sweep에서 `z5n` top triple bucket과 parent cluster signature는 baseline/positive/negative sample 전부 동일했다. 현재는 `Ivr.z5n.n4n[*].PLi[*]`를 live selection bit가 아니라 document-level structural table map으로 다루는 쪽이 맞다.
  evidence: `tmp/discovery/01-foundation/table-context-positive-seed-sweep-youth-survey-worker-9333.json`, `tmp/discovery/01-foundation/z5n-pli-cluster-youth-survey-worker-9333-rerun.json`
  risk: selection-local join key를 아직 못 잡았으므로 `z5n`을 active selection 자체로 과잉해석하면 안 된다.
- `02-read`, `04-write`: `examples/discovery/01-foundation/table-context-menu-interaction.ts` 기준 focused positive seed 위에서 `dialog_edit_table`와 `modify_object_properties`를 invoke하면 `ActionManager.NPt`와 `dispatcher.RMs`가 함께 깨어났고, 공통 numeric arg는 `35628`이었다. 이 경로가 현재 가장 가까운 selection-local dispatch surface다.
  evidence: `tmp/discovery/01-foundation/table-context-menu-interaction-youth-survey-worker-9333.json`
- `02-read`, `04-write`: 같은 probe에서 `dialog_edit_table` launcher는 hidden-enabled 상태로 존재했고 invoke 뒤에는 `data-ui-value="dialog_edit_table"` close button이 visible이 되어 actual dialog open이 확인됐다.
  evidence: `tmp/discovery/01-foundation/table-context-menu-interaction-youth-survey-worker-9333.json`
- `02-read`, `04-write`: 반대로 `makeEventActionObj`, `addEventAction`, `SetUIEventListener`는 richer interaction 후에도 끝내 안 깨어났다. current interaction class에서는 이 셋을 primary dispatch path로 잡지 말고 dead-end candidate로 낮춰라.
  evidence: `tmp/discovery/01-foundation/table-context-menu-interaction-youth-survey-worker-9333.json`
  risk: helper surface inventory와 actual dispatch surface를 섞어 해석하면 안 된다. 다음 dispatch probe는 `NPt/RMs(35628)` object sampling 쪽으로 옮겨라.
- `02-read`: exact style table entrypoint는 `HwpApp.document.Ivr.Y5n.n4n`와 `HwpApp.document.Ivr.$5n.n4n`다. char-style은 `aXt[0].DXt`, `SXt`, `oqt`, `wTi`, `bTi.Msi`, para-style은 `FNi`, `Xli`를 우선 읽으면 된다.
- `02-read`: font 이름 검증은 `HwpApp.FontManager.GetFontListAll()`로 교차검증할 수 있다.
- `02-read`: exact command-helper bucket은 `HwpApp.UIAPI.makeEventActionObj`, `HwpApp.UIAPI.addEventAction`, `HwpApp.UIAPI.getSampleElementListByCmdName`, `HwpApp.UIAPI.getSampleElementListToDescObj`, `HwpApp.UIAPI.findCommandWrapToParent`다.
  evidence: `examples/discovery/01-foundation/command-glossary.ts`, `tmp/discovery/01-foundation/command-glossary.json`
  risk: 현재는 helper surface inventory만 확보됐고 actual richer interaction에서는 `NPt/RMs(35628)`가 먼저 깨어났다. helper path를 primary dispatch path로 가정하지 마라.
- `02-read`: no-fallback rule. `readText()`/`readStructure()`/`readParagraphFormatting()` fallback 결과를 진실로 간주하지 말고, direct object graph에서 같은 정보를 다시 확인해야 한다.

## Needs From Upstream

- 없음.
