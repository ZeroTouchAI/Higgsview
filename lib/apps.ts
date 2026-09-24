// Higgsfield-style one-click Apps. Each app = inputs + 1..n steps; a step picks a model from lib/models.ts and
// fills its params. Multi-step apps chain: step N's result URL is passed to step N+1 as `prev`
// (the server runs the next step when the previous one finishes, see app/api/history).
import { byId, defaultRes, estimateUsd, type Params } from "./models.ts";

export type Tier = "draft" | "standard" | "premium";
export type AppInput = { start?: string; end?: string; product?: string; video?: string; audioUrl?: string; text?: string; choice?: string; tier?: Tier };
type Step = (i: AppInput, prev?: string) => { modelId: string; params: Partial<Params> };
type Slot = "start" | "end" | "product" | "video" | "audioUrl";

export type App = {
  id: string;
  name: string;
  cat: keyof typeof CATEGORIES;
  desc: string;
  badge?: "PRO" | "NEW" | "TRENDING";
  out: "image" | "video" | "audio";
  inputs: [Slot, string][]; // required uploads with labels
  optional?: [Slot, string][]; // optional uploads
  text?: { label: string; placeholder: string; optional?: boolean };
  choice?: { label: string; options: string[] };
  steps: Step[] | ((i: AppInput) => Step[]); // a function when the recipe depends on which inputs were given
};

export const CATEGORIES = {
  studio: "Studios",
  effects: "Effects",
  camera: "Camera & Motion",
  style: "Enhance & Style",
  identity: "Face & Identity",
  ads: "Ads & Products",
  edit: "Video Editing",
  games: "Games & Characters",
  trending: "Trending Templates",
  extras: "Extras",
};

// Video steps: Draft = Grok Imagine 480p (~$0.07), Standard = Kling 3.0 std (~$0.35/5s), Premium = Kling 3.0 pro + sound (~$0.45/5s).
// Not Seedance: it rejects real people's faces, and most apps start from a photo of a person.
const VIDEO_TIERS: Record<Tier, { modelId: string; resolution: string }> = {
  draft: { modelId: "grok-imagine", resolution: "480p" },
  standard: { modelId: "kling-3", resolution: "std" },
  premium: { modelId: "kling-3", resolution: "pro" },
};
const animate = (prompt: string | ((i: AppInput) => string), seconds = 5): Step => (i, prev) => {
  const t = VIDEO_TIERS[i.tier ?? "standard"];
  const grok = t.modelId.startsWith("grok");
  return {
    modelId: t.modelId,
    params: { prompt: typeof prompt === "function" ? prompt(i) : prompt, start: prev ?? i.start, resolution: t.resolution,
      duration: grok ? (seconds > 6 ? 10 : 6) : seconds, aspect: "9:16", audio: i.tier !== "standard" },
  };
};
// Image steps run on Nano Banana 2 with the uploaded images as references (image 1 = start, image 2 = end).
const nano = (prompt: string | ((i: AppInput) => string), final = true): Step => (i) => ({
  modelId: "nano-banana-2",
  params: { prompt: typeof prompt === "function" ? prompt(i) : prompt, start: i.start, end: i.end, aspect: "auto", resolution: final ? "2K" : "1K" },
});
const KEEP = "Keep the person's face, identity and likeness exactly the same.";
const restyleThenAnimate = (look: string, motion: string): Step[] => [nano(`${look} ${KEEP}`, false), animate(motion)];
const productAd = (scene: string, motion: string): Step[] => [
  nano(`${scene} The product must stay exactly as in the photo: same shape, colors, logo and label text.`, false),
  animate(`${motion} Premium commercial look, cinematic lighting.`),
];
const photo: [Slot, string][] = [["start", "Your photo"]];
const product: [Slot, string][] = [["start", "Product photo"]];
const grid = (what: string) => `Create a single image laid out as a clean 3x3 grid (contact sheet) of 9 panels: ${what}. Same subject, same identity, consistent lighting and style in every panel.`;

