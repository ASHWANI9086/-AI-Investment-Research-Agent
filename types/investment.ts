export interface NewsArticle {
  title: string;
  url: string;
  source?: string;
  snippet?: string;
  publishedAt?: string;
}

export interface NewsSentiment {
  score: number; // -100 to 100
  label: "Positive" | "Negative" | "Neutral";
  summary: string;
}

export interface CompanyResearch {
  news: NewsArticle[];
  sentiment: NewsSentiment;
  generalAnalysis: string;
}

export interface ChartPoint {
  date: string;
  close: number;
  volume: number;
}

export interface FinancialMetric {
  label: string;
  value: string | number;
  status: "positive" | "negative" | "neutral";
}

export interface FinancialData {
  symbol: string;
  companyName: string;
  market: string;
  locale: string;
  active: boolean;
  price?: number;
  change?: number;
  changePercent?: number;
  marketCap?: number;
  peRatio?: number;
  revenue?: number; // TTM revenue
  netIncome?: number; // TTM net income
  profitMargin?: number; // TTM profit margin in %
  ratiosSource?: "polygon" | "web_fallback" | "simulated";
  chartData?: ChartPoint[];
  error?: string;
}

export type RiskSeverity = "LOW" | "MEDIUM" | "HIGH";
export type RiskLevel = "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
export type RiskCategory =
  | "Financial"
  | "Regulatory"
  | "Competitive"
  | "Macro"
  | "Operational"
  | "Reputational";

export interface RiskFactor {
  category: RiskCategory;
  title: string;
  description: string;
  severity: RiskSeverity;
}

export interface RiskAssessment {
  overallRiskScore: number; // 0-100
  riskLevel: RiskLevel;
  factors: RiskFactor[];
  mitigants: string[];
  summary: string;
}

export interface InvestmentDecision {
  decision: "INVEST" | "PASS";
  confidence: number; // 0 to 100
  investmentScore: number; // 0 to 100
  strengths: string[];
  risks: string[];
  summary: string;
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface InvestmentState {
  company: string;
  research?: CompanyResearch;
  financials?: FinancialData;
  riskAssessment?: RiskAssessment;
  decision?: InvestmentDecision;
}

export interface AnalysisHistoryItem {
  company: string;
  symbol?: string;
  decision?: "INVEST" | "PASS";
  investmentScore?: number;
  timestamp: number;
}
