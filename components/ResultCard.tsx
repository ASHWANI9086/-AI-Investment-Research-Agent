type Props = {
  result: any;
};

export default function ResultCard({
  result,
}: Props) {
  return (
    <div className="border rounded-xl p-5">
      <h2 className="text-2xl font-bold">
        {result.decision}
      </h2>

      <p>
        Confidence:
        {result.confidence}%
      </p>

      <p className="mt-3">
        {result.summary}
      </p>
    </div>
  );
}