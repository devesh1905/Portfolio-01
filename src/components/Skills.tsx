import { skillGroups } from "@/lib/portfolio";

export default function Skills() {
  return (
    <section id="skills" aria-labelledby="skills-title" className="mx-auto max-w-6xl scroll-mt-14 px-4 py-16 sm:px-8 sm:py-24">
      <h2 id="skills-title" className="font-serif text-4xl text-ink sm:text-5xl">
        Skills
      </h2>
      <dl className="mt-10 border-t border-line">
        {skillGroups.map((g) => (
          <div key={g.name} className="grid gap-2 border-b border-line py-5 sm:grid-cols-[12rem_1fr] sm:gap-8">
            <dt className="text-sm font-medium text-subtle sm:pt-1">{g.name}</dt>
            <dd className="text-lg text-ink">{g.items.join(", ")}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
