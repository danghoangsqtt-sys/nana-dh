
// This file is deprecated in favor of liveService.ts for the main application logic.
// Keeping it as a placeholder if we need standard text-generation utilities later.

import { GoogleGenAI } from "@google/genai";

const getAiClient = () => {
  const apiKey = process.env.API_KEY;
  if (!apiKey) {
    throw new Error("API_KEY is not defined in the environment.");
  }
  return new GoogleGenAI({ apiKey });
};

// Simple helper for one-off text generation (e.g. summarization) if needed
export const generateSimpleText = async (prompt: string) => {
  const ai = getAiClient();
  const response = await ai.models.generateContent({
    model: 'gemini-2.5-flash',
    contents: prompt
  });
  return response.text;
};
