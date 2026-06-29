import axios from "axios";
import { NewsArticle } from "@/types/investment";

export async function fetchCompanyNews(company: string): Promise<NewsArticle[]> {
  try {
    const response = await axios.post(
      "https://api.tavily.com/search",
      {
        api_key: process.env.TAVILY_API_KEY,
        query: `${company} stock news market updates analysis`,
        max_results: 6,
        topic: "news",
        days: 10,
      }
    );

    const results = response.data?.results || [];
    return results.map((item: any) => {
      let sourceName = "News Source";
      try {
        sourceName = new URL(item.url).hostname.replace("www.", "");
      } catch {
        // Fallback if URL is invalid
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
