import type { Metadata } from "next";
import { Geist, Geist_Mono, Instrument_Serif } from "next/font/google";
import "./globals.css";

const serif = Instrument_Serif({
  variable: "--font-serif",
  weight: "400",
  style: ["normal", "italic"],
  subsets: ["latin"],
  display: "swap",
});

const sans = Geist({
  variable: "--font-sans",
  subsets: ["latin"],
  display: "swap",
});

// Only for real data: stats, dates, live read-outs.
const mono = Geist_Mono({
  variable: "--font-mono",
  subsets: ["latin"],
  display: "swap",
});

const siteUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL
  ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
  : "http://localhost:3000";

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  title: "Deveshwar S | Full-Stack & AI Developer",
  description: "Portfolio of Deveshwar S, a full-stack and AI developer in Chennai. Ten projects including Black Onyx, FloodLine, AudioLens and Project EtherWave.",
  keywords: ["Deveshwar S", "Full-Stack Developer", "AI Developer", "Black Onyx", "FloodLine", "Next.js", "FastAPI", "Chennai Developer"],
  openGraph: {
    title: "Deveshwar S | Full-Stack & AI Developer",
    description: "I build full-stack products and AI tools, and test them until they hold up.",
    images: [{ url: "/og.png", width: 1200, height: 630 }],
    type: "website",
  },
  twitter: { card: "summary_large_image", images: ["/og.png"] },
  authors: [{ name: "Deveshwar S" }],
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${serif.variable} ${sans.variable} ${mono.variable} h-full scroll-smooth antialiased`}
    >
      <body className="min-h-full bg-bg text-ink">
        {children}
      </body>
    </html>
  );
}
