import Nav from "@/components/Nav";
import LiquidPipe from "@/components/LiquidPipe";
import Header from "@/components/Header";
import WorksSection from "@/components/Works/WorksSection";
import Skills from "@/components/Skills";
import Contact from "@/components/Contact";
import Footer from "@/components/Footer";

export default function PortfolioPage() {
  return (
    <>
      <a
        href="#work"
        className="sr-only-focusable fixed left-4 top-1.5 z-50 inline-flex min-h-11 items-center rounded-full bg-gold px-5 text-gold-ink"
      >
        Skip to work
      </a>
      <Nav />
      <LiquidPipe />
      <main>
        <Header />
        <WorksSection />
        <Skills />
        <Contact />
      </main>
      <Footer />
    </>
  );
}
