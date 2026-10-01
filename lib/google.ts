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

// Where Drive exports go: a folder the user picked (remembered in this browser), else My Drive/Higgsview.
export type DriveFolder = { id: string; name: string };
const FOLDER = "hv_drive_folder";
export const savedFolder = (): DriveFolder | undefined => { try { return JSON.parse(localStorage.getItem(FOLDER) ?? "null") ?? undefined; } catch { return undefined; } };
export const setSavedFolder = (f?: DriveFolder) => { try { if (f) localStorage.setItem(FOLDER, JSON.stringify(f)); else localStorage.removeItem(FOLDER); } catch {} };
export const folderLink = (id: string) => `https://drive.google.com/drive/folders/${id}`;
// The default My Drive/Higgsview folder's id, remembered after the first save so Profile can link to it.
const DEFAULT = "hv_drive_default";
const defaultFolderId = () => { try { return localStorage.getItem(DEFAULT) ?? undefined; } catch { return undefined; } };
export const driveFolderUrl = () => { const id = savedFolder()?.id ?? defaultFolderId(); return id ? folderLink(id) : "https://drive.google.com/drive/my-drive"; };

// Google Picker: lets the user choose any folder in their Drive (picking it also gives Higgsview access to
// save there under the drive.file scope). Needs NEXT_PUBLIC_GOOGLE_API_KEY (Picker API enabled on it).
export const canPickFolder = !!process.env.NEXT_PUBLIC_GOOGLE_API_KEY;
type Picker = { picker: Record<string, unknown> & {
  DocsView: new (id: unknown) => { setIncludeFolders(b: boolean): unknown; setSelectFolderEnabled(b: boolean): unknown; setMimeTypes(m: string): unknown };
  PickerBuilder: new () => Record<string, (...a: unknown[]) => unknown>;
  ViewId: { FOLDERS: unknown }; Action: { PICKED: string; CANCEL: string };
} };
let gapiLoading: Promise<Picker["picker"]> | undefined;
const loadPicker = () => (gapiLoading ??= new Promise((ok, fail) => {
  const s = Object.assign(document.createElement("script"), { src: "https://apis.google.com/js/api.js", async: true });
  s.onload = () => (window as unknown as { gapi: { load: (m: string, cb: () => void) => void } }).gapi.load("picker", () => ok((window.google as unknown as Picker).picker));
  s.onerror = () => { gapiLoading = undefined; fail(new Error("Couldn't reach Google")); };
  document.head.appendChild(s);
}));
export async function pickFolder(): Promise<DriveFolder | undefined> {
  const [token, picker] = await Promise.all([driveToken(), loadPicker()]);
  return new Promise((ok) => {
    const view = new picker.DocsView(picker.ViewId.FOLDERS);
    view.setIncludeFolders(true); view.setSelectFolderEnabled(true); view.setMimeTypes("application/vnd.google-apps.folder");
    const b = new picker.PickerBuilder();
    b.addView(view); b.setOAuthToken(token); b.setDeveloperKey(process.env.NEXT_PUBLIC_GOOGLE_API_KEY);
    b.setAppId(GOOGLE_CLIENT_ID.split("-")[0]); b.setTitle("Choose where Higgsview saves your files");
    b.setCallback((d: { action: string; docs?: { id: string; name: string }[] }) => {
      if (d.action === picker.Action.PICKED && d.docs?.[0]) ok({ id: d.docs[0].id, name: d.docs[0].name });
      else if (d.action === picker.Action.CANCEL) ok(undefined);
    });
    (b.build() as { setVisible(v: boolean): void }).setVisible(true);
  });
}

// Saves a result into the chosen folder (default My Drive/Higgsview); returns links to the file and its folder.
// A dropped connection shouldn't fail a 30 MB save: each step gets up to 3 tries, and the error says which step broke.
async function attempt<T>(what: string, fn: () => Promise<T>): Promise<T> {
  let last: unknown;
  for (let n = 0; n < 3; n++) {
    try { return await fn(); } catch (e) {
      last = e;
      if (e instanceof Stop) throw e; // a real answer (expired sign-in, missing folder): retrying won't help
      await new Promise((r) => setTimeout(r, 1500 * (n + 1)));
    }
  }
  throw new Error(`${what} (${last instanceof Error ? last.message : "network error"}). Check your connection and try again.`);
}
class Stop extends Error {}

export async function saveToDrive(file: string | Blob, name: string): Promise<{ link: string; folder: string; folderName: string }> {
  const auth = { Authorization: `Bearer ${await driveToken()}` };
  const api = "https://www.googleapis.com/drive/v3/files";
  // Google answers 401 when the hour-long Drive permission has lapsed: forget it so the next click asks again.
  const check = (r: Response) => { if (r.status === 401) { drive = undefined; throw new Stop("Google Drive access expired. Press the button again to reconnect."); } return r; };
  let target = savedFolder();
  if (!target) {
    const id = await attempt("Couldn't reach Google Drive", async () => {
      const q = encodeURIComponent("name='Higgsview' and mimeType='application/vnd.google-apps.folder' and trashed=false");
      const found: string | undefined = (await fetch(`${api}?q=${q}&fields=files(id)`, { headers: auth }).then(check).then((r) => r.json())).files?.[0]?.id;
      return found ?? (await fetch(`${api}?fields=id`, { method: "POST", headers: { ...auth, "Content-Type": "application/json" },
        body: JSON.stringify({ name: "Higgsview", mimeType: "application/vnd.google-apps.folder" }) }).then(check).then((r) => r.json())).id as string;
    });
    target = { id, name: "My Drive › Higgsview" };
    try { localStorage.setItem(DEFAULT, id); } catch {}
  }
  const folder = target;
  const blob = typeof file !== "string" ? file : await attempt("Couldn't download the file from Kie.ai", () =>
    fetch(file, { cache: "no-store" }).then((r) => { if (!r.ok) throw new Stop("The file is no longer available at Kie.ai."); return r.blob(); }));
  // Resumable upload: works for large videos (simple multipart uploads are limited to 5 MB). A failed try starts a new upload.
  const saved = await attempt("The upload to Google Drive was interrupted", async () => {
    const start = check(await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&fields=id,webViewLink", {
      method: "POST", headers: { ...auth, "Content-Type": "application/json", "X-Upload-Content-Type": blob.type || "application/octet-stream" },
      body: JSON.stringify({ name, parents: [folder.id] }),
    }));
    const session = start.headers.get("Location");
    if (!session) {
      if (savedFolder()) { setSavedFolder(undefined); throw new Stop("Couldn't save to your chosen folder (deleted?). Try again to use My Drive › Higgsview."); }
      throw new Stop(`Google Drive refused the upload (${start.status}).`);
    }
    const done = await fetch(session, { method: "PUT", body: blob }).then(check).then((r) => r.json());
    if (!done.webViewLink) throw new Stop(done.error?.message ?? "Google Drive didn't confirm the upload.");
    return done as { webViewLink: string };
  });
  return { link: saved.webViewLink, folder: folderLink(folder.id), folderName: folder.name };
}
