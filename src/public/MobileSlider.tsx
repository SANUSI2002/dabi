import { Children, useRef, useState, type ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

/** Touch-scrollable on phones and small tablets; a normal grid from md upward. */
export function MobileSlider({ children, label, desktopColumns }: { children: ReactNode; label: string; desktopColumns: string }) {
  const items = Children.toArray(children);
  const track = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);
  const current = Math.min(index, Math.max(0, items.length - 1));

  function select(next: number) {
    const element = track.current;
    const cards = element?.children;
    if (!element || !cards?.[next]) return;
    const first = cards[0] as HTMLElement;
    const target = cards[next] as HTMLElement;
    element.scrollTo({ left: target.offsetLeft - first.offsetLeft, behavior: window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
    setIndex(next);
  }

  function updatePosition() {
    const element = track.current;
    if (!element?.children.length) return;
    const cards = Array.from(element.children) as HTMLElement[];
    const start = cards[0].offsetLeft;
    const closest = cards.reduce((best, card, cardIndex) => Math.abs(card.offsetLeft - start - element.scrollLeft) < Math.abs(cards[best].offsetLeft - start - element.scrollLeft) ? cardIndex : best, 0);
    setIndex(closest);
  }

  return <div role="region" aria-roledescription="carousel" aria-label={label}>
    <div ref={track} onScroll={updatePosition} className={`flex snap-x snap-mandatory gap-4 overflow-x-auto pb-3 pr-5 md:grid md:overflow-visible md:pb-0 md:pr-0 ${desktopColumns}`}>
      {items.map((item, itemIndex) => <div key={itemIndex} className="min-w-[84%] shrink-0 snap-start scroll-ml-0 md:min-w-0 md:shrink [&>*]:h-full">{item}</div>)}
    </div>
    {items.length > 1 && <div className="mt-3 flex items-center justify-between text-xs font-bold text-slate-500 md:hidden">
      <span aria-live="polite">{current + 1} of {items.length}</span>
      <div className="flex gap-2"><button type="button" aria-label={`Previous ${label}`} disabled={current === 0} onClick={() => select(current - 1)} className="grid h-10 w-10 place-items-center rounded-full border border-slate-200 bg-white text-brand-700 disabled:opacity-40"><ChevronLeft size={18}/></button><button type="button" aria-label={`Next ${label}`} disabled={current === items.length - 1} onClick={() => select(current + 1)} className="grid h-10 w-10 place-items-center rounded-full border border-slate-200 bg-white text-brand-700 disabled:opacity-40"><ChevronRight size={18}/></button></div>
    </div>}
  </div>;
}
