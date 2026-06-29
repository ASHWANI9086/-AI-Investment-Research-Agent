import { fetchCompanyNews } from "@/tools/newsTool";
import { analyzeSentiment } from "@/tools/sentimentTool";
import { CompanyResearch } from "@/types/investment";

/**
 * newsNode — dedicated LangGraph node for news fetching + sentiment.
 * Runs after financeNode so the ticker symbol is available for more targeted queries.
 */
export async function newsNode(state: any) {
  const company = state.company;
  const symbol = state.financials?.symbol;
  // Use ticker-qualified query for better news relevance when available
  const query = symbol && symbol !== "UNKNOWN" ? `${company} ${symbol}` : company;

  console.log(`[newsNode] Fetching news for "${query}"...`);

  const news = await fetchCompanyNews(query).catch((err) => {
    console.error("[newsNode] News fetch failed:", err);
    return [];
  });

  const sentiment = await analyzeSentiment(news).catch((err) => {
    console.error("[newsNode] Sentiment analysis failed:", err);
    return {
      score: 0,
      label: "Neutral" as const,
      summary: "Sentiment analysis failed due to an internal error.",
    };
  });

  // Merge: keep generalAnalysis from researchNode, add fresh news + sentiment
  const research: CompanyResearch = {
    news,
    sentiment,
    generalAnalysis: state.research?.generalAnalysis || "No general research details found.",
  };

  console.log(`[newsNode] Fetched ${news.length} articles. Sentiment: ${sentiment.label} (${sentiment.score})`);

  return { research };
}
