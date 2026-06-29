import { searchCompany } from "@/tools/tavilyTool";

/**
 * researchNode — general company research node.
 * Fetches an overview of the company's business model, market position,
 * and competitive landscape via Tavily web search.
 * News fetching and sentiment are handled separately by newsNode.
 */
export async function researchNode(state: any) {
  const company = state.company;
  console.log(`[researchNode] Starting web research on "${company}"...`);

  const generalRes = await searchCompany(company).catch((err) => {
    console.error("[researchNode] General web search failed:", err);
    return null;
  });

  const generalAnalysis =
    generalRes?.results
      ?.map((r: any) => `Source: ${r.title}\nContent: ${r.content}`)
      .join("\n\n") || "No general research details found.";

  // Initialise research state with just general analysis.
  // newsNode will add news[] and sentiment later in the pipeline.
  return {
    research: {
      news: [],
      sentiment: { score: 0, label: "Neutral", summary: "" },
      generalAnalysis,
    },
  };
}