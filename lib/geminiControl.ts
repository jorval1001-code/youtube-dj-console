import { GoogleGenAI } from "@google/genai";

export async function runGeminiControl(currentState: any, prompt: string, apiKey: string) {
  const ai = new GoogleGenAI({ apiKey });

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

  // Gemini occasionally returns transient 503/429 "high demand" errors that clear up within
  // seconds — retry once with a short backoff instead of surfacing those as a hard failure.
  // Kept short/single so total latency stays well under the serverless function's time limit.
  const maxAttempts = 2;
  let lastError: unknown;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const response = await ai.models.generateContent({
        model: "gemini-3.5-flash",
        contents: systemPrompt,
        config: {
          responseMimeType: "application/json",
        },
      });

      const responseText = response.text || "{}";
      return JSON.parse(responseText);
    } catch (err: any) {
      lastError = err;
      const isTransient = /503|429|UNAVAILABLE|RESOURCE_EXHAUSTED|high demand/i.test(String(err?.message));
      if (!isTransient || attempt === maxAttempts - 1) throw err;
      await new Promise((resolve) => setTimeout(resolve, 700));
    }
  }
  throw lastError;
}
