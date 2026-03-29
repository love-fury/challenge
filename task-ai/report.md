# FLUX.2 Inference Optimization Challenge Report

## Part 1: Architecture Analysis and Input Design

### 1. How the VAE encoder works — what layers does it have, and what are the implications for caching

Klein 4B에서 VAE encoder는 reference image를 transformer 입력 latent로 바꾸는 역할을 합니다. reference image는 transformer에 바로 들어가지 않고, 먼저 autoencoder encoder를 거쳐 latent token으로 변환된 뒤 sequence 형태로 transformer에 들어갑니다.

`src/flux2/autoencoder.py` 기준으로 encoder 구조는 아래와 같습니다.

- `conv_in`
- 4개 resolution level
- 각 level마다 2개의 `ResnetBlock`
- 마지막 level을 제외한 각 level 뒤에 `Downsample`
- bottleneck의 `ResnetBlock -> AttnBlock -> ResnetBlock`
- `norm_out -> swish -> conv_out -> quant_conv`
- `moments`의 mean half 선택
- `2x2` packing 뒤 BatchNorm 기반 normalization

explicit attention은 bottleneck 레이어의 `mid.attn_1`에만 있습니다.

입력이 `1024 x 1024`라고 두면 shape는 아래처럼 정리할 수 있습니다.

| 단계 | 출력 shape |
|---|---|
| Input | `B x 3 x 1024 x 1024` |
| `conv_in` | `B x 128 x 1024 x 1024` |
| Level 0 + Downsample | `B x 128 x 512 x 512` |
| Level 1 + Downsample | `B x 256 x 256 x 256` |
| Level 2 + Downsample | `B x 512 x 128 x 128` |
| Level 3 | `B x 512 x 128 x 128` |
| Bottleneck | `B x 512 x 128 x 128` |
| `conv_out` + `quant_conv` | `B x 64 x 128 x 128` |
| mean half 선택 | `B x 32 x 128 x 128` |
| `2x2` packing + normalization | `B x 128 x 64 x 64` |

이 단계에서 캐싱이라고 하면 출력 자체를 캐싱하는 방법과, 중간 단계를 캐싱하는 방법으로 나눌 수 있습니다.
입력을 넣는 방식에 따라 달라질 것 같은데요, 예를 들어 이미지 collage를 하거나, 출력 이미지를 다시 encoding해서 다음 요청에 넣게 되면, VAE encoder 내부의 캐싱도 유의미해질 수 있습니다.
다만 저는 개별 이미지를 넣는 방식으로 결정했고, 따라서 VAE encoder에서는 image embedding 전체를 캐싱하기로 했습니다.

### 2. How reference, noise, and text tokens are assembled and what the attention visibility rules are

토큰 조립 흐름은 `src/flux2/sampling.py` 기준으로 다음과 같습니다.

- reference image는 `encode_image_refs()`가 `default_prep()`을 거쳐 개별적으로 `ae.encode()`합니다.
- text는 text encoder output을 `batched_prc_txt()`로 감싸서 token sequence와 position ids를 만듭니다.
- noise latent는 `batched_prc_img()`를 통해 image token sequence로 변환됩니다.

요약하면 대략 아래 흐름입니다.

```python
# vae encode
ref_tokens, ref_ids = encode_image_refs(ae, img_ctx)

# prompt input
ctx = text_encoder()
ctx, ctx_ids = batched_prc_txt(ctx)

# noise input
randn = rand()
x, x_ids = batched_prc_img(randn)

x = denoise()
x = scatter(x, x_ids)
x = decode(x)
```

기본 `denoise()` 경로에서는 매 step마다 reference token이 다시 image token 앞에 concat되어 full forward가 수행됩니다. 그런데 upstream 코드를 더 읽어보면, `denoise_cached()`라는 별도 경로가 이미 있습니다. 이 경로는 한 요청 내부에서 reference KV를 재사용하도록 설계되어 있습니다.

