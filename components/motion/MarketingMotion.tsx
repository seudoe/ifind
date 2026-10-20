"use client";

import { useLayoutEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Lenis from "lenis";

gsap.registerPlugin(ScrollTrigger);

const prefersReducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/**
 * Motion layer for public marketing pages (the two landing pages).
 *
 * - One Lenis instance owns page scrolling for the lifetime of the page. It is driven by
 *   GSAP's ticker and feeds ScrollTrigger, so there is a single animation-frame loop.
 * - Mark elements with `data-hero` (staggered entrance on load) or `data-reveal`
 *   (fade/slide in once, as they scroll into view). Content is fully visible in the server
 *   HTML and with reduced motion; nothing waits on an animation to become reachable.
 * - Not used in the dashboards: those scroll inside nested panels, where a global smooth
 *   scroller would fight native scrolling.
 */
export function MarketingMotion({ children }: { children: React.ReactNode }) {
  const scope = useRef<HTMLDivElement>(null);

  // Layout effect so the initial (hidden) state is applied before first paint — no flash.
  useLayoutEffect(() => {
    if (prefersReducedMotion()) return;

    const lenis = new Lenis({ anchors: true });
    lenis.on("scroll", ScrollTrigger.update);
    const tick = (time: number) => lenis.raf(time * 1000);
    gsap.ticker.add(tick);
    gsap.ticker.lagSmoothing(0);

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
      gsap.ticker.remove(tick);
      lenis.destroy();
    };
  }, []);

  return <div ref={scope} className="contents">{children}</div>;
}
