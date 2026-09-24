// Model catalog. Every model in the UI lives here — add a model = add one entry.
// `build` turns the UI's generic params into the exact Kie.ai request body.
// Kie docs: https://docs.kie.ai (all "market" models use POST /api/v1/jobs/createTask)

export type Mode = "create" | "edit" | "motion" | "image";
export type Tier = "free" | "budget" | "standard" | "premium";

export type Params = {
  prompt: string;
  duration: number;
  aspect: string;
  resolution: string;
  audio: boolean;
  start?: string; // start frame / reference image URL
  end?: string; // end frame URL
  video?: string; // input video URL (edit / motion control)
};

export type Model = {
  id: string;
  name: string;
  mode: Mode;
  tier: Tier;
  badge?: "TOP" | "NEW" | "FREE" | "CHEAP";
  desc: string;
  durations: number[];
  aspects: string[];
  resolutions: string[];
  audio?: boolean; // supports native audio toggle
  frames: "none" | "start" | "start-end"; // image inputs supported
  needs?: ("start" | "video")[]; // required inputs
  // Estimate shown on the Generate button. Budget models measured 2026-09-24 at their cheapest settings
  // (480p/720p, no audio); higher quality or audio costs more. Real cost comes back from Kie per item.
  usdPerSec?: number;
  usdFlat?: number;
  build: (p: Params) => { model: string; input: Record<string, unknown> } | { url: string };
};

const seedance = (model: string, extra: Partial<Model>): Model => ({
  id: model.split("/")[1],
  name: "",
  mode: "create",
  tier: "standard",
  desc: "",
  durations: [5, 8, 10, 15],
  aspects: ["16:9", "9:16", "1:1", "4:3", "3:4", "21:9"],
  resolutions: ["480p", "720p"],
  audio: true,
  frames: "start-end",
  build: (p) => ({
    model,
    input: {
      prompt: p.prompt,
      first_frame_url: p.start,
      last_frame_url: p.end,
      generate_audio: p.audio,
      resolution: p.resolution,
      aspect_ratio: p.aspect,
      duration: p.duration,
    },
  }),
  ...extra,
});