step 0에서는 `forward_kv_extract()`를 호출합니다.

```python
# forward_kv_extract
x = cat([x_seq_concat, x])                      # [ref_group, img]
x_ids = cat([x_seq_concat_ids, x_ids])

for double_blocks:
    img, txt, cache = forward()                 # ref KV 추출

img = cat([txt, img])                          # [T, ref_group, img]
pe = cat([pe_ctx, pe_x])

for single_blocks:
    img, cache = forward()                     # ref KV 추출

img = img[:, txt_len + ref_len:]               # pred는 img 부분만 남김
pred = final_layer(img)
```

step 1 이후에는 query 쪽에서 `ref_group`를 제거하고, cached `k_ref`, `v_ref`만 key/value 쪽에 다시 주입합니다. 즉 reference token을 다시 forward하지는 않지만, `txt`와 `img` query가 reference memory를 읽는 attention 자체는 매 block에서 다시 계산됩니다.

attention visibility는 `causal_attn_fn()` 기준으로 아래처럼 정리할 수 있습니다.

| query | 볼 수 있는 key/value |
|---|---|
| `ref_group` | `ref_group`만 |
| `T` | `(T, ref_group, img)` 전체 |
| `img` | `(T, ref_group, img)` 전체 |

cached path에서는 query 쪽에 `ref_group`가 아예 없고, 현재 query는 `(T, img)`만 남습니다. 대신 key/value에는 cached `k_ref`, `v_ref`가 들어갑니다.

```python
# causal_attn_fn
if no_cache:
    attn_txt_img = attention(q=[T, img], k=[T, ref_group, img], v=[T, ref_group, img])
    attn_ref = attention(q=[ref_group], k=[ref_group], v=[ref_group])
    out = cat([attn_txt, attn_ref, attn_img])
else:
    out = attention(q=[T, img], k=[T, ref_group_cached, img], v=[T, ref_group_cached, img])
```

함수 이름이 `causal_attn_fn()`이긴 하지만 실제 동작은 ref group 안에서만 self-attention이 일어나고, txt/img는 전체를 볼 수 있게 되어있다고 보시면 됩니다.

### 3. What properties of reference tokens matter for optimization, including whether any work can be reused in the transformer across clicks

reference token의 최적화 관점에서 중요한 속성은 세 가지입니다.

1. 이미지 해상도가 최종 토큰 수로 이어집니다. packing 이후 token 은 `(H / 16) x (W / 16)`이므로, `1024 x 1024` avatar는 `4096` 토큰, `512 x 512` clothing은 `1024` 토큰이 됩니다. 따라서 avatar는 고해상도로 유지하되 clothing은 종류에 따라 최대한 작게 유지하면 많은 레퍼런스를 넣을 수 있게 됩니다. 아래 연산량 계산할 때는 의류는 512 x 512라고 가정했습니다.

2. flux2 구현에서 이미 ref image group은 캐싱이 가능합니다. ref query는 ref key/value만 보고, `forward_kv_extract()`에서는 ref branch에 `ref_fixed_timestep=0.0` 기반 modulation이 적용됩니다. 이 두 조건이 합쳐져서 step이 바뀌어도 ref branch의 per-layer K/V가 유지되기 때문에, 한 요청 내부에서는 step 1~3에서 ref KV cache가 성립합니다.

3. 이 재사용은 기본적으로 intra-request reuse입니다. 요청이 바뀌어 ref set이 달라지면, 현재 upstream semantics 아래에서는 step 0에서 ref group 전체를 다시 통과시켜야 합니다. 즉 virtual try-on처럼 clothing이 반복적으로 교체되는 세션에서는, 기본 경로만으로는 composable inter-request cache가 자연스럽게 생기지 않습니다.

정리하면 다음과 같습니다.

- 현재 구현에서 바로 가능한 재사용: 한 요청 내부 denoising step 간 ref KV cache
- 추가 설계 없이는 어려운 재사용: clothing 교체/추가/삭제가 반복되는 세션 간 composable ref cache

