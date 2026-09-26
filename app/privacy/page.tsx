import type { Metadata } from "next";

export const metadata: Metadata = { title: "Privacy Policy · Higgsview" };

// Public page (no sign-in, see proxy.ts): required by Google for the OAuth consent screen.
export default function Privacy() {
  const h = "mt-6 text-lg font-black uppercase";
  return (
    <article className="mx-auto w-full max-w-2xl p-6 text-sm leading-relaxed text-fg/85">
      <h1 className="text-3xl font-black uppercase">Privacy Policy</h1>
      <p className="text-muted">Higgsview, operated by ZeroTouchAI · Last updated September 25, 2026</p>

      <p className="mt-4">Higgsview (higgsview.vercel.app) is a free AI video and image studio. This page explains what we store and why.</p>

      <h2 className={h}>What we collect</h2>
      <ul className="mt-2 list-disc space-y-1 pl-5">
        <li><b>Your Google account basics</b> when you sign in with Google: your name, email address and profile picture. We use them only to identify your account and show your initials.</li>
        <li><b>Your Higgsview history</b>: the prompts you write, the settings you choose, links to the results and their cost, so you can see them on any device.</li>
        <li><b>Files you upload</b> (images, videos, audio) so the AI models can use them. Uploaded files are deleted automatically after 7 days. Videos you join in Higgsview are kept until you ask us to delete them.</li>
      </ul>

      <h2 className={h}>Your Kie.ai API key</h2>
      <p className="mt-2">Your Kie.ai key is stored <b>only in your own browser</b>. It is sent with each request to run the AI model you chose and is never saved on our servers. You can remove it anytime from your Profile.</p>

      <h2 className={h}>Google Drive</h2>
      <p className="mt-2">If you press &quot;Google Drive&quot;, Higgsview asks for permission to create files in your Drive (<code>drive.file</code>). It can only see and manage the files it creates or the folder you pick. It cannot read the rest of your Drive. The upload happens directly from your browser to Google, and the access is not stored on our servers.</p>

      <h2 className={h}>Who else processes your data</h2>
      <ul className="mt-2 list-disc space-y-1 pl-5">
        <li><b>Kie.ai</b> runs the AI models on your own Kie.ai account and receives your prompts and uploaded files for that purpose.</li>
        <li><b>Vercel</b> hosts Higgsview and stores your history and uploads.</li>
        <li><b>Google</b> provides sign-in and, if you use it, Google Drive.</li>
      </ul>
      <p className="mt-2">We do not sell your data, show ads, or use your data to train AI models.</p>

      <h2 className={h}>Your choices</h2>
      <p className="mt-2">You can delete results from your History at any time. To delete your account and everything stored for it, email us and we will remove it. You can revoke Higgsview&apos;s Google access anytime at myaccount.google.com/permissions.</p>

      <h2 className={h}>Contact</h2>
      <p className="mt-2">Questions or requests: <a href="mailto:info@zerotouchai.com" className="text-lime underline">info@zerotouchai.com</a></p>
    </article>
  );
}
