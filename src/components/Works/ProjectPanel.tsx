"use client";

import { useCallback, useEffect, useLayoutEffect, useRef } from "react";
import dynamic from "next/dynamic";
import type { Project } from "@/lib/portfolio";
import { GithubIcon } from "@/components/icons";
import ProjectImage from "./ProjectImage";

const DEMOS: Record<string, React.ComponentType> = {
  etherwave: dynamic(() => import("@/components/demos/EtherWaveDemo")),
  audiolens: dynamic(() => import("@/components/demos/AudioLensDemo")),
};

const EASE = "cubic-bezier(0.7, 0, 0.15, 1)";

const reducedMotion = () => window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// A full-page project view in a native <dialog> (focus trap, Esc, inert page behind it).
// Opening is a shared-element transition: a copy of the card image flies from where the card
// sat (`origin`) into the hero slot while the page fades in and the details rise into place.
// Closing runs the same flight backwards, then tells the parent via `onClosed`.
export default function ProjectPanel({
  project,
  origin,
  next,
  onNavigate,
  onRequestClose,
  closeRef,
  onClosed,
}: {
  project: Project | null;
  origin: DOMRect | null;
  next: Project | null;
  onNavigate: (p: Project) => void;
  // Close buttons and Esc ask the parent, which keeps the URL/history in step and then
  // calls the animated close through `closeRef`.
  onRequestClose: () => void;
  closeRef: { current: (() => void) | null };
  onClosed: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const backdrop = useRef<HTMLDivElement>(null);
  const hero = useRef<HTMLDivElement>(null);
  const closing = useRef(false);

  const reveals = () => [...(dialog.current?.querySelectorAll<HTMLElement>("[data-reveal]") ?? [])];

  // Copy of the hero image positioned over `to`, transformed so it starts at `from`.
  const fly = useCallback((src: string, from: DOMRect, to: DOMRect, duration: number) => {
    const img = document.createElement("img");
    img.src = src;
    img.alt = "";
    Object.assign(img.style, {
      position: "fixed",
      left: `${to.left}px`,
      top: `${to.top}px`,
      width: `${to.width}px`,
      height: `${to.height}px`,
      objectFit: "cover",
      objectPosition: "top",
      borderRadius: "12px",
      transformOrigin: "0 0",
      zIndex: "10",
      pointerEvents: "none",
    });
    dialog.current!.appendChild(img);
    const start = `translate(${from.left - to.left}px, ${from.top - to.top}px) scale(${from.width / to.width}, ${
      from.height / to.height
    })`;
    const animation = img.animate([{ transform: start }, { transform: "none" }], { duration, easing: EASE });
    return { img, animation };
  }, []);

  // Open: runs before paint so the details never flash in their final place.
  useLayoutEffect(() => {
    const el = dialog.current;
    if (!project || !el) return;
    // Moving to another project inside the open page: back to the top, details rise again.
    if (el.open) {
      el.scrollTop = 0;
      if (reducedMotion()) return;
      [hero.current, ...reveals()].forEach((node, i) =>
        node?.animate(
          [
            { opacity: 0, transform: "translateY(28px)" },
            { opacity: 1, transform: "none" },
          ],
          { duration: 600, delay: i * 60, easing: "cubic-bezier(0.2, 0.7, 0.2, 1)", fill: "backwards" }
        )
      );
      return;
    }
    closing.current = false;
    el.showModal();
    el.scrollTop = 0;
    if (reducedMotion()) return;

    backdrop.current?.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 450, easing: "ease-out" });
    reveals().forEach((node, i) =>
      node.animate(
        [
          { opacity: 0, transform: "translateY(28px)" },
          { opacity: 1, transform: "none" },
        ],
        { duration: 600, delay: 320 + i * 70, easing: "cubic-bezier(0.2, 0.7, 0.2, 1)", fill: "backwards" }
      )
    );

    const target = hero.current?.getBoundingClientRect();
    if (origin && target && project.image && hero.current) {
      const heroEl = hero.current;
      heroEl.style.visibility = "hidden";
      const { img, animation } = fly(project.image, origin, target, 750);
      animation.onfinish = () => {
        heroEl.style.visibility = "";
        img.remove();
      };
    } else {
      hero.current?.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 500, delay: 200, fill: "backwards" });
    }
  }, [project, origin, fly]);

  const close = useCallback(() => {
    const el = dialog.current;
    if (!el?.open || closing.current) return;
    closing.current = true;
    const finish = () => {
      el.close();
      closing.current = false;
      onClosed();
    };
    if (reducedMotion()) return finish();

    reveals().forEach((node) =>
      node.animate([{ opacity: 1 }, { opacity: 0, transform: "translateY(12px)" }], {
        duration: 180,
        fill: "forwards",
      })
    );
    const from = hero.current?.getBoundingClientRect();
    const visible = from && from.bottom > 0 && from.top < window.innerHeight;
    if (origin && from && visible && project?.image && hero.current) {
      hero.current.style.visibility = "hidden";
      // Back to the card: the copy is laid out at hero size (stays sharp) and the
      // origin-to-hero flight is played in reverse.
      const { animation } = fly(project.image, origin, from, 600);
      animation.effect?.updateTiming({ direction: "reverse" });
      backdrop.current?.animate([{ opacity: 1 }, { opacity: 0 }], {
        duration: 450,
        delay: 150,
        easing: "ease-in",
        fill: "forwards",
      });
      animation.onfinish = () => {
        if (hero.current) hero.current.style.visibility = "";
        dialog.current?.querySelectorAll(":scope > img").forEach((n) => n.remove());
        finish();
      };
    } else {
      const fade = backdrop.current?.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 300, fill: "forwards" });
      hero.current?.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 200, fill: "forwards" });
      if (fade) fade.onfinish = finish;
      else finish();
    }
  }, [origin, project, fly, onClosed]);

  useEffect(() => {
    closeRef.current = close;
  }, [close, closeRef]);

  const Demo = project ? DEMOS[project.id] : undefined;

  return (
    <dialog
      ref={dialog}
      onCancel={(e) => {
        e.preventDefault();
        onRequestClose();
      }}
      aria-labelledby="project-title"
      className="m-0 h-dvh max-h-none w-screen max-w-none overflow-y-auto bg-transparent p-0 text-ink backdrop:bg-transparent"
    >
      <div ref={backdrop} className="fixed inset-0 bg-bg" aria-hidden="true" />
      {project && (
        <article className="relative mx-auto max-w-5xl px-4 pb-24 pt-5 sm:px-8">
          <div data-reveal className="flex items-center justify-between gap-4">
            <button
              type="button"
              onClick={onRequestClose}
              className="inline-flex min-h-11 items-center gap-2 rounded-full border border-line px-4 text-sm text-ink hover:border-gold"
            >
              <span aria-hidden="true">←</span> All work
            </button>
            <p className="text-sm text-subtle">{project.badge}</p>
          </div>

          <div ref={hero} className="mt-6">
            <ProjectImage project={project} className="rounded-xl" />
          </div>

          <div className="mt-10 grid gap-12 lg:grid-cols-[1fr_16rem]">
            <div className="flex min-w-0 flex-col gap-8">
              <header data-reveal>
                <h2 id="project-title" className="font-serif text-5xl leading-none sm:text-6xl">
                  {project.title}
                </h2>
                <p className="mt-3 text-lg text-muted">{project.subtitle}</p>
              </header>

              {project.stats && project.stats.length > 0 && (
                <ul data-reveal className="flex flex-wrap gap-x-10 gap-y-3 border-y border-line py-5">
                  {project.stats.map((s) => (
                    <li key={s} className="text-xl text-gold">
                      {s}
                    </li>
                  ))}
                </ul>
              )}

              <p data-reveal className="max-w-[65ch] text-lg text-muted">
                {project.description}
              </p>

              {Demo && (
                <div data-reveal>
                  <Demo />
                </div>
              )}

              {project.gallery && project.gallery.length > 0 && (
                <div data-reveal className="flex flex-col gap-6">
                  {project.gallery.map((g) => (
                    <figure key={g.src}>
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={g.src}
                        alt={g.caption}
                        loading="lazy"
                        className="aspect-[1.6] w-full rounded-xl border border-line object-cover object-top"
                      />
                      <figcaption className="mt-2 text-sm text-subtle">{g.caption}</figcaption>
                    </figure>
                  ))}
                </div>
              )}

              {project.features.length > 0 && (
                <div data-reveal>
                  <h3 className="mb-3 text-sm font-medium text-subtle">What it does</h3>
                  <ul className="flex max-w-[65ch] flex-col gap-2 text-muted">
                    {project.features.map((f) => (
                      <li key={f} className="border-l border-line pl-4">
                        {f}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>

            <aside data-reveal className="flex flex-col gap-6 lg:pt-3">
              <dl className="flex flex-col gap-5 text-sm">
                <div>
                  <dt className="text-subtle">Status</dt>
                  <dd className="mt-1 text-ink">{project.status}</dd>
                </div>
                <div>
                  <dt className="text-subtle">Built with</dt>
                  <dd className="mt-1 text-ink">{project.techStack.join(", ")}</dd>
                </div>
              </dl>
              {project.githubUrl && (
                <a
                  href={project.githubUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex min-h-11 w-fit items-center gap-2 rounded-full border border-line px-5 text-sm hover:border-gold"
                >
                  <GithubIcon size={16} /> View code
                </a>
              )}
            </aside>
          </div>

          {next && next.id !== project.id && (
            <button
              type="button"
              data-reveal
              onClick={() => onNavigate(next)}
              className="group mt-20 grid w-full items-center gap-6 border-t border-line pt-8 text-left sm:grid-cols-[1fr_18rem]"
            >
              <span>
                <span className="block text-sm text-subtle">Next project</span>
                <span className="mt-2 block font-serif text-5xl leading-none text-ink transition-colors group-hover:text-gold sm:text-6xl">
                  {next.title} <span aria-hidden="true">→</span>
                </span>
                <span className="mt-3 block text-muted">{next.subtitle}</span>
              </span>
              <ProjectImage project={next} className="transition-colors group-hover:border-gold" />
            </button>
          )}
        </article>
      )}
    </dialog>
  );
}
