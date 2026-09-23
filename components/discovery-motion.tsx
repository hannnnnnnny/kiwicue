"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

const targets = ".portal-event-card, .movie-preview-card, .cinema-directory-list > li, .event-experience-item, .home-index-row";

/** Enhancement only: content remains visible when scripting or motion is unavailable. */
export function DiscoveryMotion() {
  const pathname = usePathname();
  useEffect(() => {
    const preference = matchMedia("(prefers-reduced-motion: reduce)");
    const seen = new WeakSet<Element>();
    const animations = new Set<Animation>();
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(({ target, isIntersecting }) => {
        if (!isIntersecting) return;
        observer.unobserve(target);
        if (preference.matches) return;
        const animation = target.animate(
          [{ opacity: 0.35, transform: "translateY(20px)" }, { opacity: 1, transform: "none" }],
          { duration: 250, easing: "cubic-bezier(.2,.7,.2,1)" },
        );
        animations.add(animation);
        animation.onfinish = () => animations.delete(animation);
      });
    }, { threshold: 0.08 });
    const scan = () => document.querySelectorAll(targets).forEach((node) => {
      if (!seen.has(node)) { seen.add(node); observer.observe(node); }
    });
    const cancel = () => { if (preference.matches) animations.forEach((animation) => animation.cancel()); };
    const mutations = new MutationObserver(scan);
    scan();
    mutations.observe(document.body, { childList: true, subtree: true });
    preference.addEventListener("change", cancel);
    return () => {
      observer.disconnect(); mutations.disconnect();
      preference.removeEventListener("change", cancel);
      animations.forEach((animation) => animation.cancel());
    };
  }, [pathname]);
  return null;
}
