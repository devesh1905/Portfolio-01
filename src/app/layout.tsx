import type { Metadata } from "next";
import { Playfair_Display, Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";

const playfair = Playfair_Display({
  variable: "--font-serif",
  subsets: ["latin"],
  display: "swap",
});

const jakarta = Plus_Jakarta_Sans({
  variable: "--font-sans",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Deveshwar S | Full-Stack & AI Developer",
  description: "Portfolio of Deveshwar S, full-stack and AI developer. National-level hackathon winner (Future Forge Buildathon 2026) with projects including Black Onyx, FloodLine, AudioLens and Project EtherWave.",
  keywords: ["Deveshwar S", "Developer Portfolio", "Project EtherWave", "Starbell", "Fotocode", "Python WASAPI", "Next.js Portfolio", "Flutter Developer", "Chennai Developer"],
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
      className={`${playfair.variable} ${jakarta.variable} h-full scroll-smooth antialiased`}
    >
      <body className="min-h-full flex flex-col bg-[#0a0a0c] text-zinc-100">
        {children}
      </body>
    </html>
  );
}
