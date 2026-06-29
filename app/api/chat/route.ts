import { groq } from "@/lib/groq";
import { SYSTEM_PROMPTS } from "@/lib/prompts";
import { ChatMessage } from "@/types/investment";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { company, research, financials, riskAssessment, decision, message, history } = body;

    if (!message || typeof message !== "string" || !message.trim()) {
      return Response.json(
        { error: "Message is required." },
        { status: 400 }
      );
    }

    const chatHistoryText = (history || [])
      .slice(-10) // only last 10 turns for context window efficiency
      .map((msg: ChatMessage) => `${msg.role === "user" ? "User" : "Analyst"}: ${msg.content}`)
      .join("\n");

    const prompt = `
${SYSTEM_PROMPTS.CHAT_ASSISTANT}

Here is the context of your analysis for ${company}:
- Company: ${company} (${financials?.symbol || "N/A"})
- Recommendation: ${decision?.decision || "N/A"}
- Confidence: ${decision?.confidence || 0}%
- Investment Score: ${decision?.investmentScore || 0}/100
- Financial Summary: Revenue ${financials?.revenue ? `$${(financials.revenue / 1e9).toFixed(2)}B` : "N/A"}, Net Income ${financials?.netIncome ? `$${(financials.netIncome / 1e9).toFixed(2)}B` : "N/A"}, Profit Margin ${financials?.profitMargin || "N/A"}%, P/E Ratio ${financials?.peRatio || "N/A"}, Market Cap ${financials?.marketCap ? `$${(financials.marketCap / 1e9).toFixed(2)}B` : "N/A"}
- Risk Assessment: ${riskAssessment?.riskLevel || "N/A"} (Score: ${riskAssessment?.overallRiskScore ?? "N/A"}/100)
- Top Risk Factors: ${riskAssessment?.factors?.slice(0, 3).map((f: any) => f.title).join(", ") || "N/A"}
- Public Sentiment: ${research?.sentiment?.label || "Neutral"} (Score: ${research?.sentiment?.score || 0})
- Key Strengths: ${JSON.stringify(decision?.strengths || [])}
- Key Risks: ${JSON.stringify(decision?.risks || [])}

Use this context to answer the user's question. If the user asks about information not directly in the context, you may use your general financial knowledge but make it clear it's general knowledge.
Keep your answer clear, insightful, professional, and concise (under 5 sentences unless the question warrants detail).

Chat History:
${chatHistoryText}

User: ${message}
Analyst:`;

    try {
      const response = await groq.invoke(prompt);
      const content = response.content as string;

      return Response.json({ content });
    } catch (llmError: any) {
      console.warn("LLM Chat invocation failed, falling back to rule-based mock reply:", llmError.message);

      let content = "";
      const queryLower = message.toLowerCase();

      if (queryLower.includes("strength") || queryLower.includes("positive") || queryLower.includes("why invest")) {
        content = `The primary strengths of ${company} include: ${decision?.strengths?.join("; ") || "strong market position, consistent revenue generation, and institutional support."}`;
      } else if (queryLower.includes("risk") || queryLower.includes("threat") || queryLower.includes("weak") || queryLower.includes("why pass")) {
        content = `The key risks for ${company} are: ${decision?.risks?.join("; ") || "valuation premium, macro headwinds, and sector-specific volatility."}`;
      } else if (queryLower.includes("confidence") || queryLower.includes("score")) {
        content = `The investment score is ${decision?.investmentScore || 50}/100 with ${decision?.confidence || 60}% analyst confidence. The risk level is rated ${riskAssessment?.riskLevel || "MEDIUM"} (${riskAssessment?.overallRiskScore ?? "N/A"}/100).`;
      } else if (queryLower.includes("risk") && queryLower.includes("factor")) {
        content = `Top identified risk factors: ${riskAssessment?.factors?.slice(0, 3).map((f: any) => `${f.title} (${f.severity})`).join(", ") || "general market and financial risks."}`;
      } else if (queryLower.includes("sentiment") || queryLower.includes("news")) {
        content = `Current market sentiment for ${company} is ${research?.sentiment?.label || "Neutral"} (score: ${research?.sentiment?.score || 0}/100). ${research?.sentiment?.summary || ""}`;
      } else {
        content = `Based on my analysis, ${company} received a ${decision?.decision || "PASS"} recommendation with an investment score of ${decision?.investmentScore || 50}/100. The overall risk is ${riskAssessment?.riskLevel || "MEDIUM"}. Feel free to ask about specific metrics, risks, or strengths.`;
      }

      return Response.json({ content });
    }
  } catch (error: any) {
    console.error("Error in API chat route:", error);
    return Response.json(
      { error: error.message || "Failed to process message." },
      { status: 500 }
    );
  }
}
