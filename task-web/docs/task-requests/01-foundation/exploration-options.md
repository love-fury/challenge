# 01 Foundation Exploration Options

이 문서는 foundation 관점에서 table-first 탐색 옵션을 breadth-first로 정리한 catalog다.
목표는 세부 digging 전에 "어디를 더 팔 수 있는지"를 빠르게 공유하는 것이다.

path coverage와 lane/subagent assignment source of truth는 `docs/task-requests/01-foundation/exploration-registry.json`이다.

## Priority Rule

- `table` 탐색 우선순위는 `exact discriminator` 가능성이 높은 순으로 둔다.
- `G0i` main chain 재탐색보다 `Svr` alternate root와 `UIAPI/ActionManager` selection signal을 우선 본다.
- HTML/overlay는 보조 증거로만 쓴다. primary truth source로 승격하지 않는다.

## Option Map

| Branch | Promise | Exact Target | Current State | Why It Matters Next |
| --- | --- | --- | --- | --- |
| `Svr` sibling roots | highest | `HwpApp.document.Svr.{K0i,j0i,Y0i,V0i,z0i,Q0i,X0i,q0i,J0i,Z0i}` | untouched | table/image가 `G0i` main chain 밖 branch일 가능성이 가장 높다 |
| `Zvr.$bi` control root | highest | `HwpApp.document.Zvr.$bi.{G0i,vie,_ie}` | newly confirmed | `Zvr.$bi.G0i`는 main `Svr.G0i`와 겹치지 않는 off-main root다 |
| `Svr._Vi` family | high | `HwpApp.document.Svr._Vi`, `_Vi.G0i`, sibling keys under `_Vi` | partially probed | `_Vi.G0i`는 두 문서에서 disjoint singleton이었다. selection/cache root인지 table/image root인지 더 확인 필요 |
| `Svr._ie` registry | high | `HwpApp.document.Svr._ie[*]` | newly confirmed | repeated object array라 embedded object catalog 가능성이 높다 |
| `Ivr` non-style tables | high | `HwpApp.document.Ivr.{o6n,h6n,u6n,z5n}` | newly confirmed | style table 밖 property table이라 table/cell/control join 후보가 된다 |
| `Loi[*].vui` | high | `HwpApp.document.Svr.<node>.Loi[*].vui.{type,pos}` | partially probed | 현재 유일한 stable discriminator-like scalar source다 |
| `adi.Cci` payload | medium | `HwpApp.document.Svr.<node>.adi.Cci[*]` | path confirmed, payload missing | table/image payload가 다른 문서나 다른 branch에서만 채워질 수 있다 |
| `UIAPI` widget/container APIs | high | `HwpApp.UIAPI.getWidgetElementList`, `findContainerNodeToParent`, `getContainerSizeInfo` | untouched for table-first | 표 선택 시 widget/container identity를 바로 줄 가능성이 있다 |
| `UIAPI` command sample APIs | medium | `getSampleElementListByCmdName`, `getSampleElementListToDescObj`, `findCommandWrapToParent` | inventory only | table 메뉴/command와 internal descriptor를 연결할 수 있다 |
| `ActionManager` hooks | high | `SetUIEventListener`, `OnIsEnabled` | untouched for live interception | 표 셀 선택/표 메뉴 활성화 순간 object type이나 command name이 튈 가능성이 있다 |
| `Models/appState/cache/Core` | medium | `HwpApp.Models`, `appState`, `cache`, `Core` | largely untouched | selected object type이나 active controller state가 숨어 있을 수 있다 |
| HTML/overlay signals | medium | `#hwpEditorBoardContent` 주변 overlay, toolbar/context state | mostly untouched | primary truth는 아니지만 "현재 선택이 표인가" 같은 보조 state를 줄 수 있다 |

## Non-Document-Model Table Signals

`G0i` 바깥에서 table-first로 가장 유망한 순서는 아래와 같다.

