import { groqCreative } from "@/lib/groq";
import { buildRiskPrompt } from "@/lib/prompts";
import { RiskAssessment } from "@/types/investment";

/**
 * riskNode — dedicated LangGraph node for investment risk assessment.
 * Runs after financeNode so it has live financial data to work with.
 */
export async function riskNode(state: any) {
  const { company, financials, research } = state;

  console.log(`[riskNode] Running risk assessment for "${company}"...`);

  const prompt = buildRiskPrompt(company, financials, research);

  try {
    const response = await groqCreative.invoke(prompt);
    const text = response.content as string;

    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("No JSON in risk LLM response");

    const parsed: RiskAssessment = JSON.parse(jsonMatch[0]);

    if (
      parsed &&
      typeof parsed.overallRiskScore === "number" &&
      Array.isArray(parsed.factors)
    ) {
      console.log(`[riskNode] Risk score for "${company}": ${parsed.overallRiskScore} (${parsed.riskLevel})`);
      return { riskAssessment: parsed };
    }

    throw new Error("Invalid risk assessment structure from LLM");
  } catch (error: any) {
    console.warn("[riskNode] LLM risk assessment failed, using rule-based fallback:", error.message);

    // Rule-based fallback
    const pe = financials?.peRatio;
    const margin = financials?.profitMargin;
    const sentScore = research?.sentiment?.score || 0;
    const mcap = financials?.marketCap || 10e9;

    let riskScore = 35; // default moderate risk

    if (pe && pe > 45) riskScore += 20;
    else if (pe && pe > 30) riskScore += 10;

    if (margin !== undefined && margin < 5) riskScore += 15;
    else if (margin !== undefined && margin < 10) riskScore += 8;

    if (sentScore < -30) riskScore += 15;
    else if (sentScore < -10) riskScore += 8;

    if (mcap < 5e9) riskScore += 10;

    riskScore = Math.min(95, Math.max(10, riskScore));

    const riskLevel: RiskAssessment["riskLevel"] =
      riskScore >= 70 ? "CRITICAL" : riskScore >= 55 ? "HIGH" : riskScore >= 35 ? "MEDIUM" : "LOW";

    const factors: RiskAssessment["factors"] = [];

    if (pe && pe > 35) {
      factors.push({
        category: "Financial",
        title: "High Valuation Multiple",
        description: `P/E ratio of ${pe}x is above typical fair-value thresholds, implying the market has priced in substantial future growth that may not materialise.`,
        severity: pe > 50 ? "HIGH" : "MEDIUM",
      });
    }

    if (margin !== undefined && margin < 10) {
      factors.push({
        category: "Financial",
        title: "Thin Profit Margins",
        description: `A ${margin}% net profit margin offers limited buffer against rising costs or revenue shortfalls, increasing operating leverage risk.`,
        severity: margin < 5 ? "HIGH" : "MEDIUM",
      });
    }

    if (sentScore < -15) {
      factors.push({
        category: "Reputational",
        title: "Negative News Momentum",
        description: `Current news sentiment score of ${sentScore} indicates a bearish public narrative that could suppress stock price in the near term.`,
        severity: sentScore < -40 ? "HIGH" : "MEDIUM",
      });
    }

    factors.push({
      category: "Macro",
      title: "General Market Volatility",
      description: "Equity markets face broader macro headwinds including interest rate uncertainty and geopolitical risk that affect all growth equities.",
      severity: "MEDIUM",
    });

    if (mcap < 10e9) {
      factors.push({
        category: "Operational",
        title: "Small-Cap Liquidity Risk",
        description: `Market cap of ~$${(mcap / 1e9).toFixed(1)}B means lower trading volumes, wider bid-ask spreads, and higher price volatility.`,
        severity: "MEDIUM",
      });
    }

    const mitigants = [
      mcap > 50e9 ? "Large-cap stability with institutional backing" : "Growth-stage company with expansion potential",
      margin && margin > 15 ? "High profit margins provide strong earnings resilience" : "Active cost-optimization programs",
      sentScore > 0 ? "Positive market sentiment as a near-term tailwind" : "Sector diversification may stabilise earnings",
    ];

    const riskAssessment: RiskAssessment = {
      overallRiskScore: riskScore,
      riskLevel,
      factors: factors.slice(0, 5),
      mitigants,
      summary: `${company} carries ${riskLevel.toLowerCase()} investment risk with a score of ${riskScore}/100. Key concerns center on ${factors[0]?.title || "valuation and market conditions"}, partially offset by ${mitigants[0]?.toLowerCase()}.`,
    };

    return { riskAssessment };
  }
}
