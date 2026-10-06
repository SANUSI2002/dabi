// Adapted from the "image stream" corridor hero: two mirrored rails of cards ride from a vanishing
// point toward the viewer. Perspective does the work — as a card's z grows it gets bigger and its
// screen x sweeps outward, because the projection scales position and size by the same factor.
//
// - Depth is authored as apparent size, geometrically, so consecutive cards keep a constant size
//   ratio and the ribbon never tears apart near the viewer.
// - The rails open hard first and then hold (`fan` > 1), so the ribbon leaves the centre as a flat
//   band, bends once, then runs out on the diagonal.
// - Cards are born across the axis (`railBirth` < 0) so the centre is always covered and no card
//   ever needs to fade in. Every length is in cqw, so the shape holds at any container size.
import { useId, useMemo, type ComponentProps, type ReactNode } from "react";
import { cn } from "@/lib/cn";

export type CorridorPath = {
  /** Strength of the projection. Lower is a wider-angle rush. @default 30 */
  perspective?: number;
  cardWidth?: number;
  cardHeight?: number;
  cardRadius?: number;
  /** On-screen card height where a card is born. @default 2.6 */
  birthHeight?: number;
  /** On-screen card height as a card leaves the frame. @default 46 */
  exitHeight?: number;
  /** Lateral offset at birth; negative starts across the axis. @default -11 */
  railBirth?: number;
  railExit?: number;
  /** How front-loaded the opening is. >1 opens early then holds. @default 3.3 */
  fan?: number;
  turnBirth?: number;
  turnExit?: number;
  /** Keyframe stops used to trace the curve. @default 24 */
  stops?: number;
};

const PATH: Required<CorridorPath> = { perspective: 30, cardWidth: 18, cardHeight: 25, cardRadius: 0.8, birthHeight: 2.6, exitHeight: 46, railBirth: -11, railExit: 44, fan: 3.3, turnBirth: 6, turnExit: 28, stops: 24 };

/** Samples the path once so the CSS keyframes trace the real curve. */
function keyframes(dir: 1 | -1, name: string, p: Required<CorridorPath>) {
  const steps: string[] = [];
  for (let s = 0; s <= p.stops; s++) {
    const u = s / p.stops;
    const scale = (p.birthHeight / p.cardHeight) * Math.pow(p.exitHeight / p.birthHeight, u);
    const z = p.perspective * (1 - 1 / scale);
    const rail = p.railExit - (p.railExit - p.railBirth) * Math.pow(1 - u, p.fan);
    const turn = p.turnBirth + (p.turnExit - p.turnBirth) * u;
    steps.push(`${(u * 100).toFixed(2)}%{transform:translate3d(${(dir * rail).toFixed(2)}cqw,0,${z.toFixed(2)}cqw) rotateY(${(-dir * turn).toFixed(2)}deg)}`);
  }
  return `@keyframes ${name}{${steps.join("")}}`;
}

export type StreamImage = { src: string; alt?: string };

export type ImageStreamHeroProps = {
  /** Images cycled onto both rails; fewer than `cards` simply repeat. */
  images: readonly StreamImage[];
  /** Cards on each rail at once (density, not speed). @default 9 */
  cards?: number;
  /** Seconds for one card to travel the whole corridor. @default 18 */
  speed?: number;
  /** Vertical placement of the corridor's axis, as a percentage of height. @default 55 */
  axis?: number;
  /** CSS object-position for each card image (useful when subjects sit off-centre). */
  imagePosition?: string;
  path?: CorridorPath;
  children?: ReactNode;
};

export function ImageStreamHero({ images, cards = 9, speed = 18, axis = 55, imagePosition = "center", path, children, className, style, ...props }: ComponentProps<"div"> & ImageStreamHeroProps) {
  const id = useId().replace(/[^a-zA-Z0-9]/g, "");
  const right = `ish-r-${id}`, left = `ish-l-${id}`, card = `ish-c-${id}`;
  const p = useMemo(() => ({ ...PATH, ...path }), [path]);
  // Pausing (not disabling) under reduced motion freezes the corridor as a finished still.
  const css = useMemo(() => `${keyframes(1, right, p)}${keyframes(-1, left, p)}@media(prefers-reduced-motion:reduce){.${card}{animation-play-state:paused}}`, [right, left, card, p]);

  return (
    <div className={cn("relative overflow-hidden", className)} {...props} style={{ containerType: "inline-size", ...style }}>
      <style>{css}</style>
      <div aria-hidden className="pointer-events-none absolute inset-0" style={{ perspective: `${p.perspective}cqw`, perspectiveOrigin: `50% ${axis}%` }}>
        <div className="absolute inset-0" style={{ transformStyle: "preserve-3d" }}>
          {[right, left].map((name) => Array.from({ length: cards }, (_, i) => {
            const img = images.length ? images[i % images.length] : undefined;
            return <div key={`${name}-${i}`} className={cn(card, "absolute overflow-hidden")} style={{ left: "50%", top: `${axis}%`, width: `${p.cardWidth}cqw`, height: `${p.cardHeight}cqw`, marginLeft: `${-p.cardWidth / 2}cqw`, marginTop: `${-p.cardHeight / 2}cqw`, borderRadius: `${p.cardRadius}cqw`, animation: `${name} ${speed}s linear infinite`, animationDelay: `${-(i * speed) / cards}s`, backfaceVisibility: "hidden" }}>
              {img && <img src={img.src} alt="" loading="lazy" decoding="async" draggable={false} className="h-full w-full object-cover" style={{ objectPosition: imagePosition }} />}
            </div>;
          }))}
        </div>
      </div>
      {children}
    </div>
  );
}

export default ImageStreamHero;
