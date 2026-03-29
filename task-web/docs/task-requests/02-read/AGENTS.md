# AGENTS.md

## Deprecated / Archive

- 이 문서는 historical discovery archive다.
- `02-read`는 과거 Hancom 내부 문서 구조와 formatting read-path를 runtime probe로 찾던 track이었다.
- 현재 read 구현의 active guidance는 루트 `AGENTS.md`와 `docs/reverse-engineering.md`의 confirmed read path를 따른다.

## Historical Role

- full text, paragraph/table/image 구분, paragraph formatting을 exact runtime path로 읽는 근거를 찾는 데 집중했다.
- paragraph/table/image discriminator, style reference, page/table/image 후보와 실패 근거를 기록했다.
- public interface를 고정하기 전 단계의 evidence 축적이 목적이었다.

## Archive Note

- 이 디렉터리의 probe와 findings는 historical evidence로만 참고한다.
- paragraph-only fallback, partial interpretation, pending follow-up은 현재 구현 계약으로 취급하지 않는다.
