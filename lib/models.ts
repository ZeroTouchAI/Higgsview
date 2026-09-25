// Model catalog. Every model in the UI lives here — add a model = add one entry.
// `build` turns the UI's generic params into the exact Kie.ai request body.
// Kie docs: https://docs.kie.ai (all "market" models use POST /api/v1/jobs/createTask)

export type Mode = "create" | "edit" | "motion" | "swap" | "image" | "audio" | "extend" | "tool"; // "extend"/"tool" are hidden: used by result cards and Apps
export type Tier = "free" | "budget" | "standard" | "premium";

export type Params = {
  prompt: string;
  duration: number;
  aspect: string;
  resolution: string;
  audio: boolean;
  start?: string; // start frame / reference image URL
  end?: string; // end frame URL
  video?: string; // input video URL (edit / motion control / swap)
  taskId?: string; // Kie task being extended
  refs?: string[]; // extra reference images (Genjutsu)
  audioUrl?: string; // input audio (lip-sync)
  voice?: string; // ElevenLabs voice id
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
  needs?: ("start" | "end" | "video")[]; // required inputs
  labels?: Partial<Record<"start" | "end" | "video", string>>; // upload tile labels
  promptOptional?: boolean;
  output?: "image" | "audio" | "text"; // model whose result isn't a video
  refs?: number; // max extra reference images
  resLabel?: string; // label for the resolutions chip (e.g. "Voice", "Quality")
  defaultRes?: string; // default chip value (otherwise the last = best)
  videoMaxPixels?: number; // input video must be at most this many pixels (w×h)
  videoMaxSecs?: number; // longer input videos are trimmed in the browser before upload
  videoMinSide?: number; // smaller input videos are upscaled in the browser (and re-encoded at 30 fps)
  videoSplit?: boolean; // videos up to 2× videoMaxSecs are split into 2 parts, generated separately, then joined
  // Estimate shown on the Generate button. Budget models measured 2026-09-24 at their cheapest settings
  // (480p/720p, no audio); higher quality or audio costs more. Real cost comes back from Kie per item.
  usdPerSec?: number | Record<string, number>; // flat rate, or per resolution
  usdPerSecAudio?: number | Record<string, number>; // rate when "Generate audio" is on (Kling 3)
  usdFlat?: number | Record<string, number>; // per job, or per resolution
  billsInputVideo?: boolean; // Kie bills input video seconds + output seconds (Seedance reference-video mode)
  build: (p: Params) => { model: string; input: Record<string, unknown> } | { url: string };
};

const seedance = (model: string, extra: Partial<Model>): Model => ({
  id: model.split("/")[1],
  name: "",
  mode: "create",
  tier: "standard",
  desc: "",
  durations: [5, 8, 10, 15],
  aspects: ["adaptive", "16:9", "9:16", "1:1", "4:3", "3:4", "21:9"],
  resolutions: ["480p", "720p"],
  audio: true,
  frames: "start-end",
  build: (p) => ({
    model,
    input: {
      prompt: p.prompt,
      first_frame_url: p.start,
      last_frame_url: p.start && p.end, // Kie rejects a last frame without a first frame
      return_last_frame: true, // enables "Continue" (chain clips into longer videos)
      generate_audio: p.audio,
      resolution: p.resolution,
      aspect_ratio: p.aspect,
      duration: p.duration,
    },
  }),
  ...extra,
});

function genjutsu(kind: string, name: string, desc: string, instruction: string): Model {
  return {
    id: `genjutsu-${kind}`, name, badge: kind === "swap" ? "NEW" : "TOP", mode: "swap", tier: "premium",
    usdPerSec: { "480p": 0.085, "720p": 0.19 }, billsInputVideo: true, defaultRes: "480p", // Kie reference-video pricing
    desc: `${desc} Not for real people (Seedance blocks faces) — use "Real People (Kling Omni)".`,
    durations: [-1], aspects: ["adaptive", "16:9", "9:16", "1:1"], resolutions: ["480p", "720p"], audio: true,
    frames: "none", refs: 9, needs: ["video"], videoMaxPixels: 927408, videoMaxSecs: 30, promptOptional: true,
    labels: { video: "Reference video" },
    build: (p) => ({
      model: "bytedance/seedance-2-5",
      input: {
        prompt: `${instruction} ${p.prompt}`.trim(),
        reference_video_urls: [p.video],
        reference_image_urls: p.refs?.length ? p.refs : undefined,
        generate_audio: p.audio, resolution: p.resolution, aspect_ratio: p.aspect,
        duration: -1, // match the input video's length
      },
    }),
  };
}

