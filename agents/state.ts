import { Annotation }
from "@langchain/langgraph";

export const InvestmentStateAnnotation =
  Annotation.Root({
    company:
      Annotation<string>(),

    research:
      Annotation<any>(),

    financials:
      Annotation<any>(),

    decision:
      Annotation<any>(),
  });