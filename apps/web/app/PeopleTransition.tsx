"use client";

import { useEffect, useRef, type ReactNode } from "react";
import { cubicBezier, useReducedMotion, useScroll } from "framer-motion";

const ease = cubicBezier(0.22, 1, 0.36, 1);
const range = (value: number, start: number, end: number) => Math.min(1, Math.max(0, (value - start) / (end - start)));

/**
 * "Follow the money" -> "One plan. The right view for everyone.": one continuous surface.
 *
 * Unlike the two sheet transitions above it, nothing slides over anything. The People section arrives on
 * the same white surface as the demo, so there is no visible edge. As it enters, the demo's content lifts
 * and fades away, the People heading rises in and the card stack settles from 90% to full size. Once
 * the section has settled, the surface warms from white to the page's off-white.
 * Scroll-linked, reversible, transform/opacity (plus one background colour); off under reduced motion.
 */
export function PeopleTransition({ children }: { children: ReactNode }) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const reduceMotion = useReducedMotion() === true;
  const { scrollY } = useScroll();

  useEffect(() => {
    const wrapper = wrapperRef.current;
    const demo = document.querySelector<HTMLElement>(".demo-zoom .demo-shell");
    const heading = wrapper?.querySelector<HTMLElement>(".people-stack-heading") ?? null;
    const stack = wrapper?.querySelector<HTMLElement>(".audience-stack") ?? null;
    if (!wrapper) return;
    const targets = [demo, heading, stack];
    const reset = () => {
      for (const node of targets) if (node) { node.style.transform = ""; node.style.opacity = ""; }
      wrapper.style.removeProperty("--people-surface");
    };
    // The static (reduced-motion) People layout has no stack to animate.
    if (reduceMotion || !wrapper.querySelector(".people-stack")) { reset(); return; }

    const geometry = { top: 0, vh: 1 };
    const measure = () => {
      geometry.top = wrapper.getBoundingClientRect().top + window.scrollY;
      geometry.vh = window.innerHeight;
    };
    // White (#ffffff) to the page canvas (#fafaf8).
    const surface = (t: number) => `rgb(${Math.round(255 - 5 * t)}, ${Math.round(255 - 5 * t)}, ${Math.round(255 - 7 * t)})`;
    const render = (y: number) => {
      // 0 when the People section's top enters at the bottom of the viewport, 1 when it reaches the top.
      const q = Math.min(1, Math.max(0, (geometry.vh - (geometry.top - y)) / geometry.vh));
      const vh = geometry.vh;
      if (demo) {
        const out = ease(range(q, 0.15, 0.95));
        demo.style.transform = q <= 0 ? "" : `translate3d(0, ${(-0.08 * vh * out).toFixed(2)}px, 0)`;
        demo.style.opacity = q <= 0 ? "" : (1 - 0.7 * out).toFixed(3);
      }
      if (heading) {
        const inn = ease(range(q, 0.1, 0.6));
        heading.style.transform = inn >= 1 ? "" : `translate3d(0, ${((1 - inn) * 40).toFixed(2)}px, 0)`;
        heading.style.opacity = inn >= 1 ? "" : inn.toFixed(3);
      }
      if (stack) {
        const grow = ease(range(q, 0.05, 0.9));
        stack.style.transform = grow >= 1 ? "" : `translate3d(0, ${((1 - grow) * 0.06 * vh).toFixed(2)}px, 0) scale(${(0.9 + 0.1 * grow).toFixed(4)})`;
        stack.style.opacity = grow >= 1 ? "" : Math.min(1, grow * 2).toFixed(3);
      }
      wrapper.style.setProperty("--people-surface", surface(range(q, 0.75, 1)));
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

  return <div ref={wrapperRef} className="people-enter">{children}</div>;
}
