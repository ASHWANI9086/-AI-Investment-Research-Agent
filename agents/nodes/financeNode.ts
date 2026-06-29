import { getFinancialData } from "@/tools/yahooTool";

export async function financeNode(state: any) {
  const company = state.company;
  console.log(`[financeNode] Fetching financials for "${company}"...`);

  const financials = await getFinancialData(company).catch((err) => {
    console.error("Finance node fetch failed:", err);
    return {
      symbol: company.slice(0, 4).toUpperCase(),
      companyName: company,
      market: "STOCKS",
      locale: "us",
      active: true,
      error: err.message || "Failed to fetch financials.",
    };
  });

  return {
    financials,
  };
}