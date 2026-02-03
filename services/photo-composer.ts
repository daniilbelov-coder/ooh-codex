import { runVision } from "./replicate-client";

export interface PhotoLayout {
  photo_zone: "left" | "right" | "full";
  text_zone: "left" | "right" | "none";
  photo_x: number;           // translateX для imageTransform (0–1)
  photo_y: number;           // translateY для imageTransform (0–1)
  photo_scale: number;       // масштаб (>=1.0)
  split_ratio: number;       // доля ширины макета занимаемая фото (0–1)
}

const LAYOUT_PROMPT = `You are an advertising layout analyst.
Look at this outdoor advertising banner image.
Determine how the photo and text are arranged in the layout.
Return ONLY valid JSON, no text, no markdown, no code blocks:
{
  "photo_zone": "left" or "right" or "full",
  "text_zone": "left" or "right" or "none",
  "photo_x": number from 0 to 1 (horizontal center of photo, 0.5 = center),
  "photo_y": number from 0 to 1 (vertical center of photo, 0.5 = center),
  "photo_scale": number >= 1.0 (1.0 = photo exactly covers its zone),
  "split_ratio": number from 0 to 1 (fraction of total width occupied by photo)
}
Example: photo on right half, text on left -> photo_zone "right", text_zone "left", split_ratio 0.5
Full background photo -> photo_zone "full", split_ratio 1.0`;

export async function analyzeLayout(apiKey: string, masterScreenshot: Blob): Promise<PhotoLayout> {
  const raw = await runVision(apiKey, LAYOUT_PROMPT, masterScreenshot);
  const cleaned = raw.replace(/```json\n?/g, "").replace(/```/g, "").trim();
  return JSON.parse(cleaned) as PhotoLayout;
}
