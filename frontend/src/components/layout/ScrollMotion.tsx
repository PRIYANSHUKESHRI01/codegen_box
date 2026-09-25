"use client";

import { useEffect } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

export function ScrollMotion() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    gsap.registerPlugin(ScrollTrigger);

    // Animate section headings subtly as they enter the viewport
    const headings = document.querySelectorAll("section h2");
    headings.forEach((heading) => {
      gsap.fromTo(
        heading,
        { opacity: 0, y: 20 },
        {
          opacity: 1,
          y: 0,
          duration: 0.6,
          ease: "power2.out",
          scrollTrigger: {
            trigger: heading,
            start: "top 85%",
            toggleActions: "play none none none",
          },
        }
      );
    });

    // Stagger-fade each grid's direct children as the grid scrolls in — one
    // generic selector benefits every card grid on the page (Features,
    // PlatformRoles, HowItWorks, Testimonials, Languages) with no
    // per-component wiring needed.
    const grids = document.querySelectorAll("section .grid");
    grids.forEach((grid) => {
      const cards = grid.children;
      if (!cards.length) return;
      gsap.fromTo(
        cards,
        { opacity: 0, y: 24 },
        {
          opacity: 1,
          y: 0,
          duration: 0.5,
          ease: "power2.out",
          stagger: 0.08,
          scrollTrigger: {
            trigger: grid,
            start: "top 88%",
            toggleActions: "play none none none",
          },
        }
      );
    });

    return () => {
      ScrollTrigger.getAll().forEach((t) => t.kill());
    };
  }, []);

  return null;
}
