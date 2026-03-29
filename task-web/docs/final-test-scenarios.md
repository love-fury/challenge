# Final Test Scenarios

이 문서는 현재 로컬 Chrome remote debugging `127.0.0.1:9223`에 열려 있는 실제 Hancom 문서를 기준으로 최종 테스트 시나리오만 정리한다.

## 대상 문서

- target title:
  - `251015(석간)_주택시장_안정화_대책발표(주택정책과).hwpx - 한컴오피스 Web v2 한글`
- target url:
  - `https://webhwp.hancomdocs.com/webhwp/?mode=HWP_EDITOR&docId=nNnOyFp8d3kWoYiKmEEXjMyLAVuIB5x4&lang=ko_KR`
- 연결 기준:
  - `HancomDocsClient.connect({ port: 9223 })`

## 테스트 운영 원칙

- 읽기 계열은 현재 열린 원본 문서를 그대로 사용한다.
- 쓰기 계열은 원본을 직접 수정하지 않고, 이 문서의 복제본을 만들어 검증한다.
- `table`, `image`, `page navigation`처럼 현재 열린 문서만으로 충분히 검증되지 않는 capability는 `현재 문서 기준 미검증`으로 명시한다.
- acceptance 문서는 실제 열린 문서 기준을 우선하고, synthetic fixture는 추가하지 않는다.

## Required Capabilities

### R1. Read the full document text

- 입력:
  - 대상 문서: 현재 열린 실문서
  - 호출: `readText()`
- 기대 출력:
  - 전체 텍스트가 비어 있지 않아야 한다.
  - 아래 문장을 모두 포함해야 한다.
    - `□ 주요 지정효과`
    - `□ 지정 기준`
    - `□ 금일 발표된 ｢주택시장 안정화 대책｣의 주요 내용은 다음과 같다.`
    - `□ 국토교통부(장관 김윤덕), 기획재정부(장관 구윤철)`
- 검증 포인트:
  - 첫 문단은 `ㅇ 10.20일 이후(20일 포함)에 계약 체결을 하고자 하는 자는 계약 체결 전에 허가관청으로부터 허가를 받아야 유효한 계약을 체결할 수 있음`과 일치해야 한다.
  - 마지막 문단은 `□ 국토교통부(장관 김윤덕), 기획재정부(장관 구윤철), 금융위원회(위원장 이억원), 국무조정실(실장 윤창렬), 국세청(청장 임광현)은 10.15일(수) 07:00 정부서울청사에서 ｢부동산 관계장관회의｣를 개최하여 ｢주택시장 안정화 대책｣을 논의하였다.`와 일치해야 한다.

### R2. Read document structure

- 입력:
  - 대상 문서: 현재 열린 실문서
  - 호출: `readStructure()`
- 기대 출력:
  - 결과 타입: `DocumentBlock[]`
  - `result.length === 53`
  - 모든 `result[*].kind === "paragraph"`
  - paragraph `0` text:
    - `ㅇ 10.20일 이후(20일 포함)에 계약 체결을 하고자 하는 자는 계약 체결 전에 허가관청으로부터 허가를 받아야 유효한 계약을 체결할 수 있음`
  - paragraph `17` text:
    - `□ 국토교통부 김윤덕 장관은 “주택시장 안정의 골든타임을 놓치면 국민들의 내집 마련과 주거 안정이 더욱 어려워질 수 있다”고 하며, “주택시장 안정을 정부 정책의 우선 순위로 두고 관계부처가 총력 대응해나갈 것”이라고 밝혔다.`
  - paragraph `52` text:
    - `□ 국토교통부(장관 김윤덕), 기획재정부(장관 구윤철), 금융위원회(위원장 이억원), 국무조정실(실장 윤창렬), 국세청(청장 임광현)은 10.15일(수) 07:00 정부서울청사에서 ｢부동산 관계장관회의｣를 개최하여 ｢주택시장 안정화 대책｣을 논의하였다.`
- 검증 포인트:
  - 각 paragraph는 `runs`와 `rawNodeIds`를 가진다.
  - 현재 문서에서는 `table`, `image`가 검출되지 않는 것이 baseline이다.
  - 추후 `table`이나 `image`가 나오면 문서가 바뀌었거나 read-path가 달라진 것이다.

### R3. Read formatting

- 입력:
  - 대상 문서: 현재 열린 실문서
  - 호출:
    - `getParagraphFormatting(0)`
    - `getParagraphFormatting(1)`
    - `getParagraphFormatting(20)`
- 기대 출력:
  - paragraph `0`
    - `paragraphId`가 존재
    - `paragraphStyle.lineSpacing === 1.6`
    - `textStyleVariants`가 배열로 존재
    - `paraStyleRefs`가 배열로 존재
  - paragraph `1`
    - `paragraphId`가 존재
    - `paragraphStyle.lineSpacing === 1.6`
    - `textStyleVariants`가 배열로 존재
    - `paraStyleRefs`가 배열로 존재
  - paragraph `20`
    - `paragraphId`가 존재
    - `paragraphStyle.lineSpacing === 1.6`
    - `textStyleVariants`가 배열로 존재
    - `paraStyleRefs`가 배열로 존재
