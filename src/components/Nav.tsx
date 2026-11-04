"use client";

import { useEffect, useState } from "react";
import { personal } from "@/lib/portfolio";

const LINKS = [
  { id: "work", label: "Work" },
  { id: "wins", label: "Wins", wide: true },
  { id: "skills", label: "Skills" },
  { id: "contact", label: "Contact" },
];

export default function Nav() {
  const [active, setActive] = useState<string>("");

  // Highlight the section that crosses the upper third of the viewport.
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) setActive(entry.target.id);
        }
      },
      { rootMargin: "-30% 0px -65% 0px" }
    );
    for (const { id } of LINKS) {
      const el = document.getElementById(id);
      if (el) observer.observe(el);
    }
    return () => observer.disconnect();
  }, []);

  return (
    <header className="sticky top-0 z-40 border-b border-line bg-bg/85 backdrop-blur-md">
      <nav
        aria-label="Main"
        className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-2 px-4 sm:px-8"
      >
        <a href="#top" className="flex min-h-11 items-center whitespace-nowrap font-serif text-base text-ink sm:text-lg">
          Deveshwar S
        </a>
        <ul className="flex items-center text-sm">
          {LINKS.map((link) => (
            <li key={link.id} className={link.wide ? "hidden sm:block" : undefined}>
              <a
                href={`#${link.id}`}
                aria-current={active === link.id ? "true" : undefined}
                className={`flex min-h-11 items-center px-2 transition-colors sm:px-3 ${
                  active === link.id ? "text-gold" : "text-muted hover:text-ink"
                }`}
              >
                {link.label}
              </a>
            </li>
          ))}
          <li>
            <a
              href={personal.resumeUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex min-h-11 items-center px-2 text-ink underline decoration-gold underline-offset-4 sm:px-3"
            >
              Résumé
            </a>
          </li>
        </ul>
      </nav>
    </header>
  );
}
