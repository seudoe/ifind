"use client";

import { useEffect } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import Lenis from "lenis";

gsap.registerPlugin(ScrollTrigger);

/**
 * Page-level Lenis smooth scrolling. Renders nothing.
 *
 * One instance per page, driven by GSAP's ticker (single rAF loop) and feeding
 * ScrollTrigger. Skipped under prefers-reduced-motion. Any nested scroll area
 * (chat transcript, filter drawer, dialogs) must carry `data-lenis-prevent` so it
 * keeps native wheel/touch scrolling; Radix dialogs get it via `Modal`.
 */
export function SmoothScroll() {
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const lenis = new Lenis({ anchors: true });
    lenis.on("scroll", ScrollTrigger.update);
    const tick = (time: number) => lenis.raf(time * 1000);
    gsap.ticker.add(tick);
    gsap.ticker.lagSmoothing(0);

    return () => {
      gsap.ticker.remove(tick);
      lenis.destroy();
    };
  }, []);

  return null;
}