// "gemini:<name>" → Gemini 3.1 Flash TTS (~$0.004/line, default); anything else is an ElevenLabs voice id.
export const VOICES: Record<string, string> = {
  "Puck (upbeat)": "gemini:Puck", "Charon (informative)": "gemini:Charon", "Kore (firm)": "gemini:Kore", "Fenrir (excitable)": "gemini:Fenrir",
  "Aoede (breezy)": "gemini:Aoede", "Zephyr (bright)": "gemini:Zephyr", "Achird (friendly)": "gemini:Achird", "Sulafat (warm)": "gemini:Sulafat",
  "Orus (firm)": "gemini:Orus", "Leda (youthful)": "gemini:Leda",
  "James · ElevenLabs": "EkK5I93UQWFDigLMpZcX", "Brian · ElevenLabs": "nPczCjzI2devNBz1zQrb", "Laura · ElevenLabs": "FGY2WhTYpPnrIDTdsKH5",
  "Bella · ElevenLabs": "hpp4J3VqNfWAUOO0d1Us", "Xavier (announcer) · ElevenLabs": "YOq2y2Up4RgXP2HyXjE5",
};
const tts: Step = (i) => {
  const v = VOICES[i.choice ?? ""] ?? Object.values(VOICES)[0];
  return v.startsWith("gemini:") ? { modelId: "gemini-tts", params: { prompt: i.text, voice: v.slice(7) } } : { modelId: "tts", params: { prompt: i.text, voice: v } };
};

export const EFFECTS: [string, string][] = [
  ["Floating Fall", "The subject floats weightlessly and drifts down through the air in dreamy slow motion, hair and clothes flowing."],
  ["Burning Man", "The subject bursts into roaring stylized flames while calmly walking toward camera, embers swirling."],
  ["Melting", "The subject slowly melts like hot wax into a glossy liquid puddle, surreal VFX."],
  ["Street Colossus", "The subject grows into a colossal giant towering over city streets, tiny cars and people below, epic low angle."],
  ["Infinite Clones", "Endless clones of the subject multiply across the frame all the way to the horizon, perfectly synchronized."],
  ["Clones", "Three clones of the subject appear in the same scene and interact with each other playfully."],
  ["High Flip", "The subject performs an impossibly high backflip in slow motion, camera tracking the spin."],
  ["Monster Dab", "A giant friendly monster rises behind the subject and they both hit a synchronized dab."],
  ["World Morphing", "The world around the subject morphs through completely different environments while they stay still."],
  ["Studio Slide", "The subject slides dramatically across a seamless white photo studio floor into a hero pose."],
  ["Smash and Grab", "The subject smashes a glass display case and grabs the item in slow motion, shards flying, heist energy."],
  ["Incline", "The whole world tilts to an extreme incline while the subject keeps walking perfectly upright."],
  ["Selfception", "The camera dives into the subject's eye and emerges in another scene with the same subject, recursive inception loop."],
  ["Act Natural", "The subject acts completely natural while absurd chaos erupts all around them."],
  ["Wild Ride", "The subject rides a wild creature at breakneck speed, wind and dust, dynamic tracking camera."],
  ["Lidar Transition", "The scene dissolves into a glowing LiDAR point-cloud scan and reassembles into a new version of itself."],
  ["Eyes In", "An ultra-fast push-in straight into the subject's eye, seamless macro transition into the iris."],
  ["Vanish", "The subject disintegrates into thousands of glowing particles that blow away in the wind."],
  ["Cutout", "The subject turns into a paper cutout and peels off the background, revealing the scene behind."],
  ["Lacewalker", "Delicate glowing lace patterns weave across the subject's body and clothing as they walk."],
];

