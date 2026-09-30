import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";
import { GoogleGenAI, Type } from "@google/genai";

dotenv.config();

const app = express();
const PORT = Number(process.env.PORT) || 3000;

app.use(express.json({ limit: "2mb" }));

// Lazy GoogleGenAI initialization
let aiClient: GoogleGenAI | null = null;
function getGenAI(): GoogleGenAI {
  if (!aiClient) {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error("GEMINI_API_KEY environment variable is missing.");
    }
    aiClient = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          "User-Agent": "aistudio-build",
        },
      },
    });
  }
  return aiClient;
}

// Health check endpoint
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

// Semantic Classification & Deep Risk Threat Analysis
app.post("/api/gemini/classify", async (req, res) => {
  try {
    const { emailText, sender, subject } = req.body;
    if (!emailText || typeof emailText !== "string") {
      return res.status(400).json({ error: "emailText string is required" });
    }

    const ai = getGenAI();
    const prompt = `Analyze this email for binary classification (SPAM vs HAM/LEGITIMATE), phishing threats, social engineering, and structural signals.
Sender: ${sender || "Unknown"}
Subject: ${subject || "None"}
Body:
"""
${emailText}
"""

Evaluate:
1. classification: "SPAM" or "HAM"
2. confidence: number between 0 and 1 (e.g. 0.98)
3. spamProbability: estimated spam probability from 0.0 to 1.0
4. primaryCategory: specific sub-type (e.g., "Phishing / Credential Harvest", "Advance-Fee (419)", "Urgent Impersonation (CEO/Helpdesk)", "Commercial Marketing / Newsletter", "Personal / Work Collaboration", "Transactional Receipt / Security Notification")
5. summary: 1-2 sentence executive verdict explaining why it's Ham or Spam
6. threatScores: numeric score 0-100 for:
   - phishingRisk (0-100)
   - urgencyPressure (0-100)
   - financialRisk (0-100)
   - impersonationRisk (0-100)
7. redFlags: list of specific red flags found (or empty array if clean ham)
8. greenFlags: list of trust/legitimacy signals found
9. keySuspiciousPhrases: list of exact phrases that triggered spam/phishing suspicion
10. recommendedAction: guidance for recipient (e.g., "Delete and block sender", "Do not click links; verify sender through external channel", "Safe to read and reply")`;

    const response = await ai.models.generateContent({
      model: "gemini-3.8-flash",
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            classification: { type: Type.STRING, enum: ["SPAM", "HAM"] },
            confidence: { type: Type.NUMBER },
            spamProbability: { type: Type.NUMBER },
            primaryCategory: { type: Type.STRING },
            summary: { type: Type.STRING },
            threatScores: {
              type: Type.OBJECT,
              properties: {
                phishingRisk: { type: Type.NUMBER },
                urgencyPressure: { type: Type.NUMBER },
                financialRisk: { type: Type.NUMBER },
                impersonationRisk: { type: Type.NUMBER },
              },
              required: ["phishingRisk", "urgencyPressure", "financialRisk", "impersonationRisk"],
            },
            redFlags: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
            },
            greenFlags: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
            },
            keySuspiciousPhrases: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
            },
            recommendedAction: { type: Type.STRING },
          },
          required: [
            "classification",
            "confidence",
            "spamProbability",
            "primaryCategory",
            "summary",
            "threatScores",
            "redFlags",
            "greenFlags",
            "keySuspiciousPhrases",
            "recommendedAction",
          ],
        },
      },
    });

    const parsed = JSON.parse(response.text || "{}");
    res.json(parsed);
  } catch (err: any) {
    console.error("Classification error:", err);
    res.status(500).json({
      error: err.message || "Failed to analyze email with Gemini API",
    });
  }
});

// "Spam-ify" or "Cleanse (Ham-ify)" rewriter
app.post("/api/gemini/rewrite", async (req, res) => {
  try {
    const { emailText, targetMode } = req.body;
    // targetMode: "spamify" or "cleanse"
    if (!emailText) {
      return res.status(400).json({ error: "emailText is required" });
    }

    const ai = getGenAI();
    let instruction = "";
    if (targetMode === "spamify") {
      instruction = `Rewrite this email so that it incorporates classic spam triggers (urgency, all-caps emphasis, deceptive incentives, pushy call-to-action) to test an email spam filter, while keeping the original context discernible.`;
    } else {
      instruction = `Rewrite this email into clean, professional, non-spammy HAM copy. Remove aggressive marketing cliches, eliminate spam-trigger words (like 'ACT NOW', '100% FREE', excessive exclamation marks), replace sensationalist phrasing with courteous, credible business communication that passes strict spam filters with high deliverability.`;
    }

    const response = await ai.models.generateContent({
      model: "gemini-3.8-flash",
      contents: `${instruction}\n\nOriginal Email:\n"""\n${emailText}\n"""`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            rewrittenSubject: { type: Type.STRING },
            rewrittenBody: { type: Type.STRING },
            changesMade: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
            },
            predictedImpact: { type: Type.STRING },
          },
          required: ["rewrittenSubject", "rewrittenBody", "changesMade", "predictedImpact"],
        },
      },
    });

    const parsed = JSON.parse(response.text || "{}");
    res.json(parsed);
  } catch (err: any) {
    console.error("Rewrite error:", err);
    res.status(500).json({ error: err.message || "Failed to rewrite email" });
  }
});

// Synthetic email generator for testing edge cases
app.post("/api/gemini/generate-synthetic", async (req, res) => {
  try {
    const { type } = req.body; // e.g. "phishing", "bec_fraud", "promotional_spam", "legit_work", "legit_personal"
    const ai = getGenAI();

    const response = await ai.models.generateContent({
      model: "gemini-3.8-flash",
      contents: `Generate a realistic synthetic email of type: "${type || "phishing"}". 
Include sender name and realistic email address, a realistic subject line, and full body text that demonstrates characteristic hallmarks of this category.`,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            sender: { type: Type.STRING },
            subject: { type: Type.STRING },
            body: { type: Type.STRING },
            targetLabel: { type: Type.STRING, enum: ["SPAM", "HAM"] },
            scenarioDescription: { type: Type.STRING },
          },
          required: ["sender", "subject", "body", "targetLabel", "scenarioDescription"],
        },
      },
    });

    const parsed = JSON.parse(response.text || "{}");
    res.json(parsed);
  } catch (err: any) {
    console.error("Synthetic generation error:", err);
    res.status(500).json({ error: err.message || "Failed to generate synthetic email" });
  }
});

// Start server with Vite middleware or static serving
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
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
