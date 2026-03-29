# AGENTS.md

## Scope

- 이 디렉터리의 작업 범위는 Hancom Docs Automation SDK로 한정한다.
- 목표는 canvas 기반 Hancom Docs editor를 raw CDP로 읽고 쓰는 라이브러리를 만드는 것이다.
- `task-web.md`의 Required Capabilities와 Deliverables를 구현 기준으로 삼는다.

## Strategy

- 현재 단계의 기본 운영 모델은 discovery-first가 아니라 implementation-first다.
- static deob 코드와 `docs/reverse-engineering.md`의 confirmed fact를 active implementation input으로 사용한다.
- read-side의 1순위 구현 경로는 `window.HwpApp.document.aPt().ENt().save("hwpjson20;")` 기반 structured payload다.
- write-side의 1순위 구현 경로는 `HwpApp.ActionManager` / `HwpApp.UIAPI` command mapping과 bridge method 승격이다.
- 확인되지 않은 런타임 해석을 public API나 공용 타입에 먼저 고정하지 않는다.
- 과거 `docs/task-requests/01-foundation` ~ `04-write`는 historical evidence/archive로만 취급한다.

## Hard Rules

- Puppeteer, Playwright, Selenium 같은 고수준 브라우저 래퍼를 추가하지 않는다.
- 브라우저 제어는 Chrome DevTools Protocol의 raw command 호출을 우선한다.
- DOM scraping, `window.getSelection()`, clipboard를 기본 해법으로 가정하지 않는다.
- Hancom editor가 `<canvas>` 기반이라는 제약을 전제로 설계한다.
- fallback으로 부분 정보나 열화된 정보를 반환하지 않는다.
- 읽기 기능은 항상 직접 런타임에서 완전한 구조와 포맷 정보를 가져오는 경로를 목표로 한다.
- paragraph-only, 대표 formatting 하나, plain-text export 같은 lossy 중간 산출물은 최종 read capability로 간주하지 않는다.

## Code Organization

- Chrome target discovery, WebSocket transport, CDP session state는 `src/client`에 둔다.
- Hancom editor 내부 object probe, page-context evaluation 함수, deob-derived bridge helper는 `src/hancom`에 둔다.
- 공개 SDK surface는 `HancomDocsClient`와 `src/operations` 계층을 통해서만 노출한다.
- Markdown/search/format conversion은 pure helper로 분리하고 `tests`에서 검증한다.
- 역공학으로 확인한 object path, command sequence, payload shape, 실패한 시도는 `docs/reverse-engineering.md`에 남긴다.

## Documentation Status

- active source of truth는 이 문서와 `docs/reverse-engineering.md`다.
- `docs/task-requests/05-static-deob`는 active implementation reference로 사용할 수 있다.
- `docs/task-requests/01-foundation` ~ `04-write`는 현재 구현 지침이 아니라 historical archive다.
- archive 문서의 가설이나 중간 산출물보다 confirmed runtime/static evidence를 우선한다.

## Validation

- 라이브 브라우저가 필요한 검증과 pure unit test를 구분한다.
- 코드 변경 후 최소 `npm run typecheck`, `npm run lint`, `npm run test`를 확인한다.
- 라이브 검증이 필요한 기능은 `examples/` 스크립트로 재현 경로를 남긴다.
- fresh CDP Chrome이 필요하면 사용자가 remote debugging Chrome을 직접 띄운 뒤 `https://www.hancomdocs.com`에서 로그인과 문서 열기를 먼저 끝낸다.
- 로그인 중에는 attach나 probe를 시도하지 않는다.
- research 전용 probe나 reverse-engineering helper는 `research/` 아래에만 둔다.

## Delivery Bias

- 챌린지용 코드라도 라이브러리 구조를 유지한다.
- 구현이 불완전한 경우에도 public API shape, failure mode, docs는 먼저 정리한다.
- 역공학 결론이 없는 부분은 모호한 추측 대신 probe와 명시적 에러로 처리한다.
- deob-derived symbol/path는 SDK code에 반영할 때 `docs/reverse-engineering.md`의 confirmed evidence와 동기화한다.
- 각 에이전트는 결론만이 아니라 사용자의 의도와 대화 중 고정된 핵심 결정도 짧게 남긴다.
- 대화 맥락 기록은 전체 transcript가 아니라 다음 에이전트가 바로 이어받을 수 있는 concise context여야 한다.
