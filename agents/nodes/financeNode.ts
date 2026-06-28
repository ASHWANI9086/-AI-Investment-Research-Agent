import { getFinancialData }
from "@/tools/yahooTool";

export async function financeNode(
  state: any
) {
  const financials =
    await getFinancialData(
      state.company
    );

  return {
    ...state,
    financials,
  };
}