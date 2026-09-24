// Temporary public read URL for a private Blob file (e.g. so Make.com can download a joined video).
import { issueSignedToken, presignUrl } from "@vercel/blob";

export async function presignGet(pathname: string, hours = 2) {
  const validUntil = Date.now() + hours * 3600_000;
  const token = await issueSignedToken({ pathname, operations: ["get"], validUntil });
  return (await presignUrl(token, { access: "private", operation: "get", pathname, validUntil })).presignedUrl;
}

// Our own permanent links look like /api/file?p=<pathname>.
export const internalPath = (url: string) => (url.startsWith("/api/file?p=") ? decodeURIComponent(url.slice(12)) : undefined);
