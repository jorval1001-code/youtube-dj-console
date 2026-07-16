import { runGeminiControl } from "../lib/geminiControl.js";

// Gemini calls (plus the one short retry in runGeminiControl) can occasionally run longer than
// the platform's default function timeout — give it explicit headroom.
export const config = { maxDuration: 30 };

export default async function handler(req: any, res: any) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY is not defined in environment variables");
    }

    const { currentState, prompt } = req.body;
    const result = await runGeminiControl(currentState, prompt, apiKey);
    res.status(200).json(result);
  } catch (err: any) {
    console.error("Gemini API Error:", err);
    res.status(500).json({ error: err.message || "Failed to communicate with Gemini" });
  }
}
