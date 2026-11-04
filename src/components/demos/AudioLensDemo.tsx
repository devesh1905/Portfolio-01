"use client";

import { useState } from "react";

const TESTS = [
  { name: "Audiogram", result: "Symmetrical sensorineural dip at 4 kHz. Model confidence 94%." },
  { name: "Tympanometry", result: "Type A, 0.75 ml ear canal volume. Normal middle-ear pressure." },
  { name: "Otoscopy", result: "Intact tympanic membrane with a healthy light reflex." },
  { name: "Weber", result: "Tone lateralises to the right ear, consistent with a right conductive component." },
];

// Sample findings in the shape AudioLens produces per test; the real app gates the model
// output behind a rule engine before it reaches the report.
export default function AudioLensDemo() {
  const [selected, setSelected] = useState(TESTS[0].name);
  const test = TESTS.find((t) => t.name === selected) ?? TESTS[0];

  return (
    <div className="rounded-2xl border border-line bg-bg p-5">
      <p className="mb-3 text-sm text-subtle">Sample findings, one per test. Pick a test.</p>
      <div role="tablist" aria-label="Diagnostic test" className="grid grid-cols-2 gap-1 rounded-xl border border-line p-1 sm:grid-cols-4">
        {TESTS.map((t) => (
          <button
            key={t.name}
            type="button"
            role="tab"
            aria-selected={selected === t.name}
            onClick={() => setSelected(t.name)}
            className={`min-h-11 rounded-lg px-2 text-sm ${
              selected === t.name ? "bg-gold text-gold-ink" : "text-muted hover:text-ink"
            }`}
          >
            {t.name}
          </button>
        ))}
      </div>
      <div role="tabpanel" className="mt-4 rounded-xl border border-line bg-panel p-4">
        <p className="text-sm text-subtle">{test.name}, checked by the rule engine</p>
        <p className="mt-1 text-ink">{test.result}</p>
      </div>
    </div>
  );
}
