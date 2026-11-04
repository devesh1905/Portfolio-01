"use client";

import { useEffect, useState } from "react";

const format = () =>
  new Intl.DateTimeFormat("en-IN", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit", hour12: false }).format(
    new Date()
  );

// Current time in Chennai, so visitors can see the timezone at a glance. Filled in after
// mount (the server can't know when the page is viewed).
export default function LocalTime() {
  const [time, setTime] = useState<string | null>(null);

  useEffect(() => {
    const tick = () => setTime(format());
    tick();
    const id = setInterval(tick, 20_000);
    return () => clearInterval(id);
  }, []);

  return (
    <p className="font-mono text-[13px]">
      Chennai <span className="tabular-nums text-ink">{time ?? "--:--"}</span> IST
    </p>
  );
}
