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
| `app/join` | Join Clips (stitch videos + soundtrack in the browser) |
| `app/api/file` | Streams private Blob files (joined videos) with a permanent link |
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
- **Genjutsu for real people:** `genjutsu-kling` = Kling 3.0 Omni Transformation (`kling-3.0-omni/transformation`: `video_urls`[1] + `image_urls` ≤4 + prompt, resolution 720p/1080p, aspect 16:9/9:16/1:1 with images). Input video 3–15.5s, each side ≥700px, 24–60 fps; the upload tile trims to 15s, upscales to 720p on the short side, and re-encodes at 30 fps (`videoMinSide`). Measured: 5s at 720p = $0.50 ($0.10/s). Tested 2026-09-24 (sneaker → perfume bottle swap worked). Character Swap (Wan Animate) measured at $0.0625/s of input video ($1.81 for 29s).
- **Real faces:** Seedance (Genjutsu, all Seedance models) rejects real human faces: "output video may contain sensitive information", not charged. ByteDance's verified real-person asset flow (`asset://` ids) isn't exposed by Kie. For real people use Wan Animate Replace (Character Swap) or Kling Motion Control. `explain()` in api/history adds this hint to the error.
- **Frame rate:** Seedance needs 23.8–60 fps, so for pixel-limited (Seedance) models every uploaded video is re-encoded at a **constant 30 fps**. `captureStream(0)` plus `track.requestFrame()` is driven by a Web Worker clock (not throttled in background tabs). Verified with a frame count from the MP4 boxes: 182 frames / 6.07s = 30.0 fps.
- **Pricing:** `usdPerSec` can be per resolution, and `billsInputVideo` doubles seconds (Seedance reference-video bills input + output). Estimates over $2 ask for confirmation. See docs/RESEARCH.md.
- **Auto-trim:** models declare `videoMaxSecs` (Genjutsu, Kling Motion, Wan Animate = 30; Wan Edit = 10). The upload tile trims anything over max−0.5s (Kie rejected a ~30.0s clip: it measures length differently) down to max−0.5s in the browser and labels the result "Trimmed to first 30s". It uses exact `v.duration` (no rounding). The stop check runs on a timer and frames are also drawn from the timer when the tab is hidden, because rVFC pauses in hidden tabs. Tested with a 32s clip: result 29.6s at 1280×720.
- Layout fix: workspace and app pages use `lg:h-[calc(100dvh-3.5rem)]` without `flex-1` (flex-basis was overriding the height, so a long history stretched the panel). The Generate button is `sticky bottom-0` with an "Add: …" hint listing missing inputs. Genjutsu prompt is optional.
- ponytail: two browser tabs polling at the same moment could start a chained step twice (single user, rare). Add a lock if it happens.

## Navigation and new sections (added 2026-09-24, third session)
- **Top bar** (`components/Nav.tsx`): Explore · **Image ▾ · Video ▾ · Audio ▾** (click-open mega menus with Features plus Models columns, mirroring higgsfield.ai; models are listed from `MODELS` by mode) · Effects · Cinema Studio · Genjutsu · Apps · History · Spending. Left out on purpose: MCP, API, ChatGPT Plugin, Contests, Enterprise.
- **Audio** (`/audio`, mode `audio`): Gemini TTS (default, voice chip), ElevenLabs (flaky on Kie), **Suno V6 music** (`ai-music-api/generate`, instrumental or vocals), **Suno sound effects** (`ai-music-api/sounds`). Model fields `resLabel`/`defaultRes` drive the chip label and default.
- **Image models added:** Nano Banana Pro, GPT Image 2, Seedream 5.0 Pro, FLUX.2 Pro, Grok Imagine 2.0. Each switches to image-to-image when a reference is uploaded.
- **Effects** (`/effects` → `/apps/fx-*`): 20 Higgsfield VFX presets (`EFFECTS` in lib/apps.ts) with optional Character/Location/Product photos. Several photos get composed with Nano Banana first, then animated. A "Change" modal switches effects.
- **Cinema Studio** (`/cinema`): camera, lens, focal length, aperture, up to 3 stacked moves, Photo/Video mode; the choices become prompt language and are sent to the chosen model.
- **Spending** (`/spend`): Kie balance, today/7d/30d/all-time, 14-day bars, by tool, by type, every charge. History DELETE is now a soft delete (`hidden`) so Spending stays accurate.
- **App videos moved off Seedance** (it blocks real faces): Draft = Grok Imagine 480p, Standard = Kling 3.0 std, Premium = Kling 3.0 pro + sound.
- **Live-tested:** FLUX.2 Pro ($0.025), Suno music ($0.06, 2 tracks returned and we keep the first; the URL is in `resultJson.data[].audio_url`, picked up by the regex fallback in api/history), Effect "Floating Fall" Draft via Grok ($0.07). Debug any Kie job with `GET /api/raw?id=<taskId>` (login required).
- Pages are keyed by their query string (menu clicks reset state). "Continue →" passes the last frame as `?start=`.

