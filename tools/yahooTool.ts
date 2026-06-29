import axios from "axios";
import { groq } from "@/lib/groq";
import { FinancialData, ChartPoint } from "@/types/investment";

// Helper to hash ticker strings into deterministic seeds
function getSeedFromString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return Math.abs(hash);
}

// Reusable mock chart data generator based on a deterministic walk
function generateMockChartData(seed: number, baseVal: number): ChartPoint[] {
  const mockPoints = 30;
  return Array.from({ length: mockPoints }).map((_, i) => {
    const date = new Date();
    date.setDate(date.getDate() - (mockPoints - i) * 3);
    
    // Generate a smooth deterministic price walk using seed and index
    const angle = (i / mockPoints) * Math.PI * 2;
    const trend = Math.sin(angle) * (baseVal * 0.1) + ((seed % 10) / 10) * baseVal * (i / mockPoints) * 0.15;
    const randomNoise = ((i * seed) % 17 - 8) / 100 * baseVal; // deterministic pseudo-random noise
    const closePrice = Math.max(1.0, baseVal + trend + randomNoise);

    return {
      date: date.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      close: parseFloat(closePrice.toFixed(2)),
      volume: Math.floor(((seed * (i + 1)) % 4000000)) + 1000000,
    };
  });
}

export async function getFinancialData(company: string): Promise<FinancialData> {
  let symbol = "";
  let companyName = company;
  let market = "STOCKS";
  let locale = "us";
  let active = true;

  // 1. Search Yahoo Finance for the best matching symbol (free, global ticker lookup)
  try {
    const searchUrl = `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(company)}`;
    const searchRes = await axios.get(searchUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
    });

    const quotes = searchRes.data?.quotes || [];
    // Prioritize equity listings (common stock) over ETFs or mutual funds
    const bestQuote = quotes.find((q: any) => q.quoteType === "EQUITY") || quotes[0];
    
    if (bestQuote) {
      symbol = bestQuote.symbol;
      companyName = bestQuote.shortname || bestQuote.longname || bestQuote.name || company;
      market = bestQuote.exchange || "STOCKS";
    }
  } catch (e: any) {
    console.warn(`[yahooTool] Yahoo symbol suggestion failed:`, e.message);
  }

  // 1b. Fallback to clean ticker guess if search was completely empty
  if (!symbol) {
    const cleanName = company.trim().toUpperCase().replace(/[^A-Z]/g, "");
    symbol = cleanName.slice(0, 4) || "STK";
    companyName = company;
  }

  const seed = getSeedFromString(symbol);

  // 2. Fetch price and 6-month aggregates from public Yahoo Finance chart API
  let price = 100.0;
  let change = 0.0;
  let changePercent = 0.0;
  let chartData: ChartPoint[] = [];

  try {
    const chartUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?range=6mo&interval=1d`;
    const chartRes = await axios.get(chartUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
    });

    const result = chartRes.data?.chart?.result?.[0];
    if (result) {
      const meta = result.meta;
      if (meta) {
        price = meta.regularMarketPrice || price;
        const prevClose = meta.chartPreviousClose || meta.previousClose || price;
        change = price - prevClose;
        changePercent = (change / prevClose) * 100;
        if (meta.symbol) symbol = meta.symbol;
        if (meta.currency) locale = meta.currency.toLowerCase();
      }

      const timestamps = result.timestamp || [];
      const quote = result.indicators?.quote?.[0] || {};
      const closes = quote.close || [];
      const volumes = quote.volume || [];

      // Parse chart aggregates, removing null days
      chartData = timestamps
        .map((t: number, i: number) => {
          const c = closes[i];
          if (c === null || c === undefined) return null;
          return {
            date: new Date(t * 1000).toLocaleDateString("en-US", {
              month: "short",
              day: "numeric",
            }),
            close: parseFloat(c.toFixed(2)),
            volume: volumes[i] || 0,
          };
        })
        .filter((pt: any) => pt !== null) as ChartPoint[];
    }
  } catch (e: any) {
    console.warn(`[yahooTool] Failed to fetch chart from Yahoo Finance for ${symbol}:`, e.message);
  }

  // Fallback to deterministic aggregates if Yahoo chart API returns empty
  if (chartData.length === 0) {
    chartData = generateMockChartData(seed, price);
  }

  // 3. Extract Ratios and Key Financial Metrics (Revenue, Net Income, P/E, Market Cap) via Tavily Search
  let marketCap: number | undefined;
  let peRatio: number | undefined;
  let revenue: number | undefined;
  let netIncome: number | undefined;
  let profitMargin: number | undefined;
  let ratiosSource: "polygon" | "web_fallback" | "simulated" = "web_fallback";

  try {
    console.log(`[yahooTool] Performing Web search for financials of ${symbol}...`);
    const searchFin = await axios.post("https://api.tavily.com/search", {
      api_key: process.env.TAVILY_API_KEY,
      query: `${symbol} ${companyName} current market cap PE ratio revenue net income profit margin quarterly annual statements 2025 2026`,
      max_results: 5,
    });

    const extractionPrompt = `
Given the company stock ticker "${symbol}" (${companyName}) and these web search results containing financial reports:
${JSON.stringify(searchFin.data)}

Extract the following financial statistics. 
CRITICAL: Convert all monetary values (Market Cap, Revenue, Net Income) to USD. If values are listed in INR or other currencies, convert them to USD (Approximate conversion: 1 USD = 83 INR, 1 Crore INR = 120,000 USD).
Provide clean absolute integers.

1. Market Capitalization (in USD)
2. P/E Ratio (Price-to-Earnings Ratio)
3. Revenue (annual/TTM in USD)
4. Net Income (annual/TTM in USD)
5. Profit Margin (Net Income / Revenue in %)

Return ONLY a valid JSON block matching this structure. Do not write markdown tags or extra text.

{
  "marketCap": 150000000000, // Number in USD
  "peRatio": 28.5, // Number
  "revenue": 45000000000, // Number in USD
  "netIncome": 8500000000, // Number in USD
  "profitMargin": 18.89 // Percentage number, e.g. 18.89
}
`;

    const extractionRes = await groq.invoke(extractionPrompt);
    const cleanExtractionText = (extractionRes.content as string).match(/\{[\s\S]*\}/)?.[0] || extractionRes.content as string;
    const parsedFin = JSON.parse(cleanExtractionText);

    marketCap = parsedFin.marketCap || undefined;
    peRatio = parsedFin.peRatio || undefined;
    revenue = parsedFin.revenue || undefined;
    netIncome = parsedFin.netIncome || undefined;
    profitMargin = parsedFin.profitMargin || (revenue && netIncome ? (netIncome / revenue) * 100 : undefined);
  } catch (finError: any) {
    console.warn("[yahooTool] Web extraction failed, generating deterministic financials:", finError.message);
    
    ratiosSource = "simulated";
    marketCap = (10 + (seed % 1490)) * 1e9;
    peRatio = 8 + (seed % 42) + (seed % 2 === 0 ? 0.3 : 0.7);
    revenue = (1 + (seed % 249)) * 1e9;
    profitMargin = 4 + (seed % 36) + (seed % 2 === 0 ? 0.25 : 0.65);
    netIncome = revenue * (profitMargin / 100);
  }

  return {
    symbol,
    companyName,
    market,
    locale,
    active,
    price: parseFloat(price.toFixed(2)),
    change: parseFloat(change.toFixed(2)),
    changePercent: parseFloat(changePercent.toFixed(2)),
    marketCap,
    peRatio: peRatio ? parseFloat(peRatio.toFixed(2)) : undefined,
    revenue,
    netIncome: netIncome ? Math.round(netIncome) : undefined,
    profitMargin: profitMargin ? parseFloat(profitMargin.toFixed(2)) : undefined,
    ratiosSource,
    chartData,
  };
}