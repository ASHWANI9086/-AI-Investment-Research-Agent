import axios from "axios";
import { getEnv } from "@/lib/env";

const TAVILY_API_KEY = getEnv("TAVILY_API_KEY");

export async function searchCompany(company: string) {
  const response = await axios.post(
    "https://api.tavily.com/search",
    {
      api_key: TAVILY_API_KEY,
      query: `${company} company overview business model market position competitive analysis`,
      max_results: 6,
      search_depth: "advanced",
    },
    { timeout: 15000 }
  );

  return response.data;
}