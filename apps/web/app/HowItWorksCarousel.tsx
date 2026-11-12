"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState, type CSSProperties, type FocusEvent, type KeyboardEvent, type PointerEvent } from "react";
import { useReducedMotion } from "framer-motion";
import { ArrowUpRight, HandCoins, ListChecks, Wallet, type LucideIcon } from "lucide-react";

type HowItWorksSlide = {
  index: string;
  label: string;
  title: string;
  description: string;
  image: string;
  alt: string;
  icon: LucideIcon;
  featured?: boolean;
};

const SLIDES: readonly HowItWorksSlide[] = [
  { index: "01", label: "Plan", title: "Model where money comes from and where it must go.", description: "Add funding sources, vendor obligations, milestone amounts, and due dates without treating commitments as cash.", image: "/how-plan.png", alt: "An event organizer and venue manager reviewing the event plan", icon: ListChecks },
  { index: "02", label: "Fund", title: "Let sponsors fund the event, not the blockchain.", description: "Share a funding link for the event or a specific milestone. Pact handles the payment in the background.", image: "/how-fund.png", alt: "A sponsor and event producer reviewing a funding plan", icon: HandCoins, featured: true },
  { index: "03", label: "Pay", title: "Allocate received funds before you release payment.", description: "Fund each milestone, approve vendor payouts, and keep a clear record of payments and eligible refunds.", image: "/how-pay.png", alt: "An event production vendor confirming a payment beside the stage", icon: Wallet },
];

/** Dwell per slide before auto-advancing. */
const DWELL_MS = 2200;
/** Slides rendered either side of the active one: ±1 are visible neighbours, ±2 sit offscreen so entering slides glide in. */
const WINDOW = 2;
const SWIPE_THRESHOLD = 40;

const mod = (value: number, size: number) => ((value % size) + size) % size;

export default function HowItWorksCarousel() {
  const reduceMotion = useReducedMotion() === true;
  // Unbounded position so the track loops forever in one direction without rewinding.
  const [position, setPosition] = useState(0);
  const [hovered, setHovered] = useState(false);
  const [focused, setFocused] = useState(false);
  const [inView, setInView] = useState(false);
  const regionRef = useRef<HTMLDivElement>(null);
  const swipe = useRef<{ x: number; y: number; moved: boolean } | null>(null);
  const suppressClick = useRef(false);

  const playing = !reduceMotion && !hovered && !focused && inView;
  const go = useCallback((delta: number) => setPosition(current => current + delta), []);

  useEffect(() => {
    const node = regionRef.current;
    if (!node || typeof IntersectionObserver === "undefined") { setInView(true); return; }
    const observer = new IntersectionObserver(([entry]) => setInView(entry.isIntersecting), { threshold: 0.35 });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  // Restarts on every slide change and stops while paused (hover, keyboard focus, offscreen, reduced motion).
  useEffect(() => {
    if (!playing) return;
    const timer = window.setTimeout(() => go(1), DWELL_MS);
    return () => window.clearTimeout(timer);
  }, [playing, position, go]);

  const onKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    if (event.key === "ArrowLeft") { event.preventDefault(); go(-1); }
    else if (event.key === "ArrowRight") { event.preventDefault(); go(1); }
  };

  // Keyboard focus on the carousel pauses it; arrow keys then step through the slides.
  const onFocus = (event: FocusEvent<HTMLDivElement>) => {
    setFocused((event.target as HTMLElement).matches(":focus-visible"));
  };
  const onBlur = (event: FocusEvent<HTMLDivElement>) => {
    if (!event.currentTarget.contains(event.relatedTarget as Node | null)) setFocused(false);
  };

  const onPointerDown = (event: PointerEvent<HTMLDivElement>) => { suppressClick.current = false; swipe.current = { x: event.clientX, y: event.clientY, moved: false }; };
  const onPointerUp = (event: PointerEvent<HTMLDivElement>) => {
    const start = swipe.current;
    swipe.current = null;
    if (!start) return;
    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    if (Math.abs(dx) > SWIPE_THRESHOLD && Math.abs(dx) > Math.abs(dy)) {
      suppressClick.current = true;
      go(dx < 0 ? 1 : -1);
    }
  };

  const offsets = Array.from({ length: WINDOW * 2 + 1 }, (_, i) => i - WINDOW);

  return (
    <div
      ref={regionRef}
      className="how-carousel"
      role="region"
      aria-roledescription="carousel"
      aria-label="How Pact works, in three steps"
      tabIndex={0}
      onKeyDown={onKeyDown}
      onFocus={onFocus}
      onBlur={onBlur}
    >
      <div
        className="how-viewport"
        onPointerEnter={event => { if (event.pointerType === "mouse") setHovered(true); }}
        onPointerLeave={event => { if (event.pointerType === "mouse") setHovered(false); swipe.current = null; }}
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        onPointerCancel={() => { swipe.current = null; }}
      >
        <div id="how-carousel-track" className="how-track" style={{ "--how-position": position } as CSSProperties} aria-live={playing ? "off" : "polite"}>
          {offsets.map(offset => {
            const absolute = position + offset;
            const slideIndex = mod(absolute, SLIDES.length);
            const slide = SLIDES[slideIndex];
            const isActive = offset === 0;
            const Icon = slide.icon;
            return (
              <div
                key={absolute}
                className={`how-slide${isActive ? " is-active" : ""}${Math.abs(offset) > 1 ? " is-far" : ""}${slide.featured ? " is-featured" : ""}`}
                style={{ "--how-slot": absolute } as CSSProperties}
                role="group"
                aria-roledescription="slide"
                aria-label={`${slideIndex + 1} of ${SLIDES.length}`}
                aria-hidden={isActive ? undefined : true}
                onClick={() => {
                  if (suppressClick.current) { suppressClick.current = false; return; }
                  if (Math.abs(offset) === 1) go(offset);
                }}
              >
                <div className="how-slide-photo">
                  <Image src={slide.image} alt={isActive ? slide.alt : ""} fill sizes="(max-width: 767px) 78vw, 560px" draggable={false} />
                  <div className="how-slide-photo-top" aria-hidden="true">
                    <span className="process-label">{slide.index} · {slide.label}</span>
                    <span className="process-arrow"><ArrowUpRight aria-hidden="true" /></span>
                  </div>
                </div>
                <div className="how-slide-caption">
                  <h3>{slide.title}</h3>
                  <span className="how-slide-icon" aria-hidden="true"><Icon strokeWidth={1.5} /></span>
                  <span className="how-slide-index" aria-hidden="true">[{slide.index}]</span>
                  <p>{slide.description}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
