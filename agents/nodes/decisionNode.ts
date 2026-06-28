import { groq } from "@/lib/groq";

export async function decisionNode(state: any) {
  const prompt = `
You are a senior investment analyst.

Company:
${state.company}

Research:
${JSON.stringify(state.research)}

Financials:
${JSON.stringify(state.financials)}

Return ONLY valid JSON.

{
  "decision":"INVEST or PASS",
  "confidence":0,
  "investmentScore":0,
  "strengths":[""],
  "risks":[""],
  "summary":""
}
`;

  const result = await groq.invoke(prompt);

  let parsed;

  try {
    parsed = JSON.parse(result.content as string);
  } catch {
    parsed = {
      decision: "PASS",
      confidence: 50,
      investmentScore: 50,
      strengths: [],
      risks: [],
      summary: result.content,
    };
  }

  return {
    ...state,
    decision: parsed,
  };
}