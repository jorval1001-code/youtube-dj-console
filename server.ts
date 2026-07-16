import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";
import { runGeminiControl } from "./lib/geminiControl";

dotenv.config();

const app = express();
const PORT = 3002;

app.use(express.json());

// API route for Gemini co-pilot console control (local dev only — the deployed site on
// Vercel uses api/gemini-control.ts instead, since this Express server never runs there).
app.post("/api/gemini-control", async (req, res) => {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY is not defined in environment variables");
    }

    const { currentState, prompt } = req.body;
    const result = await runGeminiControl(currentState, prompt, apiKey);
    res.json(result);
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