- 검증 포인트:
  - `dominantTextStyle`은 mixed paragraph에서는 비어 있을 수 있다.
  - `textStyleVariants`, `paraStyleRefs`, `paragraphStyleConsistent`, `paraStyleVariants`, `hasMixedParagraphStyles`가 summary에 포함되어야 한다.
  - run-level `bold`, `italic`, visible `color`와 static snapshot `alignment`는 노출될 수 있지만, 현재 실문서 acceptance는 exact 값보다 field presence와 line-spacing 복원을 우선한다.

### R4. Search text

- 입력:
  - 대상 문서: 현재 열린 실문서
  - 호출:
    - `search("주택시장", { contextWindow: 20 })`
    - `search("규제지역", { contextWindow: 20 })`
- 기대 출력:
  - `주택시장` match count: `10`
  - `규제지역` match count: `8`
  - `주택시장` 대표 match:
    - index `0`, start `1084`, end `1088`
    - context: `준\n\n□ 국토교통부 김윤덕 장관은 “주택시장 안정의 골든타임을 놓치면 국민들의 `
  - `주택시장` 대표 match:
    - index `4`, start `4195`, end `4199`
    - context: ` 지역*은 신규 지정한다. ➊ 최근 주택시장 불안이 확산되고 있는 주요 지역을 `
  - `규제지역` 대표 match:
    - index `0`, start `641`, end `645`
    - context: ` 없고, 현금청산 대상이 됨\n\n ㅇ 규제지역 지정공고일 당시 조합설립 인가된 재`
  - `규제지역` 대표 match:
    - index `4`, start `926`, end `930`
    - context: `이 제한되는 등 제약이 발생함\n\n□ 규제지역 지정 공고일부터 즉시 전매제한이 적`
- 검증 포인트:
  - 문단 중간 검색과 긴 본문 검색이 동시에 동작해야 한다.
  - case-insensitive 기본값은 한국어 검색에서는 영향이 없어야 한다.

### R5. Export to Markdown

- 입력:
  - 대상 문서: 현재 열린 실문서
  - 호출: `exportMarkdown()`
- 기대 출력:
  - `warnings`는 빈 배열
  - markdown는 비어 있지 않음
  - 아래 문자열을 포함:
    - `ㅇ 10\\.20일 이후\\(20일 포함\\)에 계약 체결을 하고자 하는 자는`
    - `□ 국토교통부 김윤덕 장관은 “주택시장 안정의 골든타임을`
    - `□ 국토교통부\\(장관 김윤덕\\), 기획재정부\\(장관 구윤철\\)`
- 검증 포인트:
  - 현재 구조 복원이 paragraph-only이므로 heading, table, image assertion은 하지 않는다.
  - escape 처리된 특수문자 `.` `(` `)` `*` `+`가 포함된 줄이 깨지지 않아야 한다.

### R6. Type text

- 입력:
  - 대상 문서: 현재 문서의 복제본
  - 사전 조건:
    - 문서 최상단 첫 문단 끝으로 caret 이동
  - 호출: `typeText(" [SDK-TYPE]")`
- 기대 출력:
  - `readStructure()[0].text` 끝에 ` [SDK-TYPE]`가 추가됨
- 검증 포인트:
  - 기존 첫 문단 텍스트가 보존되어야 한다.
  - 원본 문서가 아니라 복제본에서만 수행한다.

### R7. Find and replace

- 입력:
  - 대상 문서: 현재 문서의 복제본
  - 사전 조건:
    - 원본 기준 `주택시장` 문자열이 복제본에도 그대로 있어야 함
  - 호출: `replaceAll({ find: "주택시장", replace: "부동산시장" })`
- 기대 출력:
  - `search("주택시장")` count가 기존 `10`보다 감소하거나 `0`이 되어야 한다.
  - `search("부동산시장")` count가 증가해야 한다.
- 검증 포인트:
  - 최소한 문서 내 여러 occurrence가 바뀌어야 한다.
  - 일부 occurrence만 바뀌면 partial replace로 실패 처리한다.

### R8. Create a table

- canonical flow:
  - `insertTable()`는 빈 표 골격만 만든다.
  - 셀 값 입력은 R9 `fillTableCells()`에서 별도로 검증한다.

- 입력:
  - 대상 문서: 현재 문서의 복제본
  - 사전 조건:
    - 문서 마지막에 빈 문단을 하나 둔 뒤 caret를 해당 위치로 이동
  - 호출: `insertTable({ rows: 2, cols: 3 })`
- 기대 출력:
  - 이상적인 기대 출력:
    - `readStructure()`에 새 `table` node가 추가됨
    - row count `2`, col count `3`
- 현재 문서 기준 상태:
  - `readStructure()`가 아직 table node를 복원하지 못하므로 live acceptance는 `미검증`
- 검증 포인트:
  - write path가 구현되더라도 read path가 table을 못 보면 완전한 pass로 보지 않는다.

