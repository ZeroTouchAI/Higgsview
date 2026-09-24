// Prints one FLUX prompt per app/effect for the gallery thumbnails (public/thumbs/<id>.jpg).
import { APPS } from "../lib/apps.ts";

const person = "a stylish young woman";
const product = "a sleek luxury perfume bottle";
const out = APPS.map((a) => {
  const desc = a.desc
    .replace(/your product/gi, product).replace(/your photo|your image|your portrait|any photo|a photo/gi, `a portrait of ${person}`)
    .replace(/\byourself\b|\byou\b/gi, person).replace(/\byour\b/gi, "the").replace(/The subject/g, person);
  const subject = a.cat === "ads" ? product : person;
  return { id: a.id, prompt: `Striking square social-media thumbnail that shows the "${a.name}" AI effect: ${desc} Subject: ${subject}. Vivid, cinematic lighting, high detail, no text, no watermark.` };
});
console.log(JSON.stringify(out));
