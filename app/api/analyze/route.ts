import { investmentGraph } from "@/agents/graph";

// Extend Vercel serverless function timeout to 90 seconds
// The 5-node pipeline (research + finance + news + risk + decision) requires extra time
export const maxDuration = 90;

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const company = (body.company || "").trim();

    if (!company || typeof company !== "string") {
      return Response.json(
        { error: "Company name is required." },
        { status: 400 }
      );
    }

    if (company.length > 100) {
      return Response.json(
        { error: "Company name is too long (max 100 characters)." },
        { status: 400 }
      );
    }

    console.log(`[API /analyze] Invoking LangGraph for company: "${company}"`);

    const result = await investmentGraph.invoke({ company });

    console.log(`[API /analyze] Pipeline complete for "${company}". Decision: ${result.decision?.decision}`);

    return Response.json({
      company: result.company,
      research: result.research,
      financials: result.financials,
      riskAssessment: result.riskAssessment,
      decision: result.decision,
    });
  } catch (error: any) {
    const msg = error?.message || "Failed to analyze company.";
    console.error("[API /analyze] Error:", msg);

    return Response.json(
      { error: msg.length > 200 ? "Analysis pipeline encountered an internal error." : msg },
      { status: 500 }
    );
  }
}