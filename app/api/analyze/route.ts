import { groq } from "@/lib/groq";
import { searchCompany } from "@/tools/tavilyTool";
import { getFinancialData } from "@/tools/yahooTool";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const company = body.company;

    const research = await searchCompany(company);
    const financials = await getFinancialData(company);

    const prompt = `
You are a professional investment analyst.

Company: ${company}

Research:
${JSON.stringify(research)}

Financial Data:
${JSON.stringify(financials)}

Return ONLY valid JSON:

{
  "decision":"INVEST or PASS",
  "confidence":0,
  "investmentScore":0,
  "strengths":[""],
  "risks":[""],
  "summary":""
}
`;

    const response = await groq.invoke(prompt);

    let result;

    try {
      result = JSON.parse(response.content as string);
    } catch {
      result = {
        decision: "PASS",
        confidence: 50,
        investmentScore: 50,
        summary: String(response.content),
      };
    }

    return Response.json({
      company,
      financials,
      result,
    });
  } catch (error: any) {
    console.error(error);

    return Response.json(
      {
        error: error.message,
      },
      {
        status: 500,
      }
    );
  }
}