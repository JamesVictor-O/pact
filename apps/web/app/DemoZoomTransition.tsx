"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { cubicBezier, useReducedMotion, useScroll } from "framer-motion";

const ease = cubicBezier(0.33, 0, 0.2, 1);

/**
 * "How Pact works" -> "Follow the money": stacked sheets, matching the hero -> "How Pact works" move.
 *
 * "How Pact works" pins (CSS sticky inside .how-sheet, which adds a one-screen runway that this wrapper
 * cancels with an equal negative margin, so the page is not longer). "Follow the money" slides up over it
 * as a sheet, while the pinned section drifts up (12vh) and fades (to 0.35) out of its way. When the
 * sheet's top passes 70% of the viewport, its heading reveals line by line and the walkthrough fades up.
 * Scroll-linked, reversible, transform/opacity only; a plain stack under prefers-reduced-motion.
 */
export function DemoZoomTransition({ children }: { children: ReactNode }) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [revealed, setRevealed] = useState(false);
  const reduceMotion = useReducedMotion() === true;
  const { scrollY } = useScroll();

  useEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper || typeof IntersectionObserver === "undefined") { setRevealed(true); return; }
    const observer = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) { setRevealed(true); observer.disconnect(); }
    }, { rootMargin: "0px 0px -30% 0px" });
    observer.observe(wrapper);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const wrapper = wrapperRef.current;
    const how = document.querySelector<HTMLElement>("#how-it-works");
    if (!wrapper || !how) return;
    const reset = () => { how.style.transform = ""; how.style.opacity = ""; };
    if (reduceMotion) { reset(); return; }

    const geometry = { top: 0, vh: 1 };
    const measure = () => {
      geometry.top = wrapper.getBoundingClientRect().top + window.scrollY;
      geometry.vh = window.innerHeight;
    };
    const render = (y: number) => {
      // 0 when the sheet's top enters at the bottom of the viewport, 1 when it reaches the top.
      const raw = Math.min(1, Math.max(0, (geometry.vh - (geometry.top - y)) / geometry.vh));
      if (raw <= 0) { reset(); return; }
      const p = ease(raw);
      // No scaling (it distorts the carousel layout): the pinned section drifts up out of the sheet's way and fades.
      how.style.transform = `translate3d(0, ${(-0.12 * geometry.vh * p).toFixed(2)}px, 0)`;
      how.style.opacity = (1 - 0.65 * p).toFixed(3);
    };

    measure();
    render(window.scrollY);
    const onResize = () => { measure(); render(window.scrollY); };
    const observer = new ResizeObserver(onResize);
    observer.observe(document.body);
    window.addEventListener("resize", onResize);
    const unsubscribe = scrollY.on("change", render);
    return () => { unsubscribe(); observer.disconnect(); window.removeEventListener("resize", onResize); reset(); };
  }, [reduceMotion, scrollY]);

  return <div ref={wrapperRef} className="demo-zoom" data-reveal={revealed ? "in" : "pending"}>{children}</div>;
}
