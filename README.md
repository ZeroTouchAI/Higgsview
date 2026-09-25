# Higgsview

A free, open clone of the [Higgsfield](https://higgsfield.ai) studio. Same dark UI, same workflow (preset card → references → prompt → model picker → duration / aspect / quality chips → Generate), wired straight to cheap model APIs instead of a subscription.

**Goal: spend as little as possible.** You only pay per generation, at raw API prices, and every model shows its estimated cost before you click Generate.

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2FZeroTouchAI%2FHiggsview&env=NEXT_PUBLIC_GOOGLE_CLIENT_ID,SESSION_SECRET&envDescription=Google%20OAuth%20client%20ID%20and%20a%20random%20session%20secret%20(see%20README)&stores=%5B%7B%22type%22%3A%22blob%22%7D%5D)

Free and open: use the hosted version, or deploy your own copy with the button above.

## How it works
- **Sign in with Google.** Each person gets their own private History and Spending.
- **Bring your own Kie.ai key.** All models run through [Kie.ai](https://kie.ai?ref=1a59fa7ee273317c3dcdbc4f9ca41b62) (one key, pay as you go). The key is stored **only in your browser** and sent with each request; Higgsview never saves it.
- **Google Drive export** saves results to *My Drive/Higgsview* in your own Drive (Higgsview can only see files it creates).

## Get a Kie.ai key
1. Sign up at **[kie.ai](https://kie.ai?ref=1a59fa7ee273317c3dcdbc4f9ca41b62)** (Google login works).
2. Add a little credit under **Billing** ($5 is plenty to try it; 1 credit = $0.005).
3. Copy your key from **[API Keys](https://kie.ai/api-key?ref=1a59fa7ee273317c3dcdbc4f9ca41b62)** and paste it into Higgsview when it asks.

## Deploy your own (free Vercel Hobby plan)
1. Click **Deploy with Vercel** above. It copies the repo and creates a Blob store.
2. Create a Google OAuth client: [console.cloud.google.com](https://console.cloud.google.com) → APIs & Services →
   - **OAuth consent screen**: External, app name, your email. Add the scope `.../auth/drive.file`. Publish the app.
   - **Library**: enable the **Google Drive API**.
   - **Credentials → Create credentials → OAuth client ID → Web application**. Authorized JavaScript origins: your
     Vercel URL (e.g. `https://my-higgsview.vercel.app`) and `http://localhost:3000`. No redirect URIs needed.
3. In Vercel → Settings → Environment Variables set `NEXT_PUBLIC_GOOGLE_CLIENT_ID` (the client ID) and `SESSION_SECRET`
   (any long random string), then redeploy.

## Run it locally
```bash
npm install
cp .env.example .env.local   # fill in the values
npm run dev                  # http://localhost:3000
```

## Commands
- `npm run dev`: local server
- `npm run check`: sanity check of the model catalog
- `npm run lint`, `npm run build`

See [HANDOFF.md](HANDOFF.md) for project state and next steps, and [docs/RESEARCH.md](docs/RESEARCH.md) for the Higgsfield feature map and model pricing.
