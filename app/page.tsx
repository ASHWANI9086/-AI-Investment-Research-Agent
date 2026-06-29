"use client";

import { useState, useRef, useEffect } from "react";
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
  NewsSentiment,
  CompanyResearch,
  ChartPoint,
  FinancialData,
  InvestmentDecision,
  ChatMessage,
  InvestmentState,
} from "@/types/investment";

function getCurrencySymbol(locale?: string) {
  if (!locale) return "$";
  const loc = locale.toLowerCase();
  if (loc === "inr") return "₹";
  if (loc === "gbp" || loc === "gbx") return "£";
  if (loc === "eur") return "€";
  if (loc === "jpy") return "¥";
  return "$";
}

export default function Home() {
  const [company, setCompany] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadStep, setLoadStep] = useState(0);
  const [result, setResult] = useState<InvestmentState | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  // Chatbot state
  const [chatMessage, setChatMessage] = useState("");
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [chatLoading, setChatLoading] = useState(false);
  const chatBottomRef = useRef<HTMLDivElement>(null);

  const suggestedCompanies = [
    { name: "NVIDIA", query: "Nvidia" },
    { name: "Apple", query: "Apple Inc." },
    { name: "Tesla", query: "Tesla" },
    { name: "Microsoft", query: "Microsoft" },
    { name: "Amazon", query: "Amazon" },
  ];

  // Auto-scroll chat to bottom
  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatHistory, chatLoading]);

  // Handle loading animations step by step
  useEffect(() => {
    if (!loading) return;
    setLoadStep(1);

    const t1 = setTimeout(() => setLoadStep(2), 2200);
    const t2 = setTimeout(() => setLoadStep(3), 5000);
    const t3 = setTimeout(() => setLoadStep(4), 8000);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, [loading]);

  const runAnalysis = async (searchCompany: string) => {
    if (!searchCompany.trim()) return;

    setLoading(true);
    setError(null);
    setResult(null);
    setChatHistory([]);

    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ company: searchCompany }),
      });

      if (!res.ok) {
        throw new Error(`Analysis failed with status ${res.status}`);
      }

      const data = await res.json();
      if (data.error) {
        throw new Error(data.error);
      }

      setResult(data);
      // Pre-populate chat with a welcome message from the analyst
      setChatHistory([
        {
          role: "assistant",
          content: `Hello! I have completed the investment analysis for ${data.financials?.companyName || searchCompany} (${data.financials?.symbol || "N/A"}). I recommended a **${data.decision?.decision || "PASS"}** with a confidence score of **${data.decision?.confidence || 0}%**. Feel free to ask me any questions about their metrics, strengths, or risk factors!`,
        },
      ]);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "An unexpected error occurred during analysis.");
    } finally {
      setLoading(false);
      setLoadStep(0);
    }
  };

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
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          company: result.company,
          research: result.research,
          financials: result.financials,
          decision: result.decision,
          message: userMsg,
          history: chatHistory,
        }),
      });

      if (!res.ok) {
        throw new Error("Chat assistant failed to respond.");
      }

      const data = await res.json();
      setChatHistory((prev) => [
        ...prev,
        { role: "assistant", content: data.content },
      ]);
    } catch (err: any) {
      console.error(err);
      setChatHistory((prev) => [
        ...prev,
        {
          role: "assistant",
          content: "Sorry, I encountered an error while processing that question. Please try again.",
        },
      ]);
    } finally {
      setChatLoading(false);
    }
  };

  const formatMoney = (num?: number) => {
    if (num === undefined) return "N/A";
    if (num >= 1e12) return `$${(num / 1e12).toFixed(2)}T`;
    if (num >= 1e9) return `$${(num / 1e9).toFixed(2)}B`;
    if (num >= 1e6) return `$${(num / 1e6).toFixed(2)}M`;
    return `$${num.toLocaleString()}`;
  };

  const formatLargeNumber = (num?: number) => {
    if (num === undefined) return "N/A";
    if (num >= 1e12) return `${(num / 1e12).toFixed(2)}T`;
    if (num >= 1e9) return `${(num / 1e9).toFixed(2)}B`;
    if (num >= 1e6) return `${(num / 1e6).toFixed(2)}M`;
    return num.toLocaleString();
  };

  const isInvest = result?.decision?.decision === "INVEST";

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 font-sans selection:bg-emerald-500/30 selection:text-emerald-400">
      {/* Background gradients */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -left-40 w-96 h-96 bg-emerald-500/10 rounded-full blur-3xl" />
        <div className="absolute top-1/3 -right-20 w-80 h-80 bg-blue-500/5 rounded-full blur-3xl" />
        <div className="absolute bottom-10 left-1/3 w-96 h-96 bg-purple-500/5 rounded-full blur-3xl" />
      </div>

      {/* Header */}
      <header className="relative border-b border-zinc-900 bg-zinc-950/80 backdrop-blur-md px-6 py-4 flex items-center justify-between z-10">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-tr from-emerald-500 to-teal-400 flex items-center justify-center font-bold text-black text-xl shadow-lg shadow-emerald-500/20">
            IQ
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight bg-gradient-to-r from-zinc-50 via-zinc-200 to-zinc-400 bg-clip-text text-transparent">
              InvestIQ
            </h1>
            <p className="text-xs text-zinc-500 font-medium">
              Multi-Agent AI Investment Specialist
            </p>
          </div>
        </div>

        <div className="flex items-center gap-6">
          <div className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full bg-zinc-900 border border-zinc-800 text-xs">
            <span className={`h-2.5 w-2.5 rounded-full ${loading ? "bg-amber-400 animate-pulse" : "bg-emerald-500"}`} />
            <span className="text-zinc-400 font-medium">
              {loading ? "Agent Processing..." : "All Nodes Online"}
            </span>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 relative z-10">
        {/* Search & Suggestions */}
        <section className="max-w-3xl mx-auto mb-10 text-center">
          <h2 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-zinc-100 mb-3 bg-gradient-to-b from-zinc-50 to-zinc-300 bg-clip-text text-transparent">
            Automated Investment Intelligence
          </h2>
          <p className="text-zinc-400 text-sm sm:text-base mb-6 max-w-xl mx-auto">
            Input any corporation. Our autonomous AI swarm will fetch web data, compile real-time financials, analyze news sentiment, and output a verified decision.
          </p>

          {/* Search bar */}
          <div className="relative flex items-center p-1 rounded-2xl bg-zinc-900/90 border border-zinc-800 focus-within:border-emerald-500/50 shadow-2xl transition-all duration-300">
            <div className="pl-4 text-zinc-500">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <input
              type="text"
              value={company}
              onChange={(e) => setCompany(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && runAnalysis(company)}
              placeholder="Search Apple, Tesla, Nvidia..."
              className="w-full bg-transparent border-0 py-3.5 pl-3 pr-4 text-zinc-100 placeholder-zinc-500 focus:outline-none focus:ring-0 text-sm sm:text-base"
              disabled={loading}
            />
            <button
              onClick={() => runAnalysis(company)}
              disabled={loading || !company.trim()}
              className="bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600 text-black font-semibold text-sm px-6 py-2.5 rounded-xl shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300"
            >
              {loading ? "Analyzing..." : "Run Agent"}
            </button>
          </div>

          {/* Suggested quick clicks */}
          <div className="mt-4 flex flex-wrap items-center justify-center gap-2 text-xs">
            <span className="text-zinc-500 font-medium mr-1">Suggestions:</span>
            {suggestedCompanies.map((c) => (
              <button
                key={c.name}
                onClick={() => {
                  setCompany(c.query);
                  runAnalysis(c.query);
                }}
                disabled={loading}
                className="px-3 py-1.5 rounded-lg bg-zinc-900/60 border border-zinc-800 hover:bg-zinc-800 hover:border-zinc-700 text-zinc-400 hover:text-zinc-200 transition-colors"
              >
                {c.name}
              </button>
            ))}
          </div>
        </section>

        {/* Error message */}
        {error && (
          <div className="max-w-2xl mx-auto mb-8 p-4 rounded-xl bg-red-950/30 border border-red-800/50 text-red-400 text-sm flex gap-3 items-center">
            <svg className="w-5 h-5 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <span>{error}</span>
          </div>
        )}

        {/* Loading Swarm Progress */}
        {loading && (
          <section className="max-w-xl mx-auto py-12 px-6 rounded-2xl bg-zinc-900/40 border border-zinc-900 backdrop-blur-sm shadow-xl">
            <div className="flex flex-col items-center mb-8">
              <div className="relative h-12 w-12 flex items-center justify-center">
                <span className="absolute animate-ping h-8 w-8 rounded-full bg-emerald-500/20 opacity-75" />
                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-r-2 border-emerald-500" />
              </div>
              <h3 className="text-lg font-bold text-zinc-200 mt-4">
                Analyzing Market Data
              </h3>
              <p className="text-zinc-500 text-xs mt-1">
                Deploying autonomous LangGraph agents...
              </p>
            </div>

            {/* Steps Timeline */}
            <div className="space-y-4 text-sm font-medium">
              {[
                { label: "Initializing Research Graph", step: 1 },
                { label: "Scoping Tavily News & sentiment logs", step: 2 },
                { label: "Pulling financials & price data", step: 3 },
                { label: "Groq LLM synthesizing final report", step: 4 },
              ].map((item) => {
                const isActive = loadStep === item.step;
                const isDone = loadStep > item.step;
                return (
                  <div
                    key={item.step}
                    className={`flex items-center gap-3 p-3 rounded-xl border transition-all duration-300 ${
                      isActive
                        ? "bg-emerald-950/20 border-emerald-800/40 text-emerald-400"
                        : isDone
                        ? "bg-zinc-900/30 border-zinc-800/30 text-zinc-400"
                        : "bg-transparent border-transparent text-zinc-600"
                    }`}
                  >
                    <div className="flex items-center justify-center h-5 w-5 rounded-full shrink-0">
                      {isDone ? (
                        <svg className="w-4 h-4 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7" />
                        </svg>
                      ) : isActive ? (
                        <div className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                      ) : (
                        <div className="h-1.5 w-1.5 rounded-full bg-zinc-800" />
                      )}
                    </div>
                    <span className="text-xs sm:text-sm">{item.label}</span>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* Dashboard Grid Result */}
        {result && !loading && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Left/Middle Column (Metrics, Chart, Overview) - Col span 2 */}
            <div className="lg:col-span-2 space-y-8">
              {/* Overview banner */}
              <div className="p-6 rounded-2xl bg-zinc-900/40 border border-zinc-900 backdrop-blur-sm shadow-xl flex flex-wrap items-center justify-between gap-6">
                <div>
                  <div className="flex items-center gap-2.5">
                    <span className="px-2.5 py-0.5 rounded-md bg-zinc-800 text-zinc-300 font-bold text-xs uppercase">
                      {result.financials?.symbol || "N/A"}
                    </span>
                    <h3 className="text-2xl font-extrabold text-zinc-100">
                      {result.financials?.companyName || result.company}
                    </h3>
                  </div>
                  <p className="text-xs text-zinc-500 mt-1">
                    Market: {result.financials?.market?.toUpperCase()} | Currency: {result.financials?.locale?.toUpperCase()} | Pricing source: Yahoo Finance
                  </p>
                </div>

                {/* Stock Price Panel */}
                <div className="text-right">
                  <div className="text-3xl font-black text-zinc-100">
                    {result.financials?.price ? `${getCurrencySymbol(result.financials.locale)}${result.financials.price.toFixed(2)}` : "N/A"}
                  </div>
                  {result.financials?.change !== undefined && (
                    <div
                      className={`text-xs font-bold mt-1 flex items-center justify-end gap-1 ${
                        result.financials.change >= 0 ? "text-emerald-400" : "text-rose-400"
                      }`}
                    >
                      <span>
                        {result.financials.change >= 0 ? "▲" : "▼"}{" "}
                        {Math.abs(result.financials.change).toFixed(2)} (
                        {result.financials.changePercent?.toFixed(2)}%)
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Chart widget */}
              <div className="p-6 rounded-2xl bg-zinc-900/40 border border-zinc-900 backdrop-blur-sm shadow-xl">
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h4 className="text-sm font-bold text-zinc-400">Stock Price Trend</h4>
                    <p className="text-xs text-zinc-600">6-Month historical stock aggregates</p>
                  </div>
                  <span className="text-xs font-semibold px-3 py-1 rounded-full bg-zinc-800 text-zinc-400">
                    Daily Close
                  </span>
                </div>

                <div className="h-72 w-full">
                  {isMounted && result.financials?.chartData && result.financials.chartData.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={result.financials.chartData}>
                        <defs>
                          <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop
                              offset="5%"
                              stopColor={result.financials.change && result.financials.change >= 0 ? "#10b981" : "#ef4444"}
                              stopOpacity={0.15}
                            />
                            <stop
                              offset="95%"
                              stopColor={result.financials.change && result.financials.change >= 0 ? "#10b981" : "#ef4444"}
                              stopOpacity={0}
                            />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#1f2937" vertical={false} />
                        <XAxis dataKey="date" stroke="#4b5563" fontSize={10} tickLine={false} />
                        <YAxis
                          stroke="#4b5563"
                          fontSize={10}
                          tickLine={false}
                          domain={["auto", "auto"]}
                          tickFormatter={(val) => `${getCurrencySymbol(result.financials?.locale)}${val}`}
                        />
                        <Tooltip
                          contentStyle={{
                            backgroundColor: "#18181b",
                            borderColor: "#27272a",
                            borderRadius: "12px",
                            fontSize: "12px",
                            color: "#f4f4f5",
                          }}
                        />
                        <Area
                          type="monotone"
                          dataKey="close"
                          stroke={result.financials.change && result.financials.change >= 0 ? "#10b981" : "#ef4444"}
                          strokeWidth={2}
                          fillOpacity={1}
                          fill="url(#chartGradient)"
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  ) : result.financials?.chartData && result.financials.chartData.length > 0 ? (
                    <div className="h-full flex items-center justify-center text-zinc-600 text-sm">
                      Initializing Stock Price Trend...
                    </div>
                  ) : (
                    <div className="h-full flex items-center justify-center text-zinc-600 text-sm">
                      No historical chart data available.
                    </div>
                  )}
                </div>
              </div>

              {/* Financial Metrics Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                {[
                  {
                    label: "Market Cap",
                    value: formatMoney(result.financials?.marketCap),
                    desc: "Hedge-level valuation",
                  },
                  {
                    label: "P/E Ratio",
                    value: result.financials?.peRatio || "N/A",
                    desc: "Valuation multiple",
                  },
                  {
                    label: "TTM Revenue",
                    value: formatMoney(result.financials?.revenue),
                    desc: "Trailing annual sales",
                  },
                  {
                    label: "Profit Margin",
                    value: result.financials?.profitMargin !== undefined ? `${result.financials.profitMargin}%` : "N/A",
                    desc: "Net profit efficiency",
                  },
                ].map((item, idx) => (
                  <div key={idx} className="p-4 rounded-xl bg-zinc-900/30 border border-zinc-900/80 shadow">
                    <span className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider">
                      {item.label}
                    </span>
                    <div className="text-lg sm:text-xl font-extrabold text-zinc-200 mt-1">
                      {item.value}
                    </div>
                    <span className="text-[10px] text-zinc-600 font-medium block mt-0.5">
                      {item.desc}
                    </span>
                  </div>
                ))}
              </div>

              {/* Analyst Detail Breakdown */}
              <div className="p-6 rounded-2xl bg-zinc-900/40 border border-zinc-900 backdrop-blur-sm shadow-xl space-y-6">
                <div>
                  <h4 className="text-base font-bold text-zinc-200">Analyst synthesis</h4>
                  <p className="text-zinc-400 text-xs sm:text-sm mt-2 leading-relaxed">
                    {result.decision?.summary}
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-zinc-900">
                  {/* Strengths */}
                  <div>
                    <h5 className="text-xs uppercase font-extrabold text-emerald-400 tracking-wider mb-3 flex items-center gap-1.5">
                      <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      Core Strengths
                    </h5>
                    <ul className="space-y-2.5">
                      {result.decision?.strengths?.map((str, i) => (
                        <li key={i} className="text-xs sm:text-sm text-zinc-300 flex items-start gap-2">
                          <span className="text-emerald-500 font-bold shrink-0 mt-0.5">•</span>
                          <span>{str}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Risks */}
                  <div>
                    <h5 className="text-xs uppercase font-extrabold text-rose-400 tracking-wider mb-3 flex items-center gap-1.5">
                      <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                      </svg>
                      Key Risks
                    </h5>
                    <ul className="space-y-2.5">
                      {result.decision?.risks?.map((risk, i) => (
                        <li key={i} className="text-xs sm:text-sm text-zinc-300 flex items-start gap-2">
                          <span className="text-rose-500 font-bold shrink-0 mt-0.5">•</span>
                          <span>{risk}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column (Verdict, Sentiment, News, Chatbot) */}
            <div className="space-y-8">
              {/* Verdict Widget */}
              <div className="p-6 rounded-2xl bg-zinc-900/40 border border-zinc-900 backdrop-blur-sm shadow-xl flex flex-col items-center justify-center text-center">
                <span className="text-[10px] uppercase font-bold text-zinc-500 tracking-wider">
                  InvestIQ recommendation
                </span>
                <div
                  className={`mt-4 px-8 py-3.5 rounded-2xl font-black text-2xl tracking-widest shadow-xl ${
                    isInvest
                      ? "bg-gradient-to-tr from-emerald-500/20 to-teal-500/20 border border-emerald-500/40 text-emerald-400 shadow-emerald-500/5"
                      : "bg-gradient-to-tr from-rose-500/20 to-red-500/20 border border-rose-500/40 text-rose-400 shadow-rose-500/5"
                  }`}
                >
                  {result.decision?.decision}
                </div>

                <div className="w-full mt-6 space-y-4">
                  {/* Score Bar */}
                  <div>
                    <div className="flex justify-between items-center text-xs font-semibold mb-1">
                      <span className="text-zinc-500">Investment Score</span>
                      <span className="text-zinc-300">{result.decision?.investmentScore || 0}/100</span>
                    </div>
                    <div className="h-2 w-full bg-zinc-800 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-1000 ${
                          isInvest ? "bg-emerald-500" : "bg-rose-500"
                        }`}
                        style={{ width: `${result.decision?.investmentScore || 0}%` }}
                      />
                    </div>
                  </div>

                  {/* Confidence Bar */}
                  <div>
                    <div className="flex justify-between items-center text-xs font-semibold mb-1">
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
                </div>
              </div>

              {/* News & Sentiment */}
              <div className="p-6 rounded-2xl bg-zinc-900/40 border border-zinc-900 backdrop-blur-sm shadow-xl space-y-6">
                <div>
                  <h4 className="text-sm font-bold text-zinc-300">Public Sentiment</h4>
                  <div className="flex items-center justify-between mt-3">
                    <span className="text-xs text-zinc-500 font-medium">Market Consensus</span>
                    <span
                      className={`text-xs font-extrabold px-2.5 py-0.5 rounded-full ${
                        result.research?.sentiment?.label === "Positive"
                          ? "bg-emerald-950 text-emerald-400 border border-emerald-800/40"
                          : result.research?.sentiment?.label === "Negative"
                          ? "bg-rose-950 text-rose-400 border border-rose-800/40"
                          : "bg-zinc-800 text-zinc-400 border border-zinc-700/40"
                      }`}
                    >
                      {result.research?.sentiment?.label}
                    </span>
                  </div>

                  {/* Sentiment score meter */}
                  <div className="relative mt-4">
                    <div className="h-2.5 w-full bg-zinc-800 rounded-full flex overflow-hidden">
                      {/* Negative half */}
                      <div className="w-1/2 h-full bg-gradient-to-r from-rose-500/20 to-zinc-800 border-r border-zinc-900" />
                      {/* Positive half */}
                      <div className="w-1/2 h-full bg-gradient-to-r from-zinc-800 to-emerald-500/20" />
                    </div>
                    {/* Tick indicator */}
                    <div
                      className="absolute -top-1 h-4 w-1 bg-white shadow rounded-full transition-all duration-1000"
                      style={{
                        left: `${50 + (result.research?.sentiment?.score || 0) / 2}%`,
                      }}
                    />
                  </div>
                  <span className="text-[10px] text-zinc-500 mt-2 block leading-relaxed">
                    {result.research?.sentiment?.summary}
                  </span>
                </div>

                {/* News articles */}
                <div className="space-y-3 pt-4 border-t border-zinc-900">
                  <h4 className="text-xs uppercase font-extrabold text-zinc-400 tracking-wider">
                    Recent Market Catalyst News
                  </h4>
                  <div className="space-y-3 max-h-56 overflow-y-auto pr-1">
                    {result.research?.news && result.research.news.length > 0 ? (
                      result.research.news.map((item, idx) => (
                        <a
                          key={idx}
                          href={item.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="block p-3 rounded-xl bg-zinc-900/60 border border-zinc-900 hover:border-zinc-800 transition-colors"
                        >
                          <div className="flex justify-between items-center text-[10px] text-zinc-500 font-bold mb-1">
                            <span>{item.source}</span>
                            <span>
                              {item.publishedAt
                                ? new Date(item.publishedAt).toLocaleDateString(undefined, {
                                    month: "short",
                                    day: "numeric",
                                  })
                                : ""}
                            </span>
                          </div>
                          <h5 className="text-xs font-bold text-zinc-200 line-clamp-1 group-hover:text-emerald-400 transition-colors">
                            {item.title}
                          </h5>
                          <p className="text-[10px] text-zinc-500 line-clamp-2 mt-1 leading-relaxed">
                            {item.snippet}
                          </p>
                        </a>
                      ))
                    ) : (
                      <span className="text-xs text-zinc-600 block">No recent news found.</span>
                    )}
                  </div>
                </div>
              </div>

              {/* Chatbot conversation box */}
              <div className="p-6 rounded-2xl bg-zinc-900/40 border border-zinc-900 backdrop-blur-sm shadow-xl flex flex-col h-[400px]">
                <div className="flex items-center gap-2 border-b border-zinc-900 pb-3">
                  <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                  <h4 className="text-xs uppercase font-extrabold text-zinc-400 tracking-wider">
                    Ask the Lead Analyst
                  </h4>
                </div>

                {/* Messages logs */}
                <div className="flex-1 overflow-y-auto my-4 space-y-3 pr-1 text-xs">
                  {chatHistory.map((msg, i) => (
                    <div
                      key={i}
                      className={`flex flex-col max-w-[85%] rounded-xl p-3 leading-relaxed ${
                        msg.role === "user"
                          ? "bg-zinc-800 border border-zinc-700 text-zinc-200 ml-auto"
                          : "bg-zinc-900 text-zinc-300"
                      }`}
                    >
                      <span className="text-[9px] font-bold text-zinc-500 mb-1 uppercase">
                        {msg.role === "user" ? "You" : "InvestIQ"}
                      </span>
                      <p className="whitespace-pre-line text-xs font-medium">{msg.content}</p>
                    </div>
                  ))}
                  {chatLoading && (
                    <div className="bg-zinc-900 text-zinc-300 max-w-[85%] rounded-xl p-3 flex items-center gap-2">
                      <div className="h-1.5 w-1.5 rounded-full bg-zinc-500 animate-bounce" />
                      <div className="h-1.5 w-1.5 rounded-full bg-zinc-500 animate-bounce delay-150" />
                      <div className="h-1.5 w-1.5 rounded-full bg-zinc-500 animate-bounce delay-300" />
                    </div>
                  )}
                  <div ref={chatBottomRef} />
                </div>

                {/* Input submission */}
                <form onSubmit={sendChatMessage} className="flex gap-2">
                  <input
                    type="text"
                    value={chatMessage}
                    onChange={(e) => setChatMessage(e.target.value)}
                    placeholder="Ask about PE ratios, risks, margins..."
                    className="flex-1 rounded-xl bg-zinc-900 border border-zinc-800 text-xs px-3.5 focus:outline-none focus:border-zinc-700 text-zinc-200"
                    disabled={chatLoading}
                  />
                  <button
                    type="submit"
                    className="p-2.5 rounded-xl bg-emerald-500 text-black hover:bg-emerald-600 transition-colors disabled:opacity-50"
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
        )}

        {/* Empty State / Welcome Screen */}
        {!result && !loading && (
          <section className="text-center py-20">
            <div className="h-16 w-16 mx-auto bg-zinc-900 border border-zinc-800 rounded-2xl flex items-center justify-center text-zinc-400 mb-6 shadow-md">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
              </svg>
            </div>
            <h3 className="text-xl font-bold text-zinc-300">
              No Analysis Active
            </h3>
            <p className="text-zinc-500 text-sm max-w-sm mx-auto mt-2">
              Enter a corporate name in the search bar above to trigger the multi-agent decision model.
            </p>
          </section>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-zinc-900 bg-zinc-950/40 text-center py-8 text-xs text-zinc-600 mt-20">
        <p>© 2026 InvestIQ. Built using LangGraph, Polygon API, and Groq LLM.</p>
        <p className="mt-1.5 text-zinc-700">
          Disclaimer: Content is generated by artificial intelligence agents and does not constitute formal financial advice.
        </p>
      </footer>
    </div>
  );
}