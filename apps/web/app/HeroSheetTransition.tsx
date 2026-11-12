"use client";

import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { useReducedMotion, useScroll } from "framer-motion";

/**
 * Hero -> "How Pact works" transition.
 *
 * <HeroStage> wraps the hero. The hero is sticky inside it, and the stage adds a scroll runway
 * (CSS ::after) that <HowSheet> cancels with an equal negative margin, so the page is not longer:
 * the sheet simply slides up over the pinned hero. Progress p (0 -> 1 across the runway) drives the
 * hero's scale, lift, dim overlay and copy parallax. Styles are written to the DOM directly
 * (transform / opacity only) from one framer-motion scroll subscription, so it is reversible and
 * never re-renders React per frame.
 */
export function HeroStage({ children }: { children: ReactNode }) {
  const stageRef = useRef<HTMLDivElement>(null);
  const reduceMotion = useReducedMotion() === true;
  const { scrollY } = useScroll();

  useEffect(() => {
    const stage = stageRef.current;
    const hero = stage?.querySelector<HTMLElement>(".hero");
    const copy = hero?.querySelector<HTMLElement>(".hero-copy") ?? null;
    if (!stage || !hero) return;
    const reset = () => { hero.style.transform = ""; hero.style.removeProperty("--hero-dim"); if (copy) copy.style.transform = ""; };
    if (reduceMotion) { reset(); return; }

    const geometry = { top: 0, runway: 1, lift: 0, scale: 0.06 };
    const measure = () => {
      geometry.top = stage.getBoundingClientRect().top + window.scrollY;
      geometry.runway = Math.max(1, stage.offsetHeight - hero.offsetHeight);
      geometry.lift = window.innerHeight * 0.04;
      geometry.scale = window.innerWidth < 768 ? 0.03 : 0.06;
    };
    const render = (y: number) => {
      const p = Math.min(1, Math.max(0, (y - geometry.top) / geometry.runway));
      hero.style.transform = p === 0 ? "" : `translate3d(0, ${(-geometry.lift * p).toFixed(2)}px, 0) scale(${(1 - geometry.scale * p).toFixed(4)})`;
      hero.style.setProperty("--hero-dim", (0.45 * p).toFixed(3));
      // Copy rises ~40px while the hero itself barely moves: reads as 0.8x-speed parallax.
      if (copy) copy.style.transform = p === 0 ? "" : `translate3d(0, ${(-40 * p).toFixed(2)}px, 0)`;
    };

    measure();
    render(window.scrollY);
    const onResize = () => { measure(); render(window.scrollY); };
    const observer = new ResizeObserver(onResize);
    observer.observe(stage);
    window.addEventListener("resize", onResize);
    const unsubscribe = scrollY.on("change", render);
    return () => { unsubscribe(); observer.disconnect(); window.removeEventListener("resize", onResize); reset(); };
  }, [reduceMotion, scrollY]);

  return <div ref={stageRef} className="hero-stage">{children}</div>;
}

/** The "How Pact works" sheet. Reveals its heading block once, when its top passes 70% of the viewport. */
export function HowSheet({ children }: { children: ReactNode }) {
  const sheetRef = useRef<HTMLDivElement>(null);
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    const sheet = sheetRef.current;
    if (!sheet || typeof IntersectionObserver === "undefined") { setRevealed(true); return; }
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) { setRevealed(true); observer.disconnect(); }
    }, { rootMargin: "0px 0px -30% 0px" });
    observer.observe(sheet);
    return () => observer.disconnect();
  }, []);

  return <div ref={sheetRef} className="how-sheet" data-reveal={revealed ? "in" : "pending"}>{children}</div>;
}

/** Heading whose lines slide up out of a mask one after another. Words are grouped into lines by layout. */
export function RevealHeading({ id, text }: { id: string; text: string }) {
  const ref = useRef<HTMLHeadingElement>(null);
  const words = text.split(" ");

  useLayoutEffect(() => {
    const heading = ref.current;
    if (!heading) return;
    const assignLines = () => {
      const masks = Array.from(heading.querySelectorAll<HTMLElement>(".reveal-word"));
      let line = -1;
      let lastTop = Number.NEGATIVE_INFINITY;
      for (const mask of masks) {
        if (mask.offsetTop > lastTop + 2) { line += 1; lastTop = mask.offsetTop; }
        mask.style.setProperty("--line", String(line));
      }
      heading.closest<HTMLElement>(".how-sheet")?.style.setProperty("--heading-lines", String(line + 1));
    };
    assignLines();
    const observer = new ResizeObserver(assignLines);
    observer.observe(heading);
    return () => observer.disconnect();
  }, []);

  return (
    <h2 ref={ref} id={id} className="reveal-heading">
      {words.map((word, index) => (
        <span key={index}>
          <span className="reveal-word"><span>{word}</span></span>
          {index < words.length - 1 ? " " : null}
        </span>
      ))}
    </h2>
  );
}
