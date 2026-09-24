# Research (2026-09-23)

## Higgsfield: what it actually is
A UI layer over third-party models (Seedance, Kling, Veo, Sora, Wan, Nano Banana, etc.). You pay a subscription ($19–$129/mo) plus credits. We rebuild the UI and call the same models directly through one API aggregator.

### UI / design tokens (sampled from higgsfield.ai)
- Background `#0b0b0b`, text `#f7f7f8`, accent lime `#d1fe17` (text on it `#131517`), button radius 12px, font **Inter**
- Headlines: heavy, uppercase, tight tracking ("MAKE VIDEOS IN ONE CLICK")
- Top nav: Explore · Image · Video · Audio · MCP · API · Genjutsu · Effects · Cinema Studio · Contests · Marketing Studio · Supercomputer · 3D Jutsu · Edit · Academy · Community · Canvas · Originals · Pricing
- **Video workspace** (`/ai/video`): left panel with tabs *Create Video / Edit Video / Motion Control*, then a preset card ("GENERAL" + model name + **Change**), *References / Extend Video* toggle, "Add references" (image, video, or audio), Prompt, *Elements* toggle, Model selector, chips (5s · 16:9 · 1080p · Bitrate High), and a lime **Generate** button with the credit cost. The right side shows History / How it works.
- **Model picker**: search box, "Featured models" list; each row has an icon, name, TOP/NEW badge, and chips (resolution, duration range, feature).
- **Presets**: 250+ camera/VFX presets (Crash Zoom, Bullet Time, 3D Rotation, FPV, etc.)
- **Studios** (still to clone): Cinema Studio (camera body / lens / focal length picker), Marketing Studio, Lipsync Studio, UGC Factory, Fashion Factory, Photodump, Canvas, Soul ID characters, Face Swap, Upscale, Inpaint

## Model provider: Kie.ai (chosen)
One key, one endpoint (`POST https://api.kie.ai/api/v1/jobs/createTask`, poll `GET /api/v1/jobs/recordInfo?taskId=`), 50+ models, usually cheaper than fal.ai or Replicate. Failed tasks aren't charged. Result URLs expire, so download anything you want to keep.

| Model | Kie id | Approx cost | Notes |
|---|---|---|---|
| Grok Imagine | grok-imagine/text-to-video, image-to-video | ~$0.10 / 6s | cheapest draft model |
| Hailuo 2.3 Std | hailuo/2-3-image-to-video-standard | ~$0.15 / 6s | image-to-video only |
| Seedance 2.0 Mini | bytedance/seedance-2-mini | ~$0.057/s | audio |
| Kling 3.0 Turbo | kling/v3-turbo-* | ~$0.05/s | |
| Seedance 2.0 Fast | bytedance/seedance-2-fast | ~$0.07/s | |
| Wan 2.7 | wan/2-7-text-to-video, image-to-video | ~$0.08/s | |
| Kling 3.0 | kling-3.0/video | $0.07/s std, $0.09/s pro | multi-shot, audio |
| Seedance 2.0 | bytedance/seedance-2 | ~$0.09/s | |
| Seedance 2.5 | bytedance/seedance-2-5 | ~$0.12/s (est) | top model |
| Veo 3.1 | veo-3-1 | $0.05–0.40/s by tier | |
| Kling 3.0 Motion Control | kling-3.0/motion-control | ~$0.09/s | image + driving video |
| Wan 2.7 Video Edit | wan/2-7-videoedit | ~$0.08/s | |
| Nano Banana 2 | nano-banana-2 | ~$0.04 / image | |

The costs above are estimates. The app records the **real** cost Kie reports (`creditsConsumed × $0.005`) on every history item.

### "Free" options
- **Images:** pollinations.ai (free, no key) is wired in as "Flux (Free)".
- **Video:** there's no reliable free hosted video API. The truly free route is self-hosting Wan 2.2 in ComfyUI on your own GPU (12–24 GB VRAM). That could be added later as a provider. Otherwise, Grok Imagine at 480p (~$0.10/clip) is the draft tier.

### Alternatives considered
- fal.ai and Replicate: same models, usually pricier; fal is a good fallback if Kie is down.
- Direct Google (Veo/Gemini) and ByteDance APIs: more keys to manage, no clear saving.

## Measured costs (live test 2026-09-24, cheapest settings, no audio)
| Model | Settings | Real cost |
|---|---|---|
| Grok Imagine | 6s 480p | $0.072 |
| Seedance 2.0 Mini | 5s 480p | $0.095 |
| Nano Banana 2 | 1K image | $0.04 |
| Minimax Hailuo 2.3 | 6s 768P (image-to-video) | $0.15 |
| Seedance 2.0 Fast | 5s 480p | $0.29 |
| Wan 2.7 | 5s 720p | $0.40 |
| Kling 3.0 Turbo | 5s 720p | $0.45 |

All 7 succeeded on the first try. Seedance 2.5, Seedance 2.0, Kling 3.0, Veo 3.1, Wan Edit and Kling Motion Control haven't been live-tested yet.
