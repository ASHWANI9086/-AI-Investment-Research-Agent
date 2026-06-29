import axios from "axios";
import { getEnv } from "@/lib/env";
import { NewsArticle } from "@/types/investment";

const TAVILY_API_KEY = getEnv("TAVILY_API_KEY");

export async function fetchCompanyNews(company: string): Promise<NewsArticle[]> {
  try {
    const response = await axios.post(
      "https://api.tavily.com/search",
      {
        api_key: TAVILY_API_KEY,
        query: `${company} stock news market updates earnings results 2025`,
        max_results: 8,
        topic: "news",
        days: 14,
      },
      { timeout: 15000 }
    );

    const results = response.data?.results || [];
    return results.map((item: any) => {
      let sourceName = "News Source";
      try {
        sourceName = new URL(item.url).hostname.replace("www.", "");
      } catch {
        // fallback — URL invalid
      }
      return {
        title: item.title || "Company News Update",
        url: item.url || "#",
        source: sourceName,
        snippet: item.content || "",
        publishedAt: item.published_date || new Date().toISOString(),
      };
    });
  } catch (error) {
    console.error("Error in fetchCompanyNews:", error);
    return [];
  }
}
