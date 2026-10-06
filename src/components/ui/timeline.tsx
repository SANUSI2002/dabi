// Adapted from a Hyperiux Vault timeline (https://vault.hyperiux.com): a pinned section whose
// track slides sideways as the page scrolls, drawing each milestone's stem and revealing its copy.
import { type CSSProperties, useLayoutEffect, useRef, useSyncExternalStore } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { SplitText } from "gsap/SplitText";

if (typeof window !== "undefined") gsap.registerPlugin(ScrollTrigger, SplitText);

/**
 * One gsap.context for the component's lifetime (like @gsap/react's useGSAP): the callback is
 * re-added when dependencies change and everything it created is reverted on unmount.
 */
function useGSAP(callback: () => void | (() => void), dependencies: unknown[], scope: { current: Element | null }) {
  const ctxRef = useRef<gsap.Context | null>(null);
  const cleanupRef = useRef<(() => void) | undefined>(undefined);
  const callbackRef = useRef(callback);
  // Keep the latest callback without re-running the context setup (runs before the effects below).
  useLayoutEffect(() => { callbackRef.current = callback; });

  useLayoutEffect(() => {
    ctxRef.current = gsap.context(() => {}, scope.current ?? undefined);
    return () => {
      cleanupRef.current?.();
      cleanupRef.current = undefined;
      ctxRef.current?.revert();
      ctxRef.current = null;
    };
  }, [scope]);

  useLayoutEffect(() => {
    if (!ctxRef.current) return;
    cleanupRef.current?.();
    const result = ctxRef.current.add(() => callbackRef.current());
    cleanupRef.current = typeof result === "function" ? result : undefined;
  }, dependencies); // eslint-disable-line react-hooks/exhaustive-deps
}

const REDUCED_MOTION_QUERY = "(prefers-reduced-motion: reduce)";
function subscribeToReducedMotion(callback: () => void) {
  const query = window.matchMedia?.(REDUCED_MOTION_QUERY);
  query?.addEventListener("change", callback);
  return () => query?.removeEventListener("change", callback);
}
const usePrefersReducedMotion = () => useSyncExternalStore(subscribeToReducedMotion, () => window.matchMedia?.(REDUCED_MOTION_QUERY)?.matches ?? false, () => false);

export type TimelineMilestone = {
  /** Unique within the timeline; used to target the milestone's stem, dot and copy. */
  id: string;
  heading: string;
  content: string;
};

export type TimelineProps = {
  title: string;
  periodLabel: string;
  /**
   * The track is laid out for seven milestones, alternating above and below the line
   * (1st, 3rd, 5th, 7th above). Extra milestones are ignored.
   */
  milestones: readonly TimelineMilestone[];
  imageUrl: string;
  imageAlt: string;
  textColor?: string;
  mutedTextColor?: string;
  activeColor?: string;
  backgroundColor?: string;
  /** Reveal animation duration, in seconds. */
  duration?: number;
  id?: string;
};

const MAX_MILESTONES = 7;

