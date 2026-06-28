type Props = {
  score: number;
};

export default function ScoreCard({
  score,
}: Props) {
  return (
    <div className="border rounded-xl p-4 shadow">
      <h2 className="font-bold">
        Investment Score
      </h2>

      <div className="text-4xl mt-2">
        {score}/100
      </div>
    </div>
  );
}