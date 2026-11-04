import { personal } from "@/lib/portfolio";

export default function Footer() {
  return (
    <footer className="border-t border-line">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-2 px-4 py-6 text-sm text-subtle sm:px-8">
        <p>© 2026 {personal.name}</p>
        <a href="#top" className="flex min-h-11 items-center hover:text-ink">
          Back to top
        </a>
      </div>
    </footer>
  );
}