export const MODELS: Model[] = [
  // ---------- VIDEO: Create ----------
  seedance("bytedance/seedance-2-5", {
    name: "Seedance 2.5", badge: "TOP", tier: "premium", usdPerSec: { "480p": 0.14, "720p": 0.315, "1080p": 0.79 }, defaultRes: "720p",
    durations: [5, 8, 10, 15, 20, 25, 30], resolutions: ["480p", "720p", "1080p"],
    desc: "Most advanced video model. Native audio, lip-sync, SFX in one pass.",
  }),
  seedance("bytedance/seedance-2", {
    name: "Seedance 2.0", tier: "standard", usdPerSec: { "480p": 0.095, "720p": 0.205, "1080p": 0.51 }, defaultRes: "720p",
    resolutions: ["480p", "720p", "1080p"],
    desc: "First native audio-video model: synced lip-sync, SFX, and music.",
  }),
  seedance("bytedance/seedance-2-fast", {
    name: "Seedance 2.0 Fast", tier: "budget", usdPerSec: { "480p": 0.059, "720p": 0.124 }, defaultRes: "480p",
    desc: "Faster, cheaper Seedance. Great for drafts.",
  }),
  seedance("bytedance/seedance-2-mini", {
    name: "Seedance 2.0 Mini", badge: "CHEAP", tier: "budget", usdPerSec: { "480p": 0.019, "720p": 0.041 }, defaultRes: "480p",
    desc: "Cheapest video model: about $0.10 for a 5s 480p clip. Best for drafts.",
  }),
  {
    id: "kling-3", name: "Kling 3.0", badge: "TOP", mode: "create", tier: "standard", usdPerSec: { std: 0.07, pro: 0.09 }, usdPerSecAudio: { std: 0.1, pro: 0.135 }, defaultRes: "std",
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
    id: "kling-3-turbo", name: "Kling 3.0 Turbo", mode: "create", tier: "standard", usdPerSec: { "720p": 0.09, "1080p": 0.1125 }, defaultRes: "720p",
    desc: "Fast, stable Kling for quick iterations.",
    durations: [5, 10], aspects: ["16:9", "9:16", "1:1"], resolutions: ["720p", "1080p"],
    frames: "start",
    build: (p) =>
      p.start
        ? { model: "kling/v3-turbo-image-to-video", input: { prompt: p.prompt, image_urls: [p.start], duration: String(p.duration), resolution: p.resolution } }
        : { model: "kling/v3-turbo-text-to-video", input: { prompt: p.prompt, duration: String(p.duration), aspect_ratio: p.aspect, resolution: p.resolution } },
  },
  {
    id: "veo-3-1", name: "Veo 3.1", mode: "create", tier: "premium", usdPerSec: { "720p": 0.0375, "1080p": 0.041 }, defaultRes: "720p", // ≈ Kie "Fast" ($0.30–0.325 per video); unverified which tier model "veo-3-1" bills
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
    id: "wan-2-7", name: "Wan 2.7", mode: "create", tier: "budget", usdPerSec: { "720p": 0.08, "1080p": 0.12 }, defaultRes: "720p",
    desc: "The perfect balance of generation speed and visual richness.",
    durations: [5, 10, 15], aspects: ["16:9", "9:16", "1:1", "4:3", "3:4"], resolutions: ["720p", "1080p"],
    frames: "start-end",
    build: (p) =>
      p.start
        ? { model: "wan/2-7-image-to-video", input: { prompt: p.prompt, first_frame_url: p.start, last_frame_url: p.end, resolution: p.resolution, duration: p.duration } }
        : { model: "wan/2-7-text-to-video", input: { prompt: p.prompt, ratio: p.aspect, resolution: p.resolution, duration: p.duration } },
  },
  {
    id: "grok-imagine", name: "Grok Imagine", badge: "CHEAP", mode: "create", tier: "budget", usdPerSec: { "480p": 0.012, "720p": 0.0225 },
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
    id: "wan-2-6", name: "Wan 2.6", mode: "create", tier: "budget", usdPerSec: { "720p": 0.07, "1080p": 0.1045 },
    desc: "15-second cinematic videos with native lip-sync and accurate physics. Multi-shot storytelling.",
    durations: [5, 10, 15], aspects: ["auto"], resolutions: ["720p", "1080p"], defaultRes: "720p", frames: "start",
    build: (p) => p.start
      ? { model: "wan/2-6-image-to-video", input: { prompt: p.prompt, image_urls: [p.start], duration: String(p.duration), resolution: p.resolution, multi_shots: p.duration > 5 } }
      : { model: "wan/2-6-text-to-video", input: { prompt: p.prompt, duration: String(p.duration), resolution: p.resolution, multi_shots: p.duration > 5 } },
  },
  {
    id: "grok-imagine-1-5", name: "Grok Imagine 1.5", badge: "NEW", mode: "create", tier: "budget", usdPerSec: { "480p": 0.012, "720p": 0.0225, "1080p": 0.04 },
    desc: "One still image or a prompt into a cinematic clip with camera moves, physics and sound. Up to 15s.",
    durations: [6, 8, 10, 15], aspects: ["16:9", "9:16", "1:1", "3:2", "2:3"], resolutions: ["480p", "720p", "1080p"], defaultRes: "720p", frames: "start",
    build: (p) => ({ model: "generated/grok-imagine-video-1.5-preview", input: { prompt: p.prompt, ...(p.start ? { image_urls: [p.start] } : { aspect_ratio: p.aspect }), resolution: p.resolution, duration: p.duration } }),
  },
  {
    id: "minimax-h3", name: "MiniMax H3", badge: "NEW", mode: "create", tier: "standard", usdPerSec: { "768P": 0.04, "2K": 0.065 },
    desc: "2K video with native stereo sound, from text or start/end keyframes. 4–15 seconds.",
    durations: [6, 10, 15], aspects: ["16:9", "9:16", "1:1", "4:3", "3:4", "21:9"], resolutions: ["768P", "2K"], defaultRes: "768P", frames: "start-end",
    build: (p) => p.start || p.end
      ? { model: "minimax-h3/image-to-video", input: { prompt: p.prompt, first_frame_url: p.start, last_frame_url: p.end, duration: String(p.duration), resolution: p.resolution } }
      : { model: "minimax-h3/text-to-video", input: { prompt: p.prompt, aspect_ratio: p.aspect, duration: String(p.duration), resolution: p.resolution } },
  },
  {
    id: "gemini-omni", name: "Gemini Omni Flash", badge: "NEW", mode: "create", tier: "standard", usdPerSec: 0.07, // Kie: $0.315 (4s) to $0.63 (10s), same price at 720p and 1080p
    desc: "Google's multi-shot video with native audio. Use reference images for characters and products.",
    durations: [4, 6, 8, 10], aspects: ["16:9", "9:16"], resolutions: ["720p", "1080p"], defaultRes: "1080p", frames: "start-end", refs: 4,
    build: (p) => ({
      model: "google/gemini-omni-flash-1-1",
      input: { prompt: p.prompt, first_frame_url: p.start, last_frame_url: p.end, image_urls: p.refs?.length ? p.refs : undefined, duration: String(p.duration), aspect_ratio: p.aspect, resolution: p.resolution },
    }),
  },
  {
    id: "hailuo-2-3", name: "Minimax Hailuo 2.3", mode: "create", tier: "budget", usdPerSec: 0.025,
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
    id: "wan-2-7-edit", name: "Wan 2.7 Edit", badge: "NEW", mode: "edit", tier: "budget", usdPerSec: { "720p": 0.08, "1080p": 0.12 }, defaultRes: "720p",
    desc: "Upload footage and describe the change — restyle, swap objects, relight.",
    durations: [5], aspects: ["16:9", "9:16", "1:1", "4:3", "3:4"], resolutions: ["720p", "1080p"],
    frames: "start", needs: ["video"], videoMaxSecs: 10, labels: { start: "Reference image", video: "Input video" },
    build: (p) => ({
      model: "wan/2-7-videoedit",
      input: { prompt: p.prompt, video_url: p.video, reference_image: p.start, resolution: p.resolution, aspect_ratio: p.aspect },
    }),
  },

  // ---------- VIDEO: Motion Control ----------
  {
    id: "kling-3-motion", name: "Kling 3.0 Motion Control", badge: "TOP", mode: "motion", tier: "standard", usdPerSec: { std: 0.1, pro: 0.135 }, defaultRes: "std",
    desc: "Upload a reference video to drive the exact pace and gestures of your character image.",
    durations: [-1], aspects: ["auto"], resolutions: ["std", "pro"],
    frames: "start", needs: ["start", "video"], videoMaxSecs: 30, promptOptional: true,
    labels: { start: "Character image", video: "Motion video" },
    build: (p) => ({
      model: "kling-3.0/motion-control",
      input: { prompt: p.prompt, input_urls: [p.start], video_urls: [p.video], mode: p.resolution },
    }),
  },

  {
    id: "wan-animate-move", name: "Wan Animate Move", mode: "motion", tier: "budget", usdPerSec: { "480p": 0.03, "580p": 0.0475, "720p": 0.0625 }, defaultRes: "580p",
    desc: "Your character image copies the moves of the reference video (dances, gestures). From $0.03 per second of video.",
    durations: [-1], aspects: ["auto"], resolutions: ["480p", "580p", "720p"],
    frames: "start", needs: ["start", "video"], videoMaxSecs: 30, promptOptional: true,
    labels: { start: "Character image", video: "Motion video" },
    build: (p) => ({ model: "wan/2-2-animate-move", input: { video_url: p.video, image_url: p.start, resolution: p.resolution } }),
  },

  // ---------- VIDEO: Genjutsu ----------
  // Kling 3.0 Omni Transformation: video + up to 4 reference photos + instruction. Unlike Seedance it accepts real people.
  {
    id: "genjutsu-kling", name: "Genjutsu · Real People (Kling Omni)", badge: "NEW", mode: "swap", tier: "premium",
    usdPerSec: { "720p": 0.1, "1080p": 0.15 }, // 720p measured 2026-09-24: 5s = $0.50; 1080p estimated
    desc: "Swap people, outfits, products or the whole look in your video — works with real people. Say what to change; refer to your photos as “the person in image 1”. Videos over 15s (up to 30s) are split into 2 parts — Join them after.",
    durations: [-1], aspects: ["9:16", "16:9", "1:1"], resolutions: ["720p", "1080p"], defaultRes: "720p", audio: true,
    frames: "none", refs: 4, needs: ["video"], videoMaxSecs: 15, videoMinSide: 720, videoSplit: true,
    labels: { video: "Reference video" },
    build: (p) => ({
      model: "kling-3.0-omni/transformation",
      input: {
        prompt: `${p.prompt} Keep the original video's camera movement, body motion, timing and everything not mentioned exactly the same; use the reference image${(p.refs?.length ?? 0) > 1 ? "s" : ""} for the new appearance.`.trim(),
        video_urls: [p.video],
        ...(p.refs?.length ? { image_urls: p.refs, aspect_ratio: p.aspect } : { aspect_ratio: "auto" }),
        resolution: p.resolution,
        audio: p.audio,
      },
    }),
  },
  // Seedance 2.5 versions (Higgsfield's own engine): best quality, but ByteDance rejects real human faces.
  genjutsu("motion", "Genjutsu · Motion Transfer",
    "Keeps the video's motion, camera and timing; rebuilds the cast, location and look from your reference images.",
    "Recreate the reference video with exactly the same motion, choreography, camera movement, framing and timing, but rebuild the characters, setting and visual style from the reference images."),
  genjutsu("swap", "Genjutsu · Object Swap",
    "Swaps one thing (a person, outfit, product or location) with your reference and keeps the rest of the shot identical.",
    "Keep the reference video identical in motion, camera, timing, lighting and every other detail, except replace the element described below with the one shown in the reference images."),
  // ---------- VIDEO: Swap ----------
  {
    id: "wan-animate-replace", name: "Character Swap (full body)", badge: "TOP", mode: "swap", tier: "standard", usdPerSec: { "480p": 0.03, "580p": 0.0475, "720p": 0.0625 }, defaultRes: "580p", // 720p measured: 29s video = $1.81
    desc: "Replace the main person in any video with your character, keeping their exact motion, lighting and scene. From $0.03 per second of video.",
    durations: [-1], aspects: ["auto"], resolutions: ["480p", "580p", "720p"],
    frames: "start", needs: ["start", "video"], videoMaxSecs: 30, promptOptional: true,
    labels: { video: "Original video", start: "New character" },
    build: (p) => ({ model: "wan/2-2-animate-replace", input: { video_url: p.video, image_url: p.start, resolution: p.resolution } }),
  },
  {
    id: "face-swap-image", name: "Face Swap (photo)", mode: "swap", output: "image", tier: "budget", usdFlat: { "1K": 0.04, "2K": 0.06 }, defaultRes: "1K",
    desc: "Put a face onto someone in another photo (Nano Banana 2). Add a prompt for extra direction.",
    durations: [], aspects: ["auto"], resolutions: ["1K", "2K"],
    frames: "start-end", needs: ["start", "end"], promptOptional: true,
    labels: { start: "Face", end: "Target photo" },
    build: (p) => ({
      model: "nano-banana-2",
      input: {
        prompt: `Replace the face of the person in the second image with the face from the first image. Keep the second image's pose, body, hair, clothing, lighting, background and framing identical; match skin tone and lighting naturally. ${p.prompt}`.trim(),
        image_input: [p.start, p.end], aspect_ratio: "auto", resolution: p.resolution, output_format: "png",
      },
    }),
  },

  // ---------- VIDEO: Extend (opened from a Grok result's "Extend" button) ----------
  {
    id: "grok-extend", name: "Grok Imagine Extend", mode: "extend", tier: "budget", usdPerSec: 0.012, // 480p; a 720p source costs ~2x
    desc: "Continues a Grok Imagine video by 6 or 10 seconds. Repeat to go longer.",
    durations: [6, 10], aspects: ["auto"], resolutions: ["auto"], frames: "none",
    build: (p) => ({ model: "grok-imagine/extend", input: { task_id: p.taskId, prompt: p.prompt, extend_times: p.duration } }),
  },

  // ---------- TOOLS (used by Apps, not listed in the pickers) ----------
  {
    id: "upscale-image", name: "Topaz Image Upscale", mode: "tool", output: "image", tier: "budget", usdFlat: { "2": 0.05, "4": 0.1 }, defaultRes: "2",
    desc: "Sharpen and enlarge an image 2× or 4×.", durations: [], aspects: ["auto"], resolutions: ["2", "4"], frames: "start", needs: ["start"], promptOptional: true,
    build: (p) => ({ model: "topaz/image-upscale", input: { image_url: p.start, upscale_factor: p.resolution } }),
  },
  {
    id: "upscale-video", name: "Topaz Video Upscale", mode: "tool", tier: "standard", usdPerSec: { "2": 0.04, "4": 0.07 }, defaultRes: "2",
    desc: "Sharpen and enlarge a video 2× or 4×.", durations: [], aspects: ["auto"], resolutions: ["2", "4"], frames: "none", needs: ["video"], promptOptional: true,
    build: (p) => ({ model: "topaz/video-upscale", input: { video_url: p.video, upscale_factor: p.resolution } }),
  },
  {
    id: "remove-bg", name: "Background Remover", mode: "tool", output: "image", tier: "budget", usdFlat: 0.005,
    desc: "Cut out the subject (image under 5 MB).", durations: [], aspects: ["auto"], resolutions: ["auto"], frames: "start", needs: ["start"], promptOptional: true,
    build: (p) => ({ model: "recraft/remove-background", input: { image: p.start } }),
  },
  {
    id: "kling-avatar", name: "Kling AI Avatar", mode: "tool", tier: "standard", usdPerSec: 0.04, // per second of audio (standard, 720p)
    desc: "Talking video from a photo + voice audio, with lip-sync.", durations: [], aspects: ["auto"], resolutions: ["auto"], frames: "start", needs: ["start"], promptOptional: true,
    build: (p) => ({ model: "kling/ai-avatar-standard", input: { image_url: p.start, audio_url: p.audioUrl, prompt: p.prompt || "Natural talking to camera" } }),
  },
  {
    id: "tts", name: "ElevenLabs Multilingual v2", mode: "audio", output: "audio", tier: "budget", usdFlat: 0.03,
    desc: "ElevenLabs text to speech. (Was failing on Kie on 2026-09-24; use Gemini if it errors.)", durations: [], aspects: ["auto"],
    resolutions: ["Rachel", "Adam", "Brian", "Laura", "Liam", "Jessica"], resLabel: "Voice", defaultRes: "Brian", frames: "none",
    build: (p) => ({ model: "elevenlabs/text-to-speech-multilingual-v2", input: { text: p.prompt, voice: p.voice || p.resolution } }),
  },

  {
    id: "gemini-tts", name: "Text to Speech (Gemini)", badge: "CHEAP", mode: "audio", output: "audio", tier: "budget", usdFlat: 0.005,
    desc: "Natural voiceover from text, ~$0.004 per line. Add tone in brackets, e.g. [excited] or [whispers].", durations: [], aspects: ["auto"],
    resolutions: ["Puck", "Charon", "Kore", "Fenrir", "Aoede", "Zephyr", "Achird", "Sulafat", "Orus", "Leda", "Algieba", "Despina", "Gacrux", "Schedar"],
    resLabel: "Voice", defaultRes: "Puck", frames: "none",
    build: (p) => ({
      model: "google/gemini-3-1-flash-tts",
      input: {
        temperature: 1, scene: "", sample_context: "Professional, natural voiceover.",
        speakers: [{ speaker_id: "Speaker 1", voice_name: p.voice || p.resolution }],
        dialogue_turns: [{ speaker_id: "Speaker 1", text: p.prompt }],
      },
    }),
  },

  {
    id: "suno-music", name: "Music (Suno V6)", badge: "NEW", mode: "audio", output: "audio", tier: "budget", usdFlat: 0.06,
    desc: "Full songs or background music from a description. Returns a finished track.", durations: [], aspects: ["auto"],
    resolutions: ["Instrumental", "With vocals"], resLabel: "Type", defaultRes: "Instrumental", frames: "none",
    build: (p) => ({ model: "ai-music-api/generate", input: { prompt: p.prompt, custom_mode: false, instrumental: p.resolution !== "With vocals", model: "V6" } }),
  },
  {
    id: "suno-sfx", name: "Sound Effects (Suno)", mode: "audio", output: "audio", tier: "budget", usdFlat: 0.0125,
    desc: "Sound effects and ambience from a description: whooshes, crowds, rain, UI clicks.", durations: [], aspects: ["auto"], resolutions: ["auto"], frames: "none",
    build: (p) => ({ model: "ai-music-api/sounds", input: { prompt: p.prompt, model: "V6" } }),
  },

  {
    id: "gemini-text", name: "Gemini (text AI)", mode: "tool", output: "text", tier: "budget", usdFlat: 0.002,
    desc: "Reads text, images, video or audio and writes an answer. Runs instantly (see lib/run.ts TOOLS).",
    durations: [], aspects: ["auto"], resolutions: ["auto"], frames: "none",
    build: () => ({ model: "gemini-text", input: {} }), // not used: runs through TOOLS
  },
  {
    id: "page-brief", name: "Web page reader", mode: "tool", output: "text", tier: "budget", usdFlat: 0.002,
    desc: "Fetches a web page and has the text AI summarize it (see lib/run.ts TOOLS).",
    durations: [], aspects: ["auto"], resolutions: ["auto"], frames: "none",
    build: () => ({ model: "page-brief", input: {} }), // not used: runs through TOOLS
  },
  {
    id: "lipsync-video", name: "Volcengine Lip Sync", mode: "tool", tier: "standard", usdPerSec: 0.04,
    desc: "Re-syncs the lips in a video to a new voice track.", durations: [], aspects: ["auto"], resolutions: ["auto"], frames: "none", needs: ["video"], promptOptional: true,
    build: (p) => ({ model: "volcengine/video-to-video-lip-sync", input: { mode: "lite", video_url: p.video, audio_url: p.audioUrl, align_audio: true } }),
  },

  // ---------- IMAGE ----------
  {
    id: "nano-banana-2", name: "Nano Banana 2", badge: "TOP", mode: "image", tier: "standard", usdFlat: { "1K": 0.04, "2K": 0.06, "4K": 0.09 }, defaultRes: "1K",
    desc: "Google's image model. Best for product shots and edits with references.",
    durations: [], aspects: ["1:1", "16:9", "9:16", "4:3", "3:4", "4:5", "21:9"], resolutions: ["1K", "2K", "4K"],
    frames: "start",
    build: (p) => ({
      model: "nano-banana-2",
      input: { prompt: p.prompt, image_input: [p.start, p.end, ...(p.refs ?? [])].filter(Boolean), aspect_ratio: p.aspect, resolution: p.resolution, output_format: "png" },
    }),
  },
  {
    id: "nano-banana-pro", name: "Nano Banana Pro", badge: "TOP", mode: "image", tier: "premium", usdFlat: { "1K": 0.09, "2K": 0.09, "4K": 0.12 },
    desc: "Google's best 4K image model: text rendering, product shots, precise edits.",
    durations: [], aspects: ["1:1", "16:9", "9:16", "4:3", "3:4", "4:5", "21:9", "auto"], resolutions: ["1K", "2K", "4K"], defaultRes: "2K",
    frames: "start",
    build: (p) => ({ model: "nano-banana-pro", input: { prompt: p.prompt, image_input: [p.start, p.end, ...(p.refs ?? [])].filter(Boolean), aspect_ratio: p.aspect, resolution: p.resolution, output_format: "png" } }),
  },
  {
    id: "gpt-image-2", name: "GPT Image 2", mode: "image", tier: "standard", usdFlat: { "1K": 0.03, "2K": 0.05, "4K": 0.08 },
    desc: "OpenAI image model: near-perfect text, posters, ads, logos.",
    durations: [], aspects: ["1:1", "16:9", "9:16", "3:2", "2:3", "4:5", "21:9", "auto"], resolutions: ["1K", "2K", "4K"], defaultRes: "1K",
    frames: "start",
    build: (p) => p.start
      ? { model: "gpt-image-2-image-to-image", input: { prompt: p.prompt, input_urls: [p.start], aspect_ratio: p.aspect, resolution: p.resolution } }
      : { model: "gpt-image-2-text-to-image", input: { prompt: p.prompt, aspect_ratio: p.aspect, resolution: p.resolution } },
  },
  {
    id: "seedream-5-pro", name: "Seedream 5.0 Pro", mode: "image", tier: "standard", usdFlat: { basic: 0.035, high: 0.07 }, defaultRes: "basic",
    desc: "ByteDance image model with strong visual reasoning and consistency.",
    durations: [], aspects: ["1:1", "16:9", "9:16", "4:3", "3:4", "3:2", "2:3", "21:9"], resolutions: ["basic", "high"], resLabel: "Quality",
    frames: "start",
    build: (p) => p.start
      ? { model: "seedream/5-pro-image-to-image", input: { prompt: p.prompt, image_urls: [p.start], aspect_ratio: p.aspect, quality: p.resolution } }
      : { model: "seedream/5-pro-text-to-image", input: { prompt: p.prompt, aspect_ratio: p.aspect, quality: p.resolution } },
  },
  {
    id: "flux-2-pro", name: "FLUX.2 Pro", mode: "image", tier: "budget", usdFlat: { "1K": 0.025, "2K": 0.035 }, defaultRes: "1K",
    desc: "Fast, detailed photorealism from Black Forest Labs.",
    durations: [], aspects: ["1:1", "16:9", "9:16", "4:3", "3:4", "3:2", "2:3"], resolutions: ["1K", "2K"],
    frames: "start",
    build: (p) => p.start
      ? { model: "flux-2/pro-image-to-image", input: { prompt: p.prompt, input_urls: [p.start], aspect_ratio: p.aspect, resolution: p.resolution } }
      : { model: "flux-2/pro-text-to-image", input: { prompt: p.prompt, aspect_ratio: p.aspect, resolution: p.resolution } },
  },
  {
    id: "grok-image-2", name: "Grok Imagine 2.0", mode: "image", tier: "budget", usdFlat: 0.02,
    desc: "High-resolution image generation by xAI.",
    durations: [], aspects: ["1:1", "16:9", "9:16", "3:2", "2:3"], resolutions: ["auto"], frames: "none",
    build: (p) => ({ model: "grok-imagine-image-2-0/text-to-image", input: { prompt: p.prompt, aspect_ratio: p.aspect } }),
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

// `seconds`: clip length; for "match input video" models (duration -1) pass the uploaded video's length.
// Rates: Kie price list (POST api.kie.ai/client/v1/model-pricing/page, checked 2026-09-25) or measured; real cost is recorded per item.
export const defaultRes = (m: Model) => m.defaultRes ?? m.resolutions.at(-1)!;

const pick = (v: number | Record<string, number>, res: string) => (typeof v === "object" ? v[res] ?? Math.max(...Object.values(v)) : v);
export function estimateUsd(m: Model, seconds: number, resolution = defaultRes(m), audio = false) {
  if (m.usdFlat != null) return pick(m.usdFlat, resolution);
  const rate = pick(audio && m.usdPerSecAudio != null ? m.usdPerSecAudio : m.usdPerSec ?? 0, resolution);
  return rate * Math.max(seconds, 0) * (m.billsInputVideo ? 2 : 1);
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