export const MODELS: Model[] = [
  // ---------- VIDEO: Create ----------
  seedance("bytedance/seedance-2-5", {
    name: "Seedance 2.5", badge: "TOP", tier: "premium", usdPerSec: 0.12,
    resolutions: ["480p", "720p", "1080p"],
    desc: "Most advanced video model. Native audio, lip-sync, SFX in one pass.",
  }),
  seedance("bytedance/seedance-2", {
    name: "Seedance 2.0", tier: "standard", usdPerSec: 0.09,
    resolutions: ["480p", "720p", "1080p"],
    desc: "First native audio-video model: synced lip-sync, SFX, and music.",
  }),
  seedance("bytedance/seedance-2-fast", {
    name: "Seedance 2.0 Fast", tier: "budget", usdPerSec: 0.06,
    desc: "Faster, cheaper Seedance. Great for drafts.",
  }),
  seedance("bytedance/seedance-2-mini", {
    name: "Seedance 2.0 Mini", badge: "CHEAP", tier: "budget", usdPerSec: 0.02,
    desc: "Cheapest video model: about $0.10 for a 5s 480p clip. Best for drafts.",
  }),
  {
    id: "kling-3", name: "Kling 3.0", badge: "TOP", mode: "create", tier: "standard", usdPerSec: 0.09,
    desc: "The new standard in photorealism with advanced motion complexity.",
    durations: [5, 10, 15], aspects: ["16:9", "9:16", "1:1"], resolutions: ["std", "pro"],
    audio: true, frames: "start-end",
    build: (p) => ({
      model: "kling-3.0/video",
      input: {
        prompt: p.prompt,
        image_urls: [p.start, p.end].filter(Boolean),
        sound: p.audio,
        duration: String(p.duration),
        aspect_ratio: p.aspect,
        mode: p.resolution,
      },
    }),
  },
  {
    id: "kling-3-turbo", name: "Kling 3.0 Turbo", mode: "create", tier: "standard", usdPerSec: 0.09,
    desc: "Fast, stable Kling for quick iterations.",
    durations: [5, 10], aspects: ["16:9", "9:16", "1:1"], resolutions: ["720p", "1080p"],
    frames: "start",
    build: (p) =>
      p.start
        ? { model: "kling/v3-turbo-image-to-video", input: { prompt: p.prompt, image_urls: [p.start], duration: String(p.duration), resolution: p.resolution } }
        : { model: "kling/v3-turbo-text-to-video", input: { prompt: p.prompt, duration: String(p.duration), aspect_ratio: p.aspect, resolution: p.resolution } },
  },
  {
    id: "veo-3-1", name: "Veo 3.1", mode: "create", tier: "premium", usdPerSec: 0.15,
    desc: "Google's cinematic model with native audio and 1080p output.",
    durations: [4, 6, 8], aspects: ["16:9", "9:16"], resolutions: ["720p", "1080p"],
    frames: "start-end",
    build: (p) => ({
      model: "veo-3-1",
      input: {
        prompt: p.prompt,
        image_urls: [p.start, p.end].filter(Boolean),
        aspect_ratio: p.aspect,
        resolution: p.resolution,
        duration: p.duration,
      },
    }),
  },
  {
    id: "wan-2-7", name: "Wan 2.7", mode: "create", tier: "budget", usdPerSec: 0.08,
    desc: "The perfect balance of generation speed and visual richness.",
    durations: [5, 10, 15], aspects: ["16:9", "9:16", "1:1", "4:3", "3:4"], resolutions: ["720p", "1080p"],
    frames: "start-end",
    build: (p) =>
      p.start
        ? { model: "wan/2-7-image-to-video", input: { prompt: p.prompt, first_frame_url: p.start, last_frame_url: p.end, resolution: p.resolution, duration: p.duration } }
        : { model: "wan/2-7-text-to-video", input: { prompt: p.prompt, ratio: p.aspect, resolution: p.resolution, duration: p.duration } },
  },
  {
    id: "grok-imagine", name: "Grok Imagine", badge: "CHEAP", mode: "create", tier: "budget", usdFlat: 0.07,
    desc: "Cheapest option. Ideal for drafting shots before a premium render.",
    durations: [6, 10], aspects: ["16:9", "9:16", "1:1", "2:3", "3:2"], resolutions: ["480p", "720p"],
    frames: "start",
    build: (p) => ({
      model: p.start ? "grok-imagine/image-to-video" : "grok-imagine/text-to-video",
      input: {
        prompt: p.prompt,
        ...(p.start ? { image_urls: [p.start] } : { aspect_ratio: p.aspect }),
        mode: "normal",
        duration: String(p.duration),
        resolution: p.resolution,
      },
    }),
  },
  {
    id: "hailuo-2-3", name: "Minimax Hailuo 2.3", mode: "create", tier: "budget", usdFlat: 0.15,
    desc: "Image-to-video with strong physics. Requires a start frame.",
    durations: [6, 10], aspects: ["auto"], resolutions: ["768P"],
    frames: "start", needs: ["start"],
    build: (p) => ({
      model: "hailuo/2-3-image-to-video-standard",
      input: { prompt: p.prompt, image_url: p.start, duration: String(p.duration), resolution: p.resolution },
    }),
  },

  // ---------- VIDEO: Edit ----------
  {
    id: "wan-2-7-edit", name: "Wan 2.7 Edit", badge: "NEW", mode: "edit", tier: "budget", usdPerSec: 0.08,
    desc: "Upload footage and describe the change — restyle, swap objects, relight.",
    durations: [5], aspects: ["16:9", "9:16", "1:1", "4:3", "3:4"], resolutions: ["720p", "1080p"],
    frames: "start", needs: ["video"],
    build: (p) => ({
      model: "wan/2-7-videoedit",
      input: { prompt: p.prompt, video_url: p.video, reference_image: p.start, resolution: p.resolution, aspect_ratio: p.aspect },
    }),
  },

  // ---------- VIDEO: Motion Control ----------
  {
    id: "kling-3-motion", name: "Kling 3.0 Motion Control", badge: "TOP", mode: "motion", tier: "standard", usdPerSec: 0.09,
    desc: "Upload a reference video to drive the exact pace and gestures of your character image.",
    durations: [5], aspects: ["auto"], resolutions: ["std", "pro"],
    frames: "start", needs: ["start", "video"],
    build: (p) => ({
      model: "kling-3.0/motion-control",
      input: { prompt: p.prompt, input_urls: [p.start], video_urls: [p.video], mode: p.resolution },
    }),
  },

  // ---------- IMAGE ----------
  {
    id: "nano-banana-2", name: "Nano Banana 2", badge: "TOP", mode: "image", tier: "standard", usdFlat: 0.04,
    desc: "Google's image model. Best for product shots and edits with references.",
    durations: [], aspects: ["1:1", "16:9", "9:16", "4:3", "3:4", "4:5", "21:9"], resolutions: ["1K", "2K", "4K"],
    frames: "start",
    build: (p) => ({
      model: "nano-banana-2",
      input: { prompt: p.prompt, image_input: p.start ? [p.start] : [], aspect_ratio: p.aspect, resolution: p.resolution, output_format: "png" },
    }),
  },
  {
    id: "pollinations-flux", name: "Flux (Free)", badge: "FREE", mode: "image", tier: "free", usdFlat: 0,
    desc: "Free, no key needed (pollinations.ai). Good for concept drafts.",
    durations: [], aspects: ["1:1", "16:9", "9:16"], resolutions: ["1K"],
    frames: "none",
    build: (p) => {
      const [w, h] = { "1:1": [1024, 1024], "16:9": [1344, 768], "9:16": [768, 1344] }[p.aspect] ?? [1024, 1024];
      return { url: `https://image.pollinations.ai/prompt/${encodeURIComponent(p.prompt)}?width=${w}&height=${h}&nologo=true&seed=${Date.now() % 1e6}` };
    },
  },
];

