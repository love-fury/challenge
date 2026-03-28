# FLUX.2 Klein 4B Cost Model For 10 Clicks

## Goal

이 문서는 같은 10-click 시나리오에서 아래 세 경로를 비교한다.

1. `vanilla`
   - `denoise()` 경로
   - ref KV cache 없음
   - click마다 모든 ref를 다시 VAE encode
2. `kv cached`
   - `forward_kv_extract()` + `forward_kv_cached()` 경로
   - ref KV cache는 한 요청 내부의 step 1~3에서만 재사용
   - click이 바뀌면 ref branch를 다시 계산
3. `kv cached + ref group diagonal mask + inter-request ref cache`
   - ref group visibility를 `clothing -> avatar + self`, `avatar -> self only`로 제한
   - 이 dependency boundary 위에서 unchanged ref group의 per-layer ref KV를 요청 간 재사용
   - 즉 step 0에서 전체 ref를 다시 돌지 않고, 바뀐 ref group만 재계산

여기서 3번이 핵심 아이디어다. 중요한 점은 다음이다.

- `diagonal ref-group mask` 자체의 direct FLOP saving은 크지 않다
- 진짜 이득은 그 mask가 `inter-request cache composability`를 만든다는 데 있다

## Scenario

### Fixed inputs

- output image: `1024x1024`
- text length: `512` tokens
- avatar reference: `1024x1024`
- clothing reference: `512x512`
- denoising steps: `4`

### 10-click sequence

아래와 같은 시나리오에서 비교.

| Click | References |
|---|---|
| 1 | `(avatar, c1)` |
| 2 | `(avatar, c1, c2)` |
| 3 | `(avatar, c1, c2, c3)` |
| 4 | `(avatar, c1, c2, c3, c4)` |
| 5 | `(avatar, c5, c2, c3, c4)` |
| 6 | `(avatar, c5, c6, c3, c4)` |
| 7 | `(avatar, c5, c6, c7, c4)` |
| 8 | `(avatar, c5, c6, c7, c8)` |
| 9 | `(avatar, c9, c6, c7, c8)` |
| 10 | `(avatar, c9, c10, c7, c8)` |

이 시나리오에서는 click 1을 제외하면 매번 clothing 1개만 새로 들어온다.

## Code Ground Truth

### Token counts

근거:

- VAE packing: [`reference/flux2-klein4b/src/flux2/autoencoder.py`](../reference/flux2-klein4b/src/flux2/autoencoder.py)
- text max length: [`reference/flux2-klein4b/src/flux2/text_encoder.py`](../reference/flux2-klein4b/src/flux2/text_encoder.py)
- Klein 4B params / KV path: [`reference/flux2/src/flux2/model.py`](../reference/flux2/src/flux2/model.py), [`reference/flux2/src/flux2/sampling.py`](../reference/flux2/src/flux2/sampling.py)

고정 token 수:

- `T_txt = 512`
- `T_avatar = (1024 / 16)^2 = 4096`
- `T_cloth = (512 / 16)^2 = 1024`
- `T_img = (1024 / 16)^2 = 4096`
- `T_ref(k) = 4096 + 1024 * k`

### Attention visibility in upstream code

upstream `causal_attn_fn()`은 다음처럼 동작한다.

- `q_txt`와 `q_img`는 `[txt, ref, img]` 전체를 본다
- `q_ref`는 `ref`만 본다
- KV cached path에서는 step 1+에서 `q_ref`를 다시 계산하지 않는다

이건 중요하다. `q_txt`와 `q_img`가 ref memory를 읽는 비용은 2번과 3번 모두 남는다.

### Why mode 3 needs a new execution path

2번의 public KV cache는 “한 요청 내부 step 1~3”만 최적화한다. click이 바뀌면 step 0에서 ref 전체를 다시 돈다.

3번은 다르다.

- ref group dependency를 avatar/self로 끊는다
- unchanged avatar / clothing group의 per-layer ref KV를 세션 캐시에 보관한다
- 다음 click에서는 새로 바뀐 group만 ref branch를 통과시킨다
- step 0의 `q_txt`와 `q_img`는 cached ref KV와 changed ref KV를 합쳐서 사용한다

