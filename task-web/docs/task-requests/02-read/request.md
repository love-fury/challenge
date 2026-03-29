# 02 Read

## Goal

`document.Svr.G0i -> tdi`를 중심으로 Hancom 문서를 structured model로 읽는 경로를 찾는다. paragraph, page, table, image, style reference를 읽기 가능한 사실로 정리하는 것이 목적이다.
이 track은 fallback이나 대표값 근사 대신, 문서의 구조와 포맷을 완전하게 읽을 수 있는 exact runtime path를 찾는 것을 목표로 한다.
또한 `03-query-export`와 `04-write`가 공통으로 소비할 normalized snapshot contract를 제공해야 한다.

## In Scope

- text-chain traversal과 paragraph boundary 복원
- `sdi.Msi`, `Ivr.Y5n`, `Ivr.$5n`, `Csi` 해석
- page boundary 후보, node type discriminator 후보
- table/image가 포함된 샘플 문서에서 node shape 확보
- normalized read snapshot 초안

## Out Of Scope

- 검색 API 설계
- Markdown/JSON export 포맷 정책 확정
- write command dispatch 구현

## Owned Files

- `docs/task-requests/02-read/*`
- `src/hancom/discovery/02-read/*`
- `examples/discovery/02-read/*`
- `tmp/discovery/02-read/*`

## Probe Checklist

- paragraph boundary를 `"\r"` node 기준으로 안정적으로 복원한다.
- `Y5n.SXt`, `Y5n.wTi`, `Y5n.bTi.Msi`, `Y5n.oqt`를 font/size/bold/italic/color로 해석한다.
- `$5n.FNi`, `$5n.Xli`를 line spacing / alignment 후보로 검증한다.
- `Csi`를 style run offset으로 복원할 수 있는지 확인한다.
- 표/이미지 문서에서 child type 또는 node shape 차이를 확보한다.

## Subtasks

### `normalized-snapshot`

- downstream 공용 입력 계약을 정의한다.
- 최소 raw node id, `styleRef`, `Csi`, inline run candidate, paragraph anchor, page metadata placeholder를 포함한다.
- unsupported field를 capability처럼 고정하지 않는다.

### `rich-structure`

- table / image / page boundary discriminator를 찾는다.
- richer sample 문서에서 node shape 차이를 확보한다.
- write-side read-back acceptance에 필요한 최소 구조 fact를 제공한다.

### `style-semantics`

- `bold`, `italic`, `alignment`, `lineSpacing`, inline run segmentation 의미를 복원한다.
- paragraph 대표 formatting이 아니라 inline run 확장 가능한 read-path를 정리한다.

## Success Criteria

- paragraph + formatting read-path가 repro 가능한 probe로 정리돼 있다.
- table/image/page boundary에 대한 최소 1개의 강한 후보 또는 실패 근거가 남아 있다.
- `03-query-export`가 소비할 normalized snapshot shape 초안이 있다.
- lossy paragraph 대표 formatting이 아니라 inline run, page/table/image discriminator까지 확장 가능한 exact read-path 후보가 명시돼 있다.
- table / image / page가 write acceptance에 필요한 verification dependency라는 점이 handoff에 명시돼 있다.

## Handoff Contract

- field 해석은 raw 값과 해석 값을 같이 적는다.
- style mapping은 sample styleRef와 예시 텍스트를 같이 남긴다.
- 구조 복원 규칙은 pseudo-code 수준으로 적어서 downstream이 그대로 적용할 수 있게 한다.
- normalized snapshot은 required field, optional field, blocker field를 구분해서 적는다.
