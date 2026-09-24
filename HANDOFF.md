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
| `lib/history.ts` | Generation history in localStorage, plus polling of pending tasks every 5s |
| `app/api/generate` | Validate the request, build the model body, `createTask` → `{taskId}` (or `{url}` for free providers) |
| `app/api/task` | Poll `recordInfo` → `{state, url, usd}` |
| `app/api/upload` | Proxy a browser file to Kie temp storage and return a public URL |
| `app/api/credits` | Kie balance, shown in the nav pill |
| `app/api/login`, `app/login`, `proxy.ts` | Password gate (off when `APP_PASSWORD` is unset) |
| `components/Workspace.tsx` | Higgsfield-style left panel (tabs, preset card, uploads, prompt, audio, model picker, chips, Generate) |
| `components/Feed.tsx` | Results grid and the "How it works" empty state |
| `app/page.tsx` | Explore/landing (hero prompt bar and model cards) |
| `docs/RESEARCH.md` | Higgsfield UI/feature map, model ids and pricing |

## Status (updated 2026-09-24)
Done and verified locally:
- Explore, Video (Create / Edit / Motion Control tabs), Image, and History pages; model picker; presets modal; password gate
- The free image generation (pollinations) works end to end
- Type check, lint, and `npm run check` all pass

**Not yet verified:** real Kie calls. There's no `KIE_API_KEY` yet. The first run with a key may turn up field-name mismatches in `build()`; check the error the UI shows against docs.kie.ai for that model.

## Google Drive export (done 2026-09-24)
- Each finished card has an **Export to Drive** button. It calls `/api/export`, which posts `{url, name}` to Make.
- Make scenario **"Higgsview - Export to Google Drive"** (id 6385753, team 638412, org 3365202 on us2.make.com): Custom webhook (hook 2851774) → HTTP Download a file → Google Drive Upload (connection 4175462, zerotouchaiautomation@gmail.com) → webhook response `{link, id}`
- Target folder: My Drive/**Higgsview** (id `16NbyGkXZ7N019bh2eIDdPXVtFgJhkw2f`)
- Make Core plan: 100 MB file limit, about 3 operations per export
- The Drive link is saved on the history item (`driveLink`), and the card then shows "✓ In Drive"

## Deployment
- Vercel project `higgsview` (team zero-touch-ai) at https://higgsview.vercel.app, linked locally with `vercel link`
- Env vars set: `MAKE_EXPORT_WEBHOOK`. **Still missing: `KIE_API_KEY` and `APP_PASSWORD`** (owner adds these in the Vercel dashboard)

## Next steps (in order)
1. Owner adds `KIE_API_KEY`, then test one cheap model (Grok Imagine), then each model; fix any `build()` fields
2. Owner adds `APP_PASSWORD` in Vercel (the site is open until then)
3. Optional: an auto-export to Drive toggle, so every result is saved without clicking
4. Extend Video (Grok/Kling extend endpoints), audio references (Seedance `reference_audio_urls`), Kling multi-shot
5. Studios: Cinema Studio (camera/lens/focal-length → prompt), Marketing Studio / UGC Factory (commercial templates), Lipsync, Upscale
6. Optional free video: a ComfyUI + Wan 2.2 provider if the owner has a GPU

## Known limits
- Uploads go through a Vercel function (~4.5 MB body cap on Vercel). Bigger videos need a direct upload.
- History lives only in the browser (localStorage). It won't sync across devices.
- Cost estimates in `models.ts` are approximate. The real cost is recorded per item after completion.
