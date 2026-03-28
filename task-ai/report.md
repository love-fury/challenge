# FLUX.2 Inference Optimization Challenge Report

## Part 1: Architecture Analysis and Input Design

### 1. How the VAE encoder works — what layers does it have, and what are the implications for caching

klein 4b에서 VAE encoder는 reference image를 전처리할 때 들어가는데요, encoder 출력이 transformer의 입력으로 들어갑니다.
VAE encoder는 어떻게 학습했나 궁금해서 찾아보니 [여기](https://bfl.ai/research/representation-comparison) 보면 따로 학습한 것 같더군요.
VAE가 별도로 학습되어서 쓰이는 게 왜 그럴까 생각해봤는데 (단순 추측입니다) VAE에서는 reconstruction 능력에 집중하도록 하고, transformer는 좋은 latent space 안에서 editing 같은 능력에 집중할 수 있게 나눈게 아닐까 싶습니다.

VAE encoder는 resnet (convolution) block을 가진 인코더로, 아래 구조를 가지고 있습니다.

입력이 `1024 x 1024`라고 두었을 때:

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
캐싱을 하기 위해서는 같은 입력에 대해 같은 출력이 나오는 안정적인 구간이 어딘지를 알아야 경계를 찾을 수 있는데요,
auto encoder의 경우 내부 동작이 모두 deterministic하기 때문에 결과를 그대로 캐싱할 수 있습니다. 대신에 전처리가 바뀌거나 모델이 바뀔 때 어떻게  invalidate 할지 준비는 해야합니다.

(VAE 관련 힌트를 읽어보았는데요. 모델의 출력을 다시 입력으로 넣을 때는 일부분만 캐싱해서 재사용할 수 있을텐데, 아래 시나리오에선 모델 출력을 다시 넣을 일이 없었습니다)

### 2. How reference, noise, and text tokens are assembled and what the attention visibility rules are

코드를 보면 토큰들의 흐름은 대략 아래와 같습니다.
- reference token은 autoencoder를 통해 임베딩됩니다.
- prompt는 Qwen3 encoder로 임베딩됩니다.
- noise는 random으로 만들어집니다.

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
x = scatter(x, x_ids) # output 가져오기
x = decode(x) # decode
```

그런데 힌트 주신것처럼 코드를 더 읽어보면, denoise 대신 denoise_cached라는 함수가 이미 있습니다.
여기서는 ref_group의 kv를 캐싱해서 다읍 스텝에서 재활용하는 방식입니다. 이걸 기준으로 아래에서 설명하겠습니다.
model.forward_* 함수 안에서 실제 attention이 일어나는데요. 아래와 같이 표현할 수 있습니다.

```python
# forward_kv_extract
x = cat([x_seq_concat, x])                      # [ref_group, img]
x_ids = cat([x_seq_concat_ids, x_ids])

for double_blocks:
    img, txt, cache = forward()                 # ref KV 추출

img = cat([txt, img])                          # [T, ref_group, img]
pe = cat([pe_ctx, pe_x])

for single_blocks:
    img, cache = forward()                      # ref KV 추출

img = img[:, txt_len + ref_len:]               # pred는 img 부분만 남김
pred = final_layer(img)
```

`text`, `ref_group`, `img` 사이 visibility는 `causal_attn_fn()` 기준으로 보면, step 0의 no-cache 경로에서 아래처럼 정리됩니다.

| query | 볼 수 있는 key |
|---|---|
| `ref_group` | `(ref_group)`만 |
| `T` | `(T, ref_group, img)` 전체 |
| `img` | `(T, ref_group, img)` 전체 |

step 1+의 cached path에서는 query 쪽에 `ref_group`가 아예 없고, 현재 query는 `(T, img)`만 남습니다. 대신 key/value 쪽에는 cached `k_ref`, `v_ref`가 다시 들어갑니다.

```python
# causal_attn_fn
if no_cache:
    attn_txt_img = attention(q=[T, img], k=[T, ref_group, img], v=[T, ref_group, img])
    attn_ref = attention(q=[ref_group], k=[ref_group], v=[ref_group])
    out = cat([attn_txt, attn_ref, attn_img])
else:
    out = attention(q=[T, img], k=[T, ref_group_cached, img], v=[T, ref_group_cached, img])
```

```python
# single block attention
x = [T, ref_group, img]         # cached path에서는 [T, img]
q, k, v, mlp = linear1(x)
q, k = apply_rope(q, k, pe)
attn = causal_attn_fn(q, k, v, num_txt_tokens, num_ref_tokens, kv_cache?)
x = linear2(cat([attn, mlp]))
```

attention 자체는 매 block에서 항상 다시 계산되지만, cached path에서는 `ref_group`의 `k_ref`, `v_ref`만 재사용하고 ref token 자체는 다시 forward하지 않습니다.

ref_group은 내부에서만 attention하기 때문에 이를 캐싱할 수 있게 됩니다.

### 3. What properties of reference tokens matter for optimization, including whether any work can be reused in the transformer across clicks

reference token은 그룹 안에서만 어텐션하기 때문에 denoise step 안에서 2번째부터 kv cache가 가능합니다.  
prompt만 바꾼다면 요청 간에도 캐싱이 가능한데요, virtual try on 처럼 reference image가 계속 바뀌는 상황에서는 캐싱이 불가능합니다.  
그래서 어떻게 ux를 구성할거냐가 정말 중요해지는데요. 입력 패턴에 따라 마스크만 잘 조정하면 요청 사이에서 충분히 재사용할 수 있기 때문입니다.

### 4. **How would you feed the avatar + clothing inputs to the model?** Propose a preprocessing strategy and explain why it's better for optimization than alternatives

이번 챌린지 시나리오에 적힌 내용은 다음과 같습니다.
- A user uploads their **avatar photo** once per session (high resolution, e.g. 1024x1024 or larger)
- They click through dozens of **clothing items** to try on — tops, bottoms, shoes, accessories, etc. (various aspect ratios and resolutions)
- Each click generates a new try-on output image (1024x1024)
- The avatar stays constant throughout the session; the clothing changes every click

이걸 바탕으로 저만의 서비스 요구사항을 세워봤습니다.

**서비스 요구사항**

사용자에게 최대한 자유도있는 try-on 경험을 제공한다.
- 현실적인 수준(5~10벌) 안에서 옷 동시 착용이 가능해야한다.
- 매 클릭마다 옷은 추가되거나 제거될 수 있다.
- 세션당 수십 회 이상의 착용을 지원하고 이미지 품질이 떨어지면 안된다. 즉 세션의 길이는 품질과 상관이 없어야 한다.
- (이번 문제와는 관련 없는 상상) 옷을 선택해두고 그 안에서도 다양한 레이아웃 (버튼 잠그기, 안에 넣어입기 등)을 조합해볼 수 있어야 한다.

여기서 집중한 부분은 "현실적인 수준", "옷 추가 제거" 입니다. 같은 포지션의 옷을 두 벌 입는 경우는 드물 것이고, 한 사람이 몸에 걸칠 수 있는 의류에는 물리적으로 제한이 있습니다.
예를 들어 이미 바지가 있을 때 바지를 선택하면 기존 바지가 대체되는 경험을 생각했고, reference image의 최대 개수도 제한해도 되겠다고 생각했습니다.

Preprocessing strategy에서는 아래 내용을 고려했습니다.
1. 아바타 및 의류 이미지 전처리 방법
2. reference image group을 어떤 순서, 어떤 식으로 넣을지

이 때 중요한건 이미지 해상도에 따라 토큰 길이가 달라지므로 적절한 crop/resize 등 전처리가 효율적인 연산에 중요하다는 점,
레퍼런스를 어떻게 넣냐에 따라 요청 간 캐시 여부가 달라진다는 점입니다.

#### Image Preprocessing
1. 아바타 전처리
- 사용자가 올리는 사진이므로 배경을 제거하는 등 인물이 잘 들어갈 수 있게 위치/색상 조정이 필요합니다.
2. 의류 전처리
- 의류 사진도 모델이나 다른 의류가 함께 포함되지 않게 crop이 필요하고, 실제 사이즈를 고려했을 때 해상도도 512x512, 혹은 더 작게 조정할 수 있습니다.

똑똑한 전처리도 매우 중요하다고 생각이 들지만, 모델 구조를 고려한 캐싱과 연관이 적어보여서 넘어가겠습니다.
collage 같은 방식은 아래의 캐싱과 적합하지 않다는 점만 언급하겠습니다.

#### Reference Image Grouping

요청 간에 캐싱을 고려했을 때, 제가 떠올린 방법은 다음과 같습니다.
- (prev_output, c_i)
- (avatar, prev_output, c_i)
- (avatar, c_1, ..., c_i)
- (avatar, s_1, ..., s_i)
where
- c_i = 사용자가 i번째에 선택한 의류
- s_i = ui에 n개의 슬롯이 있고, 거기서 i번째 슬롯에 있는 의류

제가 가장 먼저 꽂힌 방법론은 reference image의 causal mask입니다 (llm의 history caching 같은 방법)
사용자가 누른 순서대로 (avatar, c1, c2, ...) 레퍼런스를 넣고 시간 순으로 masking을 하는 거죠.
이 경우 새로운 옷을 더해서 입는 경우에는 최적의 캐싱이 가능하지만, 이전 옷을 제거하면 캐시를 거기서부터 재계산해야합니다.
사용 패턴에 따라 유리한 경우가 다를텐데, 실제 사용 사례를 상상해보면 옷을 계속 추가하기보단 기존 옷을 바꿔입는 시나리오가 더 많을 거라고 생각이 들어 제외했습니다.

그 다음으로 떠올린 아이디어는
- (prev_output, c_i)
- (avatar, prev_output, c_i) <- avatar라는 anchor를 둬서 장기간의 변화에 강하도록 의도

이건 ref group 길이 자체를 상수로 정해버린다는 큰 장점이 있지만, 위와 동일하게 기존 의류를 제거할 방법을 찾지 못했습니다.

추가/제거라는 사용 패턴에 invariant한 캐싱 시나리오를 고려했을 때, Avatar-Hub Attention을 제안합니다. (gpt 작명)

**Avatar-Hub Attention**

Input: 아바타와 현재 선택한 옷들의 리스트.
- (avatar, s_1, ..., s_i)

Attention Mask: 자기 자신과, avatar에만 attention 가능
- 예시

```text
avatar:  [1 0 0 0 0]
cloth1:  [1 1 0 0 0]
cloth2:  [1 0 1 0 0]
cloth3:  [1 0 0 1 0]
cloth4:  [1 0 0 0 1]
```

이렇게 하면 옷을 추가하던 교체하던 다음 요청에서 1번의 kv 연산만 할 수 있고 ref group 안에서는 O(1) 연산이 됩니다.
단점은 구조적으로 ref 의류 간에 attention을 할 수 없기 때문에 정보의 손실이 발생할 수 있어서, 이미지 품질에 대한 검증은 꼭 필요합니다.
이게 얼마나 큰 손실인지 상상해보면, 의류 간 attention은 없어지지만 avatar, output, prompt와는 여전히 attention이 있기 때문에 괜찮지 않을까 생각이 듭니다.

## Part 2: Optimization Strategies


모델 구조를 바탕으로 몇 가지 최적화 플랜에 대해 flops를 계산해보았고, 이걸 기반으로 진행했습니다.
[`docs/flux2-klein4b-click-cost-model.md`](./docs/flux2-klein4b-click-cost-model.md)

- vanilla version total: `4487.296 TF`
- request 내부 KV cache 적용: `2553.416 TF`
- Avatar-Hub Attention 기반 inter-request ref cache 적용: `1947.161 TF`

다만 여기서 주의할 점이 있습니다. 이 문서의 계산은 모두 FLOPs 기준입니다. FLOPs는 큰 병목과 상대적인 compute 감소를 보는 데에는 유용하지만,
실제 latency를 직접 예측해 주지는 않습니다. 특히 attention, block sparse kernel 등은 memory traffic과 kernel implementation에 크게 좌우됩니다.

virtual try-on이라는 특성과 klein 4b 모델에서, 먼저 구조적인 개선을 제안하고, 그 뒤에 모델레벨 최적화를 제안했습니다.
캐싱 전략
- VAE encoder output cache
- reference image KV cache
- Avatar-hub attention based inter-request kv cache
커널 및 모델 최적화
- GEMM / MLP path optimization
- Dense attention path optimization
- Sparse ref attention optimization

상세한 건 아래에 적어두었습니다. 아래 섹션은 gpt의 도움을 강하게 받았습니다.

### Strategy 1. VAE encoder output caching

#### What is cached, skipped, or changed

`default_prep -> ae.encode()`의 최종 output을 reference image 단위로 캐싱합니다.

요청이 들어올 때 캐싱할 수도 있고, 사진을 업로드하는 시점에 미리 캐싱해둘 수도 있습니다.

중간 activation cache가 아니라 final encoder output을 캐싱 대상으로 잡는 이유는, 이 출력이 이후 transformer reference token의 직접 입력이기 때문입니다.

#### What code changes are needed

- `encode_image_refs()` 전에 `avatar_cache_key`, `clothing_cache_key`를 만드는 layer 추가
- cache hit 시 `ae.encode()`를 건너뛰고 cached latent를 바로 `listed_prc_img()`에 연결

#### Estimated impact and why

cost model 기준:

- mode 1 / mode 2에서는 10-click VAE total이 `86.915 TF`
- exact per-image cache를 넣으면 `16.076 TF`

즉 VAE 부분만 보면 `5.4x` 절감이 가능합니다.

하지만 전체 경로에서의 비중은 작습니다. transformer가 훨씬 더 크기 때문에, 이 전략만으로 전체 latency가 극적으로 줄지는 않습니다.

#### Quality risks

- encoder 결과를 통째로 캐싱하므로 큰 문제는 없어보입니다.
- 전처리 로직이 바뀌거나 하는 경우 cache invalidation 로직을 준비해야합니다.

### Strategy 2. Intra-request reference KV caching

#### What is cached, skipped, or changed

이미 upstream code가 제공하는 `forward_kv_extract()` / `forward_kv_cached()` 경로를 production Klein 4B path에 구현합니다.

- step 0에서 ref branch의 `k_ref`, `v_ref`를 block별로 추출
- step 1~3에서는 ref token 자체를 다시 forward하지 않고 cached ref KV를 attention에 주입

이 전략은 “한 요청 내부 denoising step 간 중복”을 줄입니다.

#### What code changes are needed

- `denoise()` 대신 `denoise_cached()` 를 사용합니다.
- block별 KV cache의 lifetime, device placement, batch shape를 관리해야 합니다.

#### Estimated impact and why

cost model 기준:

- vanilla: `4487.296 TF`
- intra-request KV cached: `2553.416 TF`
- speedup: 약 `1.76x`

스텝 1~3에서 ref token들의 kv 계산하는 과정이 아예 사라지므로 그만큼 연산량이 감소합니다.

#### Quality risks

구현만 잘하면 kv cache의 원리 상 출력은 바뀌지 않습니다.

### Strategy 3. Avatar-Hub Attention based inter-request ref KV caching

위에서 설명했던 요청 간에 reference image kv cache를 재활용하는 전략입니다.

#### What is cached, skipped, or changed

reference image group을 아래처럼 넣습니다.

- `(avatar, s_1, ..., s_i)`

여기서 `s_i`는 현재 슬롯에 들어간 clothing들입니다.

그리고 ref group 내부 attention visibility를 다음으로 제한합니다.

- avatar는 자기 자신만 봄
- 각 clothing은 avatar와 자기 자신만 봄
- clothing끼리는 직접 attention하지 않음

즉 ref group의 causal mask를 아래처럼 바꿉니다.

```text
avatar:  [1 0 0 0 0]
cloth1:  [1 1 0 0 0]
cloth2:  [1 0 1 0 0]
cloth3:  [1 0 0 1 0]
cloth4:  [1 0 0 0 1]
```

이 마스크를 쓰면 dependency boundary가 바뀝니다.

- 다음 click에서 바뀌지 않은 ref image는 per-layer ref KV를 그대로 재사용 가능
- 바뀐 image만 step 0에서 다시 계산
- 이때 cache lifetime은 request 단위가 아니라 session 단위로 가져갑니다

#### Cache key design

- lookup key: `(session_id, image_id)`
- cache value: block별 `k_ref`, `v_ref`
이 문제에서는 cache를 세션 안에서만 재사용할 것이므로, 1차 key는 `session_id + image_id`면 충분하다고 봅니다.

#### What code changes are needed

- `causal_attn_fn()` 또는 동등한 attention wrapper를 ref group diagonal mask를 이해하는 형태로 변경
- block별 ref KV cache를 이미지 단위로 분리해서 저장하도록 변경
- 다음 click의 step 0에서
  - cached avatar KV
  - unchanged clothing KV
  - changed clothing의 fresh KV
  를 attention path가 읽을 수 있게 조합해야 함
- serving layer는 request-scoped cache가 아니라 session-scoped cache table을 가져야 함
- 각 slot에 현재 `image_id`를 저장해두고, 다음 click에서 id가 다르면 해당 slot의 clothing cache를 invalidate해야 함
- 다만 invalidate 조건은 `image_id`만이 아니라 entry metadata와의 compatibility check까지 포함하는 편이 안전함

#### Estimated impact and why

cost model 기준:

- mode 2: `2553.416 TF`
- mode 3: `1947.161 TF`
- mode 2 대비 speedup: 약 `1.31x`
- vanilla 대비 speedup: 약 `2.30x`

mode 2 에서도 이미 step 1~3은 kv cache가 이루어지지만, step 0에서의 캐싱이 추가되고, 또한 세션의 길이가 길어질수록 효과가 더 누적됩니다.


#### Quality risks

- clothing끼리 직접 attention이 사라지므로 조합 의상 상호작용 정보가 줄어듭니다. 품질 검증이 필요합니다.
- 예를 들어 상의/하의/악세서리 조합에서 cross-garment consistency가 나빠질 수 있습니다

### Cost analysis after Strategy 3

Strategy 3까지 넣고 나면, 이제 어디를 줄여야 하는지는 cost model이 꽤 명확하게 보여줍니다.

- 10-click inference total: `1947.161 TF`
- VAE: `16.076 TF`
- transformer: `1931.085 TF`

여기서부터는 transformer step time을 최적화하는데 집중해야합니다.

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

실제론 측정된 시간을 기준으로 병목을 판단하겠지만, 여기서는 FLOPS를 기준으로 최적화 우선순위를 결정하겠습니다.
전체 비중만 보면 `single_linear`, `double_mlp` 같은 GEMM-heavy path를 직접 겨냥하는 최적화가 더 큰 레버입니다.

### Optimization areas after Strategy 3

#### 1. GEMM / MLP path optimization

이 영역이 겨냥하는 bucket은 `embed`, `double_proj`, `double_mlp`, `single_linear`입니다. mode 3 이후에는 이 bucket이 전체 transformer compute의 약 `63%`를 차지하므로, 가장 직접적인 다음 레버는 여기입니다.

대표적인 방법은 `FP8 quantization`입니다.

- PyTorch path 유지:
  - `TransformerEngine` + `FlashAttention-3` 조합이 가장 현실적입니다
  - cached path 병목이 `single_linear`, `double_mlp` 같은 GEMM-heavy path라서 FP8 matmul throughput 개선이 직접 먹힐 가능성이 높습니다
- NVIDIA-native engine path:
  - `TensorRT` + `TensorRT Model Optimizer`가 더 강한 선택입니다
  - static-shape serving, fusion, calibration, engine-level optimization을 함께 가져가기 좋습니다

이 전략의 기대 효과는 cost model 기준으로도 가장 의미가 큽니다. quantizable bucket이 얼마나 빨라지느냐에 따라 speedup proxy를 잡아보면:

- quantizable bucket이 `1.25x` 빨라진다고 가정하면: mode 3 transformer 전체는 약 `1.14x`
- `1.5x` 빨라진다고 가정하면: 약 `1.27x`
- `2.0x` 빨라진다고 가정하면: 약 `1.46x`

warm click 기준으로도 거의 동일합니다.

- `1.25x` 가정: 약 `1.14x`
- `1.5x` 가정: 약 `1.26x`
- `2.0x` 가정: 약 `1.45x`

이 숫자는 latency prediction이 아니라 compute proxy입니다. 하지만 "어디를 겨냥하는 최적화가 가장 큰 residual bottleneck을 때리는가"라는 관점에서는 FP8이 가장 직접적입니다. 다만 quality risk는 분명합니다.

- color / texture fidelity degradation
- identity preservation degradation
- garment detail 손실

그래서 calibration 데이터는 일반 text-to-image가 아니라 실제 virtual try-on 사용 패턴을 반영해야 합니다.

#### 2. Dense attention path optimization

이 영역이 겨냥하는 bucket은 `double_attn`, `single_attn`입니다. cached path에서는 `q_ref`가 사라지기 때문에, 실제 serving 경로에서는 sparse attention보다 dense SDPA hot path를 먼저 빠르게 만드는 편이 더 중요합니다.

현실적인 후보는 다음이라고 봅니다.

- `FlashAttention-3`
  - PyTorch serving path를 유지할 때의 1순위 dense attention kernel입니다
  - Hopper(H100/H800) 최적화가 되어 있고 BF16/FP16, FP8 forward를 지원합니다
  - head dim `<=256`를 지원하므로 Klein 4B의 head dim `128`과 잘 맞습니다
- `cuDNN frontend` SDPA
  - NVIDIA native path에서 가장 중요한 building block입니다
  - paged K/V caches, causal mask, sliding window, bias mask를 지원합니다
  - SDPA의 최대 head dim `128` 제한과 Klein 4B의 head dim `128`이 정확히 맞아떨어집니다

기대 효과는 분명합니다. attention bucket 자체를 가속하므로 cached path의 hot attention kernel이 빨라집니다. 다만 전체 compute share가 약 `37%`이기 때문에, 이 영역만 최적화해서는 Strategy 3 이후의 주병목이 사라지지 않습니다. 즉 이건 반드시 필요한 1차 kernel optimization이지만, 단독으로 가장 큰 속도 향상을 만드는 카드는 아닙니다.

#### 3. Sparse ref attention optimization

이 영역은 Strategy 3의 Avatar-Hub diagonal mask를 실제 kernel savings로 연결하는 방법입니다. 대표적으로 `block sparse attention`이 여기에 해당합니다.

이 최적화가 직접 겨냥하는 구간은 거의 `step 0`의 `q_ref -> k_ref` 계산입니다. `6 refs = avatar 1장 + clothes 5장`을 가정하면:

- ref-ref attention만 보면
  - 기존: `1.044 TF / block`
  - Avatar-Hub diagonal mask: `0.528 TF / block`
  - 약 `49%` reduction
- step 0 attention 전체로 보면
  - 기존: `1.826 TF / block`
  - Avatar-Hub: `1.311 TF / block`
  - 약 `28%` reduction

하지만 이 이득은 거의 `step 0` 전용입니다. step 1~3 cached path에는 `q_ref`가 없기 때문에, diagonal mask가 직접 줄일 수 있는 계산 자체가 많지 않습니다. 그래서 full click 기준의 추가 speedup은 제한적이고, 제 예상으로는 **low single-digit additional gain** 정도가 타당합니다.

즉 block sparse attention은 "Strategy 3 이후의 핵심 병목 해결책"이라기보다, Strategy 3 serving path를 구현할 때 붙는 보조 kernel optimization입니다. 특히 sparse metadata, gather/scatter, layout 변환 overhead 때문에 실제 latency 이득은 FLOPs 절감보다 더 작을 수 있습니다.

#### 4. Supporting optimizations

위 세 축이 구조적으로 중요한 최적화이고, 그 위에 붙는 보조 전략은 아래라고 봅니다.

- `CUDA Graph capture`
  - step 0, cached step의 shape가 비교적 안정적이므로 launch overhead를 줄이기 좋습니다
  - mode 3에서는 warm click path가 안정적이라 특히 잘 맞습니다
- fused kernels
  - attention side에서는 QKV packing, QK norm, RoPE, SDPA, output projection을 더 aggressively 묶을 수 있습니다
  - MLP side에서는 GEMM, SiLU-gated activation, projection fusion이 후보입니다
- reference token volume reduction
  - clothing 해상도를 더 줄일 수 있다면 ref token 수 자체가 감소합니다
  - 다만 이건 quality tradeoff가 직접적이므로 category별 검증이 필요합니다

## Part 3: Experiment Plan

시간 부족으로 중단합니다.
