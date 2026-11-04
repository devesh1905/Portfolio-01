"use client";

import { useId, useState } from "react";

// On phones the credentials fold behind one row (summary + toggle) so the work is reached
// in a thumb-scroll or two. From the sm breakpoint up the content is always shown.
export default function PhoneFold({ summary, children }: { summary: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  return (
    <>
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((o) => !o)}
        className="mt-12 flex min-h-14 w-full py-3 items-center justify-between gap-4 border-y border-line text-left sm:hidden"
      >
        <span>
          <span className="block text-ink">Credentials</span>
          <span className="block text-sm text-muted">{summary}</span>
        </span>
        <span className="shrink-0 whitespace-nowrap font-mono text-sm text-gold" aria-hidden="true">
          {open ? "Close [−]" : "Open [+]"}
        </span>
      </button>
      <div id={id} className={open ? "" : "max-sm:hidden"}>
        {children}
      </div>
    </>
  );
}