즉 3번은 단순 mask variant가 아니라 새로운 serving path다.

## FLOP Counting And Its Limits

### FLOP rule

- multiply-add를 `2 FLOPs`로 계산했다
- LayerNorm, GroupNorm, SiLU, RoPE, mask materialization, memory movement, launch overhead는 제외했다
- 따라서 kernel-level exact measurement가 아니라 code-structure 기반의 compute model이다

이 문서는 latency 표 대신 FLOPs 비교에 집중한다. 이유는 간단하다. 지금 시나리오에서는 `FLOPs -> ms`로 바로 환산하는 것이 지나치게 부정확하다.

특히 아래 항목들은 FLOPs만으로 잘 설명되지 않는다.

- attention의 KV read/write와 memory traffic
- bool mask, group mask, block-sparse layout이 커널에 미치는 영향
- inter-request cache를 위한 gather/concat/bookkeeping overhead
- launch overhead와 CUDA Graph capture 유무
- kernel fusion, precision, backend 선택 차이

그래서 이 문서의 숫자는 다음 역할로만 사용한다.

- 큰 병목이 어디인지 찾기
- mode 1/2/3의 상대적인 compute 감소를 비교하기
- 어떤 최적화가 attention을 줄이는지, 어떤 최적화가 linear/MLP를 줄이는지 분리해서 보기

반대로 이 문서의 FLOPs만으로 판단하면 안 되는 질문은 다음이다.

- 실제 wall time이 몇 ms인가
- block-sparse attention kernel이 dense SDPA보다 실제로 얼마나 빠른가
- inter-request cache bookkeeping이 serving latency를 얼마나 갉아먹는가

즉 이 문서의 FLOPs는 latency의 정확한 예측값이 아니라, architecture-aware한 비교 기준선이다. 현재 단계에서 얻을 수 있는 가장 일관된 계산 지표는 여전히 FLOPs지만, 커널 레벨 효과를 최종 판단하려면 반드시 실제 프로파일링이 필요하다.

## VAE Encoder Cost

### Per-image FLOPs

encoder topology는 `conv_in -> 4 resolution levels -> mid ResNet/Attn/ResNet -> conv_out -> quant_conv`이다: [`reference/flux2-klein4b/src/flux2/autoencoder.py`](../reference/flux2-klein4b/src/flux2/autoencoder.py)

| Input | Encoder FLOPs |
|---|---:|
| avatar `1024x1024` | `4.888 TF` |
| clothing `512x512` | `1.119 TF` |

### 10-click VAE totals by mode

| Mode | 10-click VAE total |
|---|---:|
| vanilla | `86.915 TF` |
| kv cached | `86.915 TF` |
| mode 3 inter-request cache | `16.076 TF` |

해석:

- 1번과 2번은 click마다 전체 ref를 다시 encode하므로 VAE cost가 같다
- 3번은 click 1 이후엔 새 clothing 1개만 encode하면 되므로 VAE total이 크게 줄어든다
- 그래도 transformer가 훨씬 더 크기 때문에, 3번에서도 VAE는 주병목이 아니다

주의할 점 하나는, 현재 ref encode가 list loop로 한 장씩 돈다는 점이다: [`reference/flux2-klein4b/src/flux2/sampling.py`](../reference/flux2-klein4b/src/flux2/sampling.py) 그래서 wall time에서는 pure FLOP share보다 VAE 체감 비용이 조금 더 클 수 있다.

## Transformer Cost

### Block structure

Klein 4B는 다음 구조를 가진다: [`reference/flux2/src/flux2/model.py`](../reference/flux2/src/flux2/model.py)

- hidden size `3072`
- double blocks `5`
- single blocks `20`
- MLP ratio `3.0`

아래 표에서는 transformer를 다음 bucket으로 나눴다.

