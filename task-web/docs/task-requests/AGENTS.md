# AGENTS.md

## Purpose

- 이 디렉터리는 이제 active coordination 레이어가 아니라 historical discovery archive다.
- 여기 문서들은 과거 병렬 탐색의 evidence, handoff, 상태 기록을 보존한다.
- 현재 구현은 루트 `AGENTS.md`와 `docs/reverse-engineering.md`의 confirmed fact를 기준으로 진행한다.

## Status

- `board.md`, 각 track의 `request.md`, `findings.md`, `handoff.md`는 historical context 용도다.
- 이 디렉터리 문서를 현재 구현의 source of truth로 사용하지 않는다.
- active implementation reference가 필요하면 `05-static-deob`와 reverse-engineering log를 우선 본다.

## Archive Rules

- 과거 track 문서는 삭제하지 않고 archive로 유지한다.
- archive 문서에 있는 가설, pending task, owner assignment, shared freeze 규칙은 현재 운영 모델로 간주하지 않는다.
- confirmed 사실만 `docs/reverse-engineering.md`에서 현재 사실로 취급한다.
- fallback이나 lossy read 결과는 여전히 완료된 capability로 취급하지 않는다.

## Writing Rules

- archive 보존 목적의 최소한 수정만 허용한다.
- 기존 findings/handoff/request를 현재 상태에 맞게 다시 쓰기보다, 필요한 경우 상단 notice로 historical 문서임을 명시한다.
- 코드나 런타임에서 이미 드러나는 사실을 AGENTS에 중복 복사하지 않는다.

## Promotion Rules

- 재현 가능한 probe, example, 또는 static/runtime evidence 결합이 없는 내용은 승격하지 않는다.
- object path, command sequence, payload shape 중 최소 하나를 명시한다.
- 공용 인터페이스로 올릴 내용은 archive track 문서가 아니라 active implementation 단계에서 다룬다.
