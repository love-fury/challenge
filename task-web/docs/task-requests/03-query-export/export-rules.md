# 03 Query Export Rules

이 문서는 Markdown export와 structured JSON export의 보존 범위, 손실 지점, 경고 정책을 정리한다.

## Markdown Rules

### Paragraph

- paragraph는 기본적으로 한 block paragraph로 내보낸다.
- `formatting.headingLevel`이 있으면 `#` prefix를 붙인다.
- inline run이 있으면 run 단위로 bold/italic marker를 적용한다.
- inline run이 없으면 paragraph-level formatting으로만 렌더링한다.
- run text를 합친 값이 paragraph text와 다르면 run export는 신뢰하지 않고 paragraph-level fallback으로 내려가며 warning을 남긴다.

### Bold / Italic

- bold only: `**text**`
- italic only: `*text*`
- bold+italic: `***text***`
- bold/italic 외 포맷(font name, size, color, alignment, line spacing)은 Markdown에 직접 보존하지 않는다.

### Table

- 첫 row를 header row로 사용한다.
- row 길이가 서로 다르면 가장 긴 row 길이에 맞춰 빈 cell을 padding하고 warning을 남긴다.
- cell 안의 inline bold/italic은 허용한다.
- cell color/alignment/font metadata는 Markdown에서 보존하지 않는다.

### Image

- image는 `![alt](source)`로 렌더링한다.
- `altText`가 없으면 `caption`, 그것도 없으면 `"image"`를 alt fallback으로 쓴다.
- `source`가 없으면 empty URL로 내보내고 warning을 남긴다.
- `caption`이 `altText`와 다르면 image block 다음 plain paragraph로 한 번 더 남긴다.

## Markdown Loss / Warning Policy

warning은 export를 중단시키지 않지만, lossy conversion을 명시적으로 드러내야 한다.

- inline run text mismatch
- image source 누락
- empty table
- ragged table
- color/font/alignment/line spacing처럼 Markdown이 직접 표현하지 못하는 formatting 존재
- page boundary 정보가 있었지만 Markdown에는 반영되지 않은 경우

## Structured JSON Rules

structured JSON export는 lossy conversion이 아니라 normalized snapshot의 보존이 목적이다.

```json
{
  "schemaVersion": "2026-03-29",
  "generatedAt": "2026-03-29T15:00:00.000Z",
  "nodeCount": 4,
  "warnings": [],
  "provenance": {
    "source": "02-read handoff",
    "generatedAt": "2026-03-29T15:00:00.000Z"
  },
  "nodes": []
}
```

- top-level envelope는 `schemaVersion`, `generatedAt`, `nodeCount`, `warnings`, `provenance`, `nodes`를 가진다.
- paragraph/table/image node는 discovery snapshot shape를 그대로 보존한다.
- raw evidence(`rawStyleRef`, `rawCsi`, `rawNodeIds`)가 있으면 JSON export에서 절대 버리지 않는다.
- exact read-path가 확정되지 않은 해석값은 optional field로 넣고, raw field를 반드시 병행한다.

## Export Blockers

- table/image exact discriminator가 없으면 corresponding node export는 provisional이다.
- inline run exact read-path가 없으면 bold/italic Markdown export는 paragraph representative formatting에 머무르므로 acceptance 충족이 제한된다.
- page boundary exact read-path가 없으면 JSON의 `pageIndex`는 optional metadata로만 유지한다.
