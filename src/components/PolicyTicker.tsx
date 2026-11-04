"use client";

import { useEffect, useState } from "react";

// Sample decisions in the shape Black Onyx's policy produces: an argument is blocked when
// its value came from untrusted tool output, allowed when it traces back to the user.
const EVENTS: { verdict: "block" | "allow"; arg: string; source: string }[] = [
  { verdict: "block", arg: "send_email.to", source: "web page (untrusted)" },
  { verdict: "allow", arg: "read_file.path", source: "user request" },
  { verdict: "block", arg: "http_post.url", source: "email body (untrusted)" },
  { verdict: "allow", arg: "search.query", source: "user request" },
  { verdict: "block", arg: "shell.cmd", source: "file contents (untrusted)" },
];

export default function PolicyTicker() {
  const [i, setI] = useState(0);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const id = setInterval(() => setI((n) => (n + 1) % EVENTS.length), 2600);
    return () => clearInterval(id);
  }, []);

  const e = EVENTS[i];
  return (
    <div className="mt-8 flex max-w-full flex-wrap items-center gap-x-3 gap-y-1 overflow-hidden rounded-lg border border-line bg-panel px-4 py-3 font-mono text-[13px] sm:w-fit sm:flex-nowrap">
      <span className="shrink-0 text-subtle">black-onyx</span>
      {/* Phones: verdict and argument on one line, the source underneath. */}
      <span key={i} className="ticker-in flex min-w-0 flex-wrap items-center gap-x-3 gap-y-1" aria-hidden="true">
        <span className={e.verdict === "block" ? "text-gold" : "text-muted"}>{e.verdict}</span>
        <span className="text-ink">{e.arg}</span>
        <span className="basis-full whitespace-nowrap text-subtle sm:basis-auto">← {e.source}</span>
      </span>
      <span className="sr-only">
        Example Black Onyx decisions: arguments from untrusted tool output are blocked, arguments from the user are
        allowed.
      </span>
    </div>
  );
}
