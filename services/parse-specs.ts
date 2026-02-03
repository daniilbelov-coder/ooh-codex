import { runVision } from "./replicate-client";

export interface AdSpecs {
  name: string;
  total_width_cm: number;
  total_height_cm: number;
  text_zone_width_cm: number | null;
  text_zone_height_cm: number | null;
  has_frame: boolean;
  dpi: number;
  color_mode: "CMYK" | "RGB";
  output_format: string;
  notes: string | null;
}

const PARSE_PROMPT = `You are a parser for outdoor advertising technical specifications.
From the provided image extract the following parameters and return ONLY valid JSON, no text, no markdown, no code blocks:
{
  "name": "surface name or format (e.g. BLB)",
  "total_width_cm": number,
  "total_height_cm": number,
  "text_zone_width_cm": number or null,
  "text_zone_height_cm": number or null,
  "has_frame": true or false,
  "dpi": number,
  "color_mode": "CMYK" or "RGB",
  "output_format": "TIF" or "PDF" or other,
  "notes": "string or null"
}
If a parameter cannot be determined set it to null.`;

export async function parseSpecs(apiKey: string, ttImageBlob: Blob): Promise<AdSpecs> {
  const raw = await runVision(apiKey, PARSE_PROMPT, ttImageBlob);
  const cleaned = raw.replace(/```json\n?/g, "").replace(/```/g, "").trim();
  return JSON.parse(cleaned) as AdSpecs;
}