이 점 때문에 input design이 중요해집니다. 어떤 단위로 reference를 넣을지, 어떤 ordering과 visibility를 줄지에 따라 요청 간 cache 가능성이 달라지기 때문입니다.

### 4. How would you feed the avatar + clothing inputs to the model? Propose a preprocessing strategy and explain why it's better for optimization than alternatives

이번 챌린지 시나리오에 적힌 내용은 다음과 같습니다.

- A user uploads their **avatar photo** once per session
- They click through dozens of **clothing items**
- Each click generates a new try-on output image
- The avatar stays constant throughout the session; the clothing changes every click

이 시나리오를 그대로 받아들이면, 기본 입력 설계는 "avatar와 clothing을 separate reference로 유지하고, stable ordering으로 넣는 방식"이 가장 낫다고 생각합니다.

제가 고려한 포인트는 두 가지입니다.

1. 아바타 및 의류 이미지 전처리 방법
2. reference image group을 어떤 순서, 어떤 단위로 넣을지

이때 중요한 것은 이미지 해상도가 token 길이를 결정한다는 점, 그리고 reference를 어떤 단위로 나누느냐에 따라 요청 간 cache 재사용 가능성이 달라진다는 점입니다.

#### Image preprocessing

1. 아바타 전처리
- 사용자가 올리는 사진이므로 인물 중심 crop, background cleanup, 색상/위치 안정화가 중요합니다.
- 아바타는 세션 내내 재사용되므로 고해상도 유지가 유리합니다. 예를 들어 `1024 x 1024`를 기본으로 둘 수 있습니다.

2. 의류 전처리
- 의류 이미지도 상품 자체만 남도록 crop하는 것이 좋습니다.
- 가능한 한 aspect ratio를 보존하되, pad를 이용해 안정된 canvas로 맞추는 편이 좋습니다.
- 기본 해상도는 `512 x 512` 정도가 합리적이고, 악세서리처럼 작은 품목은 더 작은 canvas 후보를 둘 수 있습니다.

위에서 이미지 별 vae encoder 결과를 캐싱하기로 했기 때문에 collage 와 같은 전처리 방식은 제외했습니다.

#### Reference image grouping

요청 간 캐싱을 고려하면서 떠올린 방식은 대략 아래 네 가지였습니다.

- `(prev_output, c_i)`
- `(avatar, prev_output, c_i)`
- `(avatar, c_1, ..., c_i)`
- `(avatar, s_1, ..., s_i)`

where

- `c_i` = 사용자가 i번째에 선택한 의류
- `s_i` = UI에 n개의 stable slot이 있고, 거기서 i번째 slot에 있는 의류

처음 떠올린 아이디어는 `(avatar, c1, c2, ...)`를 시간 순으로 append하고 causal하게 mask를 주는 방식이었습니다. 이 경우 새로운 옷을 계속 추가하는 시나리오에는 잘 맞습니다. 하지만 옷을 제거하거나 중간 아이템을 바꾸는 순간, cache를 그 지점부터 다시 계산해야 한다는 문제가 있습니다. virtual try-on에서는 append-only보다 replace가 더 자주 일어날 가능성이 높다고 봐서 제외했습니다.

그 다음으로는 `(prev_output, c_i)` 또는 `(avatar, prev_output, c_i)`를 떠올렸습니다. 이 방식은 ref group 길이를 상수로 유지한다는 장점이 있지만, 기존 의류를 독립적으로 제거하거나 교체하는 시나리오에 잘 맞지 않고, `prev_output`을 계속 참조하면 품질 drift 가능성도 있습니다.

그래서 기본 입력 설계로는 `[avatar, cloth_slot_1, cloth_slot_2, ...]` 같은 stable ordered refs를 생각했습니다. 이 방식의 장점은 세 가지입니다.

