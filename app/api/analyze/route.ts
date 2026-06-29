import { investmentGraph } from "@/agents/graph";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const company = body.company;

    if (!company || typeof company !== "string" || !company.trim()) {
      return Response.json(
        { error: "Company name is required." },
        { status: 400 }
      );
    }

    console.log(`[API Analyze] Invoking LangGraph for company: "${company}"`);

    // Run the compiled StateGraph with the initial state
    const result = await investmentGraph.invoke({
      company: company.trim(),
    });

    console.log(`[API Analyze] LangGraph execution complete for "${company}".`);

    // The result object contains the final state of the graph
    return Response.json({
      company: result.company,
      research: result.research,
      financials: result.financials,
      decision: result.decision,
    });
  } catch (error: any) {
    console.error("Error in API analyze route:", error);
    return Response.json(
      {
        error: error.message || "Failed to analyze company.",
      },
      {
        status: 500,
      }
    );
  }
}