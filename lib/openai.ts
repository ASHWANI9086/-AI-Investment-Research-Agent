/**
 * Re-exports groq instances so callers can import from "@/lib/openai"
 * while we use Groq under the hood (drop-in model swap path).
 * If you later add an actual OpenAI key, swap ChatGroq → ChatOpenAI here.
 */
export { groq as openai, groqCreative } from "./groq";