| Surface | Promise | Exact Target | Current State | Why It Matters Next |
| --- | --- | --- | --- | --- |
| widget/container APIs | highest | `HwpApp.UIAPI.getWidgetElementList`, `findContainerNodeToParent`, `getContainerSizeInfo` | untouched | text-chain 바깥 widget/container tree를 바로 가리킬 가능성이 가장 높다 |
| table-context command enablement | high | `[data-command="c_insert_row_col_list"]`, `[data-command="c_remove_row_col_list"]`, `dialog_edit_table` | partially evidenced | table 안에 들어갔는지 strongest secondary signal을 준다 |
| command sample APIs | high | `getSampleElementListByCmdName`, `getSampleElementListToDescObj`, `findCommandWrapToParent` | inventory only | table command descriptor나 widget sample을 internal object와 연결할 수 있다 |
| UI state bits | medium | `isUiMenuFocus`, `isTitleBarMenuOn`, `showMsgBar` | inventory only | table selection 전이와 menu/context 전이를 구분하는 보조 비트가 될 수 있다 |
| overlay / a11y mutations | medium | `data-command`, `data-ui-command`, `data-ui-value`, `aria-disabled`, `[role="option"]`, `[role="alert"]` | partially evidenced | primary truth는 아니지만 exact selection tick 라벨링에 유효하다 |
| iframe/editor-board raw DOM | low | `#hwpEditorBoardContent` 내부 DOM | weak | topology marker로는 유효하지만 table structure source로는 약하다 |

## Current Best Evidence

