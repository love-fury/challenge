# task-web

Hancom Docs web editor를 raw Chrome DevTools Protocol(CDP)로 자동화하는 TypeScript SDK다.

이 SDK는 이미 열려 있는 Chrome remote debugging 세션에 붙어서 Hancom Docs editor 탭을 찾고, 문서 읽기/검색/변환/쓰기 작업을 고수준 메서드로 제공한다. 에디터가 `<canvas>` 기반이라 DOM scraping으로는 문서를 읽을 수 없기 때문에, 실제 read path는 페이지 런타임의 `HwpApp` 내부 serializer와 command surface를 직접 사용한다.

## 특징

- raw CDP 기반 Chrome target discovery 및 WebSocket 연결
- `hwpjson20` snapshot 기반의 구조화된 문서 읽기
- paragraph/table/image block 복원
- run-level text formatting과 paragraph formatting 요약
- 문서 검색, Markdown export, JSON export
- 텍스트 입력, replace-all, 표 생성, 표 행 추가/삭제, 저장
- 로컬 파일 기반 이미지 삽입

## 요구 환경

- Node.js 22+
- npm 10+
- remote debugging이 켜진 Chrome
- 이미 열린 Hancom Docs editor 탭

## 설치와 준비

현재 패키지는 저장소 내부에서 사용하는 private package다.

```bash
npm install
npm run build
```

개발 중에는 아래 검증 명령을 함께 사용한다.

```bash
npm run typecheck
npm run lint
npm run test
```

Chrome는 remote debugging으로 실행해야 한다. Hancom Docs에 로그인한 뒤 실제 editor 탭을 열어둔 상태에서 SDK가 attach할 수 있다.

## 빠른 시작

```ts
import { HancomDocsClient } from "@lovefury/task-web";

const client = await HancomDocsClient.connect({
  port: 9223,
  targetUrlPattern: "webhwp.hancomdocs.com/webhwp"
});

try {
  const text = await client.readText();
  console.log(text);
} finally {
  await client.disconnect();
}
```

`connect()`는 target을 자동으로 찾아 page WebSocket에 붙는다. 연결이 성공하면 `client.target`에서 실제 attach된 target metadata를 확인할 수 있다.

## 연결 옵션

`HancomDocsClient.connect(options)`는 아래 옵션을 지원한다.

- `host`: remote debugging host
- `port`: remote debugging port
- `targetId`: 특정 Chrome target id
- `targetUrlPattern`: URL 기준 target 선택
- `targetTitlePattern`: title 기준 target 선택
- `timeoutMs`: target discovery timeout

일반적으로는 `port`와 `targetUrlPattern`만 주면 충분하다.

## 공개 API

### 읽기

- `readText(): Promise<string>`
  - 문서 전체 텍스트를 평탄화해서 반환한다.
- `readStructure(): Promise<DocumentBlock[]>`
  - 문서 block 배열을 반환한다.
  - block 종류는 `paragraph`, `table`, `image`다.
- `exportMarkdown(options?): Promise<string>`
  - 문서를 Markdown으로 변환한다.
- `exportJson(options?): Promise<string>`
  - 문서를 JSON payload로 내보낸다.
- `getParagraphFormatting(locator): Promise<ParagraphFormattingResult>`
  - 특정 문단의 dominant text style, style variants, paragraph style summary를 반환한다.
- `search(query, options?): Promise<SearchResult>`
  - `readText()`와 같은 flatten 결과를 기준으로 검색한다.
- `getCaretPosition(): Promise<CaretPosition>`
  - 현재 caret가 가리키는 문단과 offset 정보를 읽는다.

### 쓰기

- `typeText(text): Promise<void>`
  - 현재 caret 위치에 텍스트를 입력한다.
- `replaceAll({ find, replace, caseSensitive? }): Promise<ReplaceAllResult>`
  - 문서 전체 replace-all을 실행한다.
- `insertTable({ rows, cols }): Promise<InsertTableResult>`
  - 현재 위치에 빈 표를 삽입한다.
- `fillTableCells({ values }): Promise<FillTableCellsResult>`
  - 현재 활성 표 전체를 matrix 값으로 채운다.
- `insertTableRow({ position, count? }): Promise<TableMutationResult>`
  - 현재 활성 표 selection 기준으로 행을 추가한다.
- `deleteTableRow({ count? }): Promise<TableMutationResult>`
  - 현재 활성 표 selection 기준으로 행을 삭제한다.
- `gotoPage(pageNumber): Promise<PageNavigationResult>`
  - 지정 페이지로 이동을 시도한다.
- `insertImage({ path }): Promise<ImageInsertResult>`
  - 로컬 파일 이미지를 현재 위치에 삽입한다.
- `save(options?): Promise<SaveResult>`
  - 문서 저장을 실행한다.

### 연결 종료

- `disconnect(): Promise<void>`
  - bridge와 WebSocket 연결을 정리한다.

## 사용 예제

### 문서 구조 읽기

```ts
const blocks = await client.readStructure();

for (const block of blocks) {
  if (block.kind === "paragraph") {
    console.log(block.text, block.paragraphStyle);
  }
}
```

### 문단 포맷 확인

```ts
const formatting = await client.getParagraphFormatting(0);

console.log(formatting.paragraphStyle);
console.log(formatting.textStyleVariants);
```

### 검색

```ts
const result = await client.search("주택시장", {
  contextWindow: 20
});

console.log(result.total);
console.log(result.matches[0]);
```

### Markdown export

```ts
const markdown = await client.exportMarkdown({
  includeWarningsAsComments: true
});
```

