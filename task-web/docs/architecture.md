# 아키텍처

## 목표

이 SDK의 목표는 이미 실행 중인 Chrome remote debugging 세션에 붙어서 Hancom Docs editor 탭을 찾고, raw Chrome DevTools Protocol 위에 문서 읽기/검색/변환/쓰기 API를 제공하기.

## API를 찾은 방법

처음에는 window에 있는 HwpApp 등 내용을 실제 문서와 비교하면서 진행했습니다.
문제는 그걸 3~4시간 정도 했는데 끝이 안나서 뭔가 이상하다고 생각이 들었고, 다시 찬찬히 문제를 읽으니 task-web.md가 아니라 README.md에 이미지가 있더군요. 처음에 그냥 넘겼는데 자세히 보니 그게 소스 코드를 받아서 이해할 수 있게 만드는 과정이라는 걸 그 때 알았고, 거기서부터 소스 코드를 받아서 분석하기 시작했습니다.
저도 나름 하나씩 읽으면서 함수들이나 구조를 보면 쓸모가 있겠다 생각이 들었는데 이미 codex는 hwpjson20, ActionManager 함수 매칭 등 다 하고 있더군요.
그 뒤로 API는 codex한테 source code 기반으로 매칭해서 분석해라고 reverse engineering을 다 맡겼습니다.

## 핵심 기술적 통찰

가장 중요한 건 Hancom Docs가 canvas로 그려진다고 해서 문서 내용까지 canvas 안에만 갇혀 있는 건 아니라는 점이었습니다.
실제로는 editor 내부 문서를 구조화된 snapshot으로 직렬화할 수 있었고, 그 entrypoint가 아래 호출이었습니다.

```ts
HwpApp.document.aPt().ENt().save("hwpjson20;")
```

이걸 찾고 나서는 방향이 완전히 바뀌었습니다.
이 snapshot 안에는 문단 텍스트, run 경계, 문자 스타일, 문단 스타일, control payload, 이미지 asset 정보가 같이 들어 있어서 DOM scraping 없이도 문서 전체 텍스트, paragraph/table/image 구조, formatting metadata를 복원할 수 있었습니다.

## 읽기 방식

먼저 `src/client`가 Chrome target을 찾고 page WebSocket에 raw CDP로 붙습니다.
그 다음 `src/hancom/HwpJson20Reader`가 `Runtime.evaluate`로 `save("hwpjson20;")` snapshot을 읽고, `src/hancom/HwpJson20Codec`가 그 안의 `ro`, `sl`, `cs`, `cp`, `pp`, `st`, `bi`를 합쳐 `HancomDocument`로 정규화합니다.
마지막으로 `src/utils`와 `src/operations`가 그 결과를 바탕으로 `readText()`, `readStructure()`, `getParagraphFormatting()`, `search()`, `exportMarkdown()`, `exportJson()` 같은 공개 API를 만듭니다.

포맷 복원도 별도 추측 로직을 많이 쓰는 게 아니라 snapshot 필드를 그대로 따라가는 편입니다.
주로 아래 필드를 사용합니다.

- 문자 스타일: `cp[*]`
- 문단 스타일: `pp[*]`
- 스타일 엔트리: `st[*]`
- 텍스트/run 경계: `ro[*].tx`, `ro[*].tp`
- 표/이미지 같은 control payload: `cs[objectId]`

예를 들어 글꼴 이름, 글꼴 크기, bold/italic, 색상, line spacing은 snapshot 값에서 직접 복원합니다.

## 쓰기 방식

쓰기 쪽도 비슷합니다. 소스 코드를 기반으로 최대한 한컴에서 제공하는 함수를 직접 호출하되, typeText 같은 건 그냥 기능을 썼습니다.

- `typeText()`는 raw CDP `Input.insertText`를 사용한다.
- `replaceAll()`과 `insertTable()`은 confirmed direct property bag command를 사용한다.
  이건 메뉴 클릭을 흉내 내는 대신 Hancom 내부 command id를, 런타임이 기대하는 key-value 파라미터 묶음과 함께 직접 호출하는 경로라는 뜻입니다.
- `insertTableRow()`와 `deleteTableRow()`도 active table selection 기준의 confirmed row command를 사용한다.
- `save()`는 shortcut fallback 대신 runtime save actor를 직접 호출한다.
- `insertImage({ path })`는 로컬 파일을 읽어 base64와 page-local `blob:` URL로 바꾼 뒤 exact insert-image command path를 재생한다.

## 현재 한계

structured read가 완벽하진 않습니다.
table row/col span, 전역 block 순서 정규화, 일부 이미지 anchor 정렬은 더 보강할 여지가 있고, paragraph alignment도 snapshot에서 값은 읽히지만 enum 의미를 아직 완전히 닫지 못해서 보수적으로 다루고 있습니다.
다른 것들도 기본적인 기능만 수동으로 확인하고 넓은 범위의 테스트를 다 해보진 못했습니다.
이 과제에도 9시간 정도 걸렸네요.

## 검증 방식

검증은 둘로 나눴습니다.
unit test와 커버리지는 codex에게 맡겼구요.
e2e test는 한국에서 가장 한글을 잘쓰는 정부 문서 두 개를 이용했습니다.
이번에는 조급함으로 인해 열심히 몸으로 때웠는데요. 좀 더 정식으로 한다면 e2e 테스트도 자동화 할 수 있을 것 같습니다.