export const APPS: App[] = [
  // ---------- Studios ----------
  { id: "ugc-ad", name: "UGC Ad", cat: "studio", badge: "NEW", out: "video", desc: "A creator holds your product and talks about it to camera, with voice and lip-sync.",
    inputs: [["start", "Creator photo"], ["end", "Product photo"]], text: { label: "What they say", placeholder: "Honestly this is the only serum that fixed my skin in two weeks…" },
    steps: [nano(`Photorealistic vertical selfie-style UGC photo: the person from image 1 holding the product from image 2 up near their face at home, natural daylight, phone-camera look. ${KEEP} The product keeps its exact label and colors.`, false),
      animate((i) => `Vertical UGC video, handheld selfie. The person talks enthusiastically to camera, showing the product, and says: "${i.text}". Natural lip-sync, casual home audio.`, 10)] },
  { id: "talking-avatar", name: "Talking Avatar", cat: "studio", badge: "PRO", out: "video", desc: "Type a script, pick a voice, and your photo speaks it with lip-sync (ElevenLabs + Kling Avatar).",
    inputs: [["start", "Face photo"]], text: { label: "Script", placeholder: "Hi, I'm Alex from ZeroTouch AI. Let me show you how…" },
    choice: { label: "Voice", options: Object.keys(VOICES) },
    steps: [tts, (i, prev) => ({ modelId: "kling-avatar", params: { start: i.start, audioUrl: prev } })] },
  { id: "lipsync", name: "Lipsync Studio", cat: "studio", out: "video", desc: "Make a photo speak or sing along to your own audio file.",
    inputs: [["start", "Face photo"], ["audioUrl", "Voice / song audio"]], text: { label: "Direction", placeholder: "Friendly, smiling, slight head movement", optional: true },
    steps: [(i) => ({ modelId: "kling-avatar", params: { start: i.start, audioUrl: i.audioUrl, prompt: i.text } })] },
  { id: "voiceover", name: "Voiceover", cat: "studio", out: "audio", desc: "Natural ElevenLabs voiceover from text: for ads, narration and UGC scripts.",
    inputs: [], text: { label: "Script", placeholder: "Introducing the fastest way to…" }, choice: { label: "Voice", options: Object.keys(VOICES) }, steps: [tts] },
  { id: "upscale-image", name: "Upscale Image", cat: "studio", out: "image", desc: "Topaz upscaling: sharper detail at 2× or 4× size.",
    inputs: [["start", "Image"]], choice: { label: "Scale", options: ["2×", "4×"] },
    steps: [(i) => ({ modelId: "upscale-image", params: { start: i.start, resolution: i.choice === "4×" ? "4" : "2" } })] },
  { id: "upscale-video", name: "Upscale Video", cat: "studio", out: "video", desc: "Topaz video upscaling for crisp final exports.",
    inputs: [["video", "Video"]], choice: { label: "Scale", options: ["2×", "4×"] },
    steps: [(i) => ({ modelId: "upscale-video", params: { video: i.video, resolution: i.choice === "4×" ? "4" : "2" } })] },

  // ---------- Effects (Higgsfield VFX presets) ----------
  ...EFFECTS.map(([name, fx]): App => ({
    id: `fx-${name.toLowerCase().replace(/ /g, "-")}`, name, cat: "effects", out: "video", desc: fx,
    inputs: [], optional: [["start", "Character"], ["end", "Location"], ["product", "Product"]],
    text: { label: "Extra direction", placeholder: "Anything to add…", optional: true },
    steps: (i) => {
      const imgs = [i.start && "the person from image 1", i.end && `the location from image ${i.start ? 2 : 1}`, i.product && "the product from the last image"].filter(Boolean);
      const motion = animate((x) => `${fx} ${x.text ?? ""} Cinematic VFX shot, vertical.`.trim());
      // One photo: animate it directly. Several: compose them into one frame first.
      return imgs.length > 1 || (!i.start && (i.end || i.product))
        ? [(x) => ({ modelId: "nano-banana-2", params: { prompt: `One photorealistic cinematic vertical frame combining ${imgs.join(", ")}. ${KEEP}`, start: x.start ?? x.end ?? x.product, end: x.start ? x.end : undefined, refs: x.product && x.product !== (x.start ?? x.end ?? x.product) ? [x.product] : undefined, aspect: "9:16", resolution: "1K" } }), motion]
        : [motion];
    },
  })),

  // ---------- Camera & Motion ----------
  { id: "angles", name: "Angles", cat: "camera", badge: "PRO", out: "image", desc: "Any camera angle of your image: 9 views in one sheet.", inputs: photo,
    steps: [nano(grid("front, 3/4 left, profile left, 3/4 right, profile right, low angle, high angle, top-down, and back view"))] },
  { id: "shots", name: "Shots", cat: "camera", out: "image", desc: "9 cinematic storyboard shots from one image.", inputs: photo,
    steps: [nano(grid("extreme wide establishing, wide, medium, medium close-up, close-up, extreme close-up detail, over-the-shoulder, low-angle hero, and dutch-angle shot"))] },
  { id: "zooms", name: "Zooms", cat: "camera", out: "image", desc: "9 zoom levels from macro detail to ultra wide.", inputs: photo,
    steps: [nano(grid("progressive zoom levels from extreme macro detail to ultra-wide landscape"))] },
  { id: "whats-next", name: "What's Next", cat: "camera", out: "image", desc: "Explore 9 story directions from a single image.", inputs: photo,
    steps: [nano(grid("9 different possible next scenes of this story, each a distinct cinematic moment that could follow"))] },
  { id: "transitions", name: "Transitions", cat: "camera", badge: "TRENDING", out: "video", desc: "A seamless creative transition between two shots.",
    inputs: [["start", "First shot"], ["end", "Second shot"]], text: { label: "Style", placeholder: "Whip pan / morph / match cut through a doorway…", optional: true },
    steps: [(i) => ({ modelId: "kling-3", params: { prompt: `Seamless, creative cinematic transition from the first frame to the last frame. ${i.text ?? "Smooth morph with camera motion."}`, start: i.start, end: i.end, duration: 5, resolution: i.tier === "premium" ? "pro" : "std", audio: i.tier === "premium" } })] },
  { id: "behind-the-scenes", name: "Behind the Scenes", cat: "camera", out: "video", desc: "The camera pulls back to reveal a real film set around your shot.", inputs: photo,
    steps: [animate("The camera slowly pulls back to reveal this scene is being filmed on a busy movie set: crew, cameras on dollies, boom mics, lights and monitors around it.")] },
  { id: "expand-image", name: "Expand Image", cat: "camera", out: "image", desc: "Extend any image beyond its edges.", inputs: photo,
    choice: { label: "New shape", options: ["16:9", "9:16", "1:1", "21:9", "4:5"] },
    steps: [(i) => ({ modelId: "nano-banana-2", params: { prompt: "Expand this image beyond its original borders (outpaint), seamlessly continuing the scene, lighting and perspective. Keep the original content unchanged in the middle.", start: i.start, aspect: i.choice ?? "16:9", resolution: "2K" } })] },
  { id: "color-grading", name: "Color Grading", cat: "camera", out: "image", desc: "Cinematic color grades for any photo.", inputs: photo,
    choice: { label: "Grade", options: ["Teal & Orange", "Kodak Portra film", "Bleach bypass", "Noir black & white", "Moody green", "Warm golden", "Cool blue night"] },
    steps: [nano((i) => `Apply a professional ${i.choice ?? "Teal & Orange"} cinematic color grade to this photo. Change only color and tone, keep every detail identical.`)] },

  // ---------- Enhance & Style ----------
  { id: "relight", name: "Relight", cat: "style", badge: "PRO", out: "image", desc: "Change the lighting of any photo.", inputs: photo,
    choice: { label: "Lighting", options: ["Golden hour", "Studio softbox", "Neon night", "Dramatic rim light", "Candlelight", "Overcast soft", "Hard noon sun"] },
    steps: [nano((i) => `Relight this photo with ${i.choice ?? "Golden hour"} lighting. Keep the subject, composition and every detail identical; only the light, shadows and color temperature change.`)] },
  { id: "skin-enhancer", name: "Skin Enhancer", cat: "style", badge: "PRO", out: "image", desc: "Natural, realistic skin retouching.", inputs: photo,
    steps: [nano(`High-end natural skin retouch: even tone, reduce blemishes and blur, keep real skin texture and pores. ${KEEP} Everything else unchanged.`)] },
  { id: "outfit-swap", name: "Outfit Swap", cat: "style", out: "image", desc: "Try on any outfit from a single photo.",
    inputs: [["start", "Your photo"], ["end", "Outfit photo"]],
    steps: [nano(`Dress the person from image 1 in the outfit from image 2, with realistic fit, folds and lighting. ${KEEP} Keep their pose and background.`)] },
  { id: "ai-stylist", name: "AI Stylist", cat: "style", badge: "NEW", out: "image", desc: "Describe any look and try it on: outfit, pose, background.", inputs: photo,
    text: { label: "The look", placeholder: "Cream linen suit, gold watch, on a yacht at sunset" },
    steps: [nano((i) => `Restyle this person: ${i.text}. ${KEEP} Photorealistic fashion photo.`)] },
  { id: "style-snap", name: "Style Snap", cat: "style", out: "image", desc: "4 instant style variations of your look.", inputs: photo,
    steps: [nano(`A 2x2 fashion collage of this same person in 4 different stylish outfits (streetwear, formal, casual summer, evening). ${KEEP}`)] },
  { id: "outfit-shot", name: "Outfit Shot", cat: "style", out: "video", desc: "Your avatar models the outfit on video.",
    inputs: [["start", "Your photo"], ["end", "Outfit photo"]],
    steps: [nano(`Full-body fashion photo of the person from image 1 wearing the outfit from image 2 in a clean studio. ${KEEP}`, false),
      animate("Fashion model poses and turns confidently to show the outfit, runway lighting, smooth camera move.")] },
  { id: "glitter-sticker", name: "Glitter Sticker", cat: "style", out: "image", desc: "Holographic glitter sticker of your portrait.", inputs: photo,
    steps: [nano(`Turn this portrait into a die-cut holographic glitter sticker with shimmering foil texture and a white border, on a plain background. ${KEEP}`)] },
  { id: "vending-machine", name: "Outfit Vending", cat: "style", out: "image", desc: "Pick outfits from a fashion vending machine.", inputs: photo,
    steps: [nano(`This person standing in front of a glowing fashion vending machine filled with stylish outfits, pressing a button, wearing a new outfit from it. ${KEEP}`)] },

  // ---------- Face & Identity ----------
  { id: "recast", name: "Recast", cat: "identity", badge: "PRO", out: "video", desc: "Swap the character in any video with yours, keeping every movement.",
    inputs: [["video", "Original video"], ["start", "New character"]],
    steps: [(i) => ({ modelId: "wan-animate-replace", params: { video: i.video, start: i.start, resolution: "720p" } })] },
  { id: "video-face-swap", name: "Video Face Swap", cat: "identity", out: "video", desc: "Put your face on the person in a video.",
    inputs: [["video", "Original video"], ["start", "Your face"]],
    steps: [(i) => ({ modelId: "wan-animate-replace", params: { video: i.video, start: i.start, resolution: "720p" } })] },
  { id: "face-swap", name: "Face Swap", cat: "identity", out: "image", desc: "Instant face swap for photos.",
    inputs: [["start", "Face"], ["end", "Target photo"]], steps: [(i) => ({ modelId: "face-swap-image", params: { start: i.start, end: i.end, resolution: "2K" } })] },
  { id: "character-swap", name: "Character Swap 2.0", cat: "identity", out: "image", desc: "Swap the character in any image.",
    inputs: [["start", "New character"], ["end", "Target image"]],
    steps: [nano("Replace the main character in image 2 with the character from image 1 (face, body, hair, outfit). Keep image 2's pose, scene, lighting and composition exactly.")] },
  { id: "headshot", name: "Headshot Generator", cat: "identity", out: "image", desc: "Studio-quality professional headshots.", inputs: photo,
    choice: { label: "Background", options: ["Studio grey", "Office blur", "Outdoor city", "Dark studio", "White"] },
    steps: [nano((i) => `Professional LinkedIn-style studio headshot of this person, business attire, ${i.choice ?? "Studio grey"} background, flattering soft light, sharp focus, 85mm lens. ${KEEP}`)] },
  { id: "commercial-faces", name: "Commercial Faces", cat: "identity", out: "image", desc: "Ad-ready spokesperson based on your photo.", inputs: photo,
    text: { label: "Brand / product", placeholder: "A fintech app for small businesses" },
    steps: [nano((i) => `Ad-ready commercial spokesperson portrait of this person for ${i.text}: confident, approachable, polished wardrobe and lighting, clean branded backdrop. ${KEEP}`)] },

  // ---------- Ads & Products ----------
  ...([
    ["bullet-time-scene", "Bullet Time Scene", "360° freeze-frame spin around your product in a dynamic scene.", "The product on a pedestal in a dramatic cinematic environment matching its brand.", "Bullet-time: time freezes and the camera orbits 360° around the product."],
    ["bullet-time-white", "Bullet Time White", "Matrix-style 360° spin on clean white.", "The product floating in an infinite clean white studio.", "Bullet-time freeze, camera orbits 360° around the product on white."],
    ["bullet-time-splash", "Bullet Time Splash", "360° freeze with a dramatic water splash.", "The product mid-air inside a frozen crown of water splash, droplets everywhere.", "Time is frozen; the camera orbits 360° around the product and the suspended water splash."],
    ["billboard", "Billboard Ad", "Your product on a giant city billboard.", "A giant outdoor billboard in a busy city at dusk showing the product as the ad.", "Cinematic drone shot rising toward the billboard as city traffic moves below."],
    ["truck-ad", "Truck Ad", "Your product on a moving truck billboard.", "A branded delivery truck whose side is a big ad featuring the product, on a city street.", "The truck drives through the city, camera tracking alongside."],
    ["giant-product", "Giant Product", "Your product towering over a city skyline.", "The product as a gigantic skyscraper-sized object standing in a city, people tiny below.", "Epic slow push-in, clouds drifting, people looking up."],
    ["graffiti-ad", "Graffiti Ad", "Your product as bold street-art graffiti.", "A huge colorful graffiti mural of the product painted on a city wall.", "Camera slides along the wall revealing the mural, spray paint mist in the air."],
    ["fridge-ad", "Fridge Ad", "Your product in an opening fridge.", "The product on the lit shelf of an open fridge, fresh and cold with condensation.", "The fridge door swings open, cold mist rolls out, the product glows."],
    ["volcano-ad", "Volcano Ad", "Your product erupting from a volcano.", "The product rising from an erupting volcano, lava and sparks around it.", "Dramatic eruption, the product launches upward in slow motion."],
    ["packshot", "Packshot", "A polished final-frame product shot for your ad.", "A premium advertising packshot of the product on a clean surface with soft reflections.", "Slow elegant turntable rotation, light sweep across the product."],
    ["poster", "Poster", "A bold poster-style ad visual.", "A bold graphic poster ad featuring the product, strong typography space and color blocks.", "Subtle parallax camera move across the poster, light flicker."],
    ["macroshot-product", "Macroshot Product", "Extreme close-up detail shots.", "Extreme macro close-up of the product's texture and details, shallow depth of field.", "Slow macro slide across the surface with rack focus."],
    ["macroshot-scene", "Macro Scene", "Close-ups with a lifestyle backdrop.", "Close-up of the product in a stylish lifestyle setting matching its brand.", "Gentle macro push-in, background bokeh shifting."],
    ["chameleon", "Chameleon", "Color-shifting product transformation.", "The product in a vivid studio.", "The product's colors shift through a vibrant iridescent chameleon spectrum while the camera circles."],
    ["magic-button", "Magic Button", "A magical button press reveals your product.", "A hand about to press a glowing red button on a pedestal, the product nearby.", "The button is pressed and the product appears in a burst of magical particles."],
    ["kick-ad", "Kick Ad", "Your product wins; the rival gets kicked out.", "The product standing proudly next to a generic unbranded rival product on a table.", "A foot kicks the rival product off the table while the hero product stays, comedic slow motion."],
  ] as const).map(([id, name, desc, scene, motion]): App => ({ id, name, cat: "ads", out: "video", desc, inputs: product, steps: productAd(`${scene} Use the product from image 1.`, motion) })),
  { id: "asmr-classic", name: "ASMR Classic", cat: "ads", out: "video", desc: "An ASMR video with gentle whispers and sounds.", inputs: photo,
    steps: [animate("Soft ASMR video: gentle whispering, tapping and crinkling sounds, close-up, calm and intimate, warm light.", 8)] },
  { id: "asmr-host", name: "ASMR Host", cat: "ads", out: "video", desc: "Your photo as a whispering ASMR presenter.", inputs: photo,
    steps: [nano(`This person as an ASMR host at a cozy studio desk with a professional binaural microphone, soft lighting. ${KEEP}`, false),
      animate("The host leans toward the microphone and whispers softly to camera, gentle hand movements, calm ASMR sounds.", 8)] },
  { id: "asmr-add-on", name: "ASMR Add-On", cat: "ads", out: "video", desc: "Your character presents your product in an ASMR scene.",
    inputs: [["start", "Character photo"], ["end", "Product photo"]],
    steps: [nano(`The person from image 1 at a cozy ASMR studio desk holding the product from image 2 near a binaural microphone. ${KEEP} The product keeps its exact label.`, false),
      animate("ASMR product showcase: gentle tapping on the product, soft whispers, slow hand movements, satisfying sounds.", 8)] },

  // ---------- Video Editing ----------
  { id: "clipcut", name: "ClipCut", cat: "edit", out: "video", desc: "One selfie → an outfit-change reel.", inputs: photo,
    steps: [animate(`Vertical fashion reel: the person changes into a different stylish outfit on every beat with snappy cut transitions, upbeat music. ${KEEP}`, 10)] },
  { id: "urban-cuts", name: "Urban Cuts", cat: "edit", out: "video", desc: "Beat-synced street outfit transitions.", inputs: photo,
    steps: [animate(`Urban street-style video: fast beat-synced outfit transitions in city locations, hip-hop beat, dynamic handheld camera. ${KEEP}`, 10)] },
  { id: "japanese-show", name: "Japanese Show", cat: "edit", out: "image", desc: "A retro 2000s Japanese TV variety show panel.", inputs: photo,
    steps: [nano(`This person as a guest on a 2000s Japanese TV variety show: 4-panel retro broadcast collage, CRT scanlines, colorful studio, big Japanese subtitles and reaction captions. ${KEEP}`)] },

  // ---------- Games & Characters ----------
  { id: "game-dump", name: "Game Dump", cat: "games", out: "image", desc: "You in 9 iconic video-game styles.", inputs: photo,
    steps: [nano(grid("this person as a character in 9 iconic video game art styles (8-bit pixel, open-world crime, tactical shooter, fantasy RPG, anime fighter, life sim, kart racer, voxel block, survival horror) each with in-game HUD"))] },
  ...([
    ["nano-strike", "Nano Strike", "Tactical shooter character.", "This person as a tactical shooter video game character with armor and gear in a gritty combat map, game HUD.", "In-game third-person shot, the character moves tactically, gunfire flashes, game UI visible."],
    ["nano-theft", "Nano Theft", "Open-world crime game style.", "This person as a GTA-style open-world game character, bold loading-screen poster art.", "Game cutscene: the character walks away from an explosion in slow motion, city at sunset."],
    ["simlife", "Simlife", "A life-sim game character.", "This person as a stylized 3D life-simulation game character with a green plumbob above their head and life-sim UI.", "Idle animation in a life-sim house, UI needs bars moving, playful music."],
    ["plushies", "Plushies", "You as an adorable plushie.", "This person as a soft knitted plush doll, fuzzy yarn texture, cute proportions.", "The plushie waves and wobbles adorably, soft stop-motion feel."],
    ["3d-render", "3D Render", "A polished 3D character render.", "This person as a high-quality stylized 3D animated-movie character, studio lighting.", "The 3D character smiles and turns toward camera, animated-film quality."],
    ["3d-figure", "3D Figure", "A collectible figurine with packaging.", "This person as a detailed 1/7 scale collectible figure on a desk next to its retail box with their image on it.", "Slow camera orbit around the figurine, soft desk light."],
    ["pixel-game", "Pixel Game", "An 8-bit retro game run.", "This person as an 8-bit pixel-art platformer character in a retro game level.", "Side-scrolling 8-bit gameplay: the character runs and jumps collecting coins, chiptune music."],
    ["brick-cube", "Brick Cube", "A toy-block brick figure.", "This person as a toy brick minifigure in a brick-built world.", "The brick figure walks with stop-motion toy animation."],
  ] as const).map(([id, name, desc, look, motion]): App => ({ id, name, cat: "games", out: "video", desc, inputs: photo, steps: restyleThenAnimate(look, motion) })),
  { id: "sketch-to-real", name: "Sketch-to-Real", cat: "games", out: "video", desc: "Hand-drawn sketch → lifelike video.", inputs: [["start", "Your sketch"]],
    steps: [nano("Turn this sketch into a photorealistic image, keeping the exact composition and design.", false), animate("The scene comes to life with natural realistic motion.")] },

  // ---------- Trending Templates ----------
  ...([
    ["this-is-fine", "On Fire", "The iconic 'This is Fine' meme.", "This person calmly sitting at a table with a coffee mug in a room engulfed in flames, 'This is fine' meme style.", "Flames spread around while the person sips coffee calmly and smiles."],
    ["skibidi", "Skibidi", "The viral toilet meme.", "This person's head popping out of a toilet bowl in a bathroom, skibidi meme style.", "The head bobs out of the toilet and sings a silly tune, meme energy."],
    ["mukbang", "Mukbang", "A viral eating show.", "This person at a mukbang table covered with huge amounts of food, streaming setup.", "Mukbang eating show: they eat enthusiastically, crunchy ASMR sounds, reacting to camera."],
    ["cloud-surf", "Cloud Surf", "Surfing dreamy pink clouds.", "This person surfing a board on a sea of dreamy pink clouds at sunset.", "They surf smoothly over the clouds, hair blowing, dreamy camera tracking."],
    ["idol", "Idol", "A K-pop idol moment.", "This person as a K-pop idol on a concert stage with lights and fans.", "Idol performance: signature dance move and wink to camera, crowd cheering, stage lights."],
    ["yes-kiss", "Yes Kiss", "A humorous viral kiss scene.", "This person in a romantic movie scene.", "Comedic viral moment: they lean in dramatically for a kiss and it turns funny, sitcom energy."],
    ["latex", "Latex", "High-fashion glossy black latex.", "This person in a glossy black latex high-fashion outfit, editorial studio.", "Slow high-fashion pose changes, glossy reflections, dramatic light."],
    ["j-magazine", "J-Magazine", "A Japanese magazine cover.", "This person on the cover of a stylish Japanese fashion magazine with authentic editorial typography.", "Pages flutter and the cover comes alive, the person strikes a pose."],
    ["j-poster", "J-Poster", "A Japanese-style poster.", "This person on a bold Japanese-style poster with anime-inspired graphics and typography.", "Graphic elements animate around the person, anime energy."],
    ["roller-coaster", "Roller Coaster", "A wild theme-park ride.", "This person in the front seat of a roller coaster.", "The coaster plunges down, they scream and laugh, wind blasting, fast camera."],
    ["60s-cafe", "60s Cafe", "A vintage 1960s coffee shop.", "This person in a 1960s diner-style cafe, retro film look.", "Warm vintage film scene: they sip coffee and smile, jukebox music."],
    ["victory-card", "Victory Card", "A winner celebration card.", "This person on a winner celebration card with a trophy, confetti and bold graphics.", "Confetti bursts, the trophy is lifted, triumphant music."],
    ["sand-worm", "Sand Worm", "A giant desert creature emerges.", "This person standing in a vast desert at dusk.", "A colossal sand worm erupts from the dunes behind them, sand pouring, epic scale."],
    ["storm-creature", "Storm Creature", "A monster in a lightning storm.", "This person in a dark storm with lightning.", "Lightning flashes reveal a giant looming monster behind them, thunder and rain."],
    ["burning-sunset", "Burning Sunset", "An epic fire-lit sunset.", "This person silhouetted against an epic burning orange sunset sky.", "The sky blazes, embers drift, slow cinematic push-in."],
    ["comic-book", "Comic Book", "A comic strip panel.", "This person as a comic book hero in a panel with bold ink lines and halftone dots.", "Comic panels animate with action lines and sound-effect text popping."],
    ["melting-doodle", "Melting Doodle", "A surreal drip-art dissolve.", "This person in a colorful doodle art style.", "The image melts into surreal dripping doodles, trippy hypnotic motion."],
    ["giallo-horror", "Giallo Horror", "An Italian horror film scene.", "This person in a 1970s Italian giallo horror film scene, saturated red and blue light.", "Suspenseful slow zoom, a shadow passes, eerie synth music."],
    ["renaissance", "Renaissance", "A classical oil painting.", "This person as a Renaissance oil painting with rich textures and dramatic chiaroscuro.", "The painting subtly comes alive: breathing, candlelight flicker."],
    ["rapgod", "Rap God", "An epic rap performance.", "This person as a rapper in a recording studio with neon lights and a mic.", "Rap performance with a hard beat, confident gestures to camera, studio lights pulsing."],
    ["mascot", "Mascot", "A fun brand mascot character.", "This person as a cute cartoon brand mascot character.", "The mascot waves and dances energetically, cheerful music."],
  ] as const).map(([id, name, desc, look, motion]): App => ({ id, name, cat: "trending", out: "video", desc, inputs: photo, steps: restyleThenAnimate(look, motion) })),

  // ---------- Extras ----------
  { id: "remove-bg", name: "Background Remover", cat: "extras", out: "image", desc: "Clean cutout of any photo (under 5 MB).", inputs: photo,
    steps: [(i) => ({ modelId: "remove-bg", params: { start: i.start } })] },
  { id: "meme-generator", name: "AI Meme Generator", cat: "extras", out: "image", desc: "Turn any photo into a meme.", inputs: photo,
    text: { label: "Meme idea or caption", placeholder: "When the client says 'quick change'…" },
    steps: [nano((i) => `Turn this photo into a funny viral meme with bold white Impact-style caption text: "${i.text}". ${KEEP}`)] },
  { id: "signboard", name: "Signboard", cat: "extras", out: "image", desc: "Your photo as a massive outdoor billboard.", inputs: photo,
    steps: [nano("Ultra-realistic photo of a massive outdoor billboard in a city displaying this exact image as the ad.")] },
  { id: "micro-beasts", name: "Micro-Beasts", cat: "extras", out: "image", desc: "Surround yourself with tiny cute animals.", inputs: photo,
    steps: [nano(`This person surrounded by dozens of tiny adorable animals (kittens, bunnies, ducklings) climbing on them. ${KEEP}`)] },
  { id: "paint-app", name: "Paint App", cat: "extras", out: "image", desc: "Your image inside a retro 90s paint program.", inputs: photo,
    steps: [nano("This image redrawn as crude retro MS Paint-style art inside a 90s paint application window on a vintage CRT monitor.")] },
];

export const appById = (id: string) => APPS.find((a) => a.id === id);
export const stepsOf = (app: App, input: AppInput) => (typeof app.steps === "function" ? app.steps(input) : app.steps);

// Resolve step `n` of an app into a full model call (fills defaults the step didn't set).
export function appStep(app: App, n: number, input: AppInput, prev?: string) {
  const { modelId, params } = stepsOf(app, input)[n](input, prev);
  const m = byId(modelId);
  if (!m) throw new Error(`App ${app.id}: unknown model ${modelId}`);
  const full: Params = { prompt: "", duration: m.durations[0] ?? 0, aspect: m.aspects[0], resolution: defaultRes(m), audio: true, ...params };
  return { m, params: full };
}

export function appCost(app: App, input: AppInput) {
  return stepsOf(app, input).reduce((sum, _, n) => {
    const { m, params } = appStep(app, n, input, "https://prev");
    return sum + estimateUsd(m, params.duration > 0 ? params.duration : 10, params.resolution);
  }, 0);
}
