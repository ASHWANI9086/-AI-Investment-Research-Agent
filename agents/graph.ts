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
  "research",
  researchNode
);

graph.addNode(
  "finance",
  financeNode
);

graph.addNode(
  "decision",
  decisionNode
);

graph.addEdge(
  START,
  "research"
);

graph.addEdge(
  "research",
  "finance"
);

graph.addEdge(
  "finance",
  "decision"
);

graph.addEdge(
  "decision",
  END
);

export const investmentGraph =
  graph.compile();