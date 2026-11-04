"use client";

import { useState } from "react";
import { personal } from "@/lib/portfolio";
import { GithubIcon, LinkedinIcon } from "@/components/icons";

const field =
  "w-full rounded-xl border border-line bg-panel px-4 py-3 text-ink placeholder:text-subtle focus-visible:border-gold";

export default function Contact() {
  const [form, setForm] = useState({ name: "", email: "", message: "" });
  const [sent, setSent] = useState(false);
  const [copied, setCopied] = useState(false);

  // No backend: hand the message to the visitor's email app, already filled in.
  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const subject = `Portfolio enquiry from ${form.name}`;
    const body = `${form.message}\n\n${form.name}\n${form.email}`;
    window.location.href = `mailto:${personal.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    setSent(true);
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(personal.email);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.location.href = `mailto:${personal.email}`;
    }
  };

  return (
    <section id="contact" aria-labelledby="contact-title" className="border-t border-line">
      <div className="mx-auto grid max-w-6xl scroll-mt-14 gap-12 px-4 py-16 sm:px-8 sm:py-24 lg:grid-cols-2">
        <div>
          <h2 id="contact-title" className="font-serif text-4xl text-ink sm:text-5xl">
            Contact
          </h2>
          <p className="mt-4 max-w-md text-muted">
            For internships, freelance work or a hackathon team, email me.
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <a href={`mailto:${personal.email}`} className="min-h-11 content-center text-lg text-ink underline decoration-gold underline-offset-4">
              {personal.email}
            </a>
            <button
              type="button"
              onClick={copy}
              className="min-h-11 rounded-full border border-line px-4 text-sm text-muted hover:text-ink"
            >
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
          <div className="mt-6 flex gap-3">
            <a
              href={personal.github}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-11 items-center gap-2 rounded-full border border-line px-4 text-sm text-ink hover:border-gold"
            >
              <GithubIcon size={16} /> GitHub
            </a>
            <a
              href={personal.linkedin}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-11 items-center gap-2 rounded-full border border-line px-4 text-sm text-ink hover:border-gold"
            >
              <LinkedinIcon size={16} /> LinkedIn
            </a>
          </div>
        </div>

        <form onSubmit={submit} className="flex flex-col gap-4">
          <label className="flex flex-col gap-1.5 text-sm text-muted">
            Name
            <input
              required
              className={field}
              autoComplete="name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
          </label>
          <label className="flex flex-col gap-1.5 text-sm text-muted">
            Email
            <input
              required
              type="email"
              className={field}
              autoComplete="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
          </label>
          <label className="flex flex-col gap-1.5 text-sm text-muted">
            Message
            <textarea
              required
              rows={5}
              className={field}
              value={form.message}
              onChange={(e) => setForm({ ...form, message: e.target.value })}
            />
          </label>
          <div className="flex flex-wrap items-center gap-4">
            <button type="submit" className="min-h-12 rounded-full bg-gold px-6 font-medium text-gold-ink hover:opacity-90">
              Send via email
            </button>
            <p className="text-sm text-subtle" aria-live="polite">
              {sent ? "Your email app should now be open with the message filled in." : "Opens your email app."}
            </p>
          </div>
        </form>
      </div>
    </section>
  );
}
