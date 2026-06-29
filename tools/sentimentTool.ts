import { groq } from "@/lib/groq";
import { NewsArticle, NewsSentiment } from "@/types/investment";

export async function analyzeSentiment(
  articles: NewsArticle[]
): Promise<NewsSentiment> {
  if (!articles || articles.length === 0) {
    return {
      score: 0,
      label: "Neutral",
      summary: "No recent news articles were found to perform sentiment analysis.",
    };
  }

  const articlesText = articles
    .map(
      (a, i) =>
        `[Article ${i + 1}]\nTitle: ${a.title}\nSource: ${a.source}\nSnippet: ${a.snippet}\n`
    )
    .join("\n");

  const prompt = `
You are an expert stock market sentiment analyst. Review the following news headlines and snippets for a company and determine the overall market sentiment.

Articles:
${articlesText}

Analyze if the articles suggest positive sentiment (strong earnings, growth, buy recommendations), negative sentiment (regulatory pressure, declining revenue, lawsuits, negative outlook), or neutral sentiment.

You MUST return ONLY a JSON response in the format below. Do not include markdown formatting or extra text outside the JSON.

{
  "score": 0, // Integer between -100 (most bearish/negative) and 100 (most bullish/positive)
  "label": "Positive", // MUST be "Positive", "Negative", or "Neutral"
  "summary": "A 2-3 sentence summary explaining the current news consensus and drivers of sentiment."
}
`;

  try {
    const response = await groq.invoke(prompt);
    const text = response.content as string;

    let parsed: any = null;
    try {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      const cleanText = jsonMatch ? jsonMatch[0] : text;
      parsed = JSON.parse(cleanText);
    } catch (parseError) {
      console.warn("Failed to parse JSON response from Groq for sentiment:", text);
    }

    if (
      parsed &&
      typeof parsed.score === "number" &&
      ["Positive", "Negative", "Neutral"].includes(parsed.label)
    ) {
      return {
        score: parsed.score,
        label: parsed.label as any,
        summary: parsed.summary || "Sentiment analyzed from news updates.",
      };
    }

    throw new Error("Invalid response format from Groq API");
  } catch (error: any) {
    console.warn("Groq API error in sentiment analyzer, executing keyword fallback:", error.message);

    // Dynamic Keyword-based sentiment heuristic fallback (no API key needed!)
    const positiveWords = ["buy", "rally", "surge", "growth", "profit", "earnings", "up", "bullish", "leads", "increase", "rise", "success", "president", "strong", "outperform", "gain", "upgrade"];
    const negativeWords = ["sell", "decline", "fall", "loss", "drop", "down", "bearish", "warning", "lower", "lawsuit", "layoff", "retire", "surprise", "weak", "underperform", "cut", "downgrade"];

    let posCount = 0;
    let negCount = 0;

    for (const article of articles) {
      const textToAnalyze = `${article.title} ${article.snippet}`.toLowerCase();
      
      for (const word of positiveWords) {
        const regex = new RegExp(`\\b${word}\\b`, 'g');
        const matches = textToAnalyze.match(regex);
        if (matches) posCount += matches.length;
      }

      for (const word of negativeWords) {
        const regex = new RegExp(`\\b${word}\\b`, 'g');
        const matches = textToAnalyze.match(regex);
        if (matches) negCount += matches.length;
      }
    }

    let score = 0;
    let label: "Positive" | "Negative" | "Neutral" = "Neutral";

    if (posCount > 0 || negCount > 0) {
      score = Math.round(((posCount - negCount) / (posCount + negCount)) * 100);
    }

    if (score > 12) {
      label = "Positive";
    } else if (score < -12) {
      label = "Negative";
    }

    const summary = `Offline keyword consensus scanner analyzed ${articles.length} news items. Detected ${posCount} bullish signals vs ${negCount} bearish indicators, indicating a general ${label.toLowerCase()} market outlook.`;

    return {
      score,
      label,
      summary,
    };
  }
}
