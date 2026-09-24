# Higgsview

A personal clone of the [Higgsfield](https://higgsfield.ai) studio. Same dark UI, same workflow (preset card → references → prompt → model picker → duration / aspect / quality chips → Generate), wired straight to cheap model APIs instead of a subscription.

**Goal: spend as little as possible.** You only pay per generation, at raw API prices, and every model shows its estimated cost before you click Generate.

## Run it locally

```bash
npm install
cp .env.example .env.local   # then paste your KIE_API_KEY
npm run dev                  # http://localhost:3000
```

## API keys: step by step

### 1. Kie.ai (required, runs every paid model)
1. Go to https://kie.ai and sign up (Google login works).
2. Open **API Key** (https://kie.ai/api-key) and copy the key.
3. Top up a small amount under **Billing** ($5 is enough to test; 1 credit = $0.005).
4. Paste it into `.env.local` as `KIE_API_KEY=...`, then restart `npm run dev`.
5. The balance pill in the top-right corner should now show your dollar balance.

### 2. Free image model (no key)
"Flux (Free)" on the Image page uses pollinations.ai. It's free, needs no key, and takes about 20–40 seconds per image.

### 3. Google Drive export (already set up through Make.com)
The **Export to Drive** button saves a result to My Drive/Higgsview. This needs `MAKE_EXPORT_WEBHOOK` (the value is in `.env.example`). It's already set in Vercel.

## Deploy to Vercel (free Hobby plan)
1. https://vercel.com/new → Import `ZeroTouchAI/Higgsview`.
2. Add env vars `KIE_API_KEY` and `APP_PASSWORD` (the password is your login).
3. Deploy. Every push to `main` redeploys on its own.

## Commands
- `npm run dev`: local server
- `npm run check`: sanity check of the model catalog
- `npm run lint`, `npm run build`

See [HANDOFF.md](HANDOFF.md) for project state and next steps, and [docs/RESEARCH.md](docs/RESEARCH.md) for the Higgsfield feature map and model pricing.
