import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { WebSocketServer } from "ws";
import { GoogleGenAI, LiveServerMessage, Modality, ThinkingLevel } from "@google/genai";
import dotenv from "dotenv";

dotenv.config();

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    }
  }
});

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // API Health Check
  app.get("/api/health", (req, res) => {
    res.json({ status: "ok" });
  });

  // Gemini Text Generation Endpoint
  app.post("/api/gemini/generate", async (req, res) => {
    try {
      const { model, contents, config, systemInstruction } = req.body;
      const response = await ai.models.generateContent({
        model: model || "gemini-3.1-pro-preview",
        contents,
        systemInstruction,
        ...config
      });
      res.json(response);
    } catch (err: any) {
      console.error("Gemini Generate Error:", err);
      res.status(500).json({ error: err.message });
    }
  });

  // Vite middleware for development
  let vite: any;
  if (process.env.NODE_ENV !== "production") {
    vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const server = app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });

  // WebSocket Server for Live API
  const wss = new WebSocketServer({ server, path: '/live' });

  wss.on("connection", async (clientWs) => {
    console.log("Client connected to Live API bridge");
    let session: any;

    clientWs.on("message", async (data) => {
      try {
        const msg = JSON.parse(data.toString());

        if (msg.type === 'setup') {
          // Initialize Gemini Live session
          session = await ai.live.connect({
            model: "gemini-3.1-flash-live-preview",
            config: {
              responseModalities: [Modality.AUDIO],
              speechConfig: {
                voiceConfig: { prebuiltVoiceConfig: { voiceName: msg.voice || "Zephyr" } },
              },
              systemInstruction: msg.systemInstruction || "You are a helpful, conversational AI assistant. Keep your responses concise and natural for a spoken conversation.",
              ...msg.config
            },
            callbacks: {
              onmessage: (message: LiveServerMessage) => {
                const audio = message.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
                if (audio) {
                  clientWs.send(JSON.stringify({ type: 'audio', data: audio }));
                }
                if (message.serverContent?.interrupted) {
                  clientWs.send(JSON.stringify({ type: 'interrupted' }));
                }
                
                // Handle text transcriptions if enabled
                const transcription = message.serverContent?.modelTurn?.parts[0]?.text;
                if (transcription) {
                    clientWs.send(JSON.stringify({ type: 'text', data: transcription }));
                }
                
                if (message.serverContent?.turnComplete) {
                   clientWs.send(JSON.stringify({ type: 'turnComplete' }));
                }
              },
              onclose: () => {
                console.log("Gemini session closed");
                clientWs.close();
              },
              onerror: (err) => {
                console.error("Gemini session error:", err);
                clientWs.send(JSON.stringify({ type: 'error', message: err.message }));
              }
            },
          });
          clientWs.send(JSON.stringify({ type: 'connected' }));
        } else if (msg.type === 'audio' && session) {
          session.sendRealtimeInput({
            audio: { data: msg.data, mimeType: "audio/pcm;rate=16000" },
          });
        } else if (msg.type === 'video' && session) {
          session.sendRealtimeInput({
            video: { data: msg.data, mimeType: "image/jpeg" },
          });
        } else if (msg.type === 'text' && session) {
          session.sendRealtimeInput({
            text: msg.data
          });
        }
      } catch (err) {
        console.error("WebSocket message error:", err);
      }
    });

    clientWs.on("close", () => {
      console.log("Client disconnected");
      if (session) {
        session.close();
      }
    });
  });
}

startServer();
