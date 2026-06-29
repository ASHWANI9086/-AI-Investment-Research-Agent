import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "InvestIQ — AI Investment Research Agent",
  description:
    "AI-powered investment research agent. Enter any company name and get a data-driven INVEST or PASS recommendation, complete with financial metrics, sentiment analysis, risk assessment, and analyst reasoning.",
  keywords: ["investment", "AI", "research", "stock analysis", "LangGraph", "hedge fund", "finance"],
  authors: [{ name: "InvestIQ" }],
  openGraph: {
    title: "InvestIQ — AI Investment Research Agent",
    description: "Autonomous AI-driven investment decisions powered by LangGraph + Groq",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
