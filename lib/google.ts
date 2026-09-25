// Google Identity Services (sign-in button + Drive access tokens), loaded once on demand in the browser.
export const GOOGLE_CLIENT_ID = process.env.NEXT_PUBLIC_GOOGLE_CLIENT_ID ?? "";

type TokenResponse = { access_token?: string; expires_in?: number; error?: string };
type Google = {
  accounts: {
    id: {
      initialize: (o: { client_id: string; callback: (r: { credential: string }) => void }) => void;
      renderButton: (el: HTMLElement, o: Record<string, string | number>) => void;
    };
    oauth2: {
      initTokenClient: (o: { client_id: string; scope: string; callback: (r: TokenResponse) => void; error_callback?: (e: { message?: string }) => void }) => { requestAccessToken: (o?: { prompt?: string }) => void };
    };
  };
};
declare global { interface Window { google?: Google } }

let loading: Promise<Google> | undefined;
export const loadGoogle = () => (loading ??= new Promise<Google>((ok, fail) => {
  const s = Object.assign(document.createElement("script"), { src: "https://accounts.google.com/gsi/client", async: true });
  s.onload = () => ok(window.google!);
  s.onerror = () => { loading = undefined; fail(new Error("Couldn't reach Google")); };
  document.head.appendChild(s);
}));

// Access token for the user's own Google Drive, limited to files Higgsview creates (drive.file). Cached ~1h.
let drive: { token: string; until: number } | undefined;
export async function driveToken(): Promise<string> {
  if (drive && Date.now() < drive.until) return drive.token;
  const g = await loadGoogle();
  return new Promise((ok, fail) => {
    g.accounts.oauth2.initTokenClient({
      client_id: GOOGLE_CLIENT_ID, scope: "https://www.googleapis.com/auth/drive.file",
      callback: (r) => {
        if (!r.access_token) return fail(new Error(r.error ?? "Google Drive access was not granted"));
        drive = { token: r.access_token, until: Date.now() + ((r.expires_in ?? 3600) - 60) * 1000 };
        ok(r.access_token);
      },
      error_callback: (e) => fail(new Error(e.message ?? "Google Drive access was cancelled")),
    }).requestAccessToken({ prompt: "" });
  });
}

// Saves a result into the user's My Drive/Higgsview folder; returns the Drive link.
export async function saveToDrive(url: string, name: string): Promise<string> {
  const auth = { Authorization: `Bearer ${await driveToken()}` };
  const api = "https://www.googleapis.com/drive/v3/files";
  const q = encodeURIComponent("name='Higgsview' and mimeType='application/vnd.google-apps.folder' and trashed=false");
  let folder: string | undefined = (await fetch(`${api}?q=${q}&fields=files(id)`, { headers: auth }).then((r) => r.json())).files?.[0]?.id;
  folder ??= (await fetch(`${api}?fields=id`, { method: "POST", headers: { ...auth, "Content-Type": "application/json" },
    body: JSON.stringify({ name: "Higgsview", mimeType: "application/vnd.google-apps.folder" }) }).then((r) => r.json())).id;
  const blob = await fetch(url, { cache: "no-store" }).then((r) => { if (!r.ok) throw new Error("Couldn't load the file"); return r.blob(); });
  // Resumable upload: works for large videos (simple multipart uploads are limited to 5 MB).
  const start = await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&fields=id,webViewLink", {
    method: "POST", headers: { ...auth, "Content-Type": "application/json", "X-Upload-Content-Type": blob.type || "application/octet-stream" },
    body: JSON.stringify({ name, parents: folder ? [folder] : undefined }),
  });
  const session = start.headers.get("Location");
  if (!session) throw new Error(`Drive refused the upload (${start.status})`);
  const file = await fetch(session, { method: "PUT", body: blob }).then((r) => r.json());
  if (!file.webViewLink) throw new Error(file.error?.message ?? "Drive upload failed");
  return file.webViewLink;
}
