"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
} from "recharts";

export default function Charts({
  score,
}: {
  score: number;
}) {
  const data = [
    {
      name: "Investment",
      value: score,
    },
  ];

  return (
    <BarChart
      width={400}
      height={300}
      data={data}
    >
      <XAxis dataKey="name" />
      <YAxis />
      <Tooltip />
      <Bar dataKey="value" />
    </BarChart>
  );
}