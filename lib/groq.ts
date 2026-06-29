import { ChatGroq } from "@langchain/groq";
import fs from "fs";
import path from "path";

let apiKey = process.env.GROQ_API_KEY;

// Force override process.env using .env.local to bypass stale system environment variables
try {
  const envPath = path.join(process.cwd(), ".env.local");
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, "utf8");
    // Match GROQ_API_KEY lines
    const match = envContent.match(/^GROQ_API_KEY\s*=\s*([^\r\n]+)/m);
    if (match && match[1]) {
      const localKey = match[1].trim();
      if (localKey) {
        apiKey = localKey;
        console.log("[lib/groq] Successfully overrode system environment with .env.local key.");
      }
    }
  }
} catch (error: any) {
  console.warn("[lib/groq] Failed to override API key from .env.local:", error.message);
}

export const groq = new ChatGroq({
  apiKey: apiKey!,
  model: "llama-3.3-70b-versatile",
  temperature: 0.2,
});