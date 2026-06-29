import { StateGraph, START, END } from "@langchain/langgraph";
import { InvestmentStateAnnotation } from "./state";
import { researchNode } from "./nodes/researchNode";
import { financeNode } from "./nodes/financeNode";
import { newsNode } from "./nodes/newsNode";
import { riskNode } from "./nodes/riskNode";
import { decisionNode } from "./nodes/decisionNode";

/**
 * InvestIQ LangGraph Pipeline
 *
 * START
 *   └─► researcherNode  (web search: company overview & general analysis)
 *         └─► financeNode  (Yahoo Finance: live price + chart + financial ratios)
 *               └─► newsNode  (Tavily news + Groq sentiment analysis)
 *                     └─► riskNode  (Groq risk factor assessment)
 *                           └─► decisionMakerNode  (Groq INVEST/PASS decision)
 *                                 └─► END
 */
const graph = new StateGraph(InvestmentStateAnnotation);

graph.addNode("researcherNode", researchNode);
graph.addNode("financeNode", financeNode);
graph.addNode("newsNode", newsNode);
graph.addNode("riskNode", riskNode);
graph.addNode("decisionMakerNode", decisionNode);

graph.addEdge(START, "researcherNode" as any);
graph.addEdge("researcherNode" as any, "financeNode" as any);
graph.addEdge("financeNode" as any, "newsNode" as any);
graph.addEdge("newsNode" as any, "riskNode" as any);
graph.addEdge("riskNode" as any, "decisionMakerNode" as any);
graph.addEdge("decisionMakerNode" as any, END);

export const investmentGraph = graph.compile();