### 표 생성 후 셀 채우기

```ts
await client.insertTable({ rows: 2, cols: 3 });
await client.fillTableCells({
  values: [
    ["구분", "값", "비고"],
    ["query", "주택시장", "sdk"]
  ]
});
```

### 저장

```ts
await client.replaceAll({
  find: "주택시장",
  replace: "부동산시장"
});

await client.save();
```

## 예제 스크립트

저장소에는 live target에서 바로 써볼 수 있는 예제 스크립트가 포함돼 있다.

```bash
npm run example:list-targets -- --port 9223
npm run example:dump -- --port 9223 --target-url-pattern webhwp.hancomdocs.com/webhwp
npm run example:sdk-demo -- --port 9223 read structure
npm run example:sdk-demo -- --port 9223 search 주택시장 20
npm run example:verify-save -- --port 9223 --target-id <target-id> "old text" "new text"
```

`example:dump`는 가장 간단한 read smoke check이고, `example:sdk-demo`는 공개 SDK 메서드를 CLI로 호출하는 데모다. `example:verify-save`는 disposable 문서 복제본에서 저장 persistence를 다시 확인하는 용도다.

### working example script 실행 방법

deliverables의 `At least one working example script` 기준으로는 `example:dump` 또는 `example:sdk-demo`를 바로 사용할 수 있다.

가장 단순한 실행 순서는 아래와 같다.

1. Chrome를 remote debugging port와 함께 실행한다.
2. Hancom Docs에 로그인하고 editor 탭을 연다.
3. target 목록을 확인한다.

```bash
npm run example:list-targets -- --port 9223
```

4. 가장 간단한 working read example을 실행한다.

```bash
npm run example:dump -- --port 9223 --target-url-pattern webhwp.hancomdocs.com/webhwp
```

이 스크립트가 성공하면 SDK가 실제 Hancom editor target을 찾았고, 문서 read path도 동작한다는 뜻이다.

공개 API를 조금 더 직접적으로 확인하고 싶으면 아래 데모도 바로 실행할 수 있다.

```bash
npm run example:sdk-demo -- --port 9223 read text
npm run example:sdk-demo -- --port 9223 read structure
npm run example:sdk-demo -- --port 9223 read markdown
```

저장까지 포함한 working example이 필요하면 disposable 문서 복제본에서 아래 스크립트를 쓴다.

```bash
npm run example:verify-save -- --port 9223 --target-id <target-id> "old text" "new text"
```

## 반환 모델 개요

문서 구조의 중심 타입은 `HancomDocument`와 `DocumentBlock`이다.

- `ParagraphBlock`
  - `text`
  - `runs`
  - `paragraphStyle`
  - `dominantTextStyle`
  - `paraStyleRefs`
  - `paraStyleVariants`
  - `rawNodeIds`
- `TableBlock`
  - `rows[].cells[].blocks`
- `ImageBlock`
  - `source`
  - `mimeType`
  - `caption`
  - `base64`

세부 타입은 [src/index.ts](/Users/mhsong/source/lovefury-challenge/task-web/src/index.ts)에서 모두 export한다.

## 구현 방식

- read path의 canonical source는 `HwpApp.document.aPt().ENt().save("hwpjson20;")`다.
- `src/hancom/HwpJson20Reader`가 runtime snapshot을 읽고, `src/hancom/HwpJson20Codec`가 이를 `HancomDocument`로 정규화한다.
- write path는 가능하면 `ActionManager` / `UIAPI` command mapping을 직접 사용하고, 그렇지 않은 경우 raw CDP input을 사용한다.
- reverse-engineering helper와 static deob 코드는 `research/hancom/05-static-deob`로 분리해 둔다.

구조와 한계에 대한 자세한 설명은 [docs/architecture.md](/Users/mhsong/source/lovefury-challenge/task-web/docs/architecture.md)를 참고하면 된다.

## 현재 제약

- `fillTableCells()`는 현재 활성 표를 덮어쓰는 helper이며, caret가 해당 표 컨텍스트 안에 있어야 한다.
- table row/col span, 일부 이미지 anchor 정규화, exact block-level page boundary는 추가 보강 여지가 있다.
- paragraph alignment는 snapshot에서 읽지만 의미 매핑을 아직 보수적으로 다룬다.

## 테스트

이 저장소의 unit test는 pure parsing/conversion logic과 service contract에 집중한다.

```bash
npm run test
npm run test:coverage
```

메인 test suite는 SDK 계약과 pure parsing/conversion logic만 검증한다.

현재 기준 unit test는 `21 files / 87 tests`가 통과한다.

coverage는 `src` 기준으로 아래 수치를 확인했다.

- lines / statements: `63.68%`
- functions: `74.77%`
- branches: `75.11%`

현재 coverage raw dump는 [coverage/.tmp](/Users/mhsong/source/lovefury-challenge/task-web/coverage/.tmp)에 남는다.
최종 `coverage-summary.json` / HTML report는 아직 안정적으로 생성되지 않아서, 현재 README의 수치는 raw dump 집계 기준이다.

## 관련 문서

- 아키텍처 개요: [docs/architecture.md](/Users/mhsong/source/lovefury-challenge/task-web/docs/architecture.md)
- 역공학 로그: [docs/reverse-engineering.md](/Users/mhsong/source/lovefury-challenge/task-web/docs/reverse-engineering.md)
- research 코드: [research/hancom/05-static-deob](/Users/mhsong/source/lovefury-challenge/task-web/research/hancom/05-static-deob)
