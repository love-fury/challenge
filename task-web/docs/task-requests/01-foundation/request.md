# 01 Foundation

## Goal

Chrome target discovery부터 editor runtime topology까지 공용 기반 사실을 찾는다. 이 track의 산출물은 다른 모든 track이 재사용하는 object path와 command surface inventory다.
특히 `02-read`가 fallback 없이 완전한 구조/포맷 정보를 읽을 수 있는 exact runtime entrypoint를 찾는 것이 핵심이다.
또한 `task-web.md`의 required / bonus capability 전부가 어떤 owner track, verification dependency, runtime surface에 매달려 있는지 연결 가능한 수준의 acceptance map과 runtime audit 기준을 남겨야 한다.

## In Scope

- remote debugging target 식별 규칙
- iframe/canvas topology 확인
- `window.HwpApp`, `HwpApp.Core`, `HwpApp.UIAPI`, `HwpApp.ActionManager`, `webpackChunkwebapp` inventory
- command helper와 dispatcher 후보 surface 식별
- 공용 probe snippet과 runtime dump 경로 정리
- requirement-to-track acceptance map 유지
- downstream runtime claim과 foundation-confirmed 사실의 일치 여부 감사
- write-side command claim과 traced surface 연결 여부 감사

## Out Of Scope

- paragraph/table/image 구조 복원
- search/export 규칙 설계
- 실제 command execution 구현
- downstream 기능의 최종 correctness sign-off

## Owned Files

- `docs/task-requests/01-foundation/*`
- `src/hancom/discovery/01-foundation/*`
- `examples/discovery/01-foundation/*`
- `tmp/discovery/01-foundation/*`

## Probe Checklist

- 현재 editor tab을 안정적으로 식별하는 조건을 정리한다.
- iframe별 `src`, `readyState`, canvas 개수, body structure를 기록한다.
- `HwpApp` 주요 필드와 prototype surface를 분류한다.
- `UIAPI`와 `ActionManager`의 command-like key를 분류한다.
- downstream에서 재사용할 object path glossary를 만든다.
- 요구사항별 owner track, verification dependency, runtime evidence 연결을 남긴다.
- downstream handoff나 claim이 foundation-confirmed path와 모순되면 risk나 blocker를 남긴다.

## Subtasks

### `acceptance-map`

- `task-web.md`의 required / bonus capability를 owner track과 verification dependency로 매핑한다.
- capability가 exact runtime path, command surface, 또는 upstream blocker와 연결되는지 점검한다.

### `runtime-audit`

- downstream이 사용하는 object path, node shape, data discriminator가 foundation-confirmed 사실과 맞는지 감사한다.
- 다른 해석을 쓰려면 repro와 evidence를 요구한다.

### `command-audit`

- `04-write`가 주장하는 trigger path가 `UIAPI` / `ActionManager` trace와 연결되는지 감사한다.
- keyboard fallback과 exact command path가 섞여 서술되지 않도록 분리한다.

## Success Criteria

- `02-read`와 `04-write`가 바로 사용할 수 있는 runtime object map이 있다.
- 최소 1개의 repro 가능한 inventory probe 또는 example이 남아 있다.
- command surface 후보가 `handoff.md`에 요약돼 있다.
- partial read fallback이 아니라 exact read-path 탐색으로 이어질 수 있는 object path 또는 command candidate가 식별돼 있다.
- `task-web.md`의 각 required / bonus capability에 대해 owner track, verification dependency, 관련 object path 또는 command surface가 연결돼 있다.
- foundation audit이 runtime evidence와 acceptance coverage mapping까지만 담당하고, 기능 correctness final sign-off는 owner track으로 남는다는 경계가 문서화돼 있다.

## Handoff Contract

- object path는 전체 path 문자열과 의미를 같이 적는다.
- command surface는 `candidate`, `evidence`, `risk`를 함께 적는다.
- downstream이 바로 따라 할 수 있도록 example 또는 probe 파일 경로를 남긴다.
- acceptance map은 capability, owner, verification dependency, runtime evidence를 같이 적는다.
