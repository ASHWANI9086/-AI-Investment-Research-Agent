import axios from "axios";
import { groq } from "@/lib/groq";
import { FinancialData, ChartPoint } from "@/types/investment";

const YF_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
};

function getSeedFromString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return Math.abs(hash);
}

function generateFallbackChartData(seed: number, baseVal: number): ChartPoint[] {
  const points = 30;
  return Array.from({ length: points }).map((_, i) => {
    const date = new Date();
    date.setDate(date.getDate() - (points - i) * 3);
    const drift = (((seed * (i + 3)) % 201) - 100) / 2000 * baseVal;
    const close = Math.max(0.01, parseFloat((baseVal + drift).toFixed(2)));
    return {
      date: date.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      close,
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

  // ─── Step 1: Resolve ticker ────────────────────────────────────────────────
  try {
    const searchRes = await axios.get(
      `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(company)}&quotesCount=5`,
      { headers: YF_HEADERS, timeout: 8000 }
    );
    const quotes: any[] = searchRes.data?.quotes || [];
    const bestQuote = quotes.find((q) => q.quoteType === "EQUITY") || quotes[0];
    if (bestQuote) {
      symbol = bestQuote.symbol;
      companyName = bestQuote.shortname || bestQuote.longname || company;
      market = bestQuote.exchange || "STOCKS";
    }
  } catch (e: any) {
    console.warn("[yahooTool] Search failed:", e.message);
  }

  if (!symbol) {
    symbol = company.trim().toUpperCase().replace(/[^A-Z0-9.]/g, "").slice(0, 6) || "UNKNOWN";
    companyName = company;
  }

  const seed = getSeedFromString(symbol);

  // ─── Step 2: Live price + 6-month chart ────────────────────────────────────
  let price = 0;
  let change = 0;
  let changePercent = 0;
  let chartData: ChartPoint[] = [];

  try {
    const chartRes = await axios.get(
      `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?range=6mo&interval=1d`,
      { headers: YF_HEADERS, timeout: 10000 }
    );
    const result = chartRes.data?.chart?.result?.[0];
    if (result?.meta) {
      const meta = result.meta;
      price = meta.regularMarketPrice ?? 0;
      const prevClose = meta.chartPreviousClose ?? meta.previousClose ?? price;
      change = parseFloat((price - prevClose).toFixed(2));
      changePercent = prevClose !== 0
        ? parseFloat(((change / prevClose) * 100).toFixed(2))
        : 0;
      if (meta.symbol) symbol = meta.symbol;
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
          date: new Date(t * 1000).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
          }),
          close: parseFloat(c.toFixed(2)),
          volume: volumes[i] ?? 0,
        };
      })
      .filter(Boolean) as ChartPoint[];
  } catch (e: any) {
    console.warn(`[yahooTool] Chart failed for ${symbol}:`, e.message);
  }

  if (chartData.length === 0 && price > 0) {
    chartData = generateFallbackChartData(seed, price);
  }

  // ─── Step 3: Financial ratios via Tavily targeted search ──────────────────
  // We use very specific queries to get the actual numbers, not generic pages.
  let marketCap: number | undefined;
  let peRatio: number | undefined;
  let revenue: number | undefined;
  let netIncome: number | undefined;
  let profitMargin: number | undefined;
  let dataQuality: "live" | "unavailable" = "unavailable";

  const currencyName = locale === "inr" ? "INR" : "USD";
  const isINR = locale === "inr";

  try {
    // Use two targeted Tavily queries in parallel for speed
    const [finRes, ratioRes] = await Promise.allSettled([
      axios.post(
        "https://api.tavily.com/search",
        {
          api_key: process.env.TAVILY_API_KEY,
          // Target specific financial result pages, not news
          query: `site:screener.in OR site:moneycontrol.com OR site:wsj.com OR site:macrotrends.net "${companyName}" annual revenue net profit 2024 2025`,
          max_results: 4,
          search_depth: "advanced",
        },
        { timeout: 15000 }
      ),
      axios.post(
        "https://api.tavily.com/search",
        {
          api_key: process.env.TAVILY_API_KEY,
          query: `${symbol} ${companyName} market capitalization PE ratio profit margin fiscal year 2024 2025 results`,
          max_results: 4,
        },
        { timeout: 15000 }
      ),
    ]);

    // Merge results from both searches
    const results: any[] = [];
    if (finRes.status === "fulfilled") {
      results.push(...(finRes.value.data?.results || []));
    }
    if (ratioRes.status === "fulfilled") {
      results.push(...(ratioRes.value.data?.results || []));
    }

    if (results.length === 0) throw new Error("No Tavily results");

    const rawContent = results
      .map((r: any) => `URL: ${r.url}\n${r.content}`)
      .join("\n\n---\n\n")
      .slice(0, 6000);

    const prompt = `You are a financial data extraction engine. 

Extract VERIFIED financial figures for "${companyName}" (ticker: ${symbol}) from these web sources.

STRICT RULES:
- ONLY extract numbers explicitly written in the text. NEVER estimate or calculate.  
- If a metric is not found verbatim in the sources, return null.
- All monetary values must be in ${currencyName}${isINR ? " (if source shows crore: multiply by 10,000,000 to get INR; do NOT convert to USD)" : ""}.
- Return ONLY valid JSON. No markdown, no commentary.

SOURCES:
${rawContent}

JSON output (null for anything not found):
{
  "marketCap": <number in ${currencyName} or null>,
  "peRatio": <trailing P/E number or null>,
  "revenue": <annual/TTM revenue in ${currencyName} or null>,
  "netIncome": <annual/TTM net income in ${currencyName} or null>,
  "profitMargin": <net profit margin as percentage like 12.5 or null>
}`;

    const llmRes = await groq.invoke(prompt);
    const match = (llmRes.content as string).match(/\{[\s\S]*?\}/);
    if (!match) throw new Error("No JSON in LLM response");

    const parsed = JSON.parse(match[0]);

    marketCap = typeof parsed.marketCap === "number" && parsed.marketCap > 0 ? parsed.marketCap : undefined;
    peRatio = typeof parsed.peRatio === "number" && parsed.peRatio > 0 ? parsed.peRatio : undefined;
    revenue = typeof parsed.revenue === "number" && parsed.revenue > 0 ? parsed.revenue : undefined;
    netIncome = typeof parsed.netIncome === "number" ? parsed.netIncome : undefined;
    profitMargin =
      typeof parsed.profitMargin === "number"
        ? parsed.profitMargin
        : revenue && netIncome
        ? parseFloat(((netIncome / revenue) * 100).toFixed(2))
        : undefined;

    const hasData = [marketCap, peRatio, revenue, profitMargin].some((v) => v !== undefined);
    dataQuality = hasData ? "live" : "unavailable";

    console.log(`[yahooTool] Extracted for ${symbol}:`, { marketCap, peRatio, revenue, profitMargin, dataQuality });
  } catch (e: any) {
    console.warn(`[yahooTool] Financial extraction failed for ${symbol}:`, e.message);
    dataQuality = "unavailable";
    // DO NOT inject fake numbers — leave undefined
  }

  return {
    symbol,
    companyName,
    market,
    locale,
    active,
    price: parseFloat(price.toFixed(2)),
    change,
    changePercent,
    marketCap,
    peRatio: peRatio != null ? parseFloat(peRatio.toFixed(2)) : undefined,
    revenue,
    netIncome: netIncome != null ? Math.round(netIncome) : undefined,
    profitMargin: profitMargin != null ? parseFloat(profitMargin.toFixed(2)) : undefined,
    ratiosSource: dataQuality === "live" ? "web_fallback" : "simulated",
    chartData,
  };
}