# Chrome Worker Operations

이 문서는 Hancom Docs 병렬 탐색용 Chrome worker 운영 규칙만 정리한다.

## Model

- worker마다 별도 Chrome 프로세스를 띄운다.
- worker마다 별도 `remote-debugging-port`와 `user-data-dir`를 사용한다.
- 공개 SDK는 worker orchestration을 모르고, 오직 `connect({ port })`만 사용한다.

## Commands

```bash
npm run example:chrome-workers -- launch --base-port 9222 --worker-count 2
npm run example:chrome-workers -- list
npm run example:chrome-workers -- mark-ready chrome-9222 chrome-9223
npm run example:chrome-workers -- stop --delete-profiles chrome-9222 chrome-9223
npm run example:chrome-worker-smoke -- read --worker-id chrome-9222
npm run example:chrome-worker-smoke -- search 주택시장 --context-window 20 --worker-id chrome-9222
```

- `launch`
  - macOS Chrome binary를 직접 실행한다.
  - 기본 시작 페이지는 `https://www.hancomdocs.com`이다.
  - 각 worker는 `tmp/discovery/chrome-workers/chrome-<port>` 프로필을 사용한다.
  - 성공 시 registry에 `ready_for_login` 상태로 기록된다.
  - 이 상태에서는 사용자가 직접 Hancom 로그인과 필요한 문서 열기를 끝낼 때까지 기다린다.
- `list`
  - registry를 읽고 프로세스 생존 여부와 debugger endpoint 상태를 다시 반영한다.
- `mark-ready`
  - 사용자가 로그인과 문서 열기를 끝낸 worker를 `ready_for_attach`로 승격한다.
- `stop`
  - worker 프로세스를 종료한다.
  - `--delete-profiles`를 주면 프로필 디렉터리도 함께 삭제한다.
- `example:chrome-worker-smoke`
  - `ready_for_attach` 상태 worker를 찾아 `HancomDocsClient.connect({ port })`로 바로 붙는다.
  - `read`, `text`, `structure`, `search`, `markdown` smoke command를 제공한다.

## Manual Flow

1. `launch`로 worker를 띄운다.
2. 각 Chrome 창은 `hancomdocs.com`에서 시작한다. 사용자가 수동으로 로그인과 문서 열기를 끝낼 때까지 agent는 기다린다.
3. 로그인 중에는 attach나 probe를 시도하지 않는다.
4. 준비가 끝나면 `mark-ready`로 attach 가능한 worker를 표시한다.
5. 각 agent는 자기 worker의 `port`를 받아 `HancomDocsClient.connect({ port })`로 붙는다.

## Limits

- 같은 Hancom 문서를 여러 worker가 동시에 여는 것은 막지 않는다.
- worker registry는 `tmp/discovery/chrome-workers/registry.json`에만 저장한다.
- 현재 구현은 macOS 로컬 환경의 Google Chrome 기본 경로를 기준으로 한다.
