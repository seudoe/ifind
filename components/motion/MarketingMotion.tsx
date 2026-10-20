"use client";

import { useLayoutEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { SmoothScroll } from "./SmoothScroll";

gsap.registerPlugin(ScrollTrigger);

const prefersReducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * Motion layer for public marketing pages (the two landing pages).
 *
 * - Smooth scrolling comes from <SmoothScroll /> (one Lenis instance, GSAP-driven).
 * - Mark elements with `data-hero` (staggered entrance on load) or `data-reveal`
 *   (fade/slide in once, as they scroll into view). Content is fully visible in the server
 *   HTML and with reduced motion; nothing waits on an animation to become reachable.
 */
export function MarketingMotion({ children }: { children: React.ReactNode }) {
  const scope = useRef<HTMLDivElement>(null);

  // Layout effect so the initial (hidden) state is applied before first paint — no flash.
  useLayoutEffect(() => {
    if (prefersReducedMotion()) return;

    // gsap.context scopes selectors to this subtree and reverts everything on cleanup,
    // which also makes React Strict Mode's double-invoke a no-op.
    const ctx = gsap.context(() => {
      gsap.from("[data-hero]", {
        opacity: 0,
        y: 18,
        duration: 0.6,
        ease: "power2.out",
        stagger: 0.08,
        clearProps: "opacity,transform",
      });

      ScrollTrigger.batch("[data-reveal]", {
        start: "top 88%",
        once: true,
        onEnter: (batch) =>
          gsap.from(batch, {
            opacity: 0,
            y: 20,
            duration: 0.55,
            ease: "power2.out",
            stagger: 0.07,
            clearProps: "opacity,transform",
          }),
      });
    }, scope);

    return () => {
      ctx.revert();
    };
  }, []);

  return (
    <div ref={scope} className="contents">
      <SmoothScroll />
      {children}
    </div>
  );
}
