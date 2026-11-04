"use client";

import { useState } from "react";
import type { Project } from "@/lib/portfolio";

// The project screenshot, or a typographic cover while an image is missing or fails to load.
export default function ProjectImage({ project, className = "" }: { project: Project; className?: string }) {
  const [failed, setFailed] = useState(!project.image);

  if (failed) {
    return (
      <div
        role="img"
        aria-label={project.imageAlt ?? project.title}
        className={`flex aspect-[1.6] flex-col justify-end rounded-xl border border-line bg-raised p-5 ${className}`}
      >
        <span className="font-serif text-2xl text-ink">{project.title}</span>
        <span className="text-sm text-muted">{project.subtitle}</span>
      </div>
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={project.image}
      alt={project.imageAlt ?? project.title}
      loading="lazy"
      onError={() => setFailed(true)}
      className={`aspect-[1.6] w-full rounded-xl border border-line object-cover object-top ${className}`}
    />
  );
}