- `embed`: `img_in`, `txt_in`, timestep/modulation, final layer
- `double_proj`
- `double_attn`
- `double_mlp`
- `single_linear`
- `single_attn`

### Per-click totals for modes 1 and 2

| Clothes | Ref tokens | Vanilla 1 step | Vanilla 4 steps | KV step0 | KV cached step | KV total |
|---:|---:|---:|---:|---:|---:|---:|
| 1 | 5120 | `81.532 TF` | `326.128 TF` | `81.532 TF` | `42.068 TF` | `207.736 TF` |
| 2 | 6144 | `92.807 TF` | `371.228 TF` | `92.807 TF` | `43.517 TF` | `223.360 TF` |
| 3 | 7168 | `104.726 TF` | `418.906 TF` | `104.726 TF` | `44.967 TF` | `239.628 TF` |
| 4 | 8192 | `117.290 TF` | `469.160 TF` | `117.290 TF` | `46.417 TF` | `256.540 TF` |

### Mode 3: what changes in step 0

mode 3에서는 step 1~3 cost가 2번과 같다. 바뀌는 것은 step 0뿐이다.

- click 1: avatar와 `c1` 모두 cold이므로 사실상 full ref path와 비슷하다
- click 2 이후: active ref는 최대 4 clothes이지만, changed ref는 clothing 1개뿐이다
- 따라서 step 0에서 전체 ref branch를 재계산하지 않고, `changed ref group + current txt/img`만 계산한다

`k=4`, avatar warm, changed clothing 1개일 때:

- mode 2 step 0: `117.290 TF`
- mode 3 warm step 0: `54.309 TF`
- step 0 alone speedup: `2.16x`

즉 3번의 핵심 이득은 “step 0이 full-ref pass가 아니라 changed-group pass로 바뀐다”는 점이다.

### Internal breakdown

#### Mode 2, `k=4`, step 0

| Bucket | FLOPs |
|---|---:|
| `embed + final + misc` | `0.037 TF` |
| `double_proj` | `4.832 TF` |
| `double_attn` | `7.747 TF` |
| `double_mlp` | `10.872 TF` |
| `single_linear` | `62.814 TF` |
| `single_attn` | `30.988 TF` |
| **step 0 total** | **`117.290 TF`** |

#### Mode 2, `k=4`, cached step

| Bucket | FLOPs |
|---|---:|
| `embed + final + misc` | `0.031 TF` |
| `double_proj` | `1.739 TF` |
| `double_attn` | `3.624 TF` |
| `double_mlp` | `3.914 TF` |
| `single_linear` | `22.613 TF` |
| `single_attn` | `14.496 TF` |
| **cached step total** | **`46.417 TF`** |

#### Mode 3, `k=4`, warm step 0 with one changed clothing

| Bucket | FLOPs |
|---|---:|
| `embed + final + misc` | `0.032 TF` |
| `double_proj` | `2.126 TF` |
| `double_attn` | `3.946 TF` |
| `double_mlp` | `4.784 TF` |
| `single_linear` | `27.638 TF` |
| `single_attn` | `15.784 TF` |
| **step 0 total** | **`54.309 TF`** |

여기서도 가장 큰 항목은 `single_linear`이다. 즉 3번까지 가도 attention-only optimization보다 GEMM-first optimization이 더 중요하다.

## 10-Click Aggregate Comparison

### Click-level totals

| Click | New refs at this click | Vanilla total | KV cached total | Mode 3 total |
|---:|---|---:|---:|---:|
| 1 | `avatar, c1` | `332.134 TF` | `213.742 TF` | `212.454 TF` |
| 2 | `c2` | `378.353 TF` | `230.485 TF` | `183.082 TF` |
| 3 | `c3` | `427.150 TF` | `247.871 TF` | `188.880 TF` |
| 4 | `c4` | `478.523 TF` | `265.903 TF` | `194.678 TF` |
| 5 | `c5` | `478.523 TF` | `265.903 TF` | `194.678 TF` |
| 6 | `c6` | `478.523 TF` | `265.903 TF` | `194.678 TF` |
| 7 | `c7` | `478.523 TF` | `265.903 TF` | `194.678 TF` |
| 8 | `c8` | `478.523 TF` | `265.903 TF` | `194.678 TF` |
| 9 | `c9` | `478.523 TF` | `265.903 TF` | `194.678 TF` |
| 10 | `c10` | `478.523 TF` | `265.903 TF` | `194.678 TF` |

