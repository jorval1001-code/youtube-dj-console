import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 3002;

app.use(express.json());

// Initialize Gemini if API key is present
const getGeminiClient = () => {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not defined in environment variables");
  }
  return new GoogleGenAI({ apiKey });
};

// API route for Gemini co-pilot console control
app.post("/api/gemini-control", async (req, res) => {
  try {
    const { currentState, prompt } = req.body;
    
    const ai = getGeminiClient();
    
    const systemPrompt = `You are "Gemini DJ AI Co-Pilot", a professional, smart assistant integrated directly into our virtual DJ console.
Your job is to analyze the current state of the DJ console and output exact, valid control commands to transition, blend, adjust, or mix the tracks according to the user's request.

You MUST respond strictly with a JSON object. Do not include any markdown fences (like \`\`\`json) or extra text.

The JSON response MUST have exactly this schema:
{
  "reasoning": "A short, stylish, and professional explanation in Spanish of what changes you are making and why, e.g. 'Reduciendo la ganancia del Deck A y cruzando progresivamente al Deck B para una transición suave y armónica.'",
  "actions": [
    // A list of actions to perform. You can include multiple actions. Each action must be one of the following:
    { "target": "deckA" | "deckB", "action": "play" | "pause" }
    { "target": "deckA" | "deckB", "action": "setVolume", "value": number } // range [0, 100]
    { "target": "deckA" | "deckB", "action": "setPitch", "value": number } // range [-10, 10]
    { "target": "deckA" | "deckB", "action": "loadTrack", "value": string } // value is the exact title or id of a track to load. ONLY load from the provided track list.
    { "target": "mixer", "action": "setCrossfader", "value": number } // range [-100, 100]
    { "target": "mixer", "action": "setGainA" | "setGainB", "value": number } // range [0, 100]
    { "target": "mixer", "action": "setFilterA" | "setFilterB", "value": number } // range [-50, 50]
    { "target": "mixer", "action": "setEqHighA" | "setEqHighB" | "setEqMidA" | "setEqMidB" | "setEqLowA" | "setEqLowB", "value": number } // range [-12, 12]
  ]
}

Available tracks in Library:
${JSON.stringify(currentState.library || [])}

Current Deck A State:
- Loaded Track: ${currentState.deckA?.track ? `"${currentState.deckA.track.title}" by ${currentState.deckA.track.artist} (BPM: ${currentState.deckA.track.bpm}, ID: ${currentState.deckA.track.id})` : "None"}
- Is Playing: ${currentState.deckA?.isPlaying || false}
- Current Volume: ${currentState.deckA?.volume || 0}
- Current Pitch: ${currentState.deckA?.pitch || 0}%

Current Deck B State:
- Loaded Track: ${currentState.deckB?.track ? `"${currentState.deckB.track.title}" by ${currentState.deckB.track.artist} (BPM: ${currentState.deckB.track.bpm}, ID: ${currentState.deckB.track.id})` : "None"}
- Is Playing: ${currentState.deckB?.isPlaying || false}
- Current Volume: ${currentState.deckB?.volume || 0}
- Current Pitch: ${currentState.deckB?.pitch || 0}%

Current Mixer State:
- Crossfader: ${currentState.mixer?.crossfader || 0} (-100 to 100, where -100 is pure Deck A, 100 is pure Deck B, 0 is center)
- Gain A: ${currentState.mixer?.gainA || 50} | Gain B: ${currentState.mixer?.gainB || 50}
- Filter A: ${currentState.mixer?.filterA || 0} | Filter B: ${currentState.mixer?.filterB || 0} (-50 to 50, 0 is bypass)
- EQ High A: ${currentState.mixer?.eqHighA || 0} | EQ High B: ${currentState.mixer?.eqHighB || 0} (-12 to 12)
- EQ Mid A: ${currentState.mixer?.eqMidA || 0} | EQ Mid B: ${currentState.mixer?.eqMidB || 0} (-12 to 12)
- EQ Low A: ${currentState.mixer?.eqLowA || 0} | EQ Low B: ${currentState.mixer?.eqLowB || 0} (-12 to 12)

User request: "${prompt || "Haz algo interesante para mezclar estas canciones o recomendar una nueva"}"
`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: systemPrompt,
      config: {
        responseMimeType: "application/json",
      },
    });

    const responseText = response.text || "{}";
    res.json(JSON.parse(responseText));
  } catch (err: any) {
    console.error("Gemini API Error:", err);
    res.status(500).json({ error: err.message || "Failed to communicate with Gemini" });
  }
});

// Vite middleware setup
async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
