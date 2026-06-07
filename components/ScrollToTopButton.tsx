"use client";

import { useEffect, useState } from "react";

type ScrollToTopButtonProps = {
  scrollTargetId: string;
  className?: string;
  title?: string;
};

export function ScrollToTopButton({
  scrollTargetId,
  className = "",
  title,
}: ScrollToTopButtonProps) {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const el = document.getElementById(scrollTargetId);
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => setShow(!entry.isIntersecting),
      { threshold: 0 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [scrollTargetId]);

  if (!show) return null;

  return (
    <button
      type="button"
      onClick={() =>
        document
          .getElementById(scrollTargetId)
          ?.scrollIntoView({ behavior: "smooth", block: "start" })
      }
      className={`scroll-to-top btn btn-ghost ${className}`}
      aria-label="Nach oben"
      title={title}
    >
      ↑
    </button>
  );
}
