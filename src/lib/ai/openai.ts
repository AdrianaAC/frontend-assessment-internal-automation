import OpenAI from "openai";

// Creates the OpenAI client used by the enrichment layer.
export function getOpenAIClient() {
  return new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    baseURL: process.env.OPENAI_BASE_URL,
  });
}