1. VAE cache granularity를 보존할 수 있습니다.
2. avatar와 clothing의 해상도를 분리해서 token budget을 제어할 수 있습니다.
3. 이후 per-item cache나 session cache로 확장하기가 쉽습니다.

다만 여기서 한 걸음 더 나가서, 요청 간 composable cache를 강하게 노리는 공격적인 제안도 가능합니다. 제가 생각한 방식은 아래와 같습니다.

#### Avatar-Hub Attention

Input: 아바타와 현재 선택한 옷들의 리스트.

- `(avatar, s_1, ..., s_i)`

Attention mask: 자기 자신과, avatar에만 attention 가능

```text
avatar:  [1 0 0 0 0]
cloth1:  [1 1 0 0 0]
cloth2:  [1 0 1 0 0]
cloth3:  [1 0 0 1 0]
cloth4:  [1 0 0 0 1]
```

이렇게 하면 unchanged clothing의 per-layer ref KV를 image별로 분리 저장하고, 다음 요청에서 changed clothing만 새로 계산하는 serving path를 설계할 수 있습니다. 즉 이 마스크의 핵심은 sparse mask 자체보다도, ref item별 composable cache를 만들 수 있다는 데 있습니다.

장점은 분명합니다.

- 옷을 추가하든 교체하든 unchanged item의 KV를 재사용할 수 있습니다.
- 세션이 길어질수록 step 0의 ref branch 재계산량이 줄어듭니다.

단점도 분명합니다.

- 의류끼리 직접 attention하지 못하기 때문에 garment-garment interaction 정보가 줄어듭니다.
- layering, strap, scarf, outerwear 같은 상호작용이 중요한 조합에서 품질이 떨어질 수 있습니다.

그래서 이 방식은 "기본 입력 설계"라기보다, 품질 검증을 전제로 한 공격적인 최적화 옵션으로 제안하는 편이 더 안전하다고 봅니다.

## Part 2: Optimization Strategies

모델 구조를 바탕으로 몇 가지 최적화 플랜에 대해 FLOPs를 계산해보았고, 이걸 기반으로 우선순위를 정했습니다.

근거 문서:
[flux2-klein4b-click-cost-model.md](./flux2-klein4b-click-cost-model.md)

- vanilla version total: `4487.296 TF`
- request 내부 KV cache 적용: `2553.416 TF`
- Avatar-Hub Attention 기반 inter-request ref cache 적용: `1947.161 TF`

다만 여기서 주의할 점이 있습니다. 이 문서의 계산은 모두 FLOPs 기준입니다. 그래서 대략적인 비교는 가능하지만, 실제 h100에서의 병목은 메모리/IO 등 다양하기 때문에 속도를 완벽하게 추정할 수는 없습니다.

입출력 고려한 구조적인 캐싱을 제안하고, 그 뒤에 kernel / model 최적화를 제안하는 순서가 자연스럽다고 봤습니다.

캐싱 전략
- VAE encoder output cache
- intra-request reference image KV cache
- Avatar-Hub Attention 기반 inter-request ref KV cache

커널 및 모델 최적화
- GEMM / MLP path optimization
- Dense attention path optimization
- Sparse ref attention optimization

### Strategy 1. VAE encoder output caching

#### What is cached, skipped, or changed

`default_prep -> ae.encode()`의 최종 output latent를 reference image 단위로 캐싱합니다.

- avatar는 세션 시작 시 한 번 계산 후 재사용
- clothing은 image identity 기준으로 캐싱
- cache hit 시 `ae.encode()` 전체를 건너뜁니다

중간 activation cache가 아니라 final encoder output을 캐싱 대상으로 잡는 이유는, 현재 구현 자체가 reference image를 개별적으로 encode한 뒤 concat하는 구조이기 때문입니다. 이 출력이 이후 transformer reference token의 직접 입력이기도 해서 구조적으로 가장 자연스럽습니다.

#### What code changes are needed

