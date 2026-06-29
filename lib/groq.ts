import { ChatGroq } from "@langchain/groq";
import { getEnv } from "./env";

export const groq = new ChatGroq({
  apiKey: getEnv("GROQ_API_KEY"),
  model: "llama-3.3-70b-versatile",
  temperature: 0.2,
});

/** Second instance with slightly higher temperature for creative risk analysis */
export const groqCreative = new ChatGroq({
  apiKey: getEnv("GROQ_API_KEY"),
  model: "llama-3.3-70b-versatile",
  temperature: 0.5,
});