"use client";

import type { Project } from "@/lib/portfolio";
import ProjectImage from "./ProjectImage";

// Flat version of the gallery for phones, reduced motion and browsers without WebGL.
export default function WorksFallback({
  works,
  onOpen,
  openId,
}: {
  works: Project[];
  onOpen: (p: Project, origin: DOMRect | null) => void;
  openId: string | null;
}) {
  return (
    <ul className="-mx-4 flex snap-x snap-mandatory scroll-px-4 gap-4 overflow-x-auto px-4 pb-4 sm:mx-0 sm:grid sm:grid-cols-2 sm:overflow-visible sm:px-0 lg:grid-cols-3">
      {works.map((p) => (
        <li key={p.id} className="w-[86%] shrink-0 snap-start sm:w-auto">
          <button
            type="button"
            onClick={(e) =>
              onOpen(p, e.currentTarget.querySelector("img, [role=img]")?.getBoundingClientRect() ?? null)
            }
            className="group flex w-full flex-col gap-2 rounded-2xl text-left"
          >
            {/* Title sits on the image, as on a print; hidden with the image while it's open. */}
            <span className={`relative block ${openId === p.id ? "invisible" : ""}`}>
              <ProjectImage project={p} className="block transition-colors group-hover:border-gold" />
              <span
                className="pointer-events-none absolute inset-x-0 bottom-0 rounded-b-xl bg-gradient-to-t from-bg/90 via-bg/50 to-transparent px-4 pb-3 pt-12"
                aria-hidden="true"
              />
              <span className="absolute bottom-3 left-4 right-4 font-serif text-3xl leading-none text-ink">
                {p.title}
              </span>
            </span>
            <span className="block px-1 text-sm text-muted">{p.subtitle}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}
