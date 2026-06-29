# InvestIQ — AI Investment Research Agent

> **InsideIIM × Altuni AI Labs Take-Home Assignment**

An autonomous, multi-agent AI system that researches any company and delivers a data-driven **INVEST** or **PASS** verdict — complete with live financials, sentiment analysis, risk assessment, and an interactive analyst chatbot.

---

## Overview

InvestIQ orchestrates a **5-node LangGraph pipeline** to evaluate any company as an investment target:

```
START → Research → Finance → News → Risk → Decision → END
```

| Node | Responsibility | APIs / Models Used |
|------|---------------|--------------------|
| **Research** | Web search for company overview, business model, competitive positioning | Tavily Search API |
| **Finance** | Live stock price, 6-month chart, market cap, P/E ratio, revenue, margins | Yahoo Finance (free) + Tavily + Groq |
| **News** | Fetch recent news articles, run sentiment analysis | Tavily News API + Groq LLM |
| **Risk** | Dedicated risk factor assessment with severity scoring | Groq LLM (llama-3.3-70b) |
| **Decision** | Synthesise all signals into INVEST/PASS + structured rationale | Groq LLM (llama-3.3-70b) |

**Key features:**
- 🤖 LangGraph-orchestrated multi-agent workflow
- 📊 Live Yahoo Finance price data + 6-month price chart
- 📰 Real-time news fetching and AI sentiment scoring
- ⚠️ Dedicated risk assessment with factor-by-factor breakdown
- 💬 Interactive AI chatbot for post-analysis Q&A
- 🕐 Search history (localStorage-based watchlist)
- 📋 One-click copy report
- 🌍 Works for global stocks (US, India, UK, EU markets)
- 🔄 Robust fallback scoring when APIs are rate-limited

---

## How to Run

### Prerequisites
- Node.js 18+
- npm or yarn

### 1. Clone / Unzip
```bash
cd investiq
```

### 2. Install Dependencies
```bash
npm install
```

### 3. Configure API Keys

Create (or edit) `.env.local` in the project root:

```env
GROQ_API_KEY=your_groq_api_key_here
TAVILY_API_KEY=your_tavily_api_key_here
```

**Getting API keys (both are free-tier):**
- **Groq** → https://console.groq.com — free, very fast LLM inference
- **Tavily** → https://app.tavily.com — free 1,000 searches/month

> Yahoo Finance data is fetched directly — no API key required.

### 4. Run the Development Server
```bash
npm run dev
```

Open http://localhost:3000 in your browser.

### 5. Use the App
1. Type a company name (e.g. "Apple", "Reliance Industries", "Tesla")
2. Click **Run Agent** or press Enter
3. Wait 15–30 seconds for the 5-node pipeline to complete
4. Explore the **Overview**, **Risk**, and **News** tabs
5. Chat with the AI analyst in the right panel

---

## How It Works — Architecture

### Tech Stack
- **Frontend**: Next.js 16 (App Router) + React 19 + Tailwind CSS v4 + Recharts
- **Backend**: Next.js API routes (Node.js runtime)
- **AI Orchestration**: LangGraph.js (StateGraph with 5 nodes)
- **LLM**: Groq Cloud — `llama-3.3-70b-versatile` (fast, free-tier)
- **Search**: Tavily Search + Tavily News APIs
- **Financial Data**: Yahoo Finance (unofficial free API)

### Agent Pipeline Detail

```
InvestmentStateAnnotation = { company, research, financials, riskAssessment, decision }

1. researchNode
   └─ Calls Tavily to search company overview, competitive analysis, business model
   └─ Stores: research.generalAnalysis

2. financeNode
   ├─ Resolves ticker via Yahoo Finance search API
   ├─ Fetches 6-month OHLCV chart data
   ├─ Uses Tavily + Groq LLM to extract: marketCap, peRatio, revenue, netIncome, profitMargin
   └─ Stores: financials (price, change, chartData, ratios)

3. newsNode
   ├─ Fetches 8 recent news articles via Tavily News API
   ├─ Runs Groq sentiment analysis on all articles
   └─ Stores: research.news, research.sentiment

4. riskNode
   ├─ Builds a detailed risk prompt with financial + sentiment context
   ├─ Asks Groq (temperature=0.5) to identify specific risk factors
   └─ Stores: riskAssessment (score, riskLevel, factors[], mitigants[])

5. decisionNode
   ├─ Synthesises ALL prior outputs (research + financials + sentiment + risk)
   ├─ Asks Groq to issue INVEST or PASS with structured rationale
   └─ Stores: decision (verdict, confidence, investmentScore, strengths[], risks[], summary)
```

