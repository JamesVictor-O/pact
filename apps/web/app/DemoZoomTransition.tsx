"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { cubicBezier, useReducedMotion, useScroll } from "framer-motion";

// Ease-in-out so most of the growth happens while the card is clearly on screen.
const ease = cubicBezier(0.45, 0, 0.25, 1);

/**
 * "How Pact works" -> "Follow the money": the demo section rises as a rounded card at 84% scale and
 * grows to full width as its top travels from the bottom of the viewport to 10% from the top, so the
 * walkthrough reads as zooming into the product. Meanwhile the "How Pact works" content falls back
 * (lags the scroll and dims). Scroll-linked, reversible, transform/opacity only, no pinning.
 */
export function DemoZoomTransition({ children }: { children: ReactNode }) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const reduceMotion = useReducedMotion() === true;
  const { scrollY } = useScroll();

  useEffect(() => {
    const wrapper = wrapperRef.current;
    const demo = wrapper?.querySelector<HTMLElement>(".demo-section");
    const how = document.querySelector<HTMLElement>("#how-it-works");
    if (!wrapper || !demo) return;
    const reset = () => {
      demo.style.transform = "";
      if (how) { how.style.transform = ""; how.style.opacity = ""; }
    };
    if (reduceMotion) { reset(); return; }

    const geometry = { top: 0, vh: 1, startScale: 0.84 };
    const measure = () => {
      geometry.top = wrapper.getBoundingClientRect().top + window.scrollY;
      geometry.vh = window.innerHeight;
      geometry.startScale = window.innerWidth < 768 ? 0.9 : 0.84;
    };
    const render = (y: number) => {
      const topInViewport = geometry.top - y;
      const raw = Math.min(1, Math.max(0, (geometry.vh - topInViewport) / (geometry.vh * 0.9)));
      const p = ease(raw);
      const scale = geometry.startScale + (1 - geometry.startScale) * p;
      demo.style.transform = raw >= 1 ? "" : `scale(${scale.toFixed(4)})`;
      if (how) {
        how.style.transform = raw <= 0 ? "" : `translate3d(0, ${(raw * geometry.vh * 0.12).toFixed(2)}px, 0)`;
        how.style.opacity = raw <= 0 ? "" : (1 - 0.45 * raw).toFixed(3);
      }
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

  return <div ref={wrapperRef} className="demo-zoom">{children}</div>;
}