export const byId = (id: string) => MODELS.find((m) => m.id === id);

export function estimateUsd(m: Model, duration: number) {
  return m.usdFlat ?? (m.usdPerSec ?? 0) * duration;
}

// Higgsfield-style presets: camera moves / looks appended to the prompt.
export const PRESETS: { name: string; prompt: string }[] = [
  { name: "General", prompt: "" },
  { name: "Dolly In", prompt: "Slow cinematic dolly-in toward the subject." },
  { name: "Dolly Out", prompt: "Smooth dolly-out revealing the environment." },
  { name: "Crash Zoom", prompt: "Sudden fast crash zoom onto the subject." },
  { name: "Orbit 360", prompt: "Camera orbits 360 degrees around the subject." },
  { name: "Crane Up", prompt: "Crane shot rising up and over the scene." },
  { name: "FPV Drone", prompt: "Fast FPV drone flythrough, dynamic banking turns." },
  { name: "Handheld", prompt: "Handheld documentary camera, natural shake." },
  { name: "Bullet Time", prompt: "Bullet-time freeze with the camera sweeping around the frozen moment." },
  { name: "Snorricam", prompt: "Snorricam rig locked to the subject while the world moves around them." },
  { name: "Product Hero", prompt: "Premium commercial product hero shot, rotating turntable, studio lighting, glossy reflections." },
  { name: "Unboxing", prompt: "Top-down commercial unboxing, hands revealing the product, soft daylight." },
  { name: "Luxury Ad", prompt: "Luxury commercial look, slow motion, shallow depth of field, golden rim light." },
  { name: "Food Macro", prompt: "Macro food commercial, slow-motion splashes, steam, appetizing lighting." },
  { name: "Car Commercial", prompt: "Car commercial, low tracking shot alongside the vehicle, motion blur, dramatic sky." },
  { name: "UGC Selfie", prompt: "Vertical UGC selfie video, person talking to camera in a natural home setting." },
];
