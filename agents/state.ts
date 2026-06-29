import { Annotation } from "@langchain/langgraph";

export const InvestmentStateAnnotation = Annotation.Root({
  company: Annotation<string>(),

  /** Research node output: web search analysis + general context */
  research: Annotation<any>(),

  /** Finance node output: live price + financial metrics */
  financials: Annotation<any>(),

  /** Risk node output: structured risk assessment */
  riskAssessment: Annotation<any>(),

  /** Decision node output: final INVEST/PASS recommendation */
  decision: Annotation<any>(),
});