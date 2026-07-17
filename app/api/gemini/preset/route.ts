import { GoogleGenAI, Type } from "@google/genai";
import { NextRequest, NextResponse } from "next/server";

// Initialize Gemini Client on the Server
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    }
  }
});

export async function POST(req: NextRequest) {
  try {
    const { prompt, locale = "en" } = await req.json();

    if (!prompt) {
      return NextResponse.json({ error: "Prompt is required" }, { status: 400 });
    }

    const outputLanguage = locale === "id" ? "Bahasa Indonesia" : "English";
    const systemInstruction = `You are a professional video transcoding expert and FFmpeg command engineer.
Return the human-readable name and description in ${outputLanguage}. Keep codec names, file formats, and FFmpeg flags in their standard technical form.
Your task is to translate a user's natural language request (e.g. "compress for discord under 8mb", "make a high quality fast action webm", "convert to high quality vertical 60fps clip") into a structured video encoding preset.

You must return a JSON object with the following fields:
- "name": A concise, descriptive name for the preset (e.g., "Discord 8MB Optimizer", "60fps HQ Vertical WebM")
- "description": A clear explanation of what this preset does and why it was configured this way.
- "category": Categorize it as "compatible", "size", "hq", "audio", "gif", or "custom".
- "ffmpegArgs": An array of FFmpeg command-line arguments to achieve this transcode (DO NOT include "ffmpeg -i input.mp4" or the final output filename. Just the arguments in-between, e.g. ["-c:v", "libx264", "-preset", "veryfast", "-crf", "28", "-vf", "scale=-2:480", "-c:a", "aac", "-b:a", "96k"]).
- "settings": An object detailing the specifications:
  - "format": The file container format. Allowed values: "mp4", "webm", "gif", "mp3", "aac", "mkv".
  - "vcodec": The video codec. Allowed values: "h264", "vp9", "hevc", "gif", "none".
  - "acodec": The audio codec. Allowed values: "aac", "opus", "mp3", "none".
  - "resolution": The output resolution target. Allowed values: "1080p", "720p", "480p", "360p", "original".
  - "fps": Target frame rate as a number (e.g. 15, 24, 30, 60).
  - "vbitrate": Target video bitrate string (e.g., "1200k", "2500k", "500k", "auto").
  - "abitrate": Target audio bitrate string (e.g., "128k", "192k", "64k", "auto").
  - "audioEnabled": Boolean whether audio is kept.
  - "volume": Volume multiplier as a float (e.g. 1.0 for normal, 0.5 for half, 2.0 for double).

For Discord or limits like "under 8MB", "under 25MB", reduce resolution to 480p or 360p, use H264 or VP9, and calculate appropriate low bitrates.
Ensure your FFmpeg arguments are highly compatible and work correctly in FFmpeg.wasm. Use standard filter graphs where appropriate (e.g., for scaling use "-vf", "scale=-2:720" or similar).`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: `Translate this user request into a video encoding preset: "${prompt}"`,
      config: {
        systemInstruction,
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          required: ["name", "description", "category", "ffmpegArgs", "settings"],
          properties: {
            name: { type: Type.STRING },
            description: { type: Type.STRING },
            category: { type: Type.STRING },
            ffmpegArgs: {
              type: Type.ARRAY,
              items: { type: Type.STRING }
            },
            settings: {
              type: Type.OBJECT,
              required: ["format", "vcodec", "acodec", "resolution", "fps", "vbitrate", "abitrate", "audioEnabled", "volume"],
              properties: {
                format: { type: Type.STRING },
                vcodec: { type: Type.STRING },
                acodec: { type: Type.STRING },
                resolution: { type: Type.STRING },
                fps: { type: Type.INTEGER },
                vbitrate: { type: Type.STRING },
                abitrate: { type: Type.STRING },
                audioEnabled: { type: Type.BOOLEAN },
                volume: { type: Type.NUMBER }
              }
            }
          }
        }
      }
    });

    const presetText = response.text;
    if (!presetText) {
      throw new Error("Empty response from Gemini API");
    }

    const presetData = JSON.parse(presetText);
    return NextResponse.json(presetData);
  } catch (error: any) {
    console.error("Gemini Preset API Error:", error);
    return NextResponse.json({ error: error.message || "Failed to generate preset" }, { status: 500 });
  }
}
