import React, { Children, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

/** Preserves each section's desktop grid and adds touch/keyboard controls on phones. */
export function SwipeRow({ children, className, label }) {
  const items = Children.toArray(children);
  const row = useRef(null);
  const [index, setIndex] = useState(0);
  const current = Math.min(index, Math.max(0, items.length - 1));

  function select(next) {
    const element = row.current;
    const cards = element?.children;
    if (!element || !cards?.[next]) return;
    element.scrollTo({
      left: cards[next].offsetLeft - cards[0].offsetLeft,
      behavior: window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth",
    });
    setIndex(next);
  }

  function updatePosition() {
    const element = row.current;
    if (!element?.children.length) return;
    const cards = Array.from(element.children);
    const start = cards[0].offsetLeft;
    const closest = cards.reduce((best, card, cardIndex) => Math.abs(card.offsetLeft - start - element.scrollLeft) < Math.abs(cards[best].offsetLeft - start - element.scrollLeft) ? cardIndex : best, 0);
    setIndex(closest);
  }

  return <>
    <div ref={row} className={`${className} sabi-mobile-swipe`} onScroll={updatePosition} role="region" aria-roledescription="carousel" aria-label={label}>{items}</div>
    {items.length > 1 && <div className="sabi-swipe-controls">
      <span aria-live="polite">{current + 1} of {items.length}</span>
      <div>
        <button type="button" aria-label={`Previous ${label}`} disabled={current === 0} onClick={() => select(current - 1)}><ChevronLeft size={18} /></button>
        <button type="button" aria-label={`Next ${label}`} disabled={current === items.length - 1} onClick={() => select(current + 1)}><ChevronRight size={18} /></button>
      </div>
    </div>}
  </>;
}

export default SwipeRow;
