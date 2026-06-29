import {
  StateGraph,
  START,
  END,
} from "@langchain/langgraph";

import {
  InvestmentStateAnnotation,
} from "./state";

import {
  researchNode,
} from "./nodes/researchNode";

import {
  financeNode,
} from "./nodes/financeNode";

import {
  decisionNode,
} from "./nodes/decisionNode";

const graph =
  new StateGraph(
    InvestmentStateAnnotation
  );

graph.addNode(
  "researcherNode",
  researchNode
);

graph.addNode(
  "financeNode",
  financeNode
);

graph.addNode(
  "decisionMakerNode",
  decisionNode
);

graph.addEdge(
  START,
  "researcherNode" as any
);

graph.addEdge(
  "researcherNode" as any,
  "financeNode" as any
);

graph.addEdge(
  "financeNode" as any,
  "decisionMakerNode" as any
);

graph.addEdge(
  "decisionMakerNode" as any,
  END
);

export const investmentGraph =
  graph.compile();