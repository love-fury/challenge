# AGENTS.md

## Mission

- 이 track의 목적은 Hancom 번들을 사람이 읽기 쉬운 형태로 복원한 결과를 active implementation reference로 제공하는 것이다.
- static deob 결과는 더 이상 side-track candidate generation에만 머물지 않고, read/write entrypoint 구현을 좁히는 주 입력으로 사용한다.
- 다만 capability 확정은 여전히 static 코드와 runtime evidence가 함께 뒷받침할 때만 한다.

## Priority

- `main.js`와 chunk/module boundary를 안정적으로 유지하고, 구현에 필요한 high-signal entrypoint를 계속 추적한다.
- read/export/document/style/query 계열 path와 `ActionManager` / `UIAPI` write path를 구현 가능한 named surface로 연결한다.
- deob-derived symbol, module, payload shape를 `docs/reverse-engineering.md`의 confirmed fact와 맞춰 승격한다.
- “예쁘게 읽히는 코드”보다 “SDK bridge와 operation에 직접 연결할 수 있는 근거”를 우선한다.

## Avoid

- 정적 복원 결과만으로 capability를 확정하지 않는다.
- synthetic split이나 heuristic name을 원본 source boundary로 오해하지 않는다.
- bundle beautify 결과를 완성 산출물처럼 취급하지 않는다.
- current implementation과 무관한 packer speculation에 시간을 쓰지 않는다.

## Deliverables

- active implementation이 바로 참조할 수 있는 bundle/deob corpus
- module manifest와 high-signal entrypoint reference
- runtime/static evidence를 결합해 승격 가능한 symbol/path 후보
- SDK bridge/operation으로 이어질 follow-up note