export default function Timeline({ title, periodLabel, milestones, imageUrl, imageAlt, textColor = "#0b2b20", mutedTextColor = "#55685f", activeColor = "#059a57", backgroundColor = "#f6f9f5", duration = 1.2, id = "journey" }: TimelineProps) {
  const sectionRef = useRef<HTMLElement>(null);
  const sliderRef = useRef<HTMLDivElement>(null);
  const reducedMotion = usePrefersReducedMotion();
  const normalizedDuration = Math.max(0.2, duration);
  const items = milestones.slice(0, MAX_MILESTONES);
  const top = items.filter((_, i) => i % 2 === 0);
  const bottom = items.filter((_, i) => i % 2 === 1);
  const itemKey = items.map((item) => item.id).join("|");
  const active: CSSProperties = { backgroundColor: activeColor };
  const muted: CSSProperties = { color: mutedTextColor };

  // The sideways slide and the line that draws across the track.
  useGSAP(() => {
    const section = sectionRef.current;
    if (!section) return;
    const isMobile = window.innerWidth < 600;
    const lineWidth = isMobile ? "65%" : "98%";
    gsap.timeline({ scrollTrigger: { trigger: section, start: "top top", end: isMobile ? "82% 50%" : "92% bottom", scrub: true }, defaults: { ease: "none" } })
      .fromTo(sliderRef.current, { xPercent: 0 }, { xPercent: isMobile ? -57 : -65 });
    const line = section.querySelector("[data-journey-line]");
    if (reducedMotion) { gsap.set(line, { width: lineWidth }); return; }
    gsap.to(line, { width: lineWidth, ease: "none", scrollTrigger: { trigger: section, start: isMobile ? "top 30%" : "top 25%", end: isMobile ? "80% 50%" : "92% bottom", scrub: true } });
  }, [reducedMotion], sectionRef);

  // Each milestone: stem grows, dot pops, heading and copy rise line by line.
  useGSAP(() => {
    const section = sectionRef.current;
    if (!section) return;
    const part = (itemId: string, role: string) => section.querySelector(`[data-milestone="${CSS.escape(itemId)}"][data-role="${role}"]`);
    const isTop = new Set(top.map((item) => item.id));

    if (reducedMotion) {
      items.forEach((item) => { gsap.set(part(item.id, "stem"), { scaleY: 1 }); gsap.set(part(item.id, "dot"), { scale: 1 }); });
      return;
    }

    const splits = items.flatMap((item) => [part(item.id, "heading"), part(item.id, "content")])
      .filter((el): el is Element => el !== null)
      .map((el) => new SplitText(el, { type: "lines", mask: "lines" }));

    const isMobile = window.innerWidth < 600;
    const [first, last, span] = isMobile ? [22, 69, 10] : [6, 65, 20];
    const step = items.length > 1 ? (last - first) / (items.length - 1) : 0;

    items.forEach((item, index) => {
      const stem = part(item.id, "stem");
      gsap.set(stem, { scaleY: 0, transformOrigin: isTop.has(item.id) ? "bottom" : "top" });
      gsap.set(part(item.id, "dot"), { scale: 0 });
      const start = Math.round(first + step * index);
      const headingLines = splits.find((s) => s.elements[0] === part(item.id, "heading"))?.lines ?? [];
      const contentLines = splits.find((s) => s.elements[0] === part(item.id, "content"))?.lines ?? [];
      gsap.timeline({ scrollTrigger: { trigger: section, start: `${start}% 30%`, end: `${start + span}% 50%`, scrub: true } })
        .to(stem, { scaleY: 1, duration: normalizedDuration * 0.4 })
        .to(part(item.id, "dot"), { scale: 1, duration: normalizedDuration * 0.4 }, "<")
        .fromTo(headingLines, { y: 100 }, { y: 0, delay: -0.8 * normalizedDuration, duration: normalizedDuration, stagger: 0.02, ease: "power2.out" })
        .fromTo(contentLines, { y: 100 }, { y: 0, duration: normalizedDuration, stagger: 0.02, ease: "power2.out" }, "<");
    });

    const refresh = () => ScrollTrigger.refresh();
    window.addEventListener("resize", refresh);
    return () => { splits.forEach((split) => split.revert()); window.removeEventListener("resize", refresh); };
  }, [normalizedDuration, reducedMotion, itemKey], sectionRef);

  const renderMilestone = (item: TimelineMilestone, position: "top" | "bottom") => {
    const stem = <div data-milestone={item.id} data-role="stem" className="h-[94%] w-px rounded-full max-[600px]:h-full" style={active} />;
    const dot = <div data-milestone={item.id} data-role="dot" className="relative aspect-square size-[1vw] -translate-x-1/2 rounded-full max-[600px]:size-[2.5vw]" style={active} />;
    const copy = <>
      <h3 data-milestone={item.id} data-role="heading" className="font-display text-[2.2vw] font-semibold leading-none tracking-[-0.03em] max-[600px]:text-[6.4vw]">{item.heading}</h3>
      <p data-milestone={item.id} data-role="content" className="w-[90%] text-[1.25vw] leading-[1.3] max-[600px]:text-[4.4vw]" style={muted}>{item.content}</p>
    </>;
    return position === "top"
      ? <div key={item.id} className="relative h-full w-[30vw] px-[3vw] max-[600px]:w-[70vw] max-[600px]:px-[7vw]"><div className="absolute inset-0">{dot}{stem}</div><div className="-mt-[1vw] space-y-[1vw] max-[600px]:-mt-[2vw]">{copy}</div></div>
      : <div key={item.id} className="relative h-full w-[25vw] px-[3vw] max-[600px]:w-[70vw] max-[600px]:px-[7vw]"><div className="absolute bottom-[-1%] left-0 h-full w-full">{stem}{dot}</div><div className="flex h-full w-full flex-col justify-end space-y-[1vw]">{copy}</div></div>;
  };

  return (
    <section ref={sectionRef} id={id} aria-label={title} className="relative h-[200vw] w-full max-[600px]:h-[400vh]" style={{ color: textColor, backgroundColor }}>
      <div className="sticky top-0 flex h-screen w-full items-center overflow-hidden pt-16 max-[600px]:items-start max-[600px]:pt-[18vh]">
        <div ref={sliderRef} className="mr-[2vw] flex h-[30vw] w-[240vw] items-center gap-[5vw] px-[5vw] max-[600px]:h-[80vh] max-[600px]:w-[800vw] max-[600px]:px-[7vw]">
          <div className="h-full w-[30vw] shrink-0 overflow-hidden rounded-[1.4vw] max-[600px]:h-[65vw] max-[600px]:w-[85vw] max-[600px]:rounded-[5vw]">
            <img src={imageUrl} alt={imageAlt} draggable={false} className="h-full w-full object-cover" />
          </div>
          <div className="relative h-full w-full">
            <div aria-hidden className="absolute left-0 top-[49%] flex h-fit w-full items-center">
              <div className="size-[.8vw] rounded-full max-[600px]:size-[2vw]" style={active} />
              <div data-journey-line className="h-px w-0 rounded-full" style={active} />
              <div className="size-[.8vw] rounded-full max-[600px]:size-[2vw]" style={active} />
            </div>
            <div className="flex h-1/2 w-full items-center justify-start gap-[.5vw]">
              <div className="h-full w-[20%] shrink-0 pt-[2vw] max-[600px]:h-fit max-[600px]:pt-[5vw]"><h2 className="w-[80%] font-display text-[3vw] font-bold leading-[0.95] tracking-[-0.04em] max-[600px]:text-[8.5vw]">{title}</h2></div>
              <div className="flex h-full w-full gap-x-[15vw] max-[600px]:gap-x-[40vw]">{top.map((item) => renderMilestone(item, "top"))}</div>
            </div>
            <div className="flex h-1/2 w-full items-center justify-start">
              <div className="h-full w-[34%] shrink-0 pt-[2vw] max-[600px]:w-[30%] max-[600px]:pt-[5vw]"><p className="text-[1.4vw] font-semibold uppercase leading-none tracking-[0.14em] max-[600px]:text-[3.6vw]" style={muted}>{periodLabel}</p></div>
              <div className="ml-[7vw] flex h-full w-full gap-x-[20vw] max-[600px]:gap-x-[40vw]">{bottom.map((item) => renderMilestone(item, "bottom"))}</div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
