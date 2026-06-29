"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import {
  NewsArticle,
  CompanyResearch,
  FinancialData,
  InvestmentDecision,
  RiskAssessment,
  ChatMessage,
  InvestmentState,
  AnalysisHistoryItem,
} from "@/types/investment";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getCurrencySymbol(locale?: string) {
  if (!locale) return "$";
  const loc = locale.toLowerCase();
  if (loc === "inr") return "₹";
  if (loc === "gbp" || loc === "gbx") return "£";
  if (loc === "eur") return "€";
  if (loc === "jpy") return "¥";
  return "$";
}

function formatMoney(num?: number, locale?: string) {
  if (num === undefined || num === null) return "N/A";
  const sym = getCurrencySymbol(locale);
  if (Math.abs(num) >= 1e12) return `${sym}${(num / 1e12).toFixed(2)}T`;
  if (Math.abs(num) >= 1e9) return `${sym}${(num / 1e9).toFixed(2)}B`;
  if (Math.abs(num) >= 1e6) return `${sym}${(num / 1e6).toFixed(2)}M`;
  return `${sym}${num.toLocaleString()}`;
}

function getRiskColor(level?: string) {
  switch (level) {
    case "LOW":      return { bg: "bg-emerald-950/30", border: "border-emerald-800/40", text: "text-emerald-400", badge: "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30" };
    case "MEDIUM":   return { bg: "bg-amber-950/30",   border: "border-amber-800/40",   text: "text-amber-400",   badge: "bg-amber-500/15 text-amber-400 border border-amber-500/30" };
    case "HIGH":     return { bg: "bg-orange-950/30",  border: "border-orange-800/40",  text: "text-orange-400",  badge: "bg-orange-500/15 text-orange-400 border border-orange-500/30" };
    case "CRITICAL": return { bg: "bg-rose-950/30",    border: "border-rose-800/40",    text: "text-rose-400",    badge: "bg-rose-500/15 text-rose-400 border border-rose-500/30" };
    default:         return { bg: "bg-zinc-900/30",    border: "border-zinc-800/40",    text: "text-zinc-400",    badge: "bg-zinc-800 text-zinc-400 border border-zinc-700/40" };
  }
}

function getSeverityDot(severity?: string) {
  switch (severity) {
    case "HIGH":   return "bg-rose-500";
    case "MEDIUM": return "bg-amber-400";
    case "LOW":    return "bg-emerald-500";
    default:       return "bg-zinc-500";
  }
}

const TICKER_ITEMS = [
  { name: "NVDA", price: "138.85", change: "+2.31%" },
  { name: "AAPL", price: "211.16", change: "+0.92%" },
  { name: "TSLA", price: "248.50", change: "-1.14%" },
  { name: "MSFT", price: "472.32", change: "+1.08%" },
  { name: "AMZN", price: "226.74", change: "+0.74%" },
  { name: "GOOGL",price: "187.23", change: "+0.55%" },
  { name: "META", price: "611.40", change: "+1.92%" },
  { name: "RELIANCE", price: "₹1482", change: "+0.43%" },
  { name: "INFY", price: "₹1625", change: "-0.28%" },
  { name: "TCS",  price: "₹3892", change: "+0.19%" },
];

const HISTORY_KEY = "investiq_history";

