# 01 Foundation Exploration Registry

이 문서는 foundation track의 breadth-first 탐색 registry 운영 규칙이다.
목표는 `window -> HwpApp` 범위에서 "못 찾은 것"과 "아직 안 본 것"을 분리하고, 서브에이전트가 path family 단위로 탐색을 이어받을 수 있게 하는 것이다.

## Source Of Truth

- 기계용 source of truth는 `docs/task-requests/01-foundation/exploration-registry.json`이다.
- 이 문서는 registry 해석 규칙과 lane 운영 방식을 설명한다.
- live seed evidence는 `tmp/discovery/01-foundation/exploration-registry-seed-youth-survey.json`을 기준으로 한다.

## Scope Lock

- registry 범위는 `window -> HwpApp` top-down이다.
- `window`의 비-`HwpApp` global은 현재 registry 범위에 포함하지 않는다.
- table-first 우선순위를 유지하되, `HwpApp` top-level own key는 빠짐없이 등록한다.

## Row Contract

모든 explicit row는 아래 필드를 가진다.

- `id`
- `parent_id`
- `path`
- `depth`
- `lane`
- `kind`
- `priority`
- `status`
- `owner`
- `expansion_policy`
- `probe_mode`
- `summary`
- `evidence_refs`
- `alias_of`
- `children_complete`
- `next_probe`
- `last_checked_at`

## Status Rules

- `queued`: 등록만 됐고 아직 agent가 잡지 않았다.
- `assigned`: owner는 정해졌지만 아직 evidence를 추가하지 않았다.
- `in_progress`: live probe를 돌리는 중이다.
- `explored`: 현재 depth에서 증거를 확보했다.
- `ruled_out`: 의미 있는 branch가 아니라고 live evidence로 닫았다.
- `duplicate`: alias 또는 중복 surface로 판정했다.
- `blocked`: side effect risk나 환경 부족으로 진행 불가다.
- `deferred`: 지금 우선순위 밖이지만 scope에는 남긴다.

`queued`와 `deferred`를 혼동하지 않는다.
`queued`는 해야 하는 일, `deferred`는 현재 안 해도 되는 일이다.

## Lane Split

- `document-graph`
  `HwpApp.document`, `Svr`, `Zvr`, `Ivr`, `Nvr` 및 그 하위 control/property branch
- `uiapi-actions`
  `UIAPI`, `ActionManager`, `SetUIEventListener`, `CtrlAPI_*`, UI command plumbing
- `state-bootstrap`
  `Models`, `appState`, `cache`, `Core`, top-level runtime/bootstrap state
- `dom-signals`
  table panel widget ancestry, toolbar/context enablement, caret/widget DOM state

## Subagent Contract

- `agent-doc`
  `document-graph` lane owner다.
  `Zvr.$bi`, `Svr._Vi`, `Svr._ie`, `Ivr.{o6n,h6n,u6n,z5n}`를 먼저 탐색한다.
- `agent-ui`
  `uiapi-actions` lane owner다.
  `getWidgetElementList`, `findContainerNodeToParent`, `getContainerSizeInfo`, `OnIsEnabled`, `SetUIEventListener`를 먼저 탐색한다.
- `agent-state`
  `state-bootstrap` lane owner다.
  `Models`, `appState`, `cache`, `Core`를 semantic diff 관점으로 탐색한다.
- `agent-dom`
  `dom-signals` lane owner다.
  table panel disable-state, command enablement, mutation observer를 다룬다.

각 agent는 prose가 아니라 registry row 상태를 갱신하는 식으로 결과를 남긴다.
최소 필수 갱신 필드는 `status`, `summary`, `evidence_refs`, `children_complete`, `next_probe`다.

## Completion Rule

- top-level `HwpApp` own key가 하나라도 registry에 없으면 미완료다.
- explicit row가 `queued`, `assigned`, `in_progress` 상태로 남아 있으면 sweep 미완료다.
- `record` row는 `children_complete=true` 또는 `duplicate/ruled_out/deferred` 이유가 있어야 닫힌다.
- `duplicate` row는 반드시 `alias_of`를 가진다.

## Current Priority

1. `HwpApp.UIAPI.getWidgetElementList`
2. `HwpApp.ActionManager.OnIsEnabled`
3. `HwpApp.SetUIEventListener`
4. `HwpApp.document.Zvr.$bi`
5. `HwpApp.document.Svr._Vi`
6. `HwpApp.document.Svr._ie`
7. `HwpApp.document.Ivr.{o6n,h6n,u6n,z5n}`

## Evidence Pointers

- top-level seed: `tmp/discovery/01-foundation/exploration-registry-seed-youth-survey.json`
- widget ancestry census: `tmp/discovery/01-foundation/widget-state-census-youth-survey.json`
- breadth-first document sweep: `tmp/discovery/01-foundation/breadth-first-option-sweep-youth-survey.json`
