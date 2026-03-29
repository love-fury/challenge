# 04 Write Findings

Append-only log. 각 항목은 날짜와 `hypothesis` / `observed` / `confirmed` / `failed` 태그를 포함한다.

## 2026-03-29

- `confirmed`: track initialized. Command mapping과 fallback matrix 탐색을 이 디렉터리에서 관리한다.
- `observed`: 현재 SDK fallback이 있는 write operation은 `typeText()`의 `Input.insertText`, `replaceAll()`의 dialog replay, `insertTable()`의 dialog replay, `fillTableCells()`의 `Tab` 이동, `gotoPage()`의 scroll replay, `insertImage({ path })`의 file upload flow, `save()`의 `Ctrl/Cmd+S`다.
- `observed`: `insertTableRow()`와 `deleteTableRow()`는 initially hook-only였지만, 현재는 active table selection 기준의 command replay fallback으로 SDK에 승격할 수 있다.
- `observed`: 현재 코드와 문서가 가리키는 1순위 command surface는 `ActionManager`와 `UIAPI`이며, foundation inventory에서 함수 key 분류까지는 이미 가능하다.
- `observed`: live target에서 `examples/discovery/04-write/trace-save.ts`로 `Cmd/Ctrl+S`를 한 번 흘려보면 UIAPI helper는 잡히지 않고 `ActionManager` proto의 `Tbr(-1, false)` 호출이 연속 2회 관측된다.
- `observed`: 따라서 save fallback은 현재 기준으로 `UIAPI.makeEventActionObj`류보다 ActionManager 내부 proto method 경로를 더 직접 타는 가능성이 높다.
- `next`: 메뉴 interaction 전후 command surface 변화를 잡는 probe와, operation별 fallback 가능/불가 매트릭스를 분리해서 남겨야 한다.
- `next`: `Tbr`가 save 전용인지, 공통 command dispatcher인지 구분하려면 replace/table/image/page 메뉴 interaction 전후 같은 tracer를 재사용해야 한다.
- `confirmed`: 메뉴 DOM 자체에 write-side 후보가 노출된다. save는 `data-command="d_save"`, replace/goto/table/image dialog open은 `data-ui-command="show"`와 `data-ui-value="dialog_*"` 조합으로 식별된다.
- `confirmed`: `찾아 바꾸기...` 메뉴는 `dialog_find_replace`로 연결되고, dialog open 시 ActionManager proto 5-event 시퀀스 `PPt(33808) -> fPt(33808) -> kPt -> CMs -> NPt(33808)`가 관측됐다.
- `confirmed`: `찾아가기` 메뉴는 `dialog_goto`로 연결되고, dialog open 시 위 5-event 시퀀스에 더해 `UIAPI.getSampleElementListToDescObj("e_goto", ...)`가 호출돼 page list sample을 채운다.
- `confirmed`: `표 만들기...` 메뉴는 `dialog_insert_table`로 연결되고, dialog default가 `rows=5`, `cols=5`, `width=단에 맞춤`, `height=자동`으로 열린다.
- `confirmed`: `그림...` 메뉴는 `dialog_insert_image`로 연결되고, dialog default는 `source=장치`, `insert button disabled` 상태다.
- `confirmed`: `c_insert_row_col_list` / `c_remove_row_col_list` command surface가 DOM에 보이지만 현재 문맥에서는 전부 disabled였다. table cell selection precondition이 강하다.
- `observed`: 현재 bridge fallback 중 acceptance에 바로 쓸 수 있는 것은 `typeText -> Input.insertText`, `replaceAll -> dialog replay`, `insertTable -> dialog replay`, `fillTableCells -> typeText + Tab`, `gotoPage -> scroll replay`, `insertImage -> file upload`, `save -> Cmd/Ctrl+S`다.
- `next`: replace dialog의 `모두 바꾸기`, table dialog의 `만들기`, image dialog의 `넣기`, goto dialog의 `가기` 클릭 trace를 각각 따로 확보해야 한다.
- `next`: table cell selection이 잡힌 상태에서 `c_insert_row_col_list`와 `c_remove_row_col_list` 활성 조건, 실제 dispatch sequence를 확인해야 한다.
- `confirmed`: replace dialog에서 `find=부동산 관계장관회의`, `replace=부동산 관계장관회의X`, `scope=문서 전체`로 `모두 바꾸기`를 누르면 `바꾸기를 1번 했습니다.` alert가 나오고, text-chain에서 replacement marker가 실제로 관측됐다. undo 후 marker는 제거됐다.
- `confirmed`: goto dialog에서 page `9`를 선택하고 `가기`를 누르면 `#hcwoViewScroll.scrollTop`이 `102 -> 8340`으로 변한다. 현재 write-side effect verification은 scroll container movement로 가능하다.
- `confirmed`: table dialog에서 `2x2`로 `만들기`를 누르면 dialog가 닫히고 `dialog_edit_table`, `c_insert_row_col_list`가 즉시 enabled 상태가 된다. create-table 이후 table selection context가 살아 있다.
- `confirmed`: table selection context에서 `insert_lower_row`를 누르면 distinct action id `35474`가 잡힌다. 최소 `PPt(35474)`, `LPt(35474)`, `yNt(35474)`가 row insertion path 후보로 보인다.
- `confirmed`: image dialog는 `웹 주소` 모드에서 `https://dummyimage.com/1x1/000/fff.png` 입력 시 `넣기`가 enabled 된다. submit 후 dialog가 닫히고 `modify_object_properties`, `e_insert_caption`이 enabled 상태가 된다.
- `observed`: local file insert는 아직 검증하지 않았지만, URL mode만으로도 image insert confirm path와 post-insert object context를 검증할 수 있다.
- `next`: local file upload path와 image read-side exact verification을 이어야 한다.
- `next`: table cell 텍스트 자체를 exact read path로 확인하는 건 아직 02-read 의존성이 남아 있다.
- `confirmed`: current SDK promotion boundary now includes `insertTableRow()` and `deleteTableRow()`, but only for the active table selection. Exact `table`/`row` addressing is still not a confirmed runtime capability.
- `observed`: `fillTableCells()` still needs the first-cell focus precondition documented explicitly, because the current fallback walks cells with `Input.insertText + Tab` rather than validating table context first.
- `next`: if row mutation needs exact addressing later, add a new public contract only after `02-read` can map active selection back to exact table/row identity.
- `confirmed`: active table cell에서 current caret paragraph를 직접 읽는 runtime helper를 추가했고, 이 경로는 current cell text와 formatting(`fontName`, `fontSize`, `bold/italic`, `color`, `alignment`, `lineSpacing`)을 `Ivr.Y5n/$5n` style table과 `Evr.wVs.vqs` pending insert queue를 통해 복구한다.
- `confirmed`: live worker repro 기준 pending insert queue의 strongest current path는 `HwpApp.document.Evr.wVs.vqs[*]`이며, table cell text insert는 `cmd="hInsert"`, `type=1`, `value={t, cs, lk}` shape로 남았다. `value.cs`는 `Ivr.Y5n.n4n[*].qli`와 exact join된다.
- `confirmed`: fresh `insertTable(2,2)` 직후 첫 cell에서 `Input.insertText`는 plain call만으로는 먹지 않는다. 같은 session 기준 `Enter`, `F2`, `Escape`, `Tab` 중 하나를 먼저 보내면 edit mode로 전이되고, 그 뒤 `Input.insertText`가 실제 cell text로 반영된다.
- `observed`: 같은 fresh-table repro에서 `Escape`는 일부 run에서 leading IME/jamo artifact를 남길 수 있었고, `Enter`/`F2`가 cleaner했다. 현재 fallback은 `Enter -> F2 -> Escape` 순으로 edit-mode 진입을 시도하는 편이 안전하다.
- `observed`: 같은 live worker 문서에서 validation용 `insertTable()`를 반복 호출하면 현재 선택 셀 기준으로 nested table이 계속 생긴다. 이후 live verification은 disposable target이나 새 문서에서만 실행해야 한다.
- `confirmed`: worker `:9335` target `51F687DD0C31A638D40A518B802C23C0`에서 disposable one-shot validation을 다시 돌렸을 때 `insertTable(2,2) -> fillTableCells([["Q11","Q12"],["Q21","Q22"]]) -> readDocument()`가 `sdk-observed-active-table` block을 반환했다. artifact는 `tmp/discovery/04-write/observed-table-readback-51f-9335.json`이고, injected cell text `Q11/Q12/Q21/Q22`가 exact하게 남았다.
- `observed`: 위 성공은 SDK-owned observed-table injection path 검증이다. document-wide exact table reconstruction이 붙은 것은 아니므로 canonical table read capability 완료로 승격하면 안 된다.
- `confirmed`: live validation 전략을 repo example로 고정하기 위해 `examples/discovery/04-write/validate-observed-table-readback.ts`를 추가했다. 이 스크립트는 한 run에 table을 한 번만 만들고 fill/read-back까지 수행한다.
