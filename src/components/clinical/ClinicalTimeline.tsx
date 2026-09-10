import { useMemo, useState } from "react";
import { cn } from "@/lib/cn";
import { dateTime } from "@/lib/format";

export type TimelineItem = {
  id: string;
  timestamp: string;
  category: string;
  title: string;
  detail?: string;
  author?: string;
  source?: string;
};

// A filterable longitudinal timeline. Filtering is by category; the category
// chips only show categories that actually have events.
export function ClinicalTimeline({
  items,
  emptyLabel = "No activity has been recorded for this patient yet.",
}: {
  items: TimelineItem[];
  emptyLabel?: string;
}) {
  const categories = useMemo(
    () => Array.from(new Set(items.map((item) => item.category))).sort(),
    [items],
  );
  const [active, setActive] = useState<string>("All");

  const sorted = useMemo(
    () =>
      [...items]
        .filter((item) => active === "All" || item.category === active)
        .sort((left, right) => +new Date(right.timestamp) - +new Date(left.timestamp)),
    [items, active],
  );

  return (
    <div>
      {items.length > 0 && (
        <div className="mb-4 flex flex-wrap gap-1.5" role="group" aria-label="Filter timeline by type">
          {["All", ...categories].map((category) => {
            const count = category === "All" ? items.length : items.filter((item) => item.category === category).length;
            const selected = active === category;
            return (
              <button
                key={category}
                type="button"
                aria-pressed={selected}
                onClick={() => setActive(category)}
                className={cn(
                  "rounded-full px-2.5 py-1 text-xs font-semibold ring-1 transition",
                  selected
                    ? "bg-brand-gradient text-white ring-transparent"
                    : "bg-white text-mist-500 ring-mist-200 hover:bg-mist-50",
                )}
              >
                {category} <span className="opacity-70">{count}</span>
              </button>
            );
          })}
        </div>
      )}

      {sorted.length === 0 ? (
        <p className="rounded-xl bg-mist-50 px-3 py-6 text-center text-sm text-mist-400">
          {items.length === 0 ? emptyLabel : `No ${active.toLowerCase()} events recorded.`}
        </p>
      ) : (
        <ol className="space-y-4">
          {sorted.map((item, index) => (
            <li key={item.id} className="flex gap-3">
              <div className="flex flex-col items-center pt-1">
                <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-brand-gradient" aria-hidden />
                {index < sorted.length - 1 && <span className="mt-1 w-px flex-1 bg-mist-200" aria-hidden />}
              </div>
              <div className="min-w-0 pb-1">
                <p className="text-sm">
                  <span className="mr-1.5 rounded bg-mist-100 px-1.5 py-0.5 text-[11px] font-semibold text-mist-600 ring-1 ring-mist-200">
                    {item.category}
                  </span>
                  <span className="text-mist-800">{item.title}</span>
                </p>
                {item.detail && <p className="mt-0.5 text-xs text-mist-500">{item.detail}</p>}
                <p className="mt-0.5 text-[11px] text-mist-400">
                  {dateTime(item.timestamp)}
                  {item.author ? ` · ${item.author}` : ""}
                  {item.source ? ` · ${item.source}` : ""}
                </p>
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}
