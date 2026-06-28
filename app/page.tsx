"use client";

import { useState } from "react";

export default function Home() {
  const [company, setCompany] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);

  const analyzeCompany = async () => {
    if (!company.trim()) return;

    console.log("Button clicked"); // TEST

    setLoading(true);

    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ company }),
      });

      const data = await res.json();
      setResult(data);
    } catch (err) {
      console.error(err);
    }

    setLoading(false);
  };

  return (
    <main className="p-10">
      <h1 className="text-3xl font-bold">
        AI Investment Agent
      </h1>

      <input
        className="border p-2 mt-4"
        value={company}
        onChange={(e) => setCompany(e.target.value)}
        placeholder="Enter company name"
      />

      <button
        onClick={analyzeCompany}
        className="bg-black text-white px-4 py-2 ml-2"
      >
        {loading ? "Analyzing..." : "Analyze"}
      </button>

      {result && (
        <pre className="mt-5 bg-gray-100 p-3">
          {JSON.stringify(result, null, 2)}
        </pre>
      )}
    </main>
  );
}