- `encode_image_refs()` 직전에 cache lookup layer 추가
- `image fingerprint + preprocess version + AE checkpoint version` 정도를 key에 포함
- cache hit 시 cached latent를 바로 `listed_prc_img()`에 연결

#### Estimated impact and why

cost model 기준:

- mode 1 / mode 2에서는 10-click VAE total이 `86.915 TF`
- exact per-image cache를 넣으면 `16.076 TF`

즉 VAE 부분만 보면 약 `5.4x` 절감이 가능합니다.

다만 전체 경로에서의 비중은 작습니다. transformer가 훨씬 더 크기 때문에, 이 전략만으로 전체 click latency가 극적으로 줄지는 않습니다.

#### Quality risks

encoder 결과를 통째로 재사용하는 것이므로 이론적으로 품질 변화는 없습니다. 리스크는 품질보다 cache hygiene 쪽입니다.

- 전처리 로직이 바뀌었는데 old cache를 쓰는 경우
- checkpoint가 바뀌었는데 old latent를 쓰는 경우

즉 이 전략은 numerical correctness보다 invalidation 로직이 중요합니다.

### Strategy 2. Intra-request reference KV caching

#### What is cached, skipped, or changed

이미 upstream code가 제공하는 `denoise_cached()` / `forward_kv_extract()` / `forward_kv_cached()` 경로를 production Klein 4B path에 반영합니다.

- step 0에서 ref segment의 per-layer `k_ref`, `v_ref`를 block별로 추출
- step 1~3에서는 ref token 자체를 다시 forward하지 않고 cached ref KV를 attention에 주입

이 전략은 한 요청 내부 4-step denoising에서 step 1~3의 중복을 줄입니다.

#### Why the cache is valid

이 재사용이 성립하는 이유는 단순히 "ref가 ref만 본다" 하나가 아닙니다.

- ref query는 ref key/value만 읽습니다.
- `forward_kv_extract()`에서 ref branch는 `ref_fixed_timestep=0.0` 기반 modulation을 받습니다.
- 따라서 ref branch는 step이 바뀌어도 img latent 변화에 종속되지 않습니다.

즉 step 0에서 추출한 per-layer ref KV가 step 1~3에서도 그대로 유효합니다.

#### What code changes are needed

- serving path가 기본 `denoise()` 대신 cached path를 호출하도록 전환
- block별 KV cache의 lifetime, device placement, batch shape를 관리
- cached step에서 ordering mismatch가 없도록 shape / layout 정합성 보장

#### Estimated impact and why

cost model 기준:

- vanilla: `4487.296 TF`
- intra-request KV cached: `2553.416 TF`
- speedup: 약 `1.76x`

step 1~3에서 ref token들의 K/V 계산이 사라지므로 그만큼 연산량이 감소합니다. 그리고 이 전략의 장점은 model semantics를 바꾸지 않으면서도 큰 중복을 줄인다는 점입니다.

#### Quality risks

구현만 정확하면 출력은 바뀌지 않아야 합니다. 따라서 이 전략의 리스크는 품질 변화가 아니라 implementation bug입니다.

- KV ordering mismatch
- shape / dtype mismatch
- step 0과 cached step 간 cache lifetime bug

### Strategy 3. Avatar-Hub Attention based inter-request ref KV caching

위에서 설명했던 요청 간 reference image KV cache를 재활용하는 전략입니다. 다만 이 전략은 현재 upstream semantics를 그대로 쓰는 것이 아니라, ref visibility와 serving path를 함께 바꾸는 proposal입니다.

#### What is cached, skipped, or changed

reference image group을 아래처럼 넣습니다.

- `(avatar, s_1, ..., s_i)`

여기서 `s_i`는 현재 slot에 들어간 clothing들입니다.

그리고 ref group 내부 attention visibility를 다음으로 제한합니다.

- avatar는 자기 자신만 봄
- 각 clothing은 avatar와 자기 자신만 봄
- clothing끼리는 직접 attention하지 않음

