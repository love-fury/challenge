# AGENTS.md

## Deprecated / Archive

- 이 문서는 historical discovery archive다.
- `04-write`는 과거 cursor 기준 편집과 문서 mutation을 command path나 keyboard fallback으로 찾던 track이었다.
- 현재 write 구현의 active guidance는 루트 `AGENTS.md`와 `docs/reverse-engineering.md`의 confirmed write path를 따른다.

## Historical Role

- `ActionManager`, `UIAPI`, keyboard fallback, operation별 observable effect를 묶어 evidence를 남겼다.
- `Type text`, `Find and replace`, `Create a table`, `Fill table cells`, `Save`를 operation 단위로 분해해 추적했다.
- public write API를 확정하기 전 단계의 command candidate와 failure mode 초안이 포함돼 있다.

## Archive Note

- 이 디렉터리의 fallback matrix와 pending follow-up은 현재 운영 모델이 아니다.
- historical evidence는 참고만 하고, active implementation은 confirmed command path를 SDK method로 승격하는 데 집중한다.
