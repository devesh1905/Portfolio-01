import { achievements, now, personal, projectById } from "@/lib/portfolio";
import { Fragment } from "react";
import PhoneFold from "./PhoneFold";
import PolicyTicker from "./PolicyTicker";

// Pairs of [project id, index into its stats] shown as the proof column.
const HIGHLIGHTS: [string, number][] = [
  ["blackonyx", 0],
  ["blackonyx", 1],
  ["floodline", 0],
  ["floodline", 1],
  ["client-erp", 0],
];

function Column({ id, title, children }: { id?: string; title: string; children: React.ReactNode }) {
  return (
    <div id={id} className="scroll-mt-20 border-t border-line pt-5">
      <h2 className="mb-4 text-sm font-medium text-subtle">{title}</h2>
      {children}
    </div>
  );
}

export default function Header() {
  const highlights = HIGHLIGHTS.map(([id, i]) => {
    const p = projectById(id);
    return p?.stats?.[i] ? { stat: p.stats[i], project: p.title } : null;
  }).filter((h): h is { stat: string; project: string } => h !== null);

  return (
    <section id="top" className="mx-auto max-w-6xl px-4 pb-16 pt-14 sm:px-8 sm:pb-24 sm:pt-24">
      <p className="text-base text-muted">
        {personal.name}, full-stack and AI developer in {personal.location.split(",")[0]}
      </p>
      <h1 className="mt-4 max-w-4xl font-serif text-[2.75rem] leading-[1.02] text-ink sm:text-6xl lg:text-[5.25rem]">
        {/* Each word rises out of its own clip, staggered, once on load. */}
        {personal.tagline.split(" ").map((word, i) => (
          <Fragment key={i}>
            <span className="reveal-word">
              <span style={{ animationDelay: `${120 + i * 45}ms` }}>{word}</span>
            </span>{" "}
          </Fragment>
        ))}
      </h1>
      <p className="mt-6 max-w-2xl text-lg text-muted">
        I turn problem statements into tested software: an agent firewall that let none of 310 attacks
        through, a flood-alert app that keeps working offline, and client platforms in three languages.
      </p>

      <PolicyTicker />

      <div className="mt-8 flex flex-wrap items-center gap-3">
        <a
          href={`mailto:${personal.email}`}
          className="inline-flex min-h-12 items-center rounded-full bg-gold px-6 font-medium text-gold-ink transition-opacity hover:opacity-90"
        >
          Email me
        </a>
        <a
          href={personal.resumeUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-12 items-center rounded-full border border-line px-6 text-ink transition-colors hover:border-gold"
        >
          Résumé (PDF)
        </a>
        <span className="inline-flex items-center gap-2 px-2 text-sm text-muted">
          <span className="size-2 rounded-full bg-gold" aria-hidden="true" />
          Open to internships
        </span>
      </div>

      <PhoneFold summary={`${achievements.length} hackathon prizes, highlights, now`}>
      <div className="mt-8 grid gap-x-10 gap-y-10 sm:mt-16 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_0.7fr]">
        <Column id="wins" title="Wins">
          <ul className="flex flex-col gap-4">
            {achievements.map((a) => (
              <li key={a.id} className="grid grid-cols-[5.5rem_1fr] gap-3">
                <span className="pt-1 font-mono text-[13px] text-subtle">{a.date}</span>
                <span>
                  <span className="block text-ink">{a.title}</span>
                  <span className="block text-sm text-muted">
                    {a.badge}, with {a.project}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </Column>

        <Column title="Highlights">
          <ul className="flex flex-col gap-4">
            {highlights.map((h) => (
              <li key={h.stat}>
                <span className="block text-ink">{h.stat}</span>
                <span className="block text-sm text-muted">{h.project}</span>
              </li>
            ))}
          </ul>
        </Column>

        <Column title="Now">
          <ul className="flex flex-col gap-4 text-muted">
            {now.map((line) => (
              <li key={line}>{line}</li>
            ))}
          </ul>
        </Column>

        <Column title="Elsewhere">
          <ul className="flex flex-col">
            {[
              { label: "GitHub", href: personal.github },
              { label: "LinkedIn", href: personal.linkedin },
              { label: "Email", href: `mailto:${personal.email}` },
            ].map((l) => (
              <li key={l.label}>
                <a
                  href={l.href}
                  target={l.href.startsWith("http") ? "_blank" : undefined}
                  rel="noopener noreferrer"
                  className="flex min-h-11 items-center text-ink underline decoration-line underline-offset-4 transition-colors hover:decoration-gold"
                >
                  {l.label}
                </a>
              </li>
            ))}
          </ul>
        </Column>
      </div>
      </PhoneFold>
    </section>
  );
}
