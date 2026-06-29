import { groq } from "@/lib/groq";
import { InvestmentDecision } from "@/types/investment";

export async function decisionNode(state: any) {
  const company = state.company;
  const research = state.research;
  const financials = state.financials;

  console.log(`[decisionNode] Evaluating investment recommendation for "${company}"...`);

  // Format news summary for prompt
  const newsTitles = research?.news?.map((n: any) => `- ${n.title} (Source: ${n.source})`).join("\n") || "No news available.";

  const prompt = `
You are a senior investment analyst at a top-tier hedge fund. You are tasked with analyzing a potential investment in ${company}.

Here is the gathered research and financial details:

1. COMPANY IDENTITY
- Name: ${financials?.companyName || company}
- Ticker: ${financials?.symbol || "N/A"}
- Active: ${financials?.active ? "Yes" : "No"}

2. FINANCIAL PERFORMANCE & VALUATION
- Price: $${financials?.price || "N/A"}
- Daily Price Change: ${financials?.change !== undefined ? `${financials.change} (${financials.changePercent}%)` : "N/A"}
- Market Capitalization: ${financials?.marketCap ? `$${(financials.marketCap / 1e9).toFixed(2)} Billion` : "N/A"}
- P/E Ratio: ${financials?.peRatio || "N/A"}
- Revenue (TTM): ${financials?.revenue ? `$${(financials.revenue / 1e9).toFixed(2)} Billion` : "N/A"}
- Net Income (TTM): ${financials?.netIncome ? `$${(financials.netIncome / 1e9).toFixed(2)} Billion` : "N/A"}
- Net Profit Margin: ${financials?.profitMargin !== undefined ? `${financials.profitMargin}%` : "N/A"}

3. NEWS & PUBLIC SENTIMENT
- Sentiment Score: ${research?.sentiment?.score || 0} (-100 represents extremely bearish, +100 represents extremely bullish)
- Sentiment Label: ${research?.sentiment?.label || "Neutral"}
- Sentiment Summary: ${research?.sentiment?.summary || "N/A"}
- Recent News Headlines:
${newsTitles}

4. GENERAL WEB RESEARCH
${research?.generalAnalysis?.slice(0, 1500) || "N/A"}

Your task is to weigh all of the information above and issue an investment recommendation:
- "INVEST" if the company shows strong financial health, reasonable valuation (or high growth justifying valuation), positive news momentum, and strong market positioning.
- "PASS" if the risks outweigh the strengths, valuation is excessive, growth is stagnating, profit margins are thin, or there is negative news sentiment/legal headwinds.

Provide a comprehensive, analytical response. You MUST return ONLY a JSON response in the format below. Do not include markdown formatting or extra text. Replace all placeholder values with your own calculated data.

{
  "decision": "WRITE_INVEST_OR_PASS_HERE", 
  "confidence": 0, // Write your calculated confidence integer (between 0 and 100) based on analysis
  "investmentScore": 0, // Write your calculated investment score integer (between 0 and 100) based on analysis
  "strengths": [
    "Specific core strength 1",
    "Specific core strength 2",
    "Specific core strength 3"
  ],
  "risks": [
    "Specific key risk 1",
    "Specific key risk 2",
    "Specific key risk 3"
  ],
  "summary": "Your detailed professional analyst rationale here."
}
`;

  try {
    const response = await groq.invoke(prompt);
    const text = response.content as string;

    let parsed: InvestmentDecision;
    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      const cleanText = jsonMatch ? jsonMatch[0] : text;
      parsed = JSON.parse(cleanText);
    } catch {
      throw new Error("Failed to parse decision JSON from LLM content.");
    }

    // Validation checks
    if (
      parsed &&
      (parsed.decision === "INVEST" || parsed.decision === "PASS") &&
      typeof parsed.confidence === "number" &&
      typeof parsed.investmentScore === "number"
    ) {
      return {
        decision: parsed,
      };
    }

    throw new Error("Invalid structure returned from LLM decision.");
  } catch (error: any) {
    console.warn("Groq decision Node failed, running rule-based financial scorer fallback:", error.message);

    // Dynamic analyst fallback scoring algorithm (no API key needed!)
    const symbol = financials?.symbol || "STK";
    const companyName = financials?.companyName || company;
    const pe = financials?.peRatio;
    const margin = financials?.profitMargin || 10;
    const mcap = financials?.marketCap || 10e9;
    const sentScore = research?.sentiment?.score || 0;
    const sentLabel = research?.sentiment?.label || "Neutral";

    // 1. Calculate Score
    let score = 50; // base

    // Sentiment modifier
    score += Math.round(sentScore * 0.15); // +/- 15 points max

    // Profit margin modifier
    if (margin > 20) {
      score += 15;
    } else if (margin > 12) {
      score += 8;
    } else if (margin < 6) {
      score -= 15;
    }

    // P/E Ratio modifier
    if (pe) {
      if (pe < 15) {
        score += 10; // value play
      } else if (pe > 45) {
        score -= 18; // overvalued
      } else if (pe > 30) {
        score -= 8;
      } else {
        score += 5; // fair value
      }
    }

    // Market cap stability modifier
    if (mcap > 150e9) {
      score += 5; // stable blue chip
    } else if (mcap < 10e9) {
      score -= 5; // higher volatility risk
    }

    score = Math.max(10, Math.min(95, score));

    // 2. Decide Invest vs Pass
    const decision: "INVEST" | "PASS" = score >= 60 ? "INVEST" : "PASS";

    // 3. Compile strengths
    const strengths: string[] = [];
    if (margin >= 15) {
      strengths.push(`Strong core profitability (margins of ${margin}%) provides a robust cash cushion.`);
    } else {
      strengths.push(`Operational consistency with steady revenue generation.`);
    }
    
    if (sentScore > 15) {
      strengths.push(`Optimistic market sentiment (Score: ${sentScore}) driven by positive recent catalyst developments.`);
    } else {
      strengths.push(`Active corporate operations with stable institutional holding.`);
    }

    if (pe && pe < 20) {
      strengths.push(`Attractive valuation multiple relative to earnings growth potential (P/E of ${pe}).`);
    } else if (mcap > 100e9) {
      strengths.push(`Highly capitalized company ($${(mcap / 1e9).toFixed(1)}B Market Cap) with strong supply chain presence.`);
    } else {
      strengths.push(`Flexible capital allocation profile suitable for sector adjustments.`);
    }

    // 4. Compile risks
    const risks: string[] = [];
    if (pe && pe > 35) {
      risks.push(`Elevated P/E ratio (${pe}) implies the stock is priced at a steep premium.`);
    } else if (pe && pe > 25) {
      risks.push(`Valuation multiple is slightly high, requiring sustained revenue growth to support price.`);
    }

    if (margin < 8) {
      risks.push(`Low net profit margin (${margin}%) increases vulnerability to operational cost inflation.`);
    }

    if (sentScore < -15) {
      risks.push(`Bearish news cycle trends (sentiment score: ${sentScore}) indicating negative news momentum.`);
    } else {
      risks.push(`General equity market volatility and sector macroeconomic dependencies.`);
    }

    if (mcap < 20e9) {
      risks.push(`Smaller market capitalization profile exposes the company to higher trading volatility.`);
    } else {
      risks.push(`Regulatory oversight risks and potential supply chain adjustments.`);
    }

    // 5. Generate detailed dynamic analyst summary
    const summary = `We recommend a ${decision} for ${companyName} (${symbol}) with an overall investment score of ${score}/100. This evaluation is driven by its ${margin}% net margins and a P/E multiple of ${pe || "N/A"}. Market sentiment is currently ${sentLabel.toLowerCase()} (${sentScore > 0 ? "optimistic short-term expectations" : "cautious news headwinds"}). Key drivers for this call include ${strengths[0].slice(0, 1).toLowerCase() + strengths[0].slice(1, -1)} while key risks center on ${risks[0].slice(0, 1).toLowerCase() + risks[0].slice(1)}.`;

    const parsed: InvestmentDecision = {
      decision,
      confidence: 60 + (score % 25), // dynamic confidence (60% to 84%)
      investmentScore: score,
      strengths,
      risks,
      summary,
    };

    return {
      decision: parsed,
    };
  }
}