- `getWidgetElementList("c_insert_row_col_list")`와 `getWidgetElementList("c_remove_row_col_list")`는 현재 youth-survey 문서에서 각각 `HTMLDivElement 2개`를 반환했고, title-bar branch ancestor trail에 `class="table_view title_panel"`와 `data-name="table"`가 직접 나타났다.
- 같은 widget은 current non-table context에서 `sub_group disable disabled` class를 갖는다. table cell 진입 후 class 제거 여부를 보면 table-context transition을 바로 라벨링할 수 있다.
- `Object.getPrototypeOf(HwpApp.ActionManager).OnIsEnabled.call(HwpApp.ActionManager, 35456)`은 `true`, `35474`는 `false`였다. table dialog gate와 row/col gate를 direct runtime bit로 구분할 수 있다.
- current live rerun 기준 `HwpApp.document.Zvr.$bi`는 `HwpApp.document.Svr._Vi`와 같은 control-root outer shape를 노출하고, `Zvr.$bi.G0i`는 main `Svr.G0i`와 겹치지 않는 node-like off-main root다.
- `HwpApp.document.Svr._ie`는 repeated object array로 확인됐다. chain walk보다 embedded object catalog 쪽으로 먼저 의심해야 한다.
- `table-context-transition-grid` default run에서는 `42 clicks` 전부 `tableContextPositive=false`였다. coarse viewport click만으로 table locator를 찾는 것은 부족했다.
- 같은 run에서 `ActionManager` trace는 `35456/35474`를 거의 모든 click에서 포함했다. trace action id 존재만으로는 table locator를 만들 수 없다.
- `table-context-ui-action-trace` default `3 x 3` run에서는 worker `9333` 기준 `4개` positive click이 바로 잡혔다. offset은 `(520,180)`, `(160,320)`, `(320,520)`, `(520,520)`였다.
- 같은 trace에서 baseline은 `OnIsEnabled(35474)=false`, row/col panel `disabledAncestorCount=[2,2]`였고 positive sample은 `OnIsEnabled(35474)=true`와 panel disabled-state 해제가 함께 나타났다. current best locator는 이 조합이다.
- click-time에 실제로 살아 움직인 함수는 `getWidgetElementList`, `findContainerNodeToParent`, `findCommandWrapToParent`, `isUiMenuFocus`, `isTitleBarMenuOn`, `OnIsEnabled`였다. 일부 sample에서는 `getSampleElementListByCmdName("collabo_user")`가 추가로 보였다.
- 반대로 이번 sweep에서는 `getContainerSizeInfo`, `getSampleElementListToDescObj`, `makeEventActionObj`, `addEventAction`, `SetUIEventListener` 호출은 아직 관측되지 않았다. richer menu/dialog interaction이 있어야 할 가능성이 크다.
- `document-graph-cross-join` 기준 `Svr._Vi`와 `Zvr.$bi`는 같은 control-root family shape를 가지지만 alias는 아니었다. 둘 다 singleton off-main chain으로 남아 있다.
- 같은 probe에서 `Svr._ie[*]`와 `_Vi.gun[*]` shallow sample은 node descendant 없이 반복 scalar 패턴만 보였다. `_ie`는 current evidence로는 catalog/registry 쪽이 더 가깝다.
- `Ivr` non-style tables 중 populated child array는 `o6n.n4n(118)`, `h6n.$0n(7)`, `u6n.U4n(18)`, `z5n.n4n(10)`이 가장 강하다. table-first 다음 read probe는 이 child payload를 먼저 직접 읽는 쪽이 낫다.
- `ivr-table-image-split` 기준 `z5n.n4n[*].PLi[*].type` histogram은 `0 x80`, `1 x3`, `3 x1`로 갈렸다. current foundation evidence에서는 이 path가 table-structure discriminator 후보 1순위다.
- `z5n-pli-exact-nested` 기준 `type=0`은 주로 `parent Xli=1/18`, `type=1`은 `parent Xli=1/5/6`, `type=3`은 `parent Xli=1`에서만 보였다. current best table probe는 `PLi[*].type` 단독이 아니라 `type + parent Xli + J6t/Z6t` 묶음이다.
- `z5n-pli-cluster` rerun 기준 triple histogram은 사실상 `0|0|0 x76`, `0|3|0 x4`, `1|3|0 x3`, `3|3|0 x1`로 고정된다. rare type은 `J6t=3,Z6t=0`에 몰리고, 흔한 type은 대부분 `J6t=0,Z6t=0`이다.
- 같은 probe에서 `u6n.U4n[*]` extension histogram은 `bmp x9`, `png x6`, `jpg x3`였고 sampled payload는 file-like name과 확장자를 직접 노출했다. image-like branch 후보로는 가장 강하다.
- `o6n-zli-join` 기준 `u6n.U4n[*].Qli`는 `u6n.F4n[*].id/vti`와 각각 `18개` exact overlap을 보였다. image-like branch의 다음 exact join key는 `Qli`다.
- 같은 probe에서 `o6n.qli`, `o6n.zli.qli`는 `z5n.qli`나 `u6n.FFi`와 overlap이 `0`이었다. `o6n.zli`는 direct table/image bridge 우선순위를 낮춰도 된다.
- `table-context-positive-seed-sweep` 기준 positive seed에서는 `selectionState.tableSelectionSignals`가 실제로 같이 살아났지만, 같은 tick의 `z5n` triple/parent-cluster signature는 baseline과 완전히 같았다. `z5n`은 selection-local signal보다 document-level structural table map으로 보는 편이 맞다.
- `table-context-menu-interaction` 기준 richer interaction에서도 `makeEventActionObj`, `addEventAction`, `SetUIEventListener`는 안 깨어났다. 대신 `dialog_edit_table`/`modify_object_properties` invoke에서 `ActionManager.NPt`와 `dispatcher.RMs`가 `35628`로 같이 깨어났다.
- 같은 probe에서 `dialog_edit_table` launcher는 hidden-enabled 상태로 존재했고 invoke 뒤 close button이 visible이 되었다. current closest dispatch surface는 helper bucket보다 `NPt/RMs(35628)` 쪽이다.

## Recommended Table-First Probes

1. `UIAPI` tree-query hook
   positive 좌표를 seed로 `getWidgetElementList`, `findContainerNodeToParent`, `getContainerSizeInfo`를 wrap해서 click 전후 호출 차이를 기록한다.
2. table-context transition trace
   현재 positive 좌표에서 table cell click 뒤 `표` 메뉴 open 또는 context menu open까지 이어서 `makeEventActionObj`, `addEventAction`, `getSampleElementListByCmdName`, `getSampleElementListToDescObj`, `findCommandWrapToParent`, `OnIsEnabled`, `SetUIEventListener`를 함께 wrap한다.
   current evidence로는 helper bucket보다 `NPt/RMs(35628)` sampling 우선순위가 더 높다.
3. secondary UI-state snapshot
   같은 tick에 `isUiMenuFocus`, `isTitleBarMenuOn`, `document.activeElement`, enabled command dataset를 함께 읽어서 table selection 시점을 라벨링한다.
