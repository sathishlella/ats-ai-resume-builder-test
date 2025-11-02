'use client'

import { useRef, useEffect } from "react";

export default function TemplatePicker() {
  const btnRef = useRef<HTMLAnchorElement | null>(null);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  // Mouse move handler: calculates tilt based on pointer position inside the button.
  function handleMove(e: React.MouseEvent) {
    const el = btnRef.current;
    if (!el) return;

    const rect = el.getBoundingClientRect();
    const px = (e.clientX - rect.left) / rect.width; // 0 -> 1
    const py = (e.clientY - rect.top) / rect.height; // 0 -> 1

    // Map to rotation: center = 0, edges -> tilt up to +/-8 degrees
    const rotY = (px - 0.5) * 16; // around Y axis
    const rotX = -(py - 0.5) * 10; // around X axis

    // subtle scale
    const scale = 1.03;

    // Use rAF for smoother updates
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => {
      el.style.transform = `perspective(900px) rotateX(${rotX}deg) rotateY(${rotY}deg) scale(${scale})`;
      el.style.boxShadow = `0 ${14 - Math.abs(rotX) / 2}px ${30 - Math.abs(rotY) / 2}px rgba(0,0,0,0.18)`;
    });
  }

  function handleLeave() {
    const el = btnRef.current;
    if (!el) return;
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    // Smoothly return to neutral
    el.style.transition = "transform 420ms cubic-bezier(.2,.9,.3,1), box-shadow 420ms cubic-bezier(.2,.9,.3,1)";
    el.style.transform = "perspective(900px) rotateX(0deg) rotateY(0deg) scale(1)";
    el.style.boxShadow = "0 8px 18px rgba(0,0,0,0.12)";
    // remove transition after it finishes to keep immediate response for subsequent moves
    setTimeout(() => {
      if (!el) return;
      el.style.transition = "";
    }, 450);
  }

  function handleEnter() {
    const el = btnRef.current;
    if (!el) return;
    // ensure smooth entrance
    el.style.transition = "transform 220ms cubic-bezier(.2,.9,.3,1), box-shadow 220ms cubic-bezier(.2,.9,.3,1)";
    // slight initial lift so moves feel instant
    el.style.transform = "perspective(900px) rotateX(0deg) rotateY(0deg) scale(1.02)";
    el.style.boxShadow = "0 12px 26px rgba(0,0,0,0.16)";
  }

  return (
    <div className="rounded-2xl border p-6 bg-white shadow-sm max-w-xl">
      <div className="flex items-start gap-4">
        <div className="flex-1">
          <h3 className="text-lg font-semibold mb-2">Build your career with our help</h3>
          <p className="text-sm text-gray-600 mb-4">
            We help you land the next role — projects & portfolio design, GitHub improvements,
            and resume & cover letter writing. Browse sample works and read client feedback to
            see how we transform careers.
          </p>

          <a
            ref={btnRef}
            href="https://sathishlella.github.io/Career-Canvas/"
            target="_blank"
            rel="noopener noreferrer"
            aria-label="See sample works and client feedback (opens in a new tab)"
            onMouseMove={handleMove}
            onMouseLeave={handleLeave}
            onMouseEnter={handleEnter}
            // also add touch handlers for mobile fallback
            onTouchStart={() => {
              const el = btnRef.current;
              if (!el) return;
              el.style.transition = "transform 220ms cubic-bezier(.2,.9,.3,1), box-shadow 220ms cubic-bezier(.2,.9,.3,1)";
              el.style.transform = "perspective(900px) scale(1.02)";
              el.style.boxShadow = "0 12px 26px rgba(0,0,0,0.16)";
            }}
            onTouchEnd={handleLeave}
            className={
              // Tailwind for base look + accessibility; visual 3D handled via JS inline styles
              "inline-flex items-center gap-3 px-6 py-3 rounded-lg bg-black text-white font-medium shadow-md focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-black/20 " +
              "transform-gpu will-change-transform select-none"
            }
            // initialize neutral style so shadows/transform are present from the start
            style={{
              transform: "perspective(900px) rotateX(0deg) rotateY(0deg) scale(1)",
              boxShadow: "0 8px 18px rgba(0,0,0,0.12)",
              transition: "transform 220ms cubic-bezier(.2,.9,.3,1), box-shadow 220ms cubic-bezier(.2,.9,.3,1)",
              WebkitTapHighlightColor: "transparent",
            }}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              aria-hidden="true"
              style={{ color: "white" }}
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7l5 5m0 0l-5 5m5-5H6" />
            </svg>
            See sample works & client feedback
          </a>
        </div>
      </div>
    </div>
  );
}


