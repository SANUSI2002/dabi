export function Row2({ k, v }: { k: string; v: string }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <dt className="text-mist-400">{k}</dt>
      <dd className="font-semibold text-mist-800">{v}</dd>
    </div>
  );
}
