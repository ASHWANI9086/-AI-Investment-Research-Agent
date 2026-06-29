import axios from "axios";
import { groq } from "@/lib/groq";
import { FinancialData, ChartPoint } from "@/types/investment";

// Helper to hash ticker strings into deterministic seeds (only used for chart fallback)
function getSeedFromString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return Math.abs(hash);
}

// Fallback chart data ONLY (never used for financial ratios)
function generateFallbackChartData(seed: number, baseVal: number): ChartPoint[] {
  const points = 30;
  return Array.from({ length: points }).map((_, i) => {
    const date = new Date();
    date.setDate(date.getDate() - (points - i) * 3);
    const drift = ((seed * (i + 1)) % 100 - 50) / 1000 * baseVal;
    const close = Math.max(0.01, baseVal + drift);
    return {
      date: date.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      close: parseFloat(close.toFixed(2)),
      volume: Math.floor(((seed * (i + 7)) % 5000000)) + 500000,
    };
  });
}

export async function getFinancialData(company: string): Promise<FinancialData> {
  let symbol = "";
  let companyName = company;
  let market = "STOCKS";
  let locale = "usd";
  let active = true;

  // ─── Step 1: Resolve ticker via Yahoo Finance search ───────────────────────
  try {
    const searchUrl = `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(company)}`;
    const searchRes = await axios.get(searchUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36",
      },
      timeout: 8000,
    });
    const quotes = searchRes.data?.quotes || [];
    // Prefer equity (common stock) over ETFs/mutual funds
    const bestQuote = quotes.find((q: any) => q.quoteType === "EQUITY") || quotes[0];
    if (bestQuote) {
      symbol = bestQuote.symbol;
      companyName = bestQuote.shortname || bestQuote.longname || company;
      market = bestQuote.exchange || "STOCKS";
    }
  } catch (e: any) {
    console.warn(`[yahooTool] Yahoo search failed:`, e.message);
  }

  if (!symbol) {
    symbol = company.trim().toUpperCase().replace(/[^A-Z0-9.]/g, "").slice(0, 6) || "UNKNOWN";
    companyName = company;
  }

  const seed = getSeedFromString(symbol);

  // ─── Step 2: Fetch live price + 6-month chart from Yahoo Finance ───────────
  let price = 0;
  let change = 0;
  let changePercent = 0;
  let chartData: ChartPoint[] = [];

  try {
    const chartUrl = `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?range=6mo&interval=1d`;
    const chartRes = await axios.get(chartUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36",
      },
      timeout: 10000,
    });

    const result = chartRes.data?.chart?.result?.[0];
    if (result?.meta) {
      const meta = result.meta;
      price = meta.regularMarketPrice ?? 0;
      const prevClose = meta.chartPreviousClose ?? meta.previousClose ?? price;
      change = price - prevClose;
      changePercent = prevClose !== 0 ? (change / prevClose) * 100 : 0;
      if (meta.symbol) symbol = meta.symbol;
      // Store the raw currency string (e.g. "INR", "USD")
      if (meta.currency) locale = meta.currency.toLowerCase();
    }

    const timestamps: number[] = result?.timestamp || [];
    const closes: (number | null)[] = result?.indicators?.quote?.[0]?.close || [];
    const volumes: (number | null)[] = result?.indicators?.quote?.[0]?.volume || [];

    chartData = timestamps
      .map((t, i) => {
        const c = closes[i];
        if (c == null) return null;
        return {
          date: new Date(t * 1000).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
          close: parseFloat(c.toFixed(2)),
          volume: volumes[i] ?? 0,
        };
      })
      .filter(Boolean) as ChartPoint[];
  } catch (e: any) {
    console.warn(`[yahooTool] Yahoo chart fetch failed for ${symbol}:`, e.message);
  }

  if (chartData.length === 0 && price > 0) {
    chartData = generateFallbackChartData(seed, price);
  }

  // ─── Step 3: Fetch real financial metrics via Tavily + Groq extraction ──────
  // IMPORTANT: We do NOT inject any hardcoded/simulated numbers here.
  // If we cannot retrieve real data, we explicitly mark fields as undefined
  // so the UI/decision node knows the data is missing rather than showing fake values.
  let marketCap: number | undefined;
  let peRatio: number | undefined;
  let revenue: number | undefined;
  let netIncome: number | undefined;
  let profitMargin: number | undefined;
  let dataQuality: "live" | "estimated" | "unavailable" = "unavailable";

  try {
    console.log(`[yahooTool] Searching real financials for ${symbol} (${companyName})...`);
    const searchFin = await axios.post(
      "https://api.tavily.com/search",
      {
        api_key: process.env.TAVILY_API_KEY,
        query: `"${companyName}" ${symbol} annual revenue net income profit margin market cap P/E ratio 2024 2025 financial results`,
        max_results: 6,
      },
      { timeout: 12000 }
    );

    // Pass raw search content to the LLM with strict instructions NOT to fabricate
    const rawContent = (searchFin.data?.results || [])
      .map((r: any) => `SOURCE: ${r.url}\n${r.content}`)
      .join("\n\n---\n\n")
      .slice(0, 5000);

    const extractionPrompt = `You are a financial data extraction assistant.

TASK: Extract ONLY verified financial figures for "${companyName}" (ticker: ${symbol}) from the web search results below.

STRICT RULES:
1. ONLY use numbers explicitly stated in the source text. Do NOT estimate, calculate, or infer values.
2. If a metric is NOT found in the sources, return null for that field.
3. Convert all monetary values to USD (use rate: 1 USD = 83 INR for Indian stocks).
4. Return ONLY the JSON object. No markdown, no explanation.

WEB SEARCH RESULTS:
${rawContent}

Return this exact JSON structure with real extracted values or null:
{
  "marketCap": <number in USD or null>,
  "peRatio": <number or null>,
  "revenue": <annual/TTM revenue in USD or null>,
  "netIncome": <annual/TTM net income in USD or null>,
  "profitMargin": <percentage number like 18.5 or null>
}`;

    const extractionRes = await groq.invoke(extractionPrompt);
    const rawText = extractionRes.content as string;
    const jsonMatch = rawText.match(/\{[\s\S]*?\}/);
    if (!jsonMatch) throw new Error("No JSON found in Groq extraction response");

    const parsedFin = JSON.parse(jsonMatch[0]);

    // Only accept values that are actual numbers (not null/undefined)
    marketCap = typeof parsedFin.marketCap === "number" ? parsedFin.marketCap : undefined;
    peRatio = typeof parsedFin.peRatio === "number" ? parsedFin.peRatio : undefined;
    revenue = typeof parsedFin.revenue === "number" ? parsedFin.revenue : undefined;
    netIncome = typeof parsedFin.netIncome === "number" ? parsedFin.netIncome : undefined;
    profitMargin = typeof parsedFin.profitMargin === "number"
      ? parsedFin.profitMargin
      : revenue && netIncome
      ? parseFloat(((netIncome / revenue) * 100).toFixed(2))
      : undefined;

    // At least one metric must be real for us to claim live data
    const hasRealData = [marketCap, peRatio, revenue, netIncome, profitMargin].some(v => v !== undefined);
    dataQuality = hasRealData ? "live" : "unavailable";

    console.log(`[yahooTool] Extracted financials for ${symbol}:`, { marketCap, peRatio, revenue, profitMargin, dataQuality });
  } catch (finError: any) {
    console.warn("[yahooTool] Financial extraction failed:", finError.message);
    dataQuality = "unavailable";
    // No fallback injection — leave all ratios as undefined
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
    peRatio: peRatio != null ? parseFloat(peRatio.toFixed(2)) : undefined,
    revenue,
    netIncome: netIncome != null ? Math.round(netIncome) : undefined,
    profitMargin: profitMargin != null ? parseFloat(profitMargin.toFixed(2)) : undefined,
    ratiosSource: dataQuality === "live" ? "web_fallback" : "simulated",
    chartData,
  };
}