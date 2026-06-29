import { searchCompany } from "@/tools/tavilyTool";
import { fetchCompanyNews } from "@/tools/newsTool";
import { analyzeSentiment } from "@/tools/sentimentTool";
import { CompanyResearch } from "@/types/investment";

export async function researchNode(state: any) {
  const company = state.company;

  console.log(`[researchNode] Starting research on "${company}"...`);
  
  // Fetch general search results and news concurrently
  const [generalRes, news] = await Promise.all([
    searchCompany(company).catch((err) => {
      console.error("General research search failed:", err);
      return null;
    }),
    fetchCompanyNews(company).catch((err) => {
      console.error("News fetch failed:", err);
      return [];
    }),
  ]);

  // Run sentiment analysis on retrieved news
  const sentiment = await analyzeSentiment(news).catch((err) => {
    console.error("Sentiment analysis failed:", err);
    return {
      score: 0,
      label: "Neutral" as const,
      summary: "Sentiment analysis failed due to internal error.",
    };
  });

  const generalAnalysis =
    generalRes?.results
      ?.map((r: any) => `Source: ${r.title}\nContent: ${r.content}`)
      .join("\n\n") || "No general research details found.";

  const research: CompanyResearch = {
    news,
    sentiment,
    generalAnalysis,
  };

  return {
    research,
  };
}