# 04 Write Handoff

## Conversation Context

- 사용자는 write-side 결과만이 아니라 자신이 무엇을 원했고 어떤 결정을 내렸는지도 모든 에이전트가 짧게 기록하길 원한다.
- 기록은 장문의 대화 로그가 아니라 사용자 의도, 명시 제약, 잠긴 결정만 담는 요약이어야 한다.
- 이 track도 `status.json.conversation_context`와 handoff 상단의 `## Conversation Context`를 함께 유지한다.
- write command evidence와 verification dependency 기록은 그대로 두고, 대화 맥락은 별도 concise memory로만 추가한다.

## To Downstream

- 통합 단계: write-side 메뉴 DOM에 `data-command`, `data-ui-command`, `data-ui-value`가 직접 노출된다. `writeOperationCatalog` probe를 먼저 돌리면 save/replace/goto/table/image surface를 빠르게 재확인할 수 있다.
- 통합 단계: save shortcut은 `ActionManager` proto `Tbr(-1, false)` 2회로 다시 확인됐다. 메뉴 `d_save`가 disabled여도 shortcut path는 살아 있다.
- 통합 단계: dialog open trace는 replace `33808`, goto `33840`, insert-table `35456`, insert-image `34736` action id를 각각 먼저 본다.
- 통합 단계: `examples/discovery/04-write/trace-operation.ts`로 `save|replace-dialog|goto-dialog|insert-table-dialog|insert-image-dialog`를 raw CDP로 바로 재현할 수 있다.
- 통합 단계: 위 example은 이제 execute flow도 지원한다. `replace-all <find> <replace>`, `goto-page <n>`, `create-table <rows> <cols>`, `insert-image-url <url>`, `table-command <value>`까지 바로 재현 가능하다.
- 통합 단계: goto verification은 현재 `#hcwoViewScroll.scrollTop` before/after로 충분히 재현된다.
- 통합 단계: create-table 이후 `c_insert_row_col_list`가 enabled 되는 것이 first-cell/table-context 확보의 가장 강한 write-side 신호다.
- 통합 단계: image URL insert 이후 `modify_object_properties`와 `e_insert_caption` enablement를 object-selection verification으로 재사용할 수 있다.
- 통합 단계: `replaceAll()`, `insertTable()`, `gotoPage()`, `insertImage({ path })`, `insertTableRow({ position, count? })`, `deleteTableRow({ count? })`는 SDK에 올라와 있다.
- 통합 단계: `fillTableCells()`는 계속 첫 셀 포커스 전제를 명시해야 하며, 표 밖 caret에서의 silent write를 성공으로 취급하면 안 된다.
- 통합 단계: row insert/delete는 active table selection 기준 relative command replay일 뿐이다. exact table/row addressing을 지원하는 척하면 안 된다.

## Needs From Upstream

- `02-read`: table/image/page-aware exact read path가 생기면 create-table, fill-table-cells, goto-page verification을 write-side acceptance와 연결할 수 있다.
- 통합 단계: dialog confirm button 이후의 구조 변화를 검증하려면 read-side exact table/image/page boundary fact가 필요하다.