즉 ref group mask를 아래처럼 바꿉니다.

```text
avatar:  [1 0 0 0 0]
cloth1:  [1 1 0 0 0]
cloth2:  [1 0 1 0 0]
cloth3:  [1 0 0 1 0]
cloth4:  [1 0 0 0 1]
```

이 dependency boundary 위에서:

- unchanged avatar / clothing의 per-layer ref KV를 세션 캐시에 저장
- 다음 click의 step 0에서는 changed clothing만 fresh ref branch를 계산
- `txt`와 `img` query는 cached ref KV와 fresh ref KV를 합친 memory를 읽음

즉 핵심은 sparse mask 자체보다도, 그 mask가 ref item별 composable cache를 가능하게 만든다는 데 있습니다.

#### What code changes are needed

- `causal_attn_fn()` 또는 동등한 attention wrapper를 새로운 ref visibility rule을 이해하는 형태로 변경
- block별 ref KV cache를 contiguous ref group 단위가 아니라 image / slot 단위로 분리 저장
- 다음 click의 step 0에서
  - cached avatar KV
  - unchanged clothing KV
  - changed clothing의 fresh KV
  를 attention path가 읽을 수 있게 조합
- serving layer는 request-scoped cache가 아니라 session-scoped cache table을 가짐

#### Estimated impact and why

cost model 기준:

- mode 2: `2553.416 TF`
- mode 3: `1947.161 TF`
- mode 2 대비 speedup: 약 `1.31x`
- vanilla 대비 speedup: 약 `2.30x`

mode 2 에서도 이미 step 1~3은 kv cache가 이루어지지만, step 0에서의 캐싱이 추가되고, 또한 세션의 길이가 길어질수록 효과가 더 누적됩니다.

#### Quality risks

이 전략은 model semantics를 바꾸므로 명시적인 quality risk가 있습니다.

- clothing끼리 직접 attention이 사라져 조합 의상 상호작용 정보가 줄어듭니다
- 상의/하의/악세서리 조합에서 cross-garment consistency가 나빠질 수 있습니다
- outerwear, bag strap, scarf 같은 상호작용이 큰 조합에서 품질 저하 가능성이 있습니다

### Cost analysis after Strategy 3

이제는 트랜스포머 자체의 연산량을 줄이는 게 효과적인 단계입니다.

### Transformer compute share

mode 3 transformer 연산을 종류별로 나누면 다음과 같습니다.

- quantizable bucket
  - `embed`
  - `double_proj`
  - `double_mlp`
  - `single_linear`
- attention bucket
  - `double_attn`
  - `single_attn`

10-click aggregate 기준:

- transformer total: `1931.085 TF`
- quantizable bucket: `1219.839 TF`
- attention-like bucket: `711.247 TF`

즉 약 `63%`는 GEMM-heavy path이고, 약 `37%`는 attention-like path입니다.

실제론 측정된 시간을 기준으로 병목을 판단해야 합니다. 다만 FLOPs 기준으로만 봐도, `single_linear`, `double_mlp` 같은 GEMM-heavy path를 직접 겨냥하는 최적화가 더 큰 레버라는 점은 분명합니다.

### Optimization areas after Strategy 3

#### 1. GEMM / MLP path optimization

이 영역이 겨냥하는 bucket은 `embed`, `double_proj`, `double_mlp`, `single_linear`입니다. mode 3 이후에는 이 bucket이 전체 transformer compute의 약 `63%`를 차지하므로, 가장 직접적인 다음 레버는 여기입니다.

대표적인 방법은 `FP8 quantization`입니다.

- PyTorch path 유지:
  - `TransformerEngine` + `FlashAttention-3` 조합
  - cached path 병목이 `single_linear`, `double_mlp` 같은 GEMM-heavy path라서 FP8 matmul throughput 개선이 직접 먹힐 가능성이 높음
- NVIDIA-native engine path:
  - `TensorRT` + `TensorRT Model Optimizer`
  - static-shape serving, fusion, calibration, engine-level optimization을 함께 가져가기 좋음