### 10-click totals

| Mode | 10-click total | Avg / click | Speedup vs vanilla |
|---|---:|---:|---:|
| vanilla | `4487.296 TF` | `448.730 TF` | `1.00x` |
| kv cached | `2553.416 TF` | `255.342 TF` | `1.76x` |
| mode 3 inter-request cache | `1947.161 TF` | `194.716 TF` | `2.30x` |

mode 3는 mode 2 대비로도 `1.31x` 빠르다.

## Bottleneck Summary

### 1. Vanilla

10-click total 기준:

- VAE: `86.915 TF`
- transformer: `4400.382 TF`
- transformer share: 약 `98.1%`

즉 병목은 거의 전부 “4-step full transformer를 매 click 다시 도는 것”이다.

### 2. KV cached

10-click total 기준:

- VAE: `86.915 TF`
- transformer: `2466.501 TF`
- transformer share: 약 `96.6%`

2번은 분명히 크지만, 병목이 사라지지는 않는다. 남는 주병목은 여전히 transformer이고, 그 안에서도 cached step의 non-attention linear/MLP다.

### 3. Mode 3 inter-request cache

10-click total 기준:

- VAE: `16.076 TF`
- transformer: `1931.085 TF`
- transformer share: 약 `99.2%`

3번은 VAE와 ref step 0을 많이 줄여 주지만, 최종 병목은 더더욱 transformer trunk로 수렴한다.

특히 warm `k=4` click에서는:

- mode 3 step 0: `54.309 TF`
- cached steps 3개 합: `139.250 TF`

즉 3번 이후에는 step 0보다 step 1~3 cached path의 총합이 더 크다. 다시 말해, inter-request ref cache까지 넣고 나면 다음 병목은 cached-step transformer 자체다.

## Why The Diagonal Mask Matters

이 mask의 direct FLOP saving만 보면 과소평가하기 쉽다. 진짜 의미는 dependency boundary다.

upstream ref visibility에서는 ref token이 ref 전체와 섞인다. 그러면 clothing A의 ref hidden state가 clothing B에 의존할 수 있다. 이 상태에선 click 간에 “avatar cache + unchanged clothing cache만 재조합”하기 어렵다.

반면 `clothing -> avatar + self`, `avatar -> self only`로 끊으면:

- avatar group은 session-global cache가 된다
- 각 clothing group은 item-local cache가 된다
- unchanged group은 그대로 재사용하고 changed group만 다시 계산할 수 있다

즉 3번의 성능 이득은 “sparse attention이 빨라서”가 아니라 “mask가 ref cache를 composable하게 만들어서” 나온다.

## What FLOPs Can And Cannot Tell Us About Block-Sparse Attention

FLOPs 기준으로는 block-sparse attention의 potential saving을 볼 수 있다. 예를 들어 3번에서 ref group diagonal mask를 넣으면 `q_ref -> k_ref`의 이론적 연산량은 분명히 줄어든다.

하지만 FLOPs만으로는 아래를 판단하기 어렵다.

- 실제 sparse kernel이 존재하는지
- 그 kernel이 현재 shape에서 dense kernel보다 빠른지
- sparse metadata, packing, gather/scatter overhead가 saving을 상쇄하는지
- `q_txt`, `q_img`가 여전히 full ref KV를 읽는 경로가 실제 병목인지

즉 block-sparse attention에 대해 FLOPs가 알려 주는 것은 “줄일 수 있는 compute 상한”이지, “실제 latency gain”이 아니다.

이 문서에서 3번의 핵심 가치를 sparse kernel speedup이 아니라 `inter-request cache composability`로 본 이유도 여기에 있다.

