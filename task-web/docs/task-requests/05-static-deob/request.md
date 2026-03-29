# 05 Static Deob

## Goal

Hancom editor 번들을 정적으로 복원해 current runtime probe보다 상위의 read/export/document entrypoint 후보를 찾는다.
이 track은 `Svr.G0i` text-chain을 대체하려는 것이 아니라, 그것보다 높은 abstraction의 모듈 또는 함수가 bundle 안에 있는지 더 빠르게 좁히는 것을 목표로 한다.

## In Scope

- live editor page에서 bundle URL과 script/runtime surface 캡처
- `webcrack` 기반 deobfuscation / unminify / unpack 실행
- deob output의 module manifest와 entrypoint candidate report 생성
- read/export 후보와 write/command 후보 분리

## Out Of Scope

- public SDK read path 교체
- static evidence만으로 reverse-engineering fact 승격
- write command 구현

## Owned Files

- `docs/task-requests/05-static-deob/*`
- `src/hancom/discovery/05-static-deob/*`
- `examples/discovery/05-static-deob/*`
- `tmp/discovery/05-static-deob/*`

## Probe Checklist

- live target에서 script src와 `webpackChunk*` runtime marker를 캡처한다.
- `main.js` 우선순위 규칙으로 primary bundle URL을 고른다.
- raw bundle과 deob output을 artifact로 남긴다.
- module/file별 keyword hit, role, snippet, score를 정리한 candidate report를 만든다.
- top candidate마다 next runtime verification probe를 같이 적는다.

## Subtasks

### `bundle-capture`

- editor page의 script/resource surface와 bundle URL을 캡처한다.
- reproducible raw bundle artifact와 hash를 남긴다.

### `deob-pipeline`

- `webcrack` CLI를 실행해서 deob/unpack output을 만든다.
- failure 시 stderr와 fallback scan root를 같이 남긴다.

### `entrypoint-hunt`

- read/export/document/style/query 후보를 ranking한다.
- write/command 계열은 separate bucket으로만 기록한다.

## Success Criteria

- reproducible bundle artifact가 남아 있다.
- deob output 또는 raw fallback root에 대해 module manifest가 생성된다.
- higher-level read/export candidate report가 생성된다.
- 각 candidate에 exact runtime follow-up probe idea가 붙는다.

## Handoff Contract

- candidate마다 `why`, `matched keywords`, `snippet`, `next runtime probe`를 함께 남긴다.
- static-only 해석은 `observed` 또는 `hypothesis`로만 남기고, runtime confirmation 전에는 confirmed로 승격하지 않는다.
- read/export 후보와 write/command 후보를 섞지 않는다.
