# 03 Query Export Semantics

`03-query-export`는 `02-read`가 제공하는 structured snapshot을 어떻게 search/export에 투영할지 정의한다. 이 문서는 public SDK contract가 아니라 discovery 단계의 working contract다.

## Upstream Assumptions

- 현재 upstream handoff는 paragraph-only `DocumentNode[]`와 partial `ParagraphFormatting`을 제공한다.
- `rawTextChainNodes[]`, `rawStyleRef`, `rawCsi`, `controlNodeSamples` 같은 raw evidence는 downstream이 보존해야 한다.
- inline run, table/image discriminator, page boundary는 exact read-path가 확정되기 전까지 optional metadata로 취급한다.

## Discovery Snapshot Shape

`src/hancom/discovery/03-query-export/queryExport.ts`는 아래 방향의 normalized snapshot을 discovery-only helper로 다룬다.

```ts
interface QueryExportSnapshot {
  schemaVersion: string;
  provenance?: {
    source: string;
    generatedAt: string;
    notes?: string[];
  };
  warnings?: string[];
  nodes: QueryExportNode[];
}

type QueryExportNode = QueryExportParagraph | QueryExportTable | QueryExportImage;
```

- paragraph는 `text`, optional `formatting`, optional `runs[]`, optional `pageIndex`, optional `source.rawNodeIds[]`를 가진다.
- table은 row/cell 단위 text와 optional formatting/runs를 가진다.
- image는 `altText`, `caption`, `source`, optional `pageIndex`를 가진다.
- raw evidence가 있으면 discovery snapshot에 그대로 남기고, 해석값은 별도 field에 추가한다.

## Search Semantics

### Canonical Search Surface

검색은 DOM이 아니라 structured snapshot에서 만든 canonical plain-text surface를 기준으로 한다.

- paragraph text는 그대로 붙인다.
- table은 cell 사이를 `\t`, row 사이를 `\n`으로 이어서 붙인다.
- image는 `altText`와 `caption`을 공백으로 이어서 searchable text로 삼는다.
- top-level node 사이에는 `\n`을 넣는다.
- canonical surface의 offset이 search result의 기준 offset이다.

### Match Rules

- 빈 query는 match 없음으로 처리한다.
- 기본값은 case-insensitive search다.
- 기본 `contextWindow`는 20 code units다.
- match는 canonical surface에서 왼쪽부터 non-overlapping으로 찾는다.
- query가 separator(`\n`, `\t`)를 포함하면 node/cell 경계를 가로지르는 match도 허용한다.

### Association Rules

각 match는 최소 아래 metadata를 가져야 한다.

```ts
interface QueryExportSearchMatch {
  index: number;
  start: number;
  end: number;
  match: string;
  before: string;
  after: string;
  context: string;
  anchorPath?: string;
  anchorNodeKind?: "paragraph" | "table" | "image";
  anchorNodeId?: string;
  pageIndex?: number;
  paragraphIndex?: number;
  tableIndex?: number;
  rowIndex?: number;
  cellIndex?: number;
  crossedNodeBoundary: boolean;
  crossedSeparator: boolean;
}
```

- `start`/`end`는 canonical surface 기준이다.
- `anchorPath`는 match가 시작된 searchable unit의 경로다.
  - paragraph 예: `paragraph:3`
  - table cell 예: `table:1/row:0/cell:2`
  - image 예: `image:0`
- `crossedNodeBoundary`는 match가 둘 이상의 searchable unit에 걸치면 `true`다.
- `crossedSeparator`는 match span 안에 `\n` 또는 `\t` separator가 실제로 끼면 `true`다.
- page boundary가 upstream에서 있으면 `pageIndex`를 채운다. 없으면 omit한다.

### Search Example

입력 snapshot 일부:

```ts
[
  { kind: "paragraph", text: "Hancom Docs reverse engineering notes", pageIndex: 0 },
  {
    kind: "table",
    pageIndex: 1,
    rows: [{ cells: [{ text: "Search" }, { text: "Hancom Docs" }] }]
  }
]
```

canonical surface:

```txt
Hancom Docs reverse engineering notes
Search\tHancom Docs
```

query `"hancom"` 결과 규칙:

- 2개 match가 나와야 한다.
- 첫 match는 `anchorPath="paragraph:0"`, `pageIndex=0`.
- 둘째 match는 `anchorPath="table:0/row:0/cell:1"`, `pageIndex=1`.
- context는 canonical surface substring으로 계산한다.

## Blocker Policy

- paragraph association 없는 plain-string search만으로는 `Search text` acceptance를 충분히 설명하지 못한다.
- page boundary가 아직 upstream에 없으면 `pageIndex`는 optional로 남기고 blocker로 기록한다.
- table/image discriminator가 없으면 search helper는 paragraph-only snapshot을 허용하되, acceptance checklist에는 blocker로 남긴다.
