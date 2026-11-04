"use client";

import { useEffect, useState } from "react";
import dynamic from "next/dynamic";
import { works, type Project } from "@/lib/portfolio";
import WorksFallback from "./WorksFallback";
import ProjectPanel from "./ProjectPanel";

const WorksGallery3D = dynamic(() => import("./WorksGallery3D"), { ssr: false });

function canUse3D() {
  if (!window.matchMedia("(min-width: 900px) and (hover: hover)").matches) return false;
  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return false;
  try {
    const canvas = document.createElement("canvas");
    return Boolean(canvas.getContext("webgl2") || canvas.getContext("webgl"));
  } catch {
    return false;
  }
}

export default function WorksSection() {
  // Server render and first paint use the flat list; large screens upgrade to 3D after mount.
  const [use3D, setUse3D] = useState(false);
  const [open, setOpen] = useState<{ project: Project; origin: DOMRect | null } | null>(null);
  const onOpen = (project: Project, origin: DOMRect | null) => setOpen({ project, origin });

  useEffect(() => {
    const update = () => setUse3D(canUse3D());
    update();
    // Re-check when the window crosses the width breakpoint or motion settings change.
    const queries = ["(prefers-reduced-motion: reduce)", "(min-width: 900px) and (hover: hover)"].map((q) =>
      window.matchMedia(q)
    );
    queries.forEach((mq) => mq.addEventListener("change", update));
    return () => queries.forEach((mq) => mq.removeEventListener("change", update));
  }, []);

  return (
    <section id="work" aria-labelledby="work-title" className="scroll-mt-14 border-t border-line pt-16 sm:pt-20">
      <div className="mx-auto max-w-6xl px-4 sm:px-8">
        <h2 id="work-title" className="font-serif text-4xl text-ink sm:text-5xl">
          Selected work
        </h2>
        <p className="mt-3 max-w-2xl text-muted">
          {use3D
            ? "Scroll or drag to move through ten projects. Select one for the full story."
            : "Ten projects from the last year. Select one for the full story."}
        </p>
      </div>

      {use3D ? (
        <WorksGallery3D works={works} onOpen={onOpen} openId={open?.project.id ?? null} />
      ) : (
        <div className="mx-auto mt-8 max-w-6xl px-4 pb-6 sm:mt-10 sm:px-8 sm:pb-24">
          <WorksFallback works={works} onOpen={onOpen} openId={open?.project.id ?? null} />
        </div>
      )}

      <ProjectPanel project={open?.project ?? null} origin={open?.origin ?? null} onClosed={() => setOpen(null)} />
    </section>
  );
}