이 전략의 기대 효과는 cost model 기준으로도 가장 의미가 큽니다. 다만 이 숫자들은 latency prediction이 아니라 compute proxy로 읽어야 합니다.

- quantizable bucket이 `1.25x` 빨라진다고 가정하면: mode 3 transformer 전체는 약 `1.14x`
- `1.5x` 가정: 약 `1.27x`
- `2.0x` 가정: 약 `1.46x`

quality risk도 분명합니다.

- color / texture fidelity degradation
- identity preservation degradation
- garment detail 손실

그래서 calibration 데이터는 일반 text-to-image가 아니라 실제 virtual try-on 사용 패턴을 반영해야 합니다.

#### 2. Dense attention path optimization

이 영역이 겨냥하는 bucket은 `double_attn`, `single_attn`입니다. cached path에서는 `q_ref`가 사라지더라도, `txt/img -> full memory` attention은 계속 남습니다. 따라서 실제 serving 경로에서는 sparse attention보다 dense SDPA hot path를 먼저 빠르게 만드는 편이 더 중요합니다.

현실적인 후보는 다음이라고 봅니다.

- `FlashAttention-3`
  - PyTorch serving path를 유지할 때의 1순위 dense attention kernel
  - Hopper(H100/H800) 최적화
  - Klein 4B의 head dim `128`과 잘 맞음
- `cuDNN frontend` SDPA
  - NVIDIA native path에서 중요한 building block
  - paged K/V caches, causal mask, sliding window, bias mask 지원
  - head dim `128` 조건과 맞음

기대 효과는 분명하지만, 전체 compute share가 약 `37%`이기 때문에 이 영역만 최적화해서는 Strategy 3 이후의 주병목이 사라지지 않습니다. 즉 반드시 필요한 최적화이지만, 단독으로 가장 큰 속도 향상을 만드는 카드는 아닙니다.

#### 3. Sparse ref attention optimization

이 영역은 Strategy 3의 Avatar-Hub mask를 실제 kernel savings로 연결하는 방법입니다. 대표적으로 `block sparse attention`이 여기에 해당합니다.

이 최적화가 직접 겨냥하는 구간은 거의 `step 0`의 `q_ref -> k_ref` 계산입니다. step 1~3 cached path에는 `q_ref`가 없기 때문에, diagonal mask가 직접 줄일 수 있는 계산 자체는 많지 않습니다.

그래서 full click 기준의 추가 speedup은 제한적일 가능성이 큽니다. 제 생각에는, 이 전략은 "Strategy 3 이후의 핵심 병목 해결책"이라기보다 Strategy 3 serving path를 구현할 때 붙는 보조 kernel optimization에 가깝습니다.

또한 sparse metadata, gather/scatter, layout 변환 overhead 때문에 실제 latency 이득은 FLOPs 절감보다 더 작을 수 있습니다.

#### 4. Supporting optimizations

위 세 축이 구조적으로 중요한 최적화이고, 그 위에 붙는 보조 전략은 아래와 같습니다.

- `CUDA Graph capture`
  - step 0, cached step의 shape가 비교적 안정적이므로 launch overhead를 줄이기 좋음
- fused kernels
  - attention side에서는 QKV packing, QK norm, RoPE, SDPA, output projection fusion
  - MLP side에서는 GEMM, SiLU-gated activation, projection fusion
- reference token volume reduction
  - clothing 해상도를 더 줄이면 ref token 수 자체가 감소
  - 다만 quality tradeoff가 직접적이므로 category별 검증 필요

이들은 보통 단독으로 큰 개선을 만들기보다는, 구조적 reuse와 kernel-level acceleration 위에 얹혀 최종 latency를 다듬는 역할을 합니다.

## Part 3: Experiment Plan

여기까지 진행하는데 8시간이 넘게 걸려서, 시간 부족으로 중단합니다.
