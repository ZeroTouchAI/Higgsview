# HANDOFF: read this first

**Update this file with every change** (the owner may hand off to another AI at any time).

## What this is
Higgsview is a personal, single-user clone of the higgsfield.ai studio. The priority is commercials (video), with image second. The whole point is saving money, so prefer the cheapest model that does the job and always show the cost.

- Repo: https://github.com/ZeroTouchAI/Higgsview
- Stack: Next.js 16 (App Router, `proxy.ts` replaces middleware), Tailwind v4, no DB
- Models: Kie.ai (single key `KIE_API_KEY`) plus pollinations.ai (free images)
- Hosting target: Vercel Hobby (free). Login is one password (`APP_PASSWORD`).

## Map
| Path | What |
|---|---|
| `lib/models.ts` | **Model catalog**: every model, its options, cost estimate, and `build()` that maps UI params to the Kie request. Also `PRESETS`. Add a model here and it shows up everywhere. |
| `lib/kie.ts` | Server-side Kie fetch helper (adds the key) |
| `lib/history.ts` | Client history hook (shared cache), polls `/api/history` while items are pending, one-time localStorage → server migration |
| `lib/store.ts` | Server history: `history.json` in the private Vercel Blob store `higgsview-data`, ETag-guarded `mutate()` |
| `app/api/generate` | Validate the request, build the model body, `createTask`, append the item to server history |
| `app/api/history` | GET: list, and check pending Kie tasks and save results (state, url, lastFrame, real usd). POST: import. DELETE: remove |
| `app/api/upload` | Returns presigned Blob PUT and GET URLs: the browser uploads directly (no 4.5 MB cap), and the GET URL (24h) goes to Kie |
| `app/api/credits` | Kie balance, shown in the nav pill |
| `app/api/export` | "Export to Drive": takes `{id}`, posts that item's url to the Make.com webhook (`MAKE_EXPORT_WEBHOOK`), saves `driveLink` |
| `app/api/login`, `app/login`, `proxy.ts` | Password gate (off when `APP_PASSWORD` is unset) |
| `components/Workspace.tsx` | Higgsfield-style left panel (tabs, preset card, uploads, prompt, audio, model picker, chips, Generate) |
| `lib/apps.ts` | **Apps catalog** (86 Higgsfield-style one-click apps): inputs, a `choice` chip, and `steps[]`, where each step picks a model plus params. Multi-step apps chain through `prev` (the previous step's result URL). Helpers: `nano()` (Nano Banana 2 image step), `animate()` (Seedance tiers Draft/Standard/Premium = mini/fast/2.5), `productAd`, `restyleThenAnimate` |
| `lib/run.ts` | `runModel()` and `validate()`, shared by generate (first step) and history (next steps) |
| `app/apps`, `app/apps/[id]` | Apps gallery (categories, search) and the app runner page |
| `components/Controls.tsx` | `Upload` (presigned Blob upload plus auto-resize of videos) and `Chip` |
| `components/Feed.tsx` | Results grid and the "How it works" empty state |
| `app/page.tsx` | Explore/landing (hero prompt bar and model cards) |
| `docs/RESEARCH.md` | Higgsfield UI/feature map, model ids and pricing |

## Status (updated 2026-09-24)
Done and verified locally:
- Explore, Video (Create / Edit / Motion Control tabs), Image, and History pages; model picker; presets modal; password gate
- The free image generation (pollinations) works end to end
- Type check, lint, and `npm run check` all pass

**Live-tested on production (2026-09-24):** Grok Imagine, Seedance 2.0 Mini and Fast, Kling 3.0 Turbo, Wan 2.7, Hailuo 2.3, and Nano Banana 2 all succeeded (real costs are in docs/RESEARCH.md).
**Not yet live-tested:** Seedance 2.5, Seedance 2.0, Kling 3.0, Veo 3.1 (premium, owner hasn't approved spend), Wan 2.7 Edit, Kling Motion Control (need an input video). If one fails, check the UI error against docs.kie.ai for that model's `build()`.
- Production: the password gate and Kie key are active. Env changes need a redeploy (`vercel redeploy <url> --target production`).

## Features added 2026-09-24 (second session)
- **Shared history**: moved from localStorage to Vercel Blob (store `higgsview-data`, private, env `BLOB_READ_WRITE_TOKEN`). Local dev uses the **same** store as production.
- **Longer videos**: Seedance 2.5 up to 30s. **Continue →** (Seedance items) starts the next clip from the last frame (`return_last_frame`); **Extend +** (Grok items) uses `grok-imagine/extend` (+6s or +10s, repeatable). There's no stitching yet; clips are separate files.
- **Genjutsu tab** (Higgsfield's "Genjutsu", on Seedance 2.5 with `reference_video_urls` and up to 9 `reference_image_urls`, `duration: -1` to match the video):
  - Motion Transfer: keep motion and camera, rebuild the cast and scene from the images
  - Object Swap: change one element, keep the rest
  - Character Swap (full body): `wan/2-2-animate-replace`
  - Face Swap (photo): nano-banana-2 with a face image and a target image
  - Plus Wan Animate Move in Motion Control
- Seedance reference videos must be 409,600–927,408 px and ≤30s. The upload tile **auto-converts** anything outside that range in the browser (`resizeVideo` in Workspace.tsx: canvas + MediaRecorder MP4, real time, Chrome/Edge) to about 1280×720 and trims to 30s.
- **Not live-tested yet:** Genjutsu, Character Swap, Face Swap, Wan Animate Move, Grok Extend, Continue.

## Apps (added 2026-09-24): Higgsfield's /apps rebuilt
- Source list: higgsfield.ai/apps, 8 categories and about 90 apps (scraped 2026-09-24). **86 are implemented** in `lib/apps.ts` as prompt recipes, plus Studios (UGC Ad, Talking Avatar = ElevenLabs TTS → Kling Avatar, Lipsync, Voiceover, Topaz Upscale image/video).
- New tool models (mode `tool`, hidden from pickers): `upscale-image`, `upscale-video` (Topaz), `remove-bg` (Recraft), `kling-avatar`, `tts` (ElevenLabs turbo 2.5, voice ids in `VOICES`).
- An item's `app: {id, input, step}` is advanced by `GET /api/history`. Its cost is the running total across steps.
- **Not built** (need an LLM or a real editor): Virality Predictor, Breakdown, Click-to-Ad (product URL → ad), Sticker Matchcut, Video Background Remover (no Kie model), AI Stylist preset wardrobe. ClipCut/Urban Cuts are single-generation approximations.
- `npm run check` builds every app step with dummy inputs.
- **Live-tested 2026-09-24:** Color Grading ($0.06), Plushies 2-step Draft ($0.245), Gemini voice ($0.004), Talking Avatar (voice → Kling Avatar).
- **Voices:** ElevenLabs (turbo 2.5 and multilingual v2) returned "Internal Error" on Kie every time (not charged), so **Gemini 3.1 Flash TTS is the default** (`gemini:<Name>` in `VOICES`). The ElevenLabs voices are still listed; retry them later.
- Uploads convert non-JPG/PNG images to JPG in the browser (`toJpeg`), because Kling Avatar rejects WebP.
- ponytail: two browser tabs polling at the same moment could start a chained step twice (single user, rare). Add a lock if it happens.

## Google Drive export (done 2026-09-24)
- Each finished card has an **Export to Drive** button. It calls `/api/export`, which posts `{url, name}` to Make.
- Make scenario **"Higgsview - Export to Google Drive"** (id 6385753, team 638412, org 3365202 on us2.make.com): Custom webhook (hook 2851774) → HTTP Download a file → Google Drive Upload (connection 4175462, zerotouchaiautomation@gmail.com) → webhook response `{link, id}`
- Target folder: My Drive/**Higgsview** (id `16NbyGkXZ7N019bh2eIDdPXVtFgJhkw2f`)
- Make Core plan: 100 MB file limit, about 3 operations per export
- The Drive link is saved on the history item (`driveLink`), and the card then shows "✓ In Drive"

## Deployment
- Vercel project `higgsview` (team zero-touch-ai) at https://higgsview.vercel.app, linked locally with `vercel link`
- Env vars set: `KIE_API_KEY` and `APP_PASSWORD` (Sensitive, can't be pulled locally), plus `MAKE_EXPORT_WEBHOOK`

## Next steps (in order)
1. Live-test the premium, edit and motion models once the owner approves the spend
2. Cost estimate could scale with resolution and audio (right now it's a flat per-second rate)
3. **Stitch clips** into one long video (Continue/Extend make the parts): ffmpeg in a Vercel function or ffmpeg.wasm
4. Optional: an auto-export to Drive toggle, so every result is saved without clicking
5. Veo 3.1 extend, audio references (Seedance `reference_audio_urls`), Kling multi-shot
6. Studios: Cinema Studio (camera/lens/focal-length → prompt), Marketing Studio / UGC Factory (commercial templates), Lipsync, Upscale
7. Optional free video: a ComfyUI + Wan 2.2 provider if the owner has a GPU

## Known limits
- Uploaded inputs sit in Blob under `uploads/` and aren't cleaned up (free tier is 1 GB). Add a cleanup when it matters.
- Video auto-convert runs in real time (a 30s clip takes ~30s) and needs a browser with MP4 MediaRecorder (Chrome/Edge). Safari/Firefox users would need ffmpeg.wasm.
- Cost estimates in `models.ts` are approximate. The real cost is recorded per item after completion.