4. transient overlay observer
   top-level document와 editor-board iframe 둘 다에 `MutationObserver`를 잠깐 붙여 `role`, `aria-*`, `data-command`, `data-ui-*` 변화만 기록한다.
5. safe reconnaissance before invocation
   실제 호출 전 `Function.prototype.toString.call(fn)`, `fn.length`, `fn.name`만 먼저 읽어서 signature risk를 줄인다.

## Current Facts That Narrow The Search

- `HwpApp.document.Svr.G0i`는 stable text-chain root다.
- `HwpApp.document.Svr._Vi.G0i`는 두 문서에서 main `G0i` chain과 disjoint singleton이었다.
- `Loi[0].vui.type`는 두 문서 full scan에서도 계속 `1`만 나왔다.
- `adi.Cci`는 두 문서 full scan에서도 empty array였다.
- `$ci`는 small sample에서는 오해될 수 있다. full scan으로 해석해야 한다.

## Recommended Next Branch

1. current positive click seed에서 `UIAPI` widget/container API probe
2. current positive click seed에서 `ActionManager.OnIsEnabled` matrix + `SetUIEventListener` shim
3. positive 좌표에서 `표` 메뉴 open/context menu open을 추가해 command-helper 호출 유도
4. `Ivr.z5n.n4n[*].PLi[*]` triple probe
   `type`, `J6t`, `Z6t`, parent `Xli/Qli`를 live table selection signal과 같은 tick에서 비교한다.
5. `UIAPI`/`ActionManager` table-selection transition
   `getWidgetElementList("c_insert_row_col_list")`, `OnIsEnabled(35474)`, `SetUIEventListener`를 table cell click 전후로 묶는다.
   focused positive seed는 현재 `[(520,180), (320,320), (520,320)]`까지 좁혀졌다.
6. `ActionManager.NPt` / `dispatcher.RMs` dispatch sampling
   focused positive seed에서 `dialog_edit_table` 또는 `modify_object_properties` invoke 후 `35628` dispatch result object의 own keys와 scalar payload를 읽는다.
7. `Zvr.$bi`, `Svr._Vi`, `Svr._ie` deeper child (`z0i`, `gun`, `_Vi`) join probe
8. 마지막으로 HTML/overlay state 보조 확인

## Evidence Pointers

- main chain / alternate root: `tmp/discovery/01-foundation/text-chain-chain-comparison.json`
- discriminator path: `tmp/discovery/01-foundation/text-chain-discriminator-probe.json`
- youth survey full scan:
  - `tmp/discovery/01-foundation/text-chain-chain-comparison-youth-survey-full.json`
  - `tmp/discovery/01-foundation/text-chain-discriminator-probe-youth-survey-full.json`
- breadth-first option sweep:
  - `tmp/discovery/01-foundation/breadth-first-option-sweep-youth-survey.json`
- exploration registry seed:
  - `tmp/discovery/01-foundation/exploration-registry-seed-youth-survey.json`
- table-context transition grid:
  - `tmp/discovery/01-foundation/table-context-transition-grid-youth-survey.json`
  - `tmp/discovery/01-foundation/table-context-transition-grid-youth-survey-worker-9333-rerun.json`
  - `tmp/discovery/01-foundation/table-context-transition-grid-youth-survey-worker-9333-focused.json`
- table-context ui/action trace:
  - `tmp/discovery/01-foundation/table-context-ui-action-trace-youth-survey-worker-9333.json`
- document-graph cross-join:
  - `tmp/discovery/01-foundation/document-graph-cross-join-youth-survey.json`
- ivr table/image split:
  - `tmp/discovery/01-foundation/ivr-table-image-split-youth-survey-worker-9333.json`
- z5n exact nested:
  - `tmp/discovery/01-foundation/z5n-pli-exact-nested-youth-survey-worker-9333.json`
- z5n cluster:
  - `tmp/discovery/01-foundation/z5n-pli-cluster-youth-survey-worker-9333.json`
- o6n/u6n join:
  - `tmp/discovery/01-foundation/o6n-zli-join-youth-survey-worker-9333.json`
- widget state census:
  - `tmp/discovery/01-foundation/widget-state-census-youth-survey.json`
