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

## Status (2026-09-23)
Done and verified locally:
- Explore, Video (Create / Edit / Motion Control tabs), Image, and History pages; model picker; presets modal; password gate
- The free image generation (pollinations) works end to end
- Type check, lint, and `npm run check` all pass

**Not yet verified:** real Kie calls. There's no `KIE_API_KEY` yet. The first run with a key may turn up field-name mismatches in `build()`; check the error the UI shows against docs.kie.ai for that model.

## Next steps (in order)
1. Owner adds `KIE_API_KEY`, then test one cheap model (Grok Imagine), then each model; fix any `build()` fields
2. Deploy to Vercel with `KIE_API_KEY` and `APP_PASSWORD`
3. Persistent storage: Kie URLs expire. Options are Google Drive upload, Vercel Blob, or a Make.com scenario that copies results to Drive
4. Extend Video (Grok/Kling extend endpoints), audio references (Seedance `reference_audio_urls`), Kling multi-shot
5. Studios: Cinema Studio (camera/lens/focal-length → prompt), Marketing Studio / UGC Factory (commercial templates), Lipsync, Upscale
6. Optional free video: a ComfyUI + Wan 2.2 provider if the owner has a GPU

## Known limits
- Uploads go through a Vercel function (~4.5 MB body cap on Vercel). Bigger videos need a direct upload.
- History lives only in the browser (localStorage). It won't sync across devices.
- Cost estimates in `models.ts` are approximate. The real cost is recorded per item after completion.
