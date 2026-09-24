const { GoogleGenAI } = require("@google/genai");

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const askGemini = async (req, res) => {
  if (!process.env.GEMINI_API_KEY) {
    return res.status(503).json({ message: "Gemini is not configured. Set GEMINI_API_KEY in the backend environment." });
  }

  const prompt = typeof req.body?.prompt === "string" ? req.body.prompt.trim() : "";
  if (!prompt) return res.status(400).json({ message: "Prompt is required" });
  if (prompt.length > 8000) return res.status(400).json({ message: "Prompt cannot exceed 8000 characters" });

  try {
    const response = await ai.models.generateContent({
      model: "gemini-3.8-flash",
      contents: prompt,
    });

    const answer = response.text;
    if (!answer || !answer.trim()) {
      return res.status(502).json({ message: "Gemini returned an empty response" });
    }

    return res.json({ answer });
  }
  catch (error) {
    console.error("Gemini request failed", error);
    return res.status(502).json({ message: error.message || "Unable to reach Gemini" });
  }
};

module.exports = { askGemini };