function loadHistory(): AnalysisHistoryItem[] {
  try {
    const raw = localStorage.getItem(HISTORY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveHistory(item: AnalysisHistoryItem) {
  try {
    const existing = loadHistory();
    const filtered = existing.filter((h) => h.company.toLowerCase() !== item.company.toLowerCase());
    const updated = [item, ...filtered].slice(0, 8);
    localStorage.setItem(HISTORY_KEY, JSON.stringify(updated));
  } catch {
    // localStorage not available (SSR)
  }
}

// ─── Extended State ───────────────────────────────────────────────────────────

interface ExtendedInvestmentState extends InvestmentState {
  riskAssessment?: RiskAssessment;
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function Home() {
  const [company, setCompany] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadStep, setLoadStep] = useState(0);
  const [result, setResult] = useState<ExtendedInvestmentState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isMounted, setIsMounted] = useState(false);

  // Chat
  const [chatMessage, setChatMessage] = useState("");
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [chatLoading, setChatLoading] = useState(false);
  const chatBottomRef = useRef<HTMLDivElement>(null);

  // History
  const [history, setHistory] = useState<AnalysisHistoryItem[]>([]);
  const [showHistory, setShowHistory] = useState(false);

  // Active tab for result view
  const [activeTab, setActiveTab] = useState<"overview" | "risk" | "news">("overview");

  // Copy report
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setIsMounted(true);
    setHistory(loadHistory());
  }, []);

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatHistory, chatLoading]);

  // Loading step animation
  useEffect(() => {
    if (!loading) return;
    setLoadStep(1);
    const t1 = setTimeout(() => setLoadStep(2), 2500);
    const t2 = setTimeout(() => setLoadStep(3), 5500);
    const t3 = setTimeout(() => setLoadStep(4), 9000);
    const t4 = setTimeout(() => setLoadStep(5), 12000);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); clearTimeout(t4); };
  }, [loading]);

  const suggestedCompanies = [
    { name: "NVIDIA", query: "Nvidia" },
    { name: "Apple", query: "Apple Inc." },
    { name: "Tesla", query: "Tesla" },
    { name: "Reliance", query: "Reliance Industries" },
    { name: "Infosys", query: "Infosys" },
  ];

  const runAnalysis = useCallback(async (searchCompany: string) => {
    if (!searchCompany.trim() || loading) return;

    setLoading(true);
    setError(null);
    setResult(null);
    setChatHistory([]);
    setActiveTab("overview");

    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ company: searchCompany }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || `Analysis failed (${res.status})`);
      }

      const data: ExtendedInvestmentState = await res.json();
      if ((data as any).error) throw new Error((data as any).error);

      setResult(data);

      // Save to history
      const histItem: AnalysisHistoryItem = {
        company: data.financials?.companyName || searchCompany,
        symbol: data.financials?.symbol,
        decision: data.decision?.decision,
        investmentScore: data.decision?.investmentScore,
        timestamp: Date.now(),
      };
      saveHistory(histItem);
      setHistory(loadHistory());

      // Pre-populate chat
      setChatHistory([{
        role: "assistant",
        content: `Analysis complete for **${data.financials?.companyName || searchCompany}** (${data.financials?.symbol || "N/A"}). My recommendation is **${data.decision?.decision || "PASS"}** with a confidence of **${data.decision?.confidence || 0}%** and a risk level of **${data.riskAssessment?.riskLevel || "MEDIUM"}**. Ask me anything about this company.`,
      }]);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "An unexpected error occurred during analysis.");
    } finally {
      setLoading(false);
      setLoadStep(0);
    }
  }, [loading]);

  const sendChatMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!chatMessage.trim() || chatLoading || !result) return;

    const userMsg = chatMessage.trim();
    setChatMessage("");
    setChatHistory((prev) => [...prev, { role: "user", content: userMsg }]);
    setChatLoading(true);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          company: result.company,
          research: result.research,
          financials: result.financials,
          riskAssessment: result.riskAssessment,
          decision: result.decision,
          message: userMsg,
          history: chatHistory,
        }),
      });

      if (!res.ok) throw new Error("Chat assistant failed to respond.");
      const data = await res.json();
      setChatHistory((prev) => [...prev, { role: "assistant", content: data.content }]);
    } catch (err: any) {
      setChatHistory((prev) => [...prev, {
        role: "assistant",
        content: "Sorry, I encountered an error while processing that question. Please try again.",
      }]);
    } finally {
      setChatLoading(false);
    }
  };

  const copyReport = async () => {
    if (!result) return;
    const text = [
      `InvestIQ Analysis Report — ${result.financials?.companyName || result.company}`,
      `Generated: ${new Date().toLocaleString()}`,
      "",
      `RECOMMENDATION: ${result.decision?.decision}`,
      `Confidence: ${result.decision?.confidence}%`,
      `Investment Score: ${result.decision?.investmentScore}/100`,
      `Risk Level: ${result.riskAssessment?.riskLevel} (${result.riskAssessment?.overallRiskScore}/100)`,
      "",
      "ANALYST SUMMARY:",
      result.decision?.summary || "",
      "",
      "KEY STRENGTHS:",
      ...(result.decision?.strengths?.map((s) => `• ${s}`) || []),
      "",
      "KEY RISKS:",
      ...(result.decision?.risks?.map((r) => `• ${r}`) || []),
    ].join("\n");

    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // Clipboard API not available
    }
  };

  const isInvest = result?.decision?.decision === "INVEST";
  const riskColors = getRiskColor(result?.riskAssessment?.riskLevel);

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 font-sans">
      {/* Ambient background */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -left-40 w-[500px] h-[500px] bg-emerald-500/5 rounded-full blur-3xl" />
        <div className="absolute top-1/2 -right-20 w-96 h-96 bg-blue-500/4 rounded-full blur-3xl" />
        <div className="absolute bottom-0 left-1/3 w-[600px] h-80 bg-purple-500/4 rounded-full blur-3xl" />
      </div>

      {/* ── Ticker Bar ── */}
      <div className="relative z-20 bg-zinc-900/80 border-b border-zinc-800/60 backdrop-blur-sm py-1.5 overflow-hidden">
        <div className="flex ticker-animate w-max gap-8">
          {[...TICKER_ITEMS, ...TICKER_ITEMS].map((item, i) => (
            <div key={i} className="flex items-center gap-1.5 text-[11px] font-semibold whitespace-nowrap px-2">
              <span className="text-zinc-400">{item.name}</span>
              <span className="text-zinc-200">{item.price}</span>
              <span className={item.change.startsWith("+") ? "text-emerald-400" : "text-rose-400"}>
                {item.change}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Header ── */}
      <header className="sticky top-0 z-30 border-b border-zinc-900 bg-zinc-950/90 backdrop-blur-lg px-4 sm:px-6 py-3.5 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center font-black text-black text-sm shadow-lg shadow-emerald-500/20 select-none">
            IQ
          </div>
          <div>
            <h1 className="text-lg font-black tracking-tight text-zinc-50">InvestIQ</h1>
            <p className="text-[10px] text-zinc-500 font-medium leading-none mt-0.5">Multi-Agent AI Analyst</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {result && (
            <button
              onClick={copyReport}
              className="hidden sm:flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-zinc-400 hover:text-zinc-200 transition-all"
            >
              {copied ? (
                <>
                  <svg className="w-3.5 h-3.5 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
                  </svg>
                  <span className="text-emerald-400">Copied!</span>
                </>
              ) : (
                <>
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                  Copy Report
                </>
              )}
            </button>
          )}

          {isMounted && history.length > 0 && (
            <div className="relative">
              <button
                onClick={() => setShowHistory((v) => !v)}
                className="flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-lg bg-zinc-900 border border-zinc-800 hover:border-zinc-700 text-zinc-400 hover:text-zinc-200 transition-all"
                id="history-toggle"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                History
              </button>

              {showHistory && (
                <div className="absolute right-0 top-10 w-72 bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl z-50 overflow-hidden">
                  <div className="p-3 border-b border-zinc-800 flex items-center justify-between">
                    <span className="text-xs font-bold text-zinc-300">Recent Analyses</span>
                    <button
                      onClick={() => { localStorage.removeItem(HISTORY_KEY); setHistory([]); setShowHistory(false); }}
                      className="text-[10px] text-zinc-600 hover:text-rose-400 transition-colors"
                    >
                      Clear all
                    </button>
                  </div>
                  <div className="max-h-72 overflow-y-auto">
                    {history.map((item, i) => (
                      <button
                        key={i}
                        onClick={() => { setCompany(item.company); runAnalysis(item.company); setShowHistory(false); }}
                        className="w-full flex items-center justify-between px-4 py-3 hover:bg-zinc-800/60 transition-colors text-left border-b border-zinc-800/50 last:border-0"
                        id={`history-item-${i}`}
                      >
                        <div>
                          <p className="text-xs font-semibold text-zinc-200">{item.company}</p>
                          <p className="text-[10px] text-zinc-500 mt-0.5">
                            {item.symbol && <span className="mr-2">{item.symbol}</span>}
                            {new Date(item.timestamp).toLocaleDateString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
                          </p>
                        </div>
                        {item.decision && (
                          <span className={`text-[10px] font-black px-2 py-0.5 rounded-md ${item.decision === "INVEST" ? "bg-emerald-950 text-emerald-400 border border-emerald-800/40" : "bg-rose-950 text-rose-400 border border-rose-800/40"}`}>
                            {item.decision}
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-zinc-900 border border-zinc-800 text-xs">
            <span className={`h-2 w-2 rounded-full ${loading ? "bg-amber-400 animate-pulse" : "bg-emerald-500"}`} />
            <span className="text-zinc-500 font-medium">{loading ? "Processing..." : "Online"}</span>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 relative z-10">

        {/* ── Search Section ── */}
        <section className="max-w-3xl mx-auto mb-10 text-center">
          <h2 className="text-3xl sm:text-4xl font-black tracking-tight text-zinc-50 mb-3 leading-tight">
            Automated Investment Intelligence
          </h2>
          <p className="text-zinc-400 text-sm sm:text-base mb-7 max-w-xl mx-auto leading-relaxed">
            Enter any company — our 5-node AI agent pipeline fetches live data, analyses sentiment,
            assesses risk, and issues a data-driven verdict.
          </p>

          <div className="relative flex items-center p-1 rounded-2xl bg-zinc-900/90 border border-zinc-800 focus-within:border-emerald-500/50 shadow-2xl transition-all duration-300">
            <div className="pl-4 text-zinc-500">
              <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <input
              id="company-search"
              type="text"
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && runAnalysis(company)}
              placeholder="Apple, Tesla, Reliance Industries, Infosys..."
              className="w-full bg-transparent border-0 py-3.5 pl-3 pr-4 text-zinc-100 placeholder-zinc-500 focus:outline-none focus:ring-0 text-sm sm:text-base"
              disabled={loading}
            />
            {result && !loading && (
              <button
                onClick={() => { setResult(null); setCompany(""); setError(null); setChatHistory([]); }}
                className="mr-1 px-3 py-2 rounded-xl text-zinc-500 hover:text-zinc-300 text-xs transition-colors"
                title="Clear result"
              >
                ✕
              </button>
            )}
            <button
              id="run-agent-btn"
              onClick={() => runAnalysis(company)}
              disabled={loading || !company.trim()}
              className="bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-black font-bold text-sm px-6 py-2.5 rounded-xl shadow-lg shadow-emerald-500/20 disabled:opacity-40 disabled:cursor-not-allowed transition-all duration-200 active:scale-95"
            >
              {loading ? "Analyzing..." : "Run Agent"}
            </button>
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-center gap-2 text-xs">
            <span className="text-zinc-600 font-medium">Try:</span>
            {suggestedCompanies.map((c) => (
              <button
                key={c.name}
                id={`suggest-${c.name.toLowerCase()}`}
                onClick={() => { setCompany(c.query); runAnalysis(c.query); }}
                disabled={loading}
                className="px-3 py-1.5 rounded-lg bg-zinc-900/60 border border-zinc-800 hover:bg-zinc-800 hover:border-zinc-700 text-zinc-400 hover:text-zinc-200 transition-all disabled:opacity-40"
              >
                {c.name}
              </button>
            ))}
          </div>
        </section>

        {/* ── Error ── */}
        {error && (
          <div className="max-w-2xl mx-auto mb-8 p-4 rounded-xl bg-red-950/30 border border-red-800/40 text-red-400 text-sm flex gap-3 items-start animate-fade-in-up">
            <svg className="w-5 h-5 shrink-0 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <span>{error}</span>
          </div>
        )}

        {/* ── Loading ── */}
        {loading && (
          <section className="max-w-lg mx-auto py-12 px-6 rounded-2xl bg-zinc-900/40 border border-zinc-800/50 backdrop-blur-sm shadow-xl animate-fade-in-up">
            <div className="flex flex-col items-center mb-8">
              <div className="relative h-14 w-14 flex items-center justify-center">
                <span className="absolute animate-ping h-10 w-10 rounded-full bg-emerald-500/15" />
                <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-r-2 border-emerald-500" />
              </div>
              <h3 className="text-lg font-bold text-zinc-100 mt-5">Deploying Agent Pipeline</h3>
              <p className="text-zinc-500 text-xs mt-1">LangGraph multi-node orchestration in progress...</p>
            </div>

            <div className="space-y-3">
              {[
                { label: "🔍 Research Node — Web search & company overview", step: 1 },
                { label: "💰 Finance Node — Yahoo Finance price & metrics", step: 2 },
                { label: "📰 News Node — Tavily news & sentiment analysis", step: 3 },
                { label: "⚠️ Risk Node — Groq risk factor assessment", step: 4 },
                { label: "🧠 Decision Node — LLM investment verdict", step: 5 },
              ].map((item) => {
                const isActive = loadStep === item.step;
                const isDone = loadStep > item.step;
                return (
                  <div
                    key={item.step}
                    className={`flex items-center gap-3 p-3 rounded-xl border transition-all duration-500 ${
                      isActive ? "bg-emerald-950/20 border-emerald-800/40 text-emerald-300"
                      : isDone ? "bg-zinc-900/40 border-zinc-800/30 text-zinc-500"
                      : "bg-transparent border-transparent text-zinc-700"
                    }`}
                  >
                    <div className="h-5 w-5 flex items-center justify-center shrink-0">
                      {isDone ? (
                        <svg className="w-4 h-4 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" />
                        </svg>
                      ) : isActive ? (
                        <div className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                      ) : (
                        <div className="h-1.5 w-1.5 rounded-full bg-zinc-700" />
                      )}
                    </div>
                    <span className="text-xs sm:text-sm font-medium">{item.label}</span>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* ── Results Dashboard ── */}
        {result && !loading && (
          <div className="animate-fade-in-up">
            {/* Company header bar */}
            <div className="p-5 sm:p-6 rounded-2xl bg-zinc-900/50 border border-zinc-800/60 backdrop-blur-sm shadow-xl mb-6 flex flex-wrap items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2.5 flex-wrap">
                  <span className="px-2.5 py-0.5 rounded-md bg-zinc-800 text-zinc-300 font-bold text-xs uppercase tracking-wider">
                    {result.financials?.symbol || "N/A"}
                  </span>
                  <h3 className="text-2xl font-black text-zinc-50">
                    {result.financials?.companyName || result.company}
                  </h3>
                  <span className={`text-xs font-bold px-2.5 py-1 rounded-lg ${riskColors.badge}`}>
                    {result.riskAssessment?.riskLevel || "MEDIUM"} RISK
                  </span>
                </div>
                <p className="text-xs text-zinc-500 mt-1.5">
                  {result.financials?.market?.toUpperCase()} ·{" "}
                  {result.financials?.locale?.toUpperCase()} ·{" "}
                  Powered by LangGraph + Groq
                </p>
              </div>

              <div className="text-right">
                <div className="text-3xl font-black text-zinc-50">
                  {result.financials?.price
                    ? `${getCurrencySymbol(result.financials.locale)}${result.financials.price.toFixed(2)}`
                    : "N/A"}
                </div>
                {result.financials?.change !== undefined && (
                  <div className={`text-xs font-bold mt-1 ${result.financials.change >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                    {result.financials.change >= 0 ? "▲" : "▼"}{" "}
                    {Math.abs(result.financials.change).toFixed(2)} (
                    {result.financials.changePercent?.toFixed(2)}%)
                  </div>
                )}
              </div>
            </div>

            {/* Tab navigation */}
            <div className="flex gap-1 mb-6 bg-zinc-900/50 border border-zinc-800/60 rounded-xl p-1 w-fit">
              {(["overview", "risk", "news"] as const).map((tab) => (
                <button
                  key={tab}
                  id={`tab-${tab}`}
                  onClick={() => setActiveTab(tab)}
                  className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wide transition-all ${
                    activeTab === tab
                      ? "bg-zinc-800 text-zinc-100 shadow-sm"
                      : "text-zinc-500 hover:text-zinc-300"
                  }`}
                >
                  {tab === "overview" ? "📊 Overview" : tab === "risk" ? "⚠️ Risk" : "📰 News"}
                </button>
              ))}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* ── Left/Main Column ── */}
              <div className="lg:col-span-2 space-y-6">

                {/* OVERVIEW TAB */}
                {activeTab === "overview" && (
                  <>
                    {/* Chart */}
                    <div className="p-6 rounded-2xl bg-zinc-900/40 border border-zinc-800/50 backdrop-blur-sm shadow-xl card-glow transition-all">
                      <div className="flex items-center justify-between mb-5">
                        <div>
                          <h4 className="text-sm font-bold text-zinc-300">Stock Price Trend</h4>
                          <p className="text-xs text-zinc-600 mt-0.5">6-Month historical chart</p>
                        </div>
                        <span className="text-xs font-semibold px-3 py-1 rounded-full bg-zinc-800 text-zinc-400">Daily Close</span>
                      </div>

                      <div className="h-64 w-full">
                        {isMounted && result.financials?.chartData && result.financials.chartData.length > 0 ? (
                          <ResponsiveContainer width="100%" height="100%">
                            <AreaChart data={result.financials.chartData}>
                              <defs>
                                <linearGradient id="chartGrad" x1="0" y1="0" x2="0" y2="1">
                                  <stop offset="5%" stopColor={result.financials.change && result.financials.change >= 0 ? "#10b981" : "#ef4444"} stopOpacity={0.15} />
                                  <stop offset="95%" stopColor={result.financials.change && result.financials.change >= 0 ? "#10b981" : "#ef4444"} stopOpacity={0} />
                                </linearGradient>
                              </defs>
                              <CartesianGrid strokeDasharray="3 3" stroke="#1c1c1e" vertical={false} />
                              <XAxis dataKey="date" stroke="#3f3f46" fontSize={9} tickLine={false} />
                              <YAxis stroke="#3f3f46" fontSize={9} tickLine={false} domain={["auto", "auto"]}
                                tickFormatter={(v) => `${getCurrencySymbol(result.financials?.locale)}${v}`} />
                              <Tooltip contentStyle={{ backgroundColor: "#18181b", borderColor: "#27272a", borderRadius: "10px", fontSize: "11px", color: "#e4e4e7" }} />
                              <Area type="monotone" dataKey="close"
                                stroke={result.financials.change && result.financials.change >= 0 ? "#10b981" : "#ef4444"}
                                strokeWidth={2} fillOpacity={1} fill="url(#chartGrad)" />
                            </AreaChart>
                          </ResponsiveContainer>
                        ) : (
                          <div className="h-full flex items-center justify-center text-zinc-600 text-sm">
                            No chart data available.
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Financial Metrics */}
                    {result.financials?.ratiosSource === "simulated" && (
                      <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-amber-500/8 border border-amber-500/20 text-amber-400 text-xs font-medium">
                        <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
                        </svg>
                        Financial ratio data unavailable from live sources — price & chart data only shown.
                      </div>
                    )}

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      {[
                        { label: "Market Cap", value: formatMoney(result.financials?.marketCap, result.financials?.locale), desc: "Total valuation" },
                        { label: "P/E Ratio", value: result.financials?.peRatio != null ? `${result.financials.peRatio}x` : "—", desc: "Price-to-earnings" },
                        { label: "TTM Revenue", value: formatMoney(result.financials?.revenue, result.financials?.locale), desc: "Trailing annual" },
                        { label: "Profit Margin", value: result.financials?.profitMargin != null ? `${result.financials.profitMargin}%` : "—", desc: "Net efficiency" },
                      ].map((item, idx) => (
                        <div key={idx} className="p-4 rounded-xl bg-zinc-900/30 border border-zinc-800/60 shadow card-glow transition-all">
                          <span className="text-[10px] uppercase font-bold text-zinc-500 tracking-widest">{item.label}</span>
                          <div className={`text-xl font-black mt-1.5 ${item.value === "—" || item.value === "N/A" ? "text-zinc-600" : "text-zinc-100"}`}>
                            {item.value}
                          </div>
                          <span className="text-[10px] text-zinc-600 font-medium mt-0.5 block">{item.desc}</span>
                        </div>
                      ))}
                    </div>

                    {/* Analyst Synthesis */}
                    <div className="p-6 rounded-2xl bg-zinc-900/40 border border-zinc-800/50 backdrop-blur-sm shadow-xl space-y-5 card-glow transition-all">
                      <div>
                        <h4 className="text-sm font-bold text-zinc-200 mb-2">Analyst Synthesis</h4>
                        <p className="text-zinc-400 text-sm leading-relaxed">{result.decision?.summary}</p>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-5 pt-5 border-t border-zinc-800/50">
                        <div>
                          <h5 className="text-xs uppercase font-black text-emerald-400 tracking-widest mb-3 flex items-center gap-1.5">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                            </svg>
                            Core Strengths
                          </h5>
                          <ul className="space-y-2">
                            {result.decision?.strengths?.map((str, i) => (
                              <li key={i} className="text-xs text-zinc-300 flex items-start gap-2">
                                <span className="text-emerald-500 font-black shrink-0 mt-0.5">•</span>
                                <span>{str}</span>
                              </li>
                            ))}
                          </ul>
                        </div>

                        <div>
                          <h5 className="text-xs uppercase font-black text-rose-400 tracking-widest mb-3 flex items-center gap-1.5">
                            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                            </svg>
                            Key Risks
                          </h5>
                          <ul className="space-y-2">
                            {result.decision?.risks?.map((risk, i) => (
                              <li key={i} className="text-xs text-zinc-300 flex items-start gap-2">
                                <span className="text-rose-500 font-black shrink-0 mt-0.5">•</span>
                                <span>{risk}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    </div>
                  </>
                )}

                {/* RISK TAB */}
                {activeTab === "risk" && result.riskAssessment && (
                  <div className="space-y-5 animate-fade-in-up">
                    {/* Risk Overview Card */}
                    <div className={`p-6 rounded-2xl border backdrop-blur-sm shadow-xl ${riskColors.bg} ${riskColors.border}`}>
                      <div className="flex items-start justify-between flex-wrap gap-4">
                        <div>
                          <span className="text-[10px] uppercase font-bold text-zinc-500 tracking-widest">Overall Risk Assessment</span>
                          <div className={`text-4xl font-black mt-2 ${riskColors.text}`}>
                            {result.riskAssessment.riskLevel}
                          </div>
                          <p className="text-xs text-zinc-400 mt-2 max-w-md leading-relaxed">
                            {result.riskAssessment.summary}
                          </p>
                        </div>
                        <div className="text-right">
                          <div className={`text-5xl font-black ${riskColors.text}`}>
                            {result.riskAssessment.overallRiskScore}
                          </div>
                          <div className="text-xs text-zinc-500 font-medium">/ 100 risk score</div>
                        </div>
                      </div>

                      <div className="mt-5">
                        <div className="h-2 w-full bg-zinc-800/60 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-1000 ${
                              result.riskAssessment.riskLevel === "LOW" ? "bg-emerald-500"
                              : result.riskAssessment.riskLevel === "MEDIUM" ? "bg-amber-400"
                              : result.riskAssessment.riskLevel === "HIGH" ? "bg-orange-500"
                              : "bg-rose-500"
                            }`}
                            style={{ width: `${result.riskAssessment.overallRiskScore}%` }}
                          />
                        </div>
                        <div className="flex justify-between text-[10px] text-zinc-600 mt-1 font-semibold">
                          <span>LOW RISK</span>
                          <span>HIGH RISK</span>
                        </div>
                      </div>
                    </div>

                    {/* Risk Factors */}
                    <div className="p-6 rounded-2xl bg-zinc-900/40 border border-zinc-800/50 backdrop-blur-sm shadow-xl">
                      <h4 className="text-sm font-bold text-zinc-200 mb-4">Risk Factor Breakdown</h4>
                      <div className="space-y-3">
                        {result.riskAssessment.factors?.map((factor, i) => (
                          <div key={i} className="p-4 rounded-xl bg-zinc-900/50 border border-zinc-800/40">
                            <div className="flex items-start justify-between gap-3">
                              <div className="flex items-start gap-2.5">
                                <div className={`h-2 w-2 rounded-full mt-1.5 shrink-0 ${getSeverityDot(factor.severity)}`} />
                                <div>
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span className="text-xs font-bold text-zinc-200">{factor.title}</span>
                                    <span className="text-[9px] uppercase font-bold px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400 tracking-wider">
                                      {factor.category}
                                    </span>
                                  </div>
                                  <p className="text-xs text-zinc-500 mt-1 leading-relaxed">{factor.description}</p>
                                </div>
                              </div>
                              <span className={`text-[10px] font-black shrink-0 px-2 py-0.5 rounded-md ${
                                factor.severity === "HIGH" ? "bg-rose-950 text-rose-400 border border-rose-800/40"
                                : factor.severity === "MEDIUM" ? "bg-amber-950 text-amber-400 border border-amber-800/40"
                                : "bg-emerald-950 text-emerald-400 border border-emerald-800/40"
                              }`}>{factor.severity}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Mitigants */}
                    {result.riskAssessment.mitigants && result.riskAssessment.mitigants.length > 0 && (
                      <div className="p-6 rounded-2xl bg-zinc-900/40 border border-zinc-800/50 backdrop-blur-sm shadow-xl">
                        <h4 className="text-sm font-bold text-zinc-200 mb-4 flex items-center gap-2">
                          <svg className="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                          </svg>
                          Risk Mitigants
                        </h4>
                        <ul className="space-y-2">
                          {result.riskAssessment.mitigants.map((m, i) => (
                            <li key={i} className="text-xs text-zinc-300 flex items-start gap-2">
                              <span className="text-emerald-500 font-black shrink-0 mt-0.5">✓</span>
                              <span>{m}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>
                )}

                {activeTab === "risk" && !result.riskAssessment && (
                  <div className="p-8 rounded-2xl bg-zinc-900/40 border border-zinc-800/50 text-center text-zinc-600 text-sm">
                    Risk assessment data not available for this analysis.
                  </div>
                )}

                {/* NEWS TAB */}
                {activeTab === "news" && (
                  <div className="space-y-5 animate-fade-in-up">
                    {/* Sentiment */}
                    <div className="p-6 rounded-2xl bg-zinc-900/40 border border-zinc-800/50 backdrop-blur-sm shadow-xl">
                      <h4 className="text-sm font-bold text-zinc-200 mb-4">Market Sentiment Analysis</h4>

                      <div className="flex items-center justify-between mb-3">
                        <span className="text-xs text-zinc-500 font-medium">Consensus Signal</span>
                        <span className={`text-xs font-black px-3 py-1 rounded-full ${
                          result.research?.sentiment?.label === "Positive"
                            ? "bg-emerald-950 text-emerald-400 border border-emerald-800/40"
                            : result.research?.sentiment?.label === "Negative"
                            ? "bg-rose-950 text-rose-400 border border-rose-800/40"
                            : "bg-zinc-800 text-zinc-400 border border-zinc-700/40"
                        }`}>{result.research?.sentiment?.label}</span>
                      </div>

                      <div className="relative mt-3">
                        <div className="h-3 w-full bg-zinc-800 rounded-full flex overflow-hidden">
                          <div className="w-1/2 h-full bg-gradient-to-r from-rose-500/30 to-zinc-800" />
                          <div className="w-1/2 h-full bg-gradient-to-r from-zinc-800 to-emerald-500/30" />
                        </div>
                        <div
                          className="absolute -top-0.5 h-4 w-1.5 bg-white shadow-lg rounded-full transition-all duration-1000"
                          style={{ left: `calc(${50 + (result.research?.sentiment?.score || 0) / 2}% - 3px)` }}
                        />
                        <div className="flex justify-between text-[10px] text-zinc-600 mt-1.5 font-semibold">
                          <span>Bearish −100</span>
                          <span className="text-zinc-300 font-bold">Score: {result.research?.sentiment?.score ?? 0}</span>
                          <span>Bullish +100</span>
                        </div>
                      </div>

                      <p className="text-xs text-zinc-500 mt-3 leading-relaxed">{result.research?.sentiment?.summary}</p>
                    </div>

                    {/* News articles */}
                    <div className="p-6 rounded-2xl bg-zinc-900/40 border border-zinc-800/50 backdrop-blur-sm shadow-xl">
                      <h4 className="text-sm font-bold text-zinc-200 mb-4">Recent Market News</h4>
                      <div className="space-y-3">
                        {result.research?.news && result.research.news.length > 0 ? (
                          result.research.news.map((item, idx) => (
                            <a
                              key={idx}
                              href={item.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="block p-4 rounded-xl bg-zinc-900/60 border border-zinc-800/50 hover:border-zinc-700 transition-all card-glow group"
                            >
                              <div className="flex justify-between items-center text-[10px] text-zinc-600 font-bold mb-1.5">
                                <span className="uppercase tracking-wide">{item.source}</span>
                                <span>{item.publishedAt ? new Date(item.publishedAt).toLocaleDateString(undefined, { month: "short", day: "numeric" }) : ""}</span>
                              </div>
                              <h5 className="text-xs font-bold text-zinc-200 line-clamp-2 group-hover:text-emerald-400 transition-colors">{item.title}</h5>
                              <p className="text-[10px] text-zinc-500 line-clamp-2 mt-1.5 leading-relaxed">{item.snippet}</p>
                            </a>
                          ))
                        ) : (
                          <span className="text-xs text-zinc-600">No recent news found.</span>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* ── Right Column ── */}
              <div className="space-y-6">
                {/* Verdict */}
                <div className="p-6 rounded-2xl bg-zinc-900/40 border border-zinc-800/50 backdrop-blur-sm shadow-xl flex flex-col items-center text-center card-glow transition-all">
                  <span className="text-[10px] uppercase font-black text-zinc-500 tracking-widest">InvestIQ Verdict</span>

                  <div className={`mt-4 px-8 py-4 rounded-2xl font-black text-2xl tracking-widest shadow-xl transition-all ${
                    isInvest
                      ? "bg-gradient-to-tr from-emerald-500/20 to-teal-500/10 border border-emerald-500/40 text-emerald-400 shadow-emerald-500/10"
                      : "bg-gradient-to-tr from-rose-500/20 to-red-500/10 border border-rose-500/40 text-rose-400 shadow-rose-500/10"
                  }`}>
                    {result.decision?.decision}
                  </div>

                  <div className="w-full mt-6 space-y-4">
                    <div>
                      <div className="flex justify-between text-xs font-semibold mb-1.5">
                        <span className="text-zinc-500">Investment Score</span>
                        <span className="text-zinc-300">{result.decision?.investmentScore || 0}/100</span>
                      </div>
                      <div className="h-2 w-full bg-zinc-800 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-1000 ${isInvest ? "bg-emerald-500" : "bg-rose-500"}`}
                          style={{ width: `${result.decision?.investmentScore || 0}%` }}
                        />
                      </div>
                    </div>

                    <div>
                      <div className="flex justify-between text-xs font-semibold mb-1.5">
                        <span className="text-zinc-500">Analyst Confidence</span>
                        <span className="text-zinc-300">{result.decision?.confidence || 0}%</span>
                      </div>
                      <div className="h-2 w-full bg-zinc-800 rounded-full overflow-hidden">
                        <div
                          className="h-full rounded-full bg-zinc-400 transition-all duration-1000"
                          style={{ width: `${result.decision?.confidence || 0}%` }}
                        />
                      </div>
                    </div>

                    {result.riskAssessment && (
                      <div>
                        <div className="flex justify-between text-xs font-semibold mb-1.5">
                          <span className="text-zinc-500">Risk Score</span>
                          <span className={riskColors.text}>{result.riskAssessment.overallRiskScore}/100</span>
                        </div>
                        <div className="h-2 w-full bg-zinc-800 rounded-full overflow-hidden">
                          <div
                            className={`h-full rounded-full transition-all duration-1000 ${
                              result.riskAssessment.riskLevel === "LOW" ? "bg-emerald-500"
                              : result.riskAssessment.riskLevel === "MEDIUM" ? "bg-amber-400"
                              : result.riskAssessment.riskLevel === "HIGH" ? "bg-orange-500"
                              : "bg-rose-500"
                            }`}
                            style={{ width: `${result.riskAssessment.overallRiskScore}%` }}
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  <button
                    onClick={copyReport}
                    className="mt-5 w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-zinc-800 hover:bg-zinc-700 border border-zinc-700 text-zinc-300 hover:text-zinc-100 text-xs font-semibold transition-all"
                  >
                    {copied ? "✓ Copied!" : "Copy Report"}
                  </button>
                </div>

                {/* Quick Sentiment snapshot (right column) */}
                {activeTab === "overview" && (
                  <div className="p-5 rounded-2xl bg-zinc-900/40 border border-zinc-800/50 backdrop-blur-sm shadow-xl">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="text-xs font-bold text-zinc-300">Market Sentiment</h4>
                      <span className={`text-xs font-black px-2.5 py-0.5 rounded-full ${
                        result.research?.sentiment?.label === "Positive"
                          ? "bg-emerald-950 text-emerald-400 border border-emerald-800/40"
                          : result.research?.sentiment?.label === "Negative"
                          ? "bg-rose-950 text-rose-400 border border-rose-800/40"
                          : "bg-zinc-800 text-zinc-400"
                      }`}>{result.research?.sentiment?.label}</span>
                    </div>
                    <div className="relative">
                      <div className="h-2.5 w-full bg-zinc-800 rounded-full flex overflow-hidden">
                        <div className="w-1/2 h-full bg-gradient-to-r from-rose-500/25 to-zinc-800" />
                        <div className="w-1/2 h-full bg-gradient-to-r from-zinc-800 to-emerald-500/25" />
                      </div>
                      <div
                        className="absolute -top-0.5 h-3.5 w-1 bg-white shadow rounded-full transition-all duration-1000"
                        style={{ left: `calc(${50 + (result.research?.sentiment?.score || 0) / 2}% - 2px)` }}
                      />
                    </div>
                    <p className="text-[10px] text-zinc-500 mt-2 leading-relaxed line-clamp-3">
                      {result.research?.sentiment?.summary}
                    </p>
                    <button
                      onClick={() => setActiveTab("news")}
                      className="mt-3 text-[10px] font-semibold text-emerald-500 hover:text-emerald-400 transition-colors"
                    >
                      View all news →
                    </button>
                  </div>
                )}

                {/* AI Chat */}
                <div className="p-5 rounded-2xl bg-zinc-900/40 border border-zinc-800/50 backdrop-blur-sm shadow-xl flex flex-col h-[420px] card-glow transition-all">
                  <div className="flex items-center gap-2 border-b border-zinc-800/50 pb-3 mb-3">
                    <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                    <h4 className="text-xs uppercase font-black text-zinc-400 tracking-wider">Ask the Lead Analyst</h4>
                  </div>

                  <div className="flex-1 overflow-y-auto space-y-3 pr-1">
                    {chatHistory.map((msg, i) => (
                      <div
                        key={i}
                        className={`flex flex-col max-w-[88%] rounded-xl p-3 leading-relaxed text-xs ${
                          msg.role === "user"
                            ? "bg-zinc-800 border border-zinc-700 text-zinc-200 ml-auto"
                            : "bg-zinc-900 text-zinc-300"
                        }`}
                      >
                        <span className="text-[9px] font-black text-zinc-500 mb-1 uppercase">
                          {msg.role === "user" ? "You" : "InvestIQ"}
                        </span>
                        <p className="whitespace-pre-line font-medium">{msg.content}</p>
                      </div>
                    ))}
                    {chatLoading && (
                      <div className="bg-zinc-900 text-zinc-300 max-w-[80%] rounded-xl p-3 flex items-center gap-1.5">
                        <div className="h-1.5 w-1.5 rounded-full bg-zinc-500 animate-bounce" style={{ animationDelay: "0ms" }} />
                        <div className="h-1.5 w-1.5 rounded-full bg-zinc-500 animate-bounce" style={{ animationDelay: "150ms" }} />
                        <div className="h-1.5 w-1.5 rounded-full bg-zinc-500 animate-bounce" style={{ animationDelay: "300ms" }} />
                      </div>
                    )}
                    <div ref={chatBottomRef} />
                  </div>

                  <form onSubmit={sendChatMessage} className="flex gap-2 mt-3">
                    <input
                      id="chat-input"
                      type="text"
                      value={chatMessage}
                      onChange={(e) => setChatMessage(e.target.value)}
                      placeholder="Ask about PE ratios, risks, margins..."
                      className="flex-1 rounded-xl bg-zinc-900 border border-zinc-800 text-xs px-3.5 py-2.5 focus:outline-none focus:border-zinc-700 text-zinc-200 placeholder-zinc-600"
                      disabled={chatLoading}
                    />
                    <button
                      id="chat-send"
                      type="submit"
                      className="p-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black transition-colors disabled:opacity-40"
                      disabled={chatLoading || !chatMessage.trim()}
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                      </svg>
                    </button>
                  </form>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Empty State ── */}
        {!result && !loading && (
          <section className="text-center py-20 animate-fade-in-up">
            <div className="h-16 w-16 mx-auto bg-zinc-900 border border-zinc-800 rounded-2xl flex items-center justify-center text-zinc-400 mb-6 shadow-md">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
              </svg>
            </div>
            <h3 className="text-xl font-bold text-zinc-300">No Analysis Active</h3>
            <p className="text-zinc-500 text-sm max-w-sm mx-auto mt-2 leading-relaxed">
              Enter a company name above to trigger the 5-node LangGraph investment agent.
            </p>

            {/* Architecture preview */}
            <div className="mt-10 max-w-2xl mx-auto">
              <p className="text-xs text-zinc-600 font-bold uppercase tracking-widest mb-4">Agent Pipeline</p>
              <div className="flex flex-wrap items-center justify-center gap-2 text-xs">
                {["🔍 Research", "💰 Finance", "📰 News", "⚠️ Risk", "🧠 Decision"].map((node, i, arr) => (
                  <div key={i} className="flex items-center gap-2">
                    <div className="px-3 py-2 rounded-xl bg-zinc-900 border border-zinc-800 text-zinc-400 font-semibold">
                      {node}
                    </div>
                    {i < arr.length - 1 && (
                      <span className="text-zinc-700">→</span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}
      </main>

      {/* ── Footer ── */}
      <footer className="border-t border-zinc-900 bg-zinc-950/60 text-center py-8 text-xs text-zinc-600 mt-16">
        <p className="font-medium">© 2026 InvestIQ · Built with LangGraph, Groq LLM, Tavily, and Yahoo Finance</p>
        <p className="mt-1.5 text-zinc-700 max-w-lg mx-auto">
          Disclaimer: All content is AI-generated and does not constitute formal financial advice. Do your own due diligence before investing.
        </p>
      </footer>
    </div>
  );
}