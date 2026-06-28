import axios from "axios";

export async function getFinancialData(
  company: string
) {
  try {
    const apiKey =
      process.env.MASSIVE_API_KEY;

    const response =
      await axios.get(
        "https://api.polygon.io/v3/reference/tickers",
        {
          params: {
            search: company,
            limit: 1,
            active: true,
            apiKey,
          },
        }
      );

    const ticker =
      response.data?.results?.[0];

    if (!ticker) {
      return {
        error: "No ticker found",
      };
    }

    return {
      symbol: ticker.ticker,
      companyName: ticker.name,
      market: ticker.market,
      locale: ticker.locale,
      active: ticker.active,
    };
  } catch (error: any) {
    return {
      error: error.message,
    };
  }
}