### R9. Fill table cells

- canonical flow:
  - R8에서 만든 빈 표를 대상으로 값을 채운다.

- 입력:
  - 대상 문서: 현재 문서의 복제본
  - 사전 조건:
    - 직전에 만든 2x3 표의 첫 셀에 caret 위치
  - 호출:
    - `fillTableCells({ values: [["구분", "값", "비고"], ["query", "주택시장", "sdk"]] })`
- 기대 출력:
  - 이상적인 기대 출력:
    - 마지막 table node의 셀 값이 입력 matrix와 동일
- 현재 문서 기준 상태:
  - table read-path 부재로 `미검증`
- 검증 포인트:
  - 셀 이동 순서는 좌->우, 상->하

### R10. Save the document

- 입력:
  - 대상 문서: 현재 문서의 복제본
  - 사전 조건:
    - R6 또는 R7로 dirty 상태 생성
  - 호출: `save()`
- 기대 출력:
  - 저장 후 reload해도 수정 내용이 남아 있음
- 검증 포인트:
  - 저장 전 read-back과 reload 후 read-back이 동일해야 한다.
  - 재현 스크립트: `npm run example:verify-save -- [connection opts] "find" "replace"` on a disposable copy

## Bonus Capabilities

### B1. Navigate to a specific page number

- 입력:
  - 대상 문서: 현재 열린 실문서 또는 복제본
  - 호출: planned `gotoPage(pageNumber)`
- 기대 출력:
  - 지정 페이지로 viewport 또는 caret가 이동
- 현재 문서 기준 상태:
  - 실제 페이지 수를 SDK가 아직 읽지 못하므로 `미검증`
- 검증 포인트:
  - 이동 직후 스크롤/커서 위치를 사람 또는 probe로 확인 가능해야 한다.

### B2. Insert/delete table rows

- 입력:
  - 대상 문서: 현재 문서의 복제본
  - 사전 조건:
    - R8로 삽입한 표가 존재
    - mutation할 row가 현재 selection으로 잡혀 있어야 함
  - 호출:
    - `insertTableRow({ position: "below" })`
    - `deleteTableRow({ count: 1 })`
- 기대 출력:
  - insert 후 행 수 증가
  - delete 후 행 수 감소
- 현재 문서 기준 상태:
  - command replay는 구현됐지만, exact row-count read-back은 table read-path에 의존해서 여전히 `미검증`

### B3. Read paragraph style

- 입력:
  - 대상 문서: 현재 열린 실문서
  - 호출:
    - `getParagraphFormatting(0)`
    - `getParagraphFormatting(1)`
- 기대 출력:
  - 현재 canonical summary 기준 `paragraphStyle.lineSpacing === 1.6`
  - `paraStyleRefs`와 `paraStyleVariants`가 존재하면 mixed paragraph style 여부를 구분할 수 있어야 한다.
- 현재 문서 기준 상태:
  - `alignment`는 static snapshot 기준으로만 노출한다. current-caret paragraph formatting과 합쳐 해석하지 않는다.
- 검증 포인트:
  - paragraph style의 최소 기준은 `lineSpacing` 복원이다.
  - mixed paragraph는 단일 `paragraphStyle` 대신 `paraStyleVariants`를 source of truth로 본다.

### B4. Insert images

- 입력:
  - 대상 문서: 현재 문서의 복제본
  - 호출: `insertImage({ path })`
- 기대 출력:
  - 이상적인 기대 출력:
    - `readStructure()`에 `image` node 추가
    - `exportMarkdown()`에 `![alt](src)` 추가
- 현재 문서 기준 상태:
  - SDK insert path는 구현됐다.
  - current read fallback은 direct image anchor에 대해 `image` node를 복원하고 `exportMarkdown()`도 이를 Markdown image로 내보낸다.
  - 2026-03-29 live 검증에서 target `5F78070AC295BA2AC39D866662823F43`에 `tmp/manual-test/grid-64.png`를 삽입했고 `readStructure()` image count가 `7 -> 8`로 증가했다.
  - 같은 검증에서 새 block은 `id=01DCBF443E2745A00000F0EF`, `altText="image 26.png"`로 읽혔고 `exportMarkdown()`에도 `![image 26.png](blob:...)`가 추가됐다.
  - 위 검증은 저장 없이 수행했다.

### B5. Export structured JSON with formatting metadata

- 입력:
  - 대상 문서: 현재 열린 실문서
  - 호출: planned `exportJson()`
- 기대 출력:
  - ordered `nodes` 배열
  - 최소 기준:
    - length `53`
    - node `0` text가 첫 문단 기대값과 일치
    - node `52` text가 마지막 문단 기대값과 일치
    - paragraph formatting에는 현재 fallback이 읽는 `fontName`, `fontSize`, `color`, `lineSpacing` 포함
- 검증 포인트:
  - 현재 문서 기준 JSON export는 paragraph-only shape여야 한다.
  - 존재하지 않는 table/image를 억지로 채우면 실패로 본다.
