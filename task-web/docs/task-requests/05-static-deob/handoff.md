# 05 Static Deob Handoff

## Conversation Context

- 사용자는 runtime probe를 버리려는 것이 아니라, 난독화된 bundle을 사람이 읽기 쉬운 코드로 복원하는 lane을 별도로 추가해보자고 제안했다.
- 이 track의 목표는 "bundle을 예쁘게 만드는 것"보다 higher-level read/export entrypoint를 찾는 것이다.
- static deob 결과는 candidate generation 용도에 한정하고, runtime verification 없이 capability로 승격하지 않는다.
- 기존 SDK public surface와 shared freeze file은 이 track에서 직접 바꾸지 않는다.
- 사용자는 처음 표현을 정정했고, 실제 요청은 current SDK audit이 아니라 "static deob을 보면 CDP에서 어떤 runtime function/command path를 호출하면 `write/search/replace`를 구현할 수 있는가"를 조사해 기록하는 것이다.
- 따라서 이 track의 corrected output은 public API 상태 보고가 아니라 `ActionManager`/document actor 기준 direct callable path map이다.

## To Downstream

- `01-foundation`, `02-read`: 이 track의 primary output은 runtime path replacement가 아니라 "다음에 어떤 module/function을 런타임에서 찔러볼지"를 좁힌 candidate report다.
- `02-read`: read/export/document/style/query keyword cluster가 높은 module은 `Svr.G0i`보다 상위 abstraction일 가능성이 있으므로 exact runtime callable/path 확인을 우선해라.
- `04-write`: 이 track에서 이미 direct dispatcher shortlist가 나왔다. 우선순위는 `ActionManager.fPt/PPt/dPt/cPt`와 `document.aPt().ENt().save("hwpjson20;")`, `window.HwpApp.INt(true).PPt("d_save")`를 public bridge method로 승격하는 쪽이다.
- static report만으로 symbol 의미를 고정하지 말고, exact object path 또는 live behavior diff로 다시 확인해야 한다.
- current live artifact root는 `tmp/discovery/05-static-deob/full-mirror-doc1-all`이다.
- current official tracked corpus root는 `artifacts/static-deob/hancom-webhwp-build-20260225023319`이다.
- human entry files:
  - `artifacts/static-deob/README.md`
  - `artifacts/static-deob/hancom-webhwp-build-20260225023319/README.md`
  - `artifacts/static-deob/hancom-webhwp-build-20260225023319/readable/modules/module-index.json`
  - `artifacts/static-deob/hancom-webhwp-build-20260225023319/readable/heuristic/README.md`
  - `artifacts/static-deob/hancom-webhwp-build-20260225023319/readable/heuristic/heuristic-index.json`
- current high-signal heuristic names:
  - `main/5910 -> jquery_3_6_0`
  - `main/417 -> locale_async_context_loader`
  - `chunk-431/6971 -> webhwp_app_bootstrap`
  - `chunk-360/2595 -> ui_framework_model_store`
  - `chunk-481/6412 -> locale_strings_root`
  - `chunk-774/8237 -> custom_font_catalog`
- synthetic split is intentionally lossy. It is useful for human reading, but not evidence of original source-file boundaries.
- curated promotion keeps only selected heuristic part trees. For full scratch reruns and non-promoted parts, continue to use `tmp/discovery/05-static-deob/full-mirror-doc1-all`.
- current corrected capability shortlist:
  - search/read: `window.HwpApp.document.aPt().ENt().save("hwpjson20;")`
  - find next / replace / replace all: `ActionManager.fPt(33824|33809|33810, cti) -> action.dPt(OPt, bag)`
  - goto page: `ActionManager.PPt(33840, cti)` dialog path or `ActionManager.PPt(33697, cti)` simple dispatcher
  - insert table: `ActionManager.fPt(35456, cti) -> cPt/dPt`
  - insert/delete row: `ActionManager.PPt(35473|35474|35477, cti)`
  - insert image by URL/local file: `ActionManager.PPt(34736, cti)` dialog path with `from_computer` upload or direct `action.dPt(OPt, bag)`
  - save: `window.HwpApp.INt(true).PPt("d_save")`
- current 9222 live status:
  - verified: read/search, replaceAll direct replay, insertTable direct replay, insert lower row, delete row, goto on housing doc via `33840`, local image insert via `34736`
  - goto detail: housing doc에서 `ActionManager.PPt(33840, cti)` 후 `e_goto.J2s({ value:{ goto_input:'2', execute:'confirm' } })`를 replay하면 `jQe(type=1,page=2) -> cOn(..., how=7)`이 실제 실행되고 current page가 `1 -> 2`로 바뀐다
  - image detail: disposable doc에서 `PPt(34736, cti)`로 dialog open, local `one-pixel.png` upload, `넣기` click 후 `POST /webhwp/handler/upload/image/base64/...`와 action POST가 관측됐고 read-back `hwpjson20`에 image control payload가 생겼다
  - blocked-by-state: `d_save` actor path exists but current docs expose `LPt('d_save').enable=false`
  - blocked-by-env: direct external URL image insert는 current environment에서 validator / `ERR_BLOCKED_BY_CLIENT` 영향으로 여전히 불안정하다

## Needs From Upstream

- `01-foundation`: live target에서 current bundle URL, script topology, `webpackChunkwebapp` marker가 계속 유지되는지 확인이 필요함.
- `02-read`: 현재 text-chain보다 높은 read/export surface가 있으면 어떤 payload shape를 기대해야 하는지 최소한의 runtime-check 질문 리스트가 필요함.