## Header styling (2026-09-24)
- `components/Badge.tsx`: Higgsfield's slanted badges. TOP = blue gradient; PRO/TRENDING/CHEAP = pink radial gradient; NEW/FREE = lime. Used in the Nav menus, model picker, Explore cards and Apps cards.
- Footer on every page: "Powered by ZeroTouchAI.com" (links to https://zerotouchai.com), in `app/layout.tsx`.
- Top-left: "H" logo + "Higgsview" wordmark (back as of 2026-09-24).
- Top-right of the Nav, like Higgsfield's Pricing/Enterprise/Login area:
  - Spending pill with the Pricing diamond icon and a pink bubble showing this month's spend
  - Upcoming with the Enterprise sparkle icon and the NEW count
  - A 1px divider, then Log out (`POST /api/logout` clears the `hv_auth` cookie), then the lime Kie balance pill (links to kie.ai/billing)

## Result card actions (2026-09-24)
- ⧉ Copy (prompt to clipboard) and ↻ Regenerate. Regenerate re-posts the same `{appId, input}` or `{modelId, params}`: studio items now store `params` on the history item; older items without it don't show the button.
- ↓ Download (pink) fetches the file as a blob and saves it. Kie's file hosts send `Access-Control-Allow-Origin: *`; falls back to opening the URL. ▲ Google Drive is solid dark blue `#1f3f99` (owner preference: not the two-tone gradient).

## Account menu, profile, password (2026-09-24)
- Top-right: Spending, Upcoming, divider, **balance pill in dollars** (credits × $0.005; the menu shows credits), **account circle** (initials from the profile).
- `components/AccountMenu.tsx` dropdown (modeled on Higgsfield's):
  - Name and a credits card: 28-dot meter on a fixed 0–10,000 credit scale ($50 = full) and a Top up button (no $/days-left line) (kie.ai/billing)
  - View profile
  - Kie links: API Keys `/api-key`, Billing `/billing`, Logs `/logs`
  - Sign Out
- `/profile`: first/last name, username, email (`profile.json` in Blob via `/api/account`), plus Change password (`/api/account/password`).
- **Password:** `lib/auth.ts`. The active hash is `auth.json` in Blob if set, else `sha256(APP_PASSWORD)`. `proxy.ts` compares the `hv_auth` cookie to it (60s cache per instance). Changing the password logs out other browsers.
- ⚠ Local dev shares the Blob store: changing the password locally changes the live password.

## Everything from Upcoming built (2026-09-24, all 110 items)
Tracker after the build: Apps 92 built · Effects 87 built · Features 62 built / 56 ignored (6 with reasons: Sora 2 and Recraft V4 aren't on Kie; no voice-cloning model on Kie; App Builder / Games / Supercomputer aren't media tools). `KNOWN` in lib/upcoming.ts maps each product page → the Higgsview feature that covers it; forced scans re-check todo items.
- **Engine** (`lib/run.ts`):
  - `TOOLS` = instant server-side steps: `gemini-text` (Kie Gemini 3.7 Flash chat, OpenAI format at `/gemini-3-7-flash-openai/v1/chat/completions`; media as `image_url` parts, video/audio included) and `page-brief` (fetches a URL, gives the page text to Gemini, returns text + og:image).
  - `advance(app, input, step, prev, notes)` runs instant steps back to back and stops at the first Kie task; the history poller resumes it. Steps get `(input, prev, notes)`; `notes` = the last text output.
  - `jsonOf()` pulls JSON out of AI answers.
- **Fan-out:** apps with `fanout(input, notes)` (Script to Video, URL to Video, Explainer) create one History item per scene via hidden apps `scene-shot` / `narration`, grouped with `group` = parent id. Feed shows "⧉ Join scenes".
- **Join Clips** (`/join`, `recordClips()` in Controls.tsx):
  - Stitches videos in the browser at 30 fps (letterboxed), with an optional soundtrack.
  - Uploads the result to Blob and saves it as `/api/file?p=uploads/…` (permanent, login-protected stream). Drive export presigns it (`lib/blobUrl.ts`).
  - Tested: 5s + 6s → 11.3s 1280×720.
- **Long Genjutsu (30s):** `videoSplit` on `genjutsu-kling`. The upload tile splits videos over 15s into 2 parts; Generate runs 2 grouped jobs ("Part 1/2", "Part 2/2") → Join. Tested the split (32s → 2 × 14.5s).
- **New models:** Wan 2.6, Grok Imagine 1.5 (`generated/grok-imagine-video-1.5-preview`), MiniMax H3 (t2v/i2v), Gemini Omni Flash 1.1, and the tool Volcengine lip-sync. Prices are **estimates**.
- **New apps:**
  - 34 new effects (EFFECTS: `[slug, name, motion, look?]`; `look` = restyle the photo first, used for the split-screen paintings)
  - 34 Mixed Media styles (`MIXED`: restyle an uploaded video with Kling Omni, or animate a photo)
  - The 12 Higgsfield apps (ids = Higgsfield slugs)
  - Soul, AI Influencer, Clothes/Hairstyle Changer
  - Remove Object/Text from Video, Video Background Changer/Remover (Kling Omni)
  - Virality Predictor, Breakdown, Click to Ad, URL to Video, Script to Video, Explainer, Video Translator, Voice Changer (text AI → Gemini TTS → lip-sync)
- **NOT live-tested** (the test browser wasn't logged in and paid tests need the owner's login): all new models and apps above, including the Gemini text calls. Lip-sync assumes Kie accepts the Gemini TTS audio (wav). If something fails, the History card shows Kie's error; `/api/raw?id=<taskId>` shows the raw task.

## Upcoming tracker and app thumbnails (added 2026-09-24)
- **Upcoming** (`/upcoming`, `lib/upcoming.ts`, `app/api/upcoming`): reads Higgsfield's public sitemaps (`/apps/sitemap.xml`, `/effects/sitemap.xml`, `/sitemap-marketing.xml`) and stores `upcoming.json` in Blob. The Nav calls `GET /api/upcoming` on every app open; the server re-scans only if the last check is over 24h old ("Check now" forces it).
  - Statuses: `new` (appeared after the first scan, shown as a count badge in the Nav), `todo`, `built`, `ignored`. The user can re-mark any item.
  - Classification rules: `NOISE` (guides, community, MCP, pricing…), `ALIASES` (Higgsfield slug → our app id), `BUILT_PAGES`, `PRODUCTS` (real products worth building; other marketing/SEO pages start ignored).
  - First scan (baseline, 2026-09-24): to build = 12 apps, 67 effects, 31 features/products.
  - Easy next win: the 67 unbuilt effects are prompt-only. Each Higgsfield effect page has a description to base a prompt on.
- **Homepage model cards** use `public/thumbs/model-<modelId>.jpg` (640px, 10 files, $0.31).
- **Thumbnails**: `public/thumbs/<appId>.jpg` (480px JPEG, about 30 KB each, 106 files) shown on Apps cards, the effect picker and the app header. Generated once with FLUX.2 Pro (a few with Grok Image 2 / Nano Banana after Kie "Internal Error"s). Cost $2.63. A second batch of 92 (the Upcoming build: new effects, Mixed Media, AI Assist apps) cost $2.30 (group `thumbs3`; Kie rate-limits bursts, so send ~1 every 4 s). The generation jobs are hidden in History and counted in Spending.
  - Prompts: `scripts/thumb-prompts.ts`. To add a thumb for a new app, generate an image and save it as `public/thumbs/<id>.jpg`; cards fall back to a gradient if the file is missing.

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

## Public multi-user version: BUILT as v2.0 on branch `multi-user` (2026-09-25); see the v2.0 section below. Original plan:
Build once the owner has the Kie affiliate link (`kie.ai?ref=CODE`):
- **Google sign-in** replaces the shared password; per-user History / Spending / profile in Blob (`users/<googleId>/…`).
- **Bring your own Kie key, stored only in the user's browser** (localStorage), sent per request, never saved server-side. The owner handles no keys.
- **Onboarding wall**: step 1 "Create Kie account" (affiliate link) → step 2 "Paste API key". Every kie.ai link in the app carries the ref code.
- **Google Drive export** via the user's own Google login (`drive.file` scope) instead of the owner's Make.com scenario.
- Public GitHub repo + "Deploy to Vercel" button (README uses the affiliate link) so anyone can run their own copy.
- Auto-delete uploads after 7 days (Blob cost); build on a preview deploy before switching production.

## Price audit (2026-09-25) and version
- **Version** shown top-right of the account dropdown: `VERSION` in `components/AccountMenu.tsx` (+ `package.json`). **Bump on every change pushed** (owner rule, 2026-09-25): 1.2 = price audit + upload types, 1.3 = Genjutsu aspect fix, 1.4 = Join/Download cache fix, 1.5 = /api/file redirects to a signed Blob URL, 1.6 = split parts carry the last frame over, 1.7 = converter pauses with playback (no overlong parts), 1.8 = split into equal halves, 1.9 = converter no longer hangs at 99%, 2.0 = public multi-user version (Google sign-in, bring-your-own Kie key), 2.1 = Google client ID configured, 2.2 = LIVE + Drive "Open in Drive"/folder link/folder picker, 2.3 = Picker API key set (Choose folder… enabled), 2.4 = production redirects other *.vercel.app names to higgsview.vercel.app, 2.5 = Help & feedback email, no username, one key button, 2.6 = balance refreshes after connecting a key, 2.7 = Help opens a Gmail draft, 2.8 = public /privacy page, 2.9 = .vercelignore for local env files, 2.10 = checked auto-deploy after a promote, 2.11 = balance refreshes when a job starts/finishes, 2.12 = Regenerate shows its cost and always confirms.
- **Kie's full price list is public**: `POST https://api.kie.ai/client/v1/model-pricing/page` with `{"pageNum":1,"pageSize":100}` (max 100 per page, ~500 rows; `usdPrice` per `creditUnit`). Use it to re-check prices.
- All model prices in `lib/models.ts` now come from that list. `usdFlat` can be per resolution, `usdPerSecAudio` covers Kling 3's sound surcharge, and `estimateUsd(m, secs, res, audio)` takes the audio flag.
- Big fixes: Seedance 2.0 defaulted to 1080p at $0.51/s while showing $0.09/s; now 720p ($0.205/s) with correct per-resolution prices. Seedance 2.5 / Kling 3 / Kling Turbo / Wan 2.7 / Wan Edit default to 720p; Seedance Fast/Mini to 480p; Nano Banana 2, GPT Image 2, FLUX, Seedream to 1K/basic; Topaz to 2×; Character Swap / Animate Move to 580p ($0.0475/s vs $0.0625). Gemini Omni costs the same at 720p and 1080p, so it defaults to 1080p.
- Kling Motion Control is billed per second of the reference video (durations `[-1]`). Topaz video, lip-sync and Kling Avatar are per second ($0.04–0.07/s), not flat.
- App image steps (`nano()`, face swap) use 1K. Video tiers unchanged: Draft = Grok 480p (~$0.07), Standard = Kling 3 720p no sound ($0.35/5s), Premium = Kling 3 1080p + sound ($0.68/5s).
- Veo 3.1: Kie doesn't say which tier (Lite $0.15 / Fast $0.30 / Quality $1.25 per video) model `veo-3-1` bills; estimate assumes Fast. Check the real cost after the first run.
- Cheaper options not yet added: Kling 2.6 Motion Control ($0.055/s vs $0.10), Nano Banana 2 Lite ($0.02), Seedance 1.5 Pro ($0.0175/s at 720p no audio), PixVerse v6 ($0.036/s 720p).
- **Upload file types** (2026-09-25): `Upload` in `components/Controls.tsx` only takes images JPG/PNG/WebP/GIF/AVIF/BMP (non-JPG/PNG converted to JPG), videos MP4/MOV/WebM, audio MP3/WAV/M4A/AAC. Checked on pick and drag-drop (the file picker's filter alone can be bypassed); `/api/upload` also rejects anything but JPG/PNG, MP4/MOV/WebM and those audio types.
- **Genjutsu shape fix (v1.3)**: Kling Omni with reference photos used the first aspect chip (9:16), so a 16:9 two-person video came back as a 720×1280 portrait crop with one person cut out (and each 15s part cropped differently). Uploading a video now sets the output aspect to the closest match of the video's shape (`closestAspect` in Workspace; `Upload` passes `ratio` as the 4th onChange arg). Split parts show a lime "⧉ Join both parts into one video" button.
- Kling Omni is limited to 15s per job by Kie; 30s = 2 parts + Join. Wan Character Swap does 30s in one go but only swaps ONE person (one image) and can drift back to the original face mid-video.
- **Join / Download fix (v1.4)**: History cards load Kie videos without CORS; Chrome then reuses that cached copy (no Access-Control header) for the Join recorder and the Download fetch, which failed ("Format error" / "Failed to fetch"). Join now fetches each clip with `cache: "no-store"` into a blob URL first; Download uses `cache: "no-store"`.
- **`/api/file` (v1.5)** now 302-redirects to a 12h signed Blob URL instead of streaming. Streaming had no Range support, so joined videos showed a wrong length (3.3s for a 30.6s file) and couldn't seek. Signed Blob URLs support Range + CORS.
- **Split parts carry the likeness over (v1.6)**: a split video (Kling Omni, >15s) now starts only part 1, stored with `next: {video, label}`. When part 1 succeeds, `Feed` (any open page showing History) grabs its last frame (`lastFrame()` in Controls), uploads it and POSTs `/api/generate {continueFrom, frame}`. The server claims `next` once (ETag-guarded mutate, so two tabs can't double-start) and runs part 2 with the frame appended as an extra reference image (if under the model's 4-ref limit) plus a prompt line: "Image N is a frame from the previous part … every swapped person must look exactly like they do in image N". Parts now run one after the other (~2× the wait); Higgsview must be open for part 2 to start.
- **Converter length fix (v1.7)**: `recordClips` records on the wall clock, so when playback stalled (buffering, or Chrome pausing video in a background tab) the frozen frames made a 14.5s slice come out 17.2s and Kling Omni rejected it ("between 3 and 15.5 seconds"). The recorder now pauses on the video's `waiting`/`pause` and resumes on `playing` (and restarts playback when the tab is visible again). `resizeVideo` then measures the real length (`blobSeconds`) and throws a clear "keep this tab in front, try again" error if it's still over the slice + 0.45s.
- "Reuse" on a result card loads its prompt and model back into the panel (no generation); it now has a tooltip saying so.
- **Equal halves (v1.8)**: a split video is cut into two equal parts (17s → 2 × 8.5s) instead of 14.5s + a tiny remainder under Kling's 3s minimum.
- **v1.9**: a clip reaching its end fires "pause" (which pauses the recorder), so the end-of-clip check now runs even while the recorder is paused; before, preparing could hang at 99%.

## v2.0: public multi-user version (branch `multi-user`, 2026-09-25)
Kie affiliate link: `https://kie.ai?ref=1a59fa7ee273317c3dcdbc4f9ca41b62` (`lib/kieLinks.ts` → `kieUrl(path)`; every kie.ai link uses it).
- **Sign-in = Google** (`app/login`, `lib/google.ts` loads Google Identity Services). `/api/login` verifies the ID token with Google's tokeninfo (audience must equal `NEXT_PUBLIC_GOOGLE_CLIENT_ID`) and sets `hv_session` = base64url(user).HMAC-SHA256 with `SESSION_SECRET` (`lib/auth.ts`). `proxy.ts` checks it. Password login, `auth.json` and `/api/account/password` are gone.
- **Per-user data**: `lib/store.ts` `readHistory`/`mutate` and the profile use `users/<google sub>/…` via `userDir()` (reads the cookie from `next/headers`), so the call sites didn't change. `upcoming.json` stays shared. The owner's first sign-in (`OWNER_EMAIL`) copies the old root `history.json`/`profile.json` into their user folder.
- **Kie key per user, never stored server-side**: `components/KeyGate.tsx` keeps it in `localStorage hv_kie_key` and patches `window.fetch` to add header `x-kie-key` on `/api/*` calls (not `/api/file`, which redirects to Blob). `lib/kie.ts` `apiKey()` uses that header; only `OWNER_EMAIL` may fall back to env `KIE_API_KEY`. KeyGate shows the 3-step "Connect your Kie.ai account" wall (affiliate sign-up → API Keys → paste; validated via `/api/credits`) until a key works. Profile page: change/remove key.
- **Drive export in the browser** with the user's own Google account: `saveToDrive()` in `lib/google.ts` (token client, scope `drive.file`, finds/creates "Higgsview" folder, resumable upload). `/api/export` now only stores the link. Make.com is no longer used (env `MAKE_EXPORT_WEBHOOK` can be deleted; the webhook URL is in old git history, so disable that Make scenario before making the repo public).
- **Cleanup cron**: `vercel.json` runs `/api/cleanup` daily (07:00 UTC); it deletes `uploads/` files older than 7 days except joined videos. Needs `CRON_SECRET`.
- **Vercel env** (set 2026-09-25 for Production + Preview): `SESSION_SECRET`, `CRON_SECRET`, `OWNER_EMAIL=zerotouchaiautomation@gmail.com`. `NEXT_PUBLIC_GOOGLE_CLIENT_ID` = `617890165863-55ardljorund7isft715k19nlniku15s.apps.googleusercontent.com` (Google Cloud project "Higgsview", owner account; set 2026-09-25 for all environments; origins: higgsview.vercel.app, the multi-user preview, localhost:3000). `APP_PASSWORD` can be deleted after the switch.
- README has a **Deploy with Vercel** button (needs the repo to be public).
- Tested locally with a minted test session: login redirect, KeyGate wall, bad key rejected, header reaches Kie, per-user empty history, cron 401, profile from session. **Not tested yet**: real Google sign-in, owner data migration, Drive export (all need the OAuth client ID).
- ponytail: `/api/file` lets any signed-in user open any `uploads/` path they know (names are timestamp + filename); scope uploads per user if that matters.
- **v2.2 (went live 2026-09-25, `multi-user` merged into `main`)**: owner tested Google sign-in, history migration and Drive export on the preview. Drive card now shows "↗ Open in Drive" (the file) + 📁 (the folder it's in; `driveFolder` on the item). Profile → "Google Drive folder": default My Drive › Higgsview, or **Choose folder…** via Google Picker (`pickFolder()` in `lib/google.ts`, remembered per browser in `hv_drive_folder`). The picker button only appears when `NEXT_PUBLIC_GOOGLE_API_KEY` is set (an API key in the same Google Cloud project with the **Google Picker API** enabled; appId = project number from the client ID).
- New-user test on the preview was blocked by Vercel Deployment Protection ("Social Account is not yet connected to any Vercel user"); production has no protection.
- **v2.3**: `NEXT_PUBLIC_GOOGLE_API_KEY` set in Vercel (all environments, 2026-09-25): an API key in the "Higgsview" Google Cloud project, restricted by the owner to the Picker API and the site's URLs. Profile → "Choose folder…" is now visible.
- **v2.4**: Google sign-in failed with `origin_mismatch` when the site was opened on another production name (a deployment URL or the git-main alias, e.g. from the Vercel dashboard's Visit button). `proxy.ts` now 308-redirects any production `*.vercel.app` host to `higgsview.vercel.app` (previews keep their URL). Registered origins: higgsview.vercel.app, the multi-user preview, localhost:3000.
- **v2.5**: Help & feedback (account menu + footer) opens an email to **info@zerotouchai.com** with the user's account email and version prefilled (`helpMail()` in AccountMenu). Profile has only first/last name (they set the initials; email comes from Google); username removed. Removed the duplicate "Kie.ai API key" menu row (Profile has the key section; "API Keys" goes to kie.ai). Owner tested the new-user flow on production 2026-09-25: Google sign-in → Connect Kie (new Kie accounts start with ~80 free credits) → generated a Nano Banana 2 image for $0.04 (8 credits); History, Spending and the Kie links worked. The "flex-shrink / gap" issue popup on Cinema Studio comes from the **Vercel Toolbar** (shown only to Vercel team members), not the app.
- **v2.6**: connecting/changing/removing a Kie key fires the `hv_key` event (`setKey` in KeyGate); Nav reloads the balance, so a new user sees their free credits right away. Drive/Picker "has not completed the Google verification process" = the OAuth app is still in Testing: Google Auth Platform → Audience → Publish app.
- **v2.7**: Help & feedback opens a Gmail compose tab (`mail.google.com/mail/?view=cm&to=info@zerotouchai.com&su=…&body=…`) instead of `mailto:`, since everyone signs in with Google.
- **v2.8**: public Privacy Policy at `/privacy` (no sign-in; allowed in `proxy.ts`, no Nav/KeyGate there), linked from the login page and footer. Needed by Google to publish the OAuth app: Branding → homepage `https://higgsview.vercel.app`, privacy policy `https://higgsview.vercel.app/privacy`, authorized domain `higgsview.vercel.app`.
- **v2.9**: the v2.8 GitHub push did not trigger a Vercel build (webhook hiccup), so v2.8 was deployed with `vercel --prod` from the local folder. Added `.vercelignore` (`.env*`) so a CLI deploy never uploads local env files (checked: production rejected a cookie signed with the local test secret).
- **v2.10**: the delayed v2.8 webhook build finished after v2.9 and took over production (an older version live). Fixed with `vercel promote <v2.9 deployment>`. If production ever shows an older version: `vercel ls` → check each build log's "Cloning … Commit:" → `vercel promote` the newest. The owner's version badge in the account menu shows which one is live.
- **v2.11**: the Kie balance pill reloads whenever a job starts or finishes (Nav watches the shared History cache: item count + pending count), plus once more 5s later because Kie can post the charge a moment after the status changes. The Spending bubble now comes from the same cache (no extra /api/history call). History polling is one shared 5s timer however many components use `useHistory`.
- **v2.12**: ↻ Regenerate (orange-gold, `GOLD` in Feed) shows its cost on the button and always asks "It will cost about $X" before starting (skipped only when free). Cost = last real charge (`item.usd`), else the estimate (`appCost` for apps, `estimateUsd` from saved params). Before, it only asked above $2. "Reuse" only appears on the Image/Video/Audio pages, not on History (by design).