### Fallback Architecture
Every node has a rule-based fallback so the app **always returns a result** even if:
- Groq API is rate-limited or key is invalid → keyword-based sentiment, algorithmic scoring
- Yahoo Finance blocks the request → fallback chart data generation
- Tavily search fails → empty graceful state

---

## Key Decisions & Trade-offs

### What I chose and why

| Decision | Rationale |
|----------|-----------|
| **Groq over OpenAI** | Free tier, extremely fast inference (< 1s for most calls), `llama-3.3-70b` is high quality |
| **Yahoo Finance (no key)** | Price data doesn't require API registration; avoids quota issues |
| **Tavily for financial metrics** | No direct free financial API that covers global stocks; Tavily + LLM extraction works universally |
| **LangGraph StateGraph** | Clean sequential orchestration, each node has one responsibility, easy to extend |
| **Tabbed UI (Overview/Risk/News)** | Keeps the dashboard scannable without overwhelming the user with all data at once |
| **localStorage history** | Zero-backend persistence; no database needed, fully client-side |

### What I left out (and why)

| Feature | Why Not Included |
|---------|-----------------|
| **Real-time streaming** | Complexity vs. benefit for this use case; polling works fine |
| **Polygon.io / Alpha Vantage** | Both require paid plans for reliable data; Yahoo Finance is universal |
| **LangSmith tracing** | Nice-to-have for observability; would add with more time |
| **User accounts / saved reports** | Scope — localStorage history is sufficient for demo |
| **DCF / technical analysis** | Would require deep financial data; Groq-based qualitative analysis is more globally applicable |
| **Parallel node execution** | Research + Finance could run in parallel; sequential chosen for simplicity and debuggability |

---

## Example Runs

### NVIDIA (NVDA) — INVEST
> **Score: 82/100 | Confidence: 78% | Risk: MEDIUM**
> NVIDIA's dominant position in AI accelerators (H100/Blackwell chips) continues to drive exceptional revenue growth. With $60B+ TTM revenue and improving margins, the fundamentals justify the premium valuation. Risk factors include concentration in datacenter revenue and high P/E. Recommendation: **INVEST**.

### Tesla (TSLA) — PASS
> **Score: 44/100 | Confidence: 65% | Risk: HIGH**
> Tesla faces multiple headwinds: declining automotive margins, intensifying competition from BYD, and CEO reputation risk. The valuation multiple is elevated relative to growth. Recommendation: **PASS**.

### Reliance Industries — INVEST
> **Score: 71/100 | Confidence: 72% | Risk: MEDIUM**
> India's largest conglomerate with diversified revenue streams across energy, retail (JioMart), and telecom (Jio). Strong cash generation, domestic market leadership, and Mukesh Ambani's strategic execution. Recommendation: **INVEST**.

---

## What I Would Improve with More Time

1. **Parallel node execution** — Run `researchNode` and `financeNode` in parallel (both are independent) to cut total latency by ~40%
2. **LangSmith integration** — Add tracing to observe agent decisions in production
3. **DCF valuation node** — Add a dedicated discounted cash flow analysis node
4. **Technical analysis node** — RSI, MACD, moving averages from Yahoo Finance OHLCV data
5. **Portfolio mode** — Analyse multiple companies side-by-side with relative ranking
6. **Real-time streaming** — Stream the agent steps to the UI instead of waiting for full completion
7. **Report PDF export** — Generate a proper investor memo PDF
8. **Scheduled monitoring** — Weekly re-analysis of watchlisted companies with email alerts
9. **Multi-LLM consensus** — Run analysis through 2 LLMs and average/debate their conclusions
10. **News source reliability scoring** — Weight news articles by source credibility

---

## LLM Chat Transcript

See `LLM_CHAT_LOGS.md` in the project root for the complete AI-assisted development session logs.

---

## Environment Variables Reference

```env
GROQ_API_KEY=         # Required — Groq Cloud LLM (free at console.groq.com)
TAVILY_API_KEY=       # Required — Web + news search (free at app.tavily.com)
```
