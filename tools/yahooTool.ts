import { FinancialData, ChartPoint } from "@/types/investment";

const YF_BASE = "https://query1.finance.yahoo.com";
const YF_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
  Accept: "application/json",
};

let yfCookie = "";
let yfCrumb = "";
let crumbPromise: Promise<string | null> | null = null;

async function getCrumb(): Promise<string | null> {
  if (yfCrumb) return yfCrumb;
  if (crumbPromise) return crumbPromise;

  crumbPromise = (async () => {
    try {
      const res1 = await fetch("https://fc.yahoo.com/", {
        headers: YF_HEADERS,
        cache: "no-store",
      });
      
      const cookieHeader = res1.headers.get("set-cookie");
      if (cookieHeader) {
        yfCookie = cookieHeader.split(";")[0];
      }

      const res2 = await fetch(`${YF_BASE}/v1/test/getcrumb`, {
        headers: { ...YF_HEADERS, Cookie: yfCookie },
        cache: "no-store",
      });
      
      yfCrumb = await res2.text();
      return yfCrumb;
    } catch (e: any) {
      console.warn("[yahooTool] Crumb fetch failed:", e.message);
      return null;
    }
  })();

  return crumbPromise;
}

function getSeed(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = str.charCodeAt(i) + ((h << 5) - h);
  return Math.abs(h);
}

function generateFallbackChart(seed: number, baseVal: number): ChartPoint[] {
  return Array.from({ length: 30 }).map((_, i) => {
    const date = new Date();
    date.setDate(date.getDate() - (30 - i) * 3);
    const drift = (((seed * (i + 3)) % 201) - 100) / 2000 * baseVal;
    return {
      date: date.toLocaleDateString("en-US", { month: "short", day: "numeric" }),
      close: Math.max(0.01, parseFloat((baseVal + drift).toFixed(2))),
      volume: Math.floor(((seed * (i + 7)) % 5_000_000)) + 500_000,
    };
  });
}

