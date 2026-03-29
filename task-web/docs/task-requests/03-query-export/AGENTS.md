# AGENTS.md

## Deprecated / Archive

- 이 문서는 historical discovery archive다.
- `03-query-export`는 과거 structured read 결과를 search/Markdown/JSON 규칙으로 정리하던 track이었다.
- 현재 export/search 구현은 active read path와 SDK integration 상태를 기준으로 다시 진행한다.

## Historical Role

- search context semantics, Markdown export 범위, structured JSON 보존 규칙을 분리해서 정리했다.
- pure helper 테스트 케이스로 옮길 수 있는 규칙과 acceptance checklist를 남기는 역할이었다.
- upstream read 구조가 안정되기 전 단계의 정책 초안이 포함돼 있다.

## Archive Note

- 이 디렉터리 문서는 현재 export behavior의 source of truth가 아니다.
- historical 규칙과 checklist는 참고만 하고, 실제 구현 계약은 현재 confirmed payload shape에 맞춰 결정한다.