- sparse kernel이 없어도 3번의 구조적 이득은 남는다
- 반대로 sparse kernel이 있어도 cached-step GEMM 병목은 그대로 남을 수 있다

따라서 block-sparse attention은 이렇게 해석하는 것이 맞다.

1. FLOPs로 먼저 `theoretical upside`를 본다
2. serving design 관점에서는 cache boundary를 만드는 효과를 먼저 본다
3. 최종 latency 판단은 NVTX / Nsight / real serving trace로 검증한다

## Additional Bottlenecks And Opportunities After Mode 3

### 1. Cached-step GEMM path is now the main target

mode 3 이후의 가장 큰 잔여 병목은 cached step의 single-stream linear path다.

- `single_linear`
- `single_attn`
- `double_mlp`

따라서 generic “flash attention만 붙이자”보다, cached-step GEMM을 직접 겨냥하는 최적화가 더 중요하다.

실행 후보:

- [NVIDIA TransformerEngine](https://github.com/NVIDIA/TransformerEngine)
  - Hopper FP8 inference 경로
  - double/single block linear, MLP가 1차 타깃
- [NVIDIA Model Optimizer](https://github.com/NVIDIA/TensorRT-Model-Optimizer)
  - PTQ/QAT 후보
  - Klein 4B transformer trunk의 FP8 calibration에 적합
- [NVIDIA TensorRT](https://github.com/NVIDIA/TensorRT)
  - static-shape serving, fusion, engine-level optimization 후보

### 2. Attention work should be custom and narrow

attention 최적화 자체를 버리라는 뜻은 아니다. 다만 3번 이후엔 attention이 유일한 병목이 아니다.

적절한 후보:

- [NVIDIA cuDNN Frontend](https://github.com/NVIDIA/cudnn-frontend)
  - custom SDPA graph, graph capture-friendly path
- [NVIDIA CUTLASS](https://github.com/NVIDIA/cutlass)
  - Hopper WGMMA 기반 grouped / block-sparse attention kernel 후보

이건 mode 3의 serving path를 실제로 빠르게 구현하기 위해 필요하다. 하지만 그것만으로 충분하지는 않다.

### 3. CUDA Graph capture becomes more attractive

mode 3는 graph capture 친화적이다.

- output resolution이 고정 `1024x1024`
- denoising step 수가 고정 `4`
- warm clicks의 step 0 shape가 안정적
- cached steps는 shape가 완전히 안정적

따라서 `warm step0 graph`와 `cached-step graph`를 따로 캡처하는 전략이 잘 맞는다.

### 4. VAE caching stays worth doing, but it is not the final bottleneck

3번에서도 avatar/clothing latent cache는 exact reuse라서 넣는 게 맞다. 다만 그걸로만 목표를 달성하긴 어렵다. 최종 병목은 transformer cached path다.

## Recommended Priority

이 시나리오 기준 우선순위는 다음이 맞다.

1. `kv cached` 경로를 Klein 4B serving path에 넣는다
2. ref group diagonal mask와 inter-request ref cache를 함께 설계한다
3. cached-step transformer trunk를 FP8 / fused GEMM으로 줄인다
4. CUDA Graph capture를 얹는다
5. custom grouped / block-sparse attention kernel을 붙인다
6. exact avatar / clothing latent cache를 정리한다

즉 3번의 핵심은 “mask만 넣자”가 아니라 “mask를 이용해서 요청 간 ref cache를 재조합 가능한 구조로 바꾸자”다.

## Bottom Line

- 1번은 transformer가 거의 전부인 baseline이다
- 2번은 intra-request KV cache로 `1.76x` 개선된다
- 3번은 inter-request ref cache까지 열어 주는 경로라서 `2.30x`까지 올라간다
- 3번 이후의 주병목은 ref branch가 아니라 cached-step transformer trunk, 특히 single-stream linear/MLP다
- 따라서 그 다음 최적화는 generic attention tuning보다 FP8 GEMM, graph capture, 그리고 narrow custom attention kernel이 더 타당하다