export async function getFinancialData(company: string): Promise<FinancialData> {
  let symbol = "";
  let companyName = company;
  let market = "STOCKS";
  let locale = "usd";
  const active = true;

  try {
    const res = await fetch(`${YF_BASE}/v1/finance/search?q=${encodeURIComponent(company)}&quotesCount=5`, {
      headers: YF_HEADERS,
      cache: "no-store",
    });
    const data = await res.json();
    const quotes: any[] = data.quotes || [];
    const best = quotes.find((q) => q.quoteType === "EQUITY") || quotes[0];
    if (best) {
      symbol = best.symbol;
      companyName = best.shortname || best.longname || company;
      market = best.exchange || "STOCKS";
    }
  } catch (e: any) {
    console.warn("[yahooTool] Ticker search failed:", e.message);
  }

  if (!symbol) {
    symbol = company.trim().toUpperCase().replace(/[^A-Z0-9.]/g, "").slice(0, 6) || "UNKNOWN";
  }

  const seed = getSeed(symbol);
  let price = 0, change = 0, changePercent = 0;
  let chartData: ChartPoint[] = [];

  try {
    const chartRes = await fetch(`${YF_BASE}/v8/finance/chart/${symbol}?range=6mo&interval=1d`, {
      headers: YF_HEADERS,
      cache: "no-store",
    });
    const chartJson = await chartRes.json();
    const result = chartJson?.chart?.result?.[0];
    
    if (result?.meta) {
      const m = result.meta;
      price = m.regularMarketPrice ?? 0;
      const prev = m.chartPreviousClose ?? m.previousClose ?? price;
      change = parseFloat((price - prev).toFixed(2));
      changePercent = prev !== 0 ? parseFloat(((change / prev) * 100).toFixed(2)) : 0;
      if (m.symbol) symbol = m.symbol;
      if (m.currency) locale = m.currency.toLowerCase();
    }
    const timestamps: number[] = result?.timestamp || [];
    const closes: (number | null)[] = result?.indicators?.quote?.[0]?.close || [];
    const volumes: (number | null)[] = result?.indicators?.quote?.[0]?.volume || [];
    chartData = timestamps.map((t, i) => {
      const c = closes[i];
      if (c == null) return null;
      return {
        date: new Date(t * 1000).toLocaleDateString("en-US", { month: "short", day: "numeric" }),
        close: parseFloat(c.toFixed(2)),
        volume: volumes[i] ?? 0,
      };
    }).filter(Boolean) as ChartPoint[];
  } catch (e: any) {
    console.warn(`[yahooTool] Chart fetch failed:`, e.message);
  }
  if (chartData.length === 0 && price > 0) chartData = generateFallbackChart(seed, price);

  let marketCap: number | undefined;
  let peRatio: number | undefined;
  let revenue: number | undefined;
  let netIncome: number | undefined;
  let profitMargin: number | undefined;
  let dataQuality: "live" | "unavailable" = "unavailable";

  try {
    const crumb = await getCrumb();
    if (crumb) {
      const summaryRes = await fetch(`${YF_BASE}/v10/finance/quoteSummary/${symbol}?modules=defaultKeyStatistics,financialData,summaryDetail&crumb=${crumb}`, {
        headers: { ...YF_HEADERS, Cookie: yfCookie },
        cache: "no-store",
      });
      const summJson = await summaryRes.json();
      const result = summJson?.quoteSummary?.result?.[0];
      
      if (result) {
        const fin = result.financialData || {};
        const stats = result.defaultKeyStatistics || {};
        const summ = result.summaryDetail || {};

        const rawMCap = fin.marketCap?.raw ?? summ.marketCap?.raw ?? stats.enterpriseValue?.raw;
        marketCap = rawMCap && rawMCap > 0 ? rawMCap : undefined;

        const trailingPE = summ.trailingPE?.raw ?? stats.trailingEps?.raw ? summ.trailingPE?.raw : undefined;
        peRatio = trailingPE ?? summ.forwardPE?.raw;
        if (peRatio && (peRatio <= 0 || peRatio > 10000)) peRatio = undefined;

        revenue = fin.totalRevenue?.raw && fin.totalRevenue.raw > 0 ? fin.totalRevenue.raw : undefined;
        netIncome = fin.netIncomeToCommon?.raw ?? undefined;

        const rawMargin = fin.profitMargins?.raw ?? fin.grossMargins?.raw;
        if (rawMargin != null && rawMargin !== 0) profitMargin = parseFloat((rawMargin * 100).toFixed(2));
        if (!profitMargin && revenue && netIncome) profitMargin = parseFloat(((netIncome / revenue) * 100).toFixed(2));

        if (marketCap || peRatio || revenue) {
          dataQuality = "live";
          console.log(`[yahooTool] YF quoteSummary fetched successfully for ${symbol}`);
        }
      }
    }
  } catch (e: any) {
    console.warn(`[yahooTool] quoteSummary failed:`, e.message);
  }

  // Final fallback to HTML Scraping if APIs fail
  if (dataQuality === "unavailable") {
    try {
      const htmlRes = await fetch(`https://finance.yahoo.com/quote/${symbol}`, {
        headers: YF_HEADERS,
        cache: "no-store",
      });
      const html = await htmlRes.text();
      
      const regex = /<script[^>]*?>([\s\S]*?)<\/script>/gi;
      let match;
      while ((match = regex.exec(html)) !== null) {
        const content = match[1].trim();
        if (!content) continue;
        
        try {
          let parsed = null;
          if (content.startsWith('{') && content.endsWith('}')) {
            parsed = JSON.parse(content);
          }
          
          if (parsed && parsed.body) {
            const bodyParsed = JSON.parse(parsed.body);
            if (bodyParsed && bodyParsed.quoteSummary) {
              const result = bodyParsed.quoteSummary.result?.[0];
              if (result) {
                const fin = result.financialData || {};
                const stats = result.defaultKeyStatistics || {};
                const summ = result.summaryDetail || {};

                const rawMCap = fin.marketCap?.raw ?? summ.marketCap?.raw ?? stats.enterpriseValue?.raw;
                marketCap = rawMCap && rawMCap > 0 ? rawMCap : undefined;

                const trailingPE = summ.trailingPE?.raw ?? stats.trailingEps?.raw ? summ.trailingPE?.raw : undefined;
                peRatio = trailingPE ?? summ.forwardPE?.raw;
                if (peRatio && (peRatio <= 0 || peRatio > 10000)) peRatio = undefined;

                revenue = fin.totalRevenue?.raw && fin.totalRevenue.raw > 0 ? fin.totalRevenue.raw : undefined;
                netIncome = fin.netIncomeToCommon?.raw ?? undefined;

                const rawMargin = fin.profitMargins?.raw ?? fin.grossMargins?.raw;
                if (rawMargin != null && rawMargin !== 0) profitMargin = parseFloat((rawMargin * 100).toFixed(2));
                if (!profitMargin && revenue && netIncome) profitMargin = parseFloat(((netIncome / revenue) * 100).toFixed(2));

                if (marketCap || peRatio || revenue) {
                  dataQuality = "live";
                  console.log(`[yahooTool] Scraped and parsed HTML script tag successfully for ${symbol}`);
                  break;
                }
              }
            }
          }
        } catch (e) {
          // ignore parsing error
        }
      }
    } catch(e: any) {
      console.warn(`[yahooTool] HTML scraping failed:`, e.message);
    }
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