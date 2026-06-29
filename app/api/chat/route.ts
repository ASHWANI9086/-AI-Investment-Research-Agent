import { groq } from "@/lib/groq";
import { ChatMessage } from "@/types/investment";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { company, research, financials, decision, message, history } = body;

    if (!message || typeof message !== "string" || !message.trim()) {
      return Response.json(
        { error: "Message is required." },
        { status: 400 }
      );
    }

    const chatHistoryText = (history || [])
      .map((msg: ChatMessage) => `${msg.role === "user" ? "User" : "Analyst"}: ${msg.content}`)
      .join("\n");

    const prompt = `
You are the InvestIQ AI Investment Assistant, a professional hedge fund analyst. You have just completed an in-depth analysis on ${company}. The user is looking at your analysis dashboard and has follow-up questions.

Here is the context of your analysis:
- Company: ${company} (${financials?.symbol || "N/A"})
- Recommendation: ${decision?.decision || "N/A"}
- Confidence: ${decision?.confidence || 0}%
- Investment Score: ${decision?.investmentScore || 0}/100
- Financial Summary: Revenue $${financials?.revenue ? `${(financials.revenue / 1e9).toFixed(2)}B` : "N/A"}, Net Income $${financials?.netIncome ? `${(financials.netIncome / 1e9).toFixed(2)}B` : "N/A"}, Profit Margin ${financials?.profitMargin || "N/A"}%, P/E Ratio ${financials?.peRatio || "N/A"}, Market Cap $${financials?.marketCap ? `${(financials.marketCap / 1e9).toFixed(2)}B` : "N/A"}
- Public Sentiment: ${research?.sentiment?.label || "Neutral"} (Score: ${research?.sentiment?.score || 0})
- Key Strengths: ${JSON.stringify(decision?.strengths || [])}
- Key Risks: ${JSON.stringify(decision?.risks || [])}

Use this context to answer the user's question. If the user asks about information not directly in the context, you may use your general knowledge.
Keep your answer clear, insightful, professional, and relatively concise (under 4 sentences if possible).

Chat History:
${chatHistoryText}

User: ${message}
Analyst:
`;

    try {
      const response = await groq.invoke(prompt);
      const content = response.content as string;

      return Response.json({
        content,
      });
    } catch (llmError: any) {
      console.warn("LLM Chat invocation failed (possibly invalid key), falling back to mock reply:", llmError.message);
      
      // Smart offline mockup answers to keep the chat functional even with invalid API keys!
      let content = `I received your question: "${message}". I noticed that the Groq API key is invalid or rate-limited. Under standard operations, I'd analyze the financials and news to answer this. Based on my offline analysis for ${company}, here is a brief response:\n\n`;
      
      const queryLower = message.toLowerCase();
      if (queryLower.includes("strength") || queryLower.includes("positive") || queryLower.includes("why invest")) {
        content += `The primary strengths of ${company} include its strong historical market position, active business segments, and a net positive trend in news catalysts.`;
      } else if (queryLower.includes("risk") || queryLower.includes("pass") || queryLower.includes("threat") || queryLower.includes("weak")) {
        content += `The critical risks involve pricing valuation multiples, potential microeconomic headwinds, supply chain stability, and general stock market sensitivity.`;
      } else if (queryLower.includes("confidence") || queryLower.includes("score")) {
        content += `The investment score of ${decision?.investmentScore || 50}/100 and confidence of ${decision?.confidence || 60}% represent a balanced analyst assessment based on simulated parameters, adjusting for standard sector benchmarks.`;
      } else {
        content += `For the company ${company} (${financials?.symbol || "STK"}), my recommendation is ${decision?.decision || "PASS"}. Please check your environment keys (like GROQ_API_KEY) in .env.local to enable real-time analytical reasoning answers.`;
      }

      return Response.json({
        content,
      });
    }
  } catch (error: any) {
    console.error("Error in API chat route:", error);
    return Response.json(
      {
        error: error.message || "Failed to process message.",
      },
      {
        status: 500,
      }
    );
  }
}
