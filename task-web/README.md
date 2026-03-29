# task-web

Hancom Docs web editor를 Chrome DevTools Protocol(CDP)로 자동화하기 위한 TypeScript SDK 스캐폴드입니다.

이 디렉터리는 챌린지 문제를 빠르게 풀기 위한 실험 코드가 아니라, 역공학 코드와 라이브러리 인터페이스를 분리한 재사용 가능한 패키지 구조를 기준으로 잡았습니다.

## Requirements

- Node.js 22+
- npm 10+
- Chrome remote debugging enabled
- Hancom Docs editor tab already open

## Quick Start

```bash
npm install
npm run typecheck
npm run lint
npm run test
```

Chrome를 remote debugging으로 켠 뒤 예제를 실행합니다.

```bash
npm run example:list-targets -- --port 9223
npm run example:dump -- --port 9223 --target-url-pattern webhwp.hancomdocs.com/webhwp
npm run example:verify-save -- --port 9223 --target-id <target-id> "old text" "new text"
```

예제는 공유 `.env` 파일을 읽지 않습니다. 병렬 실행 시에도 각 프로세스에 `--port`, `--target-id`, `--target-url-pattern` 같은 인자를 직접 넘기면 됩니다.

```bash
npm run example:list-targets -- --port 9223
npm run example:dump -- --port 9223 --target-url-pattern webhwp.hancomdocs.com/webhwp
```

## Layout

- `src/client`: raw CDP transport and Chrome target discovery
- `src/hancom`: page-context bridge, `hwpjson20` parsing, static deob helpers
- `src/models`: public types
- `src/utils`: pure document helpers
- `examples`: live browser examples
- `tests`: unit tests for pure logic
- `docs`: architecture and reverse-engineering notes

최종 acceptance 기준은 `docs/final-test-scenarios.md`에 정리했습니다.

## Parallel Discovery

병렬 탐색 규칙은 루트 `AGENTS.md`, `docs/task-requests/AGENTS.md`, 각 track 디렉터리의 `AGENTS.md`를 기준으로 운영합니다.

- 운영 상태와 handoff: `docs/task-requests/`
- confirmed 역공학 사실: `docs/reverse-engineering.md`

## Current Status

- CDP 연결, target 탐색, `Runtime.evaluate`, keyboard 입력까지는 기본 골격을 제공합니다.
- `readDocument()`는 runtime `save("hwpjson20;")` 기반 structured snapshot을 canonical `HancomDocument`로 반환하고, `readStructure()`는 그 `blocks` alias입니다.
- paragraph block은 `text`, `runs`, `paragraphStyle`, `paraStyleRefs`, `paraStyleVariants`, `rawNodeIds` 같은 snapshot formatting metadata를 함께 노출합니다.
- 각 text run은 `textStyle` 외에 `charStyleCode`, `styleRef`, `formatting`을 통해 run-level formatting provenance를 보존합니다.
- `getParagraphFormatting()`는 canonical paragraph block에서 text-style variants와 paragraph-style variants를 포함한 formatting summary를 계산합니다.
- `replaceAll()`와 `insertTable()`은 confirmed `ActionManager` direct command path로 승격했습니다.
- `example:verify-save`는 disposable 문서 복제본에서 `replaceAll() -> save() -> reconnect -> readText()` 순서로 persistence를 재검증하는 live acceptance script입니다.
- `insertTableRow({ position, count? })`와 `deleteTableRow({ count? })`는 active table selection에서 confirmed `ActionManager.PPt(...)` row command로 실행됩니다.
- row mutation의 exact row-count read-back은 아직 table read-path에 의존합니다.
- `fillTableCells()`는 여전히 첫 셀 포커스 전제를 명시적으로 지켜야 합니다.
- `gotoPage()`, `insertImage({ path })`, `save()`는 아직 각각 dialog/file-upload/shortcut fallback을 유지합니다.
- static bundle analysis tooling은 `src/hancom/discovery/05-static-deob`와 해당 example에만 남깁니다.
