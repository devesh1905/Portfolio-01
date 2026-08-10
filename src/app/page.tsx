"use client";

import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence, useMotionValue, useSpring } from "framer-motion";
import {
  Mail,
  ExternalLink,
  Award,
  Sparkles,
  Code,
  Cpu,
  Sliders,
  Send,
  MapPin,
  CheckCircle,
  FileText,
  Volume2,
  Activity,
  Layers,
  Settings,
  HelpCircle,
  ArrowRight,
  Briefcase,
  Layers2,
  BookOpen,
  Trophy,
  Stethoscope,
  Zap,
} from "lucide-react";
import portfolioData from "@/data/portfolioConfig.json";

// Custom SVG components for social links (compile safety)
const GithubIcon = ({ size = 16, className = "" }: { size?: number; className?: string }) => (
  <svg
    viewBox="0 0 24 24"
    width={size}
    height={size}
    stroke="currentColor"
    strokeWidth="2"
    fill="none"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4" />
    <path d="M9 18c-4.51 2-5-2-7-2" />
  </svg>
);

const LinkedinIcon = ({ size = 16, className = "" }: { size?: number; className?: string }) => (
  <svg
    viewBox="0 0 24 24"
    width={size}
    height={size}
    stroke="currentColor"
    strokeWidth="2"
    fill="none"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <path d="M16 8a6 6 0 0 1 6 6v7h-4v-7a2 2 0 0 0-2-2 2 2 0 0 0-2 2v7h-4v-7a6 6 0 0 1 6-6z" />
    <rect x="2" y="9" width="4" height="12" />
    <circle cx="4" cy="4" r="2" />
  </svg>
);

export default function PortfolioPage() {
  // Project lookups
  const etherwaveProject = portfolioData.projects.find((p) => p.id === "etherwave") || portfolioData.projects[0];
  const audiolensProject = portfolioData.projects.find((p) => p.id === "audiolens") || portfolioData.projects[1];
  const starbellProject = portfolioData.projects.find((p) => p.id === "starbell") || portfolioData.projects[2];
  const fotocodeProject = portfolioData.projects.find((p) => p.id === "fotocode") || portfolioData.projects[3];

  // Navigation active tab
  const [activeTab, setActiveTab] = useState<string>("about");

  // Core skills active category
  const [activeSkillCategory, setActiveSkillCategory] = useState<string>("all");

  // Interactive "Project EtherWave" State
  const [bufferSize, setBufferSize] = useState<number>(1536);
  const [latency, setLatency] = useState<number>(32.4);
  const [streamActive, setStreamActive] = useState<boolean>(true);
  const [dualPlayback, setDualPlayback] = useState<boolean>(true);
  const [knobRotation, setKnobRotation] = useState<number>(120);

  // Interactive AudioLens Workup State
  const [selectedAudioLensTest, setSelectedAudioLensTest] = useState<string>("Audiogram");

  const audiolensTests = [
    {
      name: "Audiogram",
      aiResult: "Symmetrical sensorineural dip at 4kHz. AI confidence: 94%.",
      status: "AI Clinical Assist Active",
    },
    {
      name: "Tympanometry",
      aiResult: "Type A compliance, 0.75ml ear canal volume. Normal middle ear pressure.",
      status: "AI Clinical Assist Active",
    },
    {
      name: "Otoscopy",
      aiResult: "Intact tympanic membrane with healthy light reflex observed.",
      status: "AI Clinical Assist Active",
    },
    {
      name: "Weber Test",
      aiResult: "Tone lateralizes to right ear; consistent with right conductive component.",
      status: "AI Clinical Assist Active",
    },
  ];

  // Contact Form State
  const [contactForm, setContactForm] = useState({
    name: "",
    email: "",
    subject: "",
    message: "",
  });
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [isSubmitted, setIsSubmitted] = useState<boolean>(false);

  // Custom Cursor Spring Values
  const cursorX = useMotionValue(-100);
  const cursorY = useMotionValue(-100);
  const cursorSpringX = useSpring(cursorX, { stiffness: 350, damping: 25 });
  const cursorSpringY = useSpring(cursorY, { stiffness: 350, damping: 25 });
  const [cursorHovered, setCursorHovered] = useState<boolean>(false);

  // Refs
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mainContainerRef = useRef<HTMLDivElement>(null);

  // Custom Cursor Event Listeners
  useEffect(() => {
    // Enable custom cursor styles in CSS on mount
    document.body.classList.add("custom-cursor-active");

    const moveCursor = (e: MouseEvent) => {
      cursorX.set(e.clientX);
      cursorY.set(e.clientY);
    };

    window.addEventListener("mousemove", moveCursor);

    // Scan interactive hover targets
    const handleMouseOver = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const isInteractive =
        target.tagName === "A" ||
        target.tagName === "BUTTON" ||
        target.tagName === "INPUT" ||
        target.tagName === "TEXTAREA" ||
        target.closest("a") ||
        target.closest("button") ||
        target.closest('[role="button"]') ||
        target.classList.contains("clickable-target");

      setCursorHovered(!!isInteractive);
    };

    window.addEventListener("mouseover", handleMouseOver);

    return () => {
      document.body.classList.remove("custom-cursor-active");
      window.removeEventListener("mousemove", moveCursor);
      window.removeEventListener("mouseover", handleMouseOver);
    };
  }, [cursorX, cursorY]);

  // Scroll Spy to update navigation active tab
  useEffect(() => {
    const handleScroll = () => {
      const sections = ["about", "achievements", "works", "skills", "contact"];
      
      // If we are at the very bottom of the page, force "contact" tab
      if (window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - 50) {
        setActiveTab("contact");
        return;
      }

      for (const sectionId of sections) {
        const el = document.getElementById(sectionId);
        if (el) {
          const top = el.offsetTop;
          const height = el.offsetHeight;
          if (window.scrollY >= top - 200 && window.scrollY < top + height - 200) {
            setActiveTab(sectionId);
          }
        }
      }
    };

    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();

    return () => {
      window.removeEventListener("scroll", handleScroll);
    };
  }, []);

  // Recalculate latency based on buffer size
  useEffect(() => {
    const calculatedLatency = parseFloat(((bufferSize / 48000) * 1000).toFixed(1));
    setLatency(calculatedLatency);
  }, [bufferSize]);

  // Audio wave canvas loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationId: number;
    let phase = 0;

    const resizeCanvas = () => {
      canvas.width = canvas.parentElement?.clientWidth || 500;
      canvas.height = 90;
    };
    resizeCanvas();
    window.addEventListener("resize", resizeCanvas);

    const drawWave = () => {
      if (!ctx || !canvas) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      if (!streamActive) {
        ctx.strokeStyle = "rgba(255,255,255,0.06)";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, canvas.height / 2);
        for (let x = 0; x < canvas.width; x++) {
          ctx.lineTo(x, canvas.height / 2 + (Math.random() - 0.5) * 0.8);
        }
        ctx.stroke();
        animationId = requestAnimationFrame(drawWave);
        return;
      }

      ctx.lineWidth = 1.5;
      const color = dualPlayback ? "#ff5c00" : "#e2c08d"; // Orange vs Champagne Gold
      
      // Draw interleaved stereo streams
      for (let channel = 0; channel < 2; channel++) {
        ctx.beginPath();
        ctx.strokeStyle = channel === 0 ? color : `${color}55`;
        ctx.lineWidth = channel === 0 ? 1.5 : 1;

        const volumeScale = knobRotation / 200;
        
        for (let x = 0; x < canvas.width; x++) {
          const ratio = x / canvas.width;
          const envelope = Math.sin(ratio * Math.PI); // fade edges
          const wave1 = Math.sin(ratio * Math.PI * 8 + phase * (channel === 0 ? 1.2 : 0.9));
          const wave2 = Math.cos(ratio * Math.PI * 18 - phase * 0.8);
          
          const y =
            canvas.height / 2 +
            (wave1 * 0.65 + wave2 * 0.35) *
              22 *
              envelope *
              volumeScale;

          if (x === 0) {
            ctx.moveTo(x, y);
          } else {
            ctx.lineTo(x, y);
          }
        }
        ctx.stroke();
      }

      // Draw minimal VU bar indicators
      const barH_L = (knobRotation / 280) * (canvas.height - 30) * (0.8 + Math.sin(phase * 3.1) * 0.2);
      const barH_R = (knobRotation / 280) * (canvas.height - 30) * (0.75 + Math.cos(phase * 2.8) * 0.2);

      ctx.fillStyle = "rgba(255,255,255,0.05)";
      ctx.fillRect(8, 15, 3, canvas.height - 30);
      ctx.fillRect(canvas.width - 11, 15, 3, canvas.height - 30);

      ctx.fillStyle = color;
      ctx.fillRect(8, canvas.height - 15 - barH_L, 3, barH_L);
      ctx.fillRect(canvas.width - 11, canvas.height - 15 - barH_R, 3, barH_R);

      phase += 0.06;
      animationId = requestAnimationFrame(drawWave);
    };

    drawWave();

    return () => {
      window.removeEventListener("resize", resizeCanvas);
      cancelAnimationFrame(animationId);
    };
  }, [streamActive, dualPlayback, knobRotation, bufferSize]);

  // Skill definitions compiler
  const skillCategories = [
    { id: "all", name: "All Core Skills" },
    { id: "languages", name: "Languages" },
    { id: "frameworks", name: "Web Technologies" },
    { id: "tools", name: "Tools & Protocols" },
    { id: "databases", name: "Databases" },
  ];

  const allSkills = [
    ...portfolioData.skills.languages,
    ...portfolioData.skills.frameworks,
    ...portfolioData.skills.tools,
    ...portfolioData.skills.databases,
  ];

  const filteredSkills =
    activeSkillCategory === "all"
      ? allSkills
      : allSkills.filter((s) => s.category === activeSkillCategory);

  const handleKnobTurn = () => {
    setKnobRotation((prev) => {
      const next = prev + 60;
      return next > 280 ? 40 : next;
    });
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!contactForm.name || !contactForm.email || !contactForm.message) return;

    setIsSubmitting(true);
    setTimeout(() => {
      setIsSubmitting(false);
      setIsSubmitted(true);
      setContactForm({ name: "", email: "", subject: "", message: "" });
    }, 1500);
  };

  return (
    <div
      ref={mainContainerRef}
      className="min-h-screen bg-[#0a0a0c] text-zinc-100 font-sans relative overflow-x-hidden"
    >
      {/* 1. Luminous Ambient Mesh Gradient Background */}
      <div className="fixed inset-0 pointer-events-none z-0 overflow-hidden">
        <div className="absolute top-[10%] left-[20%] w-[55vw] h-[55vw] rounded-full mesh-orb-1 opacity-60"></div>
        <div className="absolute bottom-[10%] right-[10%] w-[50vw] h-[50vw] rounded-full mesh-orb-2 opacity-50"></div>
        <div className="absolute top-[40%] right-[30%] w-[40vw] h-[40vw] rounded-full mesh-orb-3 opacity-40"></div>
        {/* Subtle grid pattern overlay */}
        <div className="absolute inset-0 opacity-[0.03] bg-[radial-gradient(circle_at_1px_1px,white_1px,transparent_1px)] bg-[size:32px_32px]"></div>
      </div>

      {/* 2. Custom Magnetic Cursor (Desktop) */}
      <motion.div
        className="hidden lg:block fixed w-8 h-8 rounded-full border border-white/40 pointer-events-none z-50 mix-blend-difference"
        style={{
          x: cursorSpringX,
          y: cursorSpringY,
          translateX: "-50%",
          translateY: "-50%",
        }}
        animate={{
          scale: cursorHovered ? 1.8 : 1,
          backgroundColor: cursorHovered ? "rgba(255, 255, 255, 0.1)" : "rgba(255, 255, 255, 0)",
          borderColor: cursorHovered ? "rgba(255, 255, 255, 0.8)" : "rgba(255, 255, 255, 0.4)",
        }}
        transition={{ type: "tween", ease: "backOut", duration: 0.15 }}
      />

      {/* 3. Sleek Translucent Glassmorphism Pill Nav (Centered Floating) */}
      <div className="fixed bottom-8 inset-x-0 flex justify-center z-50 px-4">
        <motion.nav
          initial={{ y: 50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.4, type: "spring", stiffness: 120 }}
          className="glass-nav rounded-full px-5 py-3.5 flex items-center gap-3 sm:gap-6 border border-white/10 max-w-xl w-full justify-between overflow-x-auto scrollbar-none"
        >
          <a
            href="#about"
            onClick={() => setActiveTab("about")}
            className={`font-mono text-[10px] uppercase tracking-widest transition-colors flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === "about" ? "text-brand-gold font-bold" : "text-zinc-400 hover:text-white"
            }`}
          >
            <span>01/</span> About
          </a>
          <a
            href="#achievements"
            onClick={() => setActiveTab("achievements")}
            className={`font-mono text-[10px] uppercase tracking-widest transition-colors flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === "achievements" ? "text-brand-gold font-bold" : "text-zinc-400 hover:text-white"
            }`}
          >
            <span>02/</span> Wins
          </a>
          <a
            href="#works"
            onClick={() => setActiveTab("works")}
            className={`font-mono text-[10px] uppercase tracking-widest transition-colors flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === "works" ? "text-brand-gold font-bold" : "text-zinc-400 hover:text-white"
            }`}
          >
            <span>03/</span> Works
          </a>
          <a
            href="#skills"
            onClick={() => setActiveTab("skills")}
            className={`font-mono text-[10px] uppercase tracking-widest transition-colors flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === "skills" ? "text-brand-gold font-bold" : "text-zinc-400 hover:text-white"
            }`}
          >
            <span>04/</span> Skills
          </a>
          <a
            href="#contact"
            onClick={() => setActiveTab("contact")}
            className={`font-mono text-[10px] uppercase tracking-widest transition-colors flex items-center gap-1.5 whitespace-nowrap ${
              activeTab === "contact" ? "text-brand-gold font-bold" : "text-zinc-400 hover:text-white"
            }`}
          >
            <span>05/</span> Connect
          </a>
        </motion.nav>
      </div>

      {/* Outer Layout Wrapper */}
      <div className="w-full max-w-6xl mx-auto px-6 sm:px-10 py-12 relative z-10 flex flex-col gap-32">
        
        {/* Navigation Logo Top bar */}
        <header className="flex items-center justify-between border-b border-white/5 pb-6">
          <div className="flex items-center gap-2">
            <span className="font-serif italic text-lg tracking-tight font-bold">DS.</span>
            <span className="w-1.5 h-1.5 rounded-full bg-brand-terracotta"></span>
          </div>
          <div className="flex items-center gap-6 font-mono text-[10px] uppercase tracking-widest text-zinc-500">
            <span>Chennai, India</span>
            <span>/</span>
            <span>Available for contract</span>
          </div>
        </header>

        {/* Section 1: Hero Section (Oversized Kinetic Typography & Clay/Glass shapes) */}
        <section id="about" className="min-h-[70vh] flex flex-col justify-center relative scroll-mt-24">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-start">
            
            {/* Left Column: Asymmetrical Typography */}
            <div className="lg:col-span-8 flex flex-col gap-6 select-none relative z-10">
              <motion.div
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
                className="flex flex-col"
              >
                <span className="font-mono text-[11px] uppercase tracking-widest text-brand-terracotta mb-2 font-medium">
                  01 / {portfolioData.personalInfo.title.toUpperCase()}
                </span>
                <h1 className="font-serif text-5xl sm:text-8xl tracking-tight leading-[0.9] text-white">
                  Deveshwar S
                </h1>
              </motion.div>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15, duration: 0.8 }}
                className="font-serif italic text-xl sm:text-3xl text-zinc-400 max-w-xl pl-2 border-l-2 border-brand-gold/20"
              >
                {portfolioData.personalInfo.tagline}
              </motion.div>

              <motion.p
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.25, duration: 0.8 }}
                className="text-zinc-400 text-sm leading-relaxed max-w-lg mt-2"
              >
                {portfolioData.personalInfo.bio || (
                  <>
                    I craft digital products characterized by high architectural performance, tactile user interfaces, and playful visual layouts. Blending robust low-latency logic with creative front-ends.
                  </>
                )}
              </motion.p>

              <motion.div
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.35, duration: 0.8 }}
                className="flex items-center gap-6 mt-4 flex-wrap"
              >
                <a
                  href="#contact"
                  className="clay-button px-6 py-3 font-mono text-[10px] uppercase tracking-widest text-white font-semibold flex items-center gap-2"
                >
                  Initiate Link <ArrowRight size={12} />
                </a>

                {portfolioData.personalInfo.resumeUrl ? (
                  <div className="flex items-center gap-3">
                    <a
                      href={portfolioData.personalInfo.resumeUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="font-mono text-[10px] uppercase tracking-widest text-zinc-400 hover:text-white transition-colors flex items-center gap-1.5 py-2 border-b border-white/10 hover:border-white"
                    >
                      <FileText size={12} /> Retrieve CV
                    </a>
                    <a
                      href="/Deveshwar_S_Resume.docx"
                      download="Deveshwar_S_Resume.docx"
                      className="font-mono text-[9px] uppercase tracking-widest text-zinc-500 hover:text-zinc-300 transition-colors py-2"
                      title="Download DOCX format"
                    >
                      [.DOCX]
                    </a>
                  </div>
                ) : (
                  <span className="font-mono text-[10px] uppercase tracking-widest text-zinc-600 cursor-not-allowed flex items-center gap-1.5">
                    <FileText size={12} /> CV (Locked)
                  </span>
                )}
              </motion.div>
            </div>

            {/* Right Column: Floating 3D claymorphic/glassmorphic kinetic vector layout */}
            <div className="lg:col-span-4 relative h-[300px] w-full flex items-center justify-center select-none">
              {/* Shifting 3D glass ring */}
              <motion.div
                animate={{
                  y: [0, -15, 0],
                  rotate: [0, 360],
                }}
                transition={{
                  y: { repeat: Infinity, duration: 6, ease: "easeInOut" },
                  rotate: { repeat: Infinity, duration: 25, ease: "linear" },
                }}
                className="absolute w-44 h-44 rounded-full border-[10px] border-white/5 backdrop-blur-[6px] shadow-2xl flex items-center justify-center"
                style={{
                  boxShadow: "inset 0 4px 20px rgba(255,255,255,0.05), 0 20px 40px rgba(0,0,0,0.5)",
                }}
              >
                {/* Floating inner sphere */}
                <motion.div
                  animate={{
                    scale: [1, 1.15, 1],
                  }}
                  transition={{
                    repeat: Infinity,
                    duration: 4,
                    ease: "easeInOut",
                  }}
                  className="w-16 h-16 rounded-full bg-gradient-to-tr from-brand-terracotta to-brand-gold opacity-30 blur-[2px]"
                />
              </motion.div>

              {/* Shifting claymorphic pill shape */}
              <motion.div
                animate={{
                  x: [0, 20, 0],
                  y: [0, 25, 0],
                  rotate: [45, 60, 45],
                }}
                transition={{
                  repeat: Infinity,
                  duration: 8,
                  ease: "easeInOut",
                }}
                className="absolute top-10 left-12 w-10 h-28 rounded-full bg-gradient-to-b from-white/10 to-transparent border border-white/10 shadow-lg backdrop-blur-[2px]"
                style={{
                  boxShadow: "inset 0 4px 10px rgba(255,255,255,0.1), 0 10px 20px rgba(0,0,0,0.3)",
                }}
              />

              {/* Champagne gold clay float block */}
              <motion.div
                animate={{
                  x: [0, -25, 0],
                  y: [0, -15, 0],
                }}
                transition={{
                  repeat: Infinity,
                  duration: 7,
                  ease: "easeInOut",
                }}
                className="absolute bottom-6 right-8 w-16 h-16 rounded-3xl bg-brand-gold/10 border border-brand-gold/15 backdrop-blur-[4px]"
                style={{
                  boxShadow: "inset 0 2px 8px rgba(226, 192, 141, 0.2), 0 15px 30px rgba(0,0,0,0.4)",
                }}
              />
            </div>
          </div>
        </section>

        {/* Section 2: Achievements & Hackathon Wins */}
        <section id="achievements" className="scroll-mt-24 flex flex-col gap-10">
          <div className="flex flex-col gap-2">
            <span className="font-mono text-[10px] text-brand-gold uppercase tracking-widest font-semibold flex items-center gap-1.5">
              <Trophy size={12} className="text-brand-gold" /> 02 / Competition Victories
            </span>
            <h2 className="font-serif text-3xl sm:text-5xl text-white tracking-tight">
              Hackathon Victories & Recognition
            </h2>
            <p className="text-zinc-400 text-sm max-w-xl leading-relaxed">
              Proven track record of engineering award-winning platforms under fast-paced competition timelines.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* SmartAbility Hackathon */}
            <div className="glass-card rounded-3xl p-6 sm:p-7 flex flex-col justify-between gap-6 border border-brand-gold/25 relative overflow-hidden group hover:border-brand-gold/40 transition-all">
              <div className="absolute -top-12 -right-12 w-36 h-36 bg-brand-gold/10 blur-2xl rounded-full"></div>
              <div className="flex flex-col gap-4 relative z-10">
                <div className="flex items-center justify-between">
                  <span className="px-3 py-1 rounded-full text-[9px] font-mono uppercase tracking-widest bg-brand-gold/15 text-brand-gold border border-brand-gold/25 font-bold flex items-center gap-1">
                    <Trophy size={10} /> 1st Place Winner
                  </span>
                  <span className="font-mono text-[9px] text-zinc-500 uppercase">College</span>
                </div>
                <div className="flex flex-col gap-1">
                  <h3 className="font-serif text-xl text-white font-bold tracking-tight">
                    SmartAbility Hackathon
                  </h3>
                  <span className="font-mono text-xs text-brand-gold/90 font-medium">Project: AudioLens</span>
                </div>
                <p className="text-zinc-400 text-xs leading-relaxed">
                  Won 1st place for building AudioLens—a clinical workup application for audiologists featuring full AI diagnostic support per test and automated overall clinical report generation.
                </p>
              </div>
              <div className="pt-4 border-t border-white/5 flex items-center justify-between font-mono text-[9px] text-zinc-400 relative z-10">
                <span className="flex items-center gap-1 text-zinc-300">
                  <Stethoscope size={11} className="text-brand-gold" /> AI Audiology Workup
                </span>
                <span className="text-brand-gold font-bold">2026</span>
              </div>
            </div>

            {/* BUILDFEST 26 */}
            <div className="glass-card rounded-3xl p-6 sm:p-7 flex flex-col justify-between gap-6 border border-white/10 relative overflow-hidden group hover:border-white/25 transition-all">
              <div className="absolute -top-12 -right-12 w-36 h-36 bg-sky-500/10 blur-2xl rounded-full"></div>
              <div className="flex flex-col gap-4 relative z-10">
                <div className="flex items-center justify-between">
                  <span className="px-3 py-1 rounded-full text-[9px] font-mono uppercase tracking-widest bg-sky-500/15 text-sky-400 border border-sky-500/25 font-bold flex items-center gap-1">
                    <Trophy size={10} /> Hackathon Winner
                  </span>
                  <span className="font-mono text-[9px] text-zinc-500 uppercase">BUILDFEST</span>
                </div>
                <div className="flex flex-col gap-1">
                  <h3 className="font-serif text-xl text-white font-bold tracking-tight">
                    BUILDFEST '26
                  </h3>
                  <span className="font-mono text-xs text-sky-400/90 font-medium">Hackathon Victory</span>
                </div>
                <p className="text-zinc-400 text-xs leading-relaxed">
                  Secured top honors at BUILDFEST '26 by executing rapid software prototyping, robust system integration, and responsive frontend design under tight constraints.
                </p>
              </div>
              <div className="pt-4 border-t border-white/5 flex items-center justify-between font-mono text-[9px] text-zinc-400 relative z-10">
                <span className="flex items-center gap-1 text-zinc-300">
                  <Zap size={11} className="text-sky-400" /> High-Impact Software
                </span>
                <span className="text-sky-400 font-bold">August 2026</span>
              </div>
            </div>

            {/* REC Capture & Code */}
            <div className="glass-card rounded-3xl p-6 sm:p-7 flex flex-col justify-between gap-6 border border-white/10 relative overflow-hidden group hover:border-white/25 transition-all">
              <div className="absolute -top-12 -right-12 w-36 h-36 bg-emerald-500/10 blur-2xl rounded-full"></div>
              <div className="flex flex-col gap-4 relative z-10">
                <div className="flex items-center justify-between">
                  <span className="px-3 py-1 rounded-full text-[9px] font-mono uppercase tracking-widest bg-emerald-500/15 text-emerald-400 border border-emerald-500/25 font-bold flex items-center gap-1">
                    <Trophy size={10} /> 1st Place Winner
                  </span>
                  <span className="font-mono text-[9px] text-zinc-500 uppercase">REC</span>
                </div>
                <div className="flex flex-col gap-1">
                  <h3 className="font-serif text-xl text-white font-bold tracking-tight">
                    REC Capture & Code
                  </h3>
                  <span className="font-mono text-xs text-emerald-400/90 font-medium">Project: Fotocode</span>
                </div>
                <p className="text-zinc-400 text-xs leading-relaxed">
                  Won 1st Place at the college web competition for creating Fotocode, a fast-loading landing page and interactive multi-device web showcase.
                </p>
              </div>
              <div className="pt-4 border-t border-white/5 flex items-center justify-between font-mono text-[9px] text-zinc-400 relative z-10">
                <span className="flex items-center gap-1 text-zinc-300">
                  <Code size={11} className="text-emerald-400" /> Web Competition
                </span>
                <span className="text-emerald-400 font-bold">March 2026</span>
              </div>
            </div>
          </div>
        </section>

        {/* Section 3: Selected Works (Bento Grid project cards) */}
        <section id="works" className="scroll-mt-24 flex flex-col gap-10">
          <div className="flex flex-col gap-2">
            <span className="font-mono text-[10px] text-brand-terracotta uppercase tracking-widest font-semibold">
              03 / Engineering Portfolios
            </span>
            <h2 className="font-serif text-3xl sm:text-5xl text-white tracking-tight">
              Selected Works
            </h2>
          </div>

          {/* Bento Grid Layout */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            
            {/* Bento Block 1: Project EtherWave (Spans 6 columns) */}
            <div className="lg:col-span-6 glass-card rounded-3xl p-6 sm:p-8 flex flex-col justify-between gap-8 relative overflow-hidden transition-all duration-300 hover:border-white/15">
              <div className="absolute top-0 right-0 w-[300px] h-[300px] bg-brand-orange/5 blur-[80px] rounded-full pointer-events-none"></div>

              {/* Project Header */}
              <div className="flex flex-col gap-4 relative z-10">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <span className="px-3 py-1 rounded-full text-[9px] font-mono uppercase tracking-widest bg-brand-orange/10 text-brand-orange border border-brand-orange/15 font-semibold">
                    {etherwaveProject.badge}
                  </span>
                  <span className="font-mono text-[9px] text-zinc-500 uppercase tracking-widest">
                    {etherwaveProject.status}
                  </span>
                </div>
                
                <div className="flex flex-col gap-1">
                  <h3 className="font-serif text-2xl sm:text-3xl text-white font-bold tracking-tight">
                    {etherwaveProject.title}
                  </h3>
                  <span className="font-mono text-xs text-zinc-400">{etherwaveProject.subtitle}</span>
                </div>

                <p className="text-zinc-400 text-sm leading-relaxed">
                  {etherwaveProject.description}
                </p>
              </div>

              {/* Tactile Audio Wave Console */}
              <div className="border border-white/5 bg-[#0e0e12]/80 backdrop-blur-md rounded-2xl p-5 flex flex-col gap-5 shadow-2xl relative z-10">
                {/* Visualizer screen */}
                <div className="bg-black/60 border border-white/5 rounded-xl py-3 px-1 relative overflow-hidden flex flex-col items-center justify-center">
                  <canvas ref={canvasRef} className="w-full h-[90px]" />
                  <div className="absolute top-2 left-4 font-mono text-[8px] text-zinc-600 tracking-wider">
                    PCM_LOOPBACK: {streamActive ? "BROADCASTING" : "SILENT"}
                  </div>
                  <div className="absolute bottom-2 right-4 font-mono text-[8px] text-zinc-600 tracking-widest uppercase">
                    48000Hz stereo
                  </div>
                </div>

                {/* Status Bar */}
                <div className="grid grid-cols-4 gap-2 border-y border-white/5 py-3 font-mono text-center text-xs">
                  <div className="flex flex-col border-r border-white/5">
                    <span className="text-[9px] text-zinc-500 uppercase">Lag time</span>
                    <span className="font-bold text-white tracking-tight mt-0.5">{latency} ms</span>
                  </div>
                  <div className="flex flex-col border-r border-white/5">
                    <span className="text-[9px] text-zinc-500 uppercase">Buffer</span>
                    <span className="font-bold text-white tracking-tight mt-0.5">{bufferSize} smpl</span>
                  </div>
                  <div className="flex flex-col border-r border-white/5">
                    <span className="text-[9px] text-zinc-500 uppercase">Format</span>
                    <span className="font-bold text-white tracking-tight mt-0.5">INT16 PCM</span>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-[9px] text-zinc-500 uppercase">Network</span>
                    <span className="font-bold text-white tracking-tight mt-0.5">1.5 Mbps</span>
                  </div>
                </div>

                {/* Knobs and Toggles */}
                <div className="flex items-center justify-between gap-4 flex-wrap">
                  <div className="flex items-center gap-6">
                    {/* Knurled Knob */}
                    <div className="flex flex-col items-center gap-1 select-none">
                      <div
                        onClick={handleKnobTurn}
                        className="w-10 h-10 rounded-full border border-white/10 bg-zinc-900 flex items-center justify-center cursor-pointer relative shadow-inner group hover:border-brand-orange/40 transition-colors"
                        title="Rotate Dial (Simulate Wave Volume)"
                      >
                        <div className="absolute inset-1 rounded-full border border-dashed border-zinc-700/50"></div>
                        <div
                          className="w-1.5 h-1.5 bg-brand-orange rounded-full absolute top-1 knob-indicator"
                          style={{
                            transform: `rotate(${knobRotation}deg)`,
                            transformOrigin: "center 15px",
                          }}
                        ></div>
                        <span className="text-[8px] font-mono text-zinc-500 group-hover:text-brand-orange">VOL</span>
                      </div>
                      <span className="font-mono text-[8px] text-zinc-600 uppercase">Gain</span>
                    </div>

                    {/* Buffer Pill Tabs */}
                    <div className="flex flex-col items-center gap-1">
                      <div className="flex items-center gap-1 bg-black/40 border border-white/5 p-1 rounded-full font-mono text-[9px]">
                        {[512, 1536, 4096].map((size) => (
                          <button
                            key={size}
                            onClick={() => setBufferSize(size)}
                            className={`px-2 py-0.5 rounded-full transition-all ${
                              bufferSize === size ? "bg-brand-orange text-white" : "text-zinc-500 hover:text-white"
                            }`}
                          >
                            {size}
                          </button>
                        ))}
                      </div>
                      <span className="font-mono text-[8px] text-zinc-600 uppercase">Buffer Size</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    {/* Status Toggles */}
                    <button
                      onClick={() => setStreamActive((prev) => !prev)}
                      className={`px-3 py-1.5 rounded-full font-mono text-[9px] uppercase tracking-wider font-semibold border flex items-center gap-1.5 transition-all ${
                        streamActive
                          ? "bg-brand-orange/15 border-brand-orange/20 text-brand-orange"
                          : "bg-white/5 border-white/5 text-zinc-500 hover:text-zinc-400"
                      }`}
                    >
                      <Activity size={10} />
                      {streamActive ? "On" : "Mute"}
                    </button>

                    <button
                      onClick={() => setDualPlayback((prev) => !prev)}
                      className={`px-3 py-1.5 rounded-full font-mono text-[9px] uppercase tracking-wider font-semibold border flex items-center gap-1.5 transition-all ${
                        dualPlayback
                          ? "bg-brand-gold/15 border-brand-gold/20 text-brand-gold"
                          : "bg-white/5 border-white/5 text-zinc-500 hover:text-zinc-400"
                      }`}
                    >
                      <Volume2 size={10} />
                      {dualPlayback ? "Dual" : "Single"}
                    </button>
                  </div>
                </div>
              </div>

              {/* Tech Pill & Github Links */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-4 border-t border-white/5 relative z-10">
                <div className="flex flex-wrap gap-1.5">
                  {etherwaveProject.techStack.map((tech) => (
                    <span
                      key={tech}
                      className="px-2.5 py-0.5 rounded-full font-mono text-[9px] bg-white/5 border border-white/5 text-zinc-400"
                    >
                      {tech}
                    </span>
                  ))}
                </div>

                <a
                  href={etherwaveProject.githubUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="clay-button px-4 py-2 font-mono text-[9px] uppercase tracking-widest text-white font-semibold flex items-center justify-center gap-1.5"
                >
                  <GithubIcon size={11} /> Source Code
                </a>
              </div>
            </div>

            {/* Bento Block 2: AudioLens (Spans 6 columns, features interactive clinical AI workup console) */}
            <div className="lg:col-span-6 glass-card rounded-3xl p-6 sm:p-8 flex flex-col justify-between gap-8 relative overflow-hidden transition-all duration-300 hover:border-white/15 border-brand-gold/20">
              <div className="absolute top-0 right-0 w-[250px] h-[250px] bg-brand-gold/5 blur-[70px] rounded-full pointer-events-none"></div>

              {/* Project Header */}
              <div className="flex flex-col gap-4 relative z-10">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <span className="px-3 py-1 rounded-full text-[9px] font-mono uppercase tracking-widest bg-brand-gold/15 text-brand-gold border border-brand-gold/25 font-semibold flex items-center gap-1">
                    <Trophy size={10} /> {audiolensProject.badge}
                  </span>
                  <span className="font-mono text-[9px] text-zinc-500 uppercase tracking-widest">
                    {audiolensProject.status}
                  </span>
                </div>
                
                <div className="flex flex-col gap-1">
                  <h3 className="font-serif text-2xl sm:text-3xl text-white font-bold tracking-tight">
                    {audiolensProject.title}
                  </h3>
                  <span className="font-mono text-xs text-zinc-400">{audiolensProject.subtitle}</span>
                </div>

                <p className="text-zinc-400 text-sm leading-relaxed">
                  {audiolensProject.description}
                </p>
              </div>

              {/* Interactive AudioLens Workup Console Simulator */}
              <div className="border border-white/5 bg-[#0e0e12]/80 backdrop-blur-md rounded-2xl p-5 flex flex-col gap-4 shadow-2xl relative z-10">
                <div className="flex items-center justify-between border-b border-white/5 pb-3">
                  <div className="flex items-center gap-2">
                    <Stethoscope size={14} className="text-brand-gold" />
                    <span className="font-mono text-[10px] text-zinc-300 font-semibold uppercase tracking-wider">
                      Audiology AI Clinical Support
                    </span>
                  </div>
                  <span className="px-2 py-0.5 rounded-full text-[8px] font-mono bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    SmartAbility Winner
                  </span>
                </div>

                {/* Diagnostic Test Selector Tabs */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5 bg-black/40 p-1 rounded-xl border border-white/5 font-mono text-[9px]">
                  {audiolensTests.map((t) => (
                    <button
                      key={t.name}
                      onClick={() => setSelectedAudioLensTest(t.name)}
                      className={`px-2 py-1.5 rounded-lg transition-all text-center ${
                        selectedAudioLensTest === t.name
                          ? "bg-brand-gold text-black font-bold"
                          : "text-zinc-400 hover:text-white"
                      }`}
                    >
                      {t.name}
                    </button>
                  ))}
                </div>

                {/* Test Output & AI Diagnosis Box */}
                <div className="bg-black/60 border border-white/5 rounded-xl p-4 flex flex-col gap-2 font-mono">
                  <div className="flex items-center justify-between text-[9px]">
                    <span className="text-brand-gold font-semibold flex items-center gap-1">
                      <Sparkles size={10} /> Test: {selectedAudioLensTest}
                    </span>
                    <span className="text-zinc-500 text-[8px] uppercase">Rule Engine + AI Gated</span>
                  </div>
                  <p className="text-xs text-zinc-300 leading-normal">
                    {audiolensTests.find((t) => t.name === selectedAudioLensTest)?.aiResult}
                  </p>
                </div>

                <div className="flex items-center justify-between pt-1 font-mono text-[9px]">
                  <span className="text-zinc-400 flex items-center gap-1">
                    <FileText size={10} className="text-brand-gold" /> Automated PDF Report Generation
                  </span>
                  <span className="text-emerald-400 font-medium">8 Diagnostic Modules</span>
                </div>
              </div>

              {/* Tech Stack & Link */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-4 border-t border-white/5 relative z-10">
                <div className="flex flex-wrap gap-1.5">
                  {audiolensProject.techStack.map((tech) => (
                    <span
                      key={tech}
                      className="px-2.5 py-0.5 rounded-full font-mono text-[9px] bg-white/5 border border-white/5 text-zinc-400"
                    >
                      {tech}
                    </span>
                  ))}
                </div>

                <a
                  href={audiolensProject.githubUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="clay-button px-4 py-2 font-mono text-[9px] uppercase tracking-widest text-white font-semibold flex items-center justify-center gap-1.5"
                >
                  <GithubIcon size={11} /> View Code
                </a>
              </div>
            </div>

            {/* Bento Block 3: Starbell Kids Playschool (Spans 6 columns) */}
            <div className="lg:col-span-6 glass-card rounded-3xl p-6 sm:p-8 flex flex-col justify-between gap-8 relative overflow-hidden transition-all duration-300 hover:border-white/15">
              <div className="absolute top-0 right-0 w-[200px] h-[200px] bg-sky-500/5 blur-[60px] rounded-full pointer-events-none"></div>

              <div className="flex flex-col gap-4 relative z-10">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <span className="px-3 py-1 rounded-full text-[9px] font-mono uppercase tracking-widest bg-sky-500/10 text-sky-400 border border-sky-500/15 font-semibold">
                    {starbellProject.badge}
                  </span>
                  <span className="font-mono text-[9px] text-zinc-500 uppercase tracking-widest">
                    {starbellProject.status}
                  </span>
                </div>

                <div className="flex flex-col gap-1">
                  <h3 className="font-serif text-2xl text-white font-bold tracking-tight">
                    {starbellProject.title}
                  </h3>
                  <span className="font-mono text-xs text-zinc-400">{starbellProject.subtitle}</span>
                </div>

                <p className="text-zinc-400 text-sm leading-relaxed">
                  {starbellProject.description}
                </p>

                {starbellProject.features && starbellProject.features.length > 0 && (
                  <div className="flex flex-col gap-2 mt-2">
                    <span className="font-mono text-[9px] text-zinc-500 uppercase tracking-wider">Features</span>
                    <ul className="text-xs text-zinc-400 flex flex-col gap-1.5 pl-3 list-disc">
                      {starbellProject.features.map((feat, i) => (
                        <li key={i}>{feat}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-4 border-t border-white/5 relative z-10">
                <div className="flex flex-wrap gap-1.5">
                  {starbellProject.techStack.map((tech) => (
                    <span
                      key={tech}
                      className="px-2.5 py-0.5 rounded-full font-mono text-[9px] bg-white/5 border border-white/5 text-zinc-400"
                    >
                      {tech}
                    </span>
                  ))}
                </div>

                <a
                  href={starbellProject.githubUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-2.5 border border-white/10 rounded-full font-mono text-[9px] uppercase tracking-widest text-zinc-300 hover:text-white hover:bg-white/5 transition-all text-center flex items-center justify-center gap-1.5"
                >
                  <GithubIcon size={11} /> Inspect Repo
                </a>
              </div>
            </div>

            {/* Bento Block 4: Fotocode (Spans 6 columns) */}
            <div className="lg:col-span-6 glass-card rounded-3xl p-6 sm:p-8 flex flex-col justify-between gap-6 relative overflow-hidden transition-all duration-300 hover:border-white/15">
              <div className="absolute top-0 right-0 w-[200px] h-[200px] bg-emerald-500/5 blur-[60px] rounded-full pointer-events-none"></div>

              <div className="flex flex-col gap-4 relative z-10">
                <div className="flex items-center justify-between">
                  <span className="px-3 py-1 rounded-full text-[9px] font-mono uppercase tracking-widest bg-emerald-500/10 text-emerald-400 border border-emerald-500/15 font-semibold">
                    {fotocodeProject.badge}
                  </span>
                  <span className="font-mono text-[9px] text-zinc-500 uppercase tracking-widest">
                    {fotocodeProject.status}
                  </span>
                </div>

                <div className="flex flex-col gap-1">
                  <h3 className="font-serif text-2xl text-white font-bold tracking-tight">
                    {fotocodeProject.title}
                  </h3>
                  <span className="font-mono text-xs text-zinc-400">{fotocodeProject.subtitle}</span>
                </div>

                <p className="text-zinc-400 text-sm leading-relaxed">
                  {fotocodeProject.description}
                </p>

                {fotocodeProject.features && fotocodeProject.features.length > 0 && (
                  <div className="flex flex-col gap-2 mt-2">
                    <span className="font-mono text-[9px] text-zinc-500 uppercase tracking-wider">Features</span>
                    <ul className="text-xs text-zinc-400 flex flex-col gap-1.5 pl-3 list-disc">
                      {fotocodeProject.features.map((feat, i) => (
                        <li key={i}>{feat}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pt-4 border-t border-white/5 relative z-10">
                <div className="flex flex-wrap gap-1.5">
                  {fotocodeProject.techStack.map((tech) => (
                    <span
                      key={tech}
                      className="px-2.5 py-0.5 rounded-full font-mono text-[9px] bg-white/5 border border-white/5 text-zinc-400"
                    >
                      {tech}
                    </span>
                  ))}
                </div>

                <a
                  href={fotocodeProject.githubUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-2.5 border border-white/10 rounded-full font-mono text-[9px] uppercase tracking-widest text-zinc-300 hover:text-white hover:bg-white/5 transition-all text-center flex items-center justify-center gap-1.5"
                >
                  <GithubIcon size={11} /> View Code
                </a>
              </div>
            </div>

            {/* Bento Block 5: Coming up block (Spans 12 columns) */}
            <div className="lg:col-span-12 glass-card rounded-3xl p-6 sm:p-8 flex flex-col justify-between gap-6 relative overflow-hidden transition-all duration-300 hover:border-white/15">
              <div className="flex flex-col gap-4">
                <span className="font-mono text-[9px] text-zinc-500 uppercase tracking-widest font-semibold">
                  Under Active Research
                </span>
                <h4 className="font-serif text-xl text-zinc-300 tracking-tight">
                  Coming up
                </h4>
                
                <div className="grid grid-cols-1 gap-4 mt-2">
                  {portfolioData.upcomingProjects.map((proj) => (
                    <div
                      key={proj.id}
                      className="border border-dashed border-white/10 rounded-2xl p-5 flex flex-col gap-2 hover:border-brand-gold/20 transition-colors"
                    >
                      <div className="flex items-center gap-1.5 text-brand-gold text-xs font-mono font-semibold">
                        <Sparkles size={12} className="text-brand-gold" />
                        <span>{proj.title}</span>
                      </div>
                      <p className="text-xs text-zinc-400 leading-relaxed">
                        {proj.description}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

          </div>
        </section>

        {/* Section 4: Magazine Split Bio / Timeline */}
        <section className="grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">
          
          {/* Magazine Bio Text Column (Asymmetrical block) */}
          <div className="lg:col-span-5 flex flex-col gap-6">
            <span className="font-mono text-[10px] text-brand-terracotta uppercase tracking-widest font-semibold">
              04 / Building with Purpose
            </span>
            
            <h3 className="font-serif text-3xl sm:text-5xl text-white tracking-tight leading-tight">
              Engineering & Hackathon Execution
            </h3>

            <p className="text-zinc-400 text-sm leading-relaxed">
              My development philosophy is straightforward: build clean, responsive, and functional software. Whether I'm designing an AI diagnostic workflow for medical professionals or low-latency streaming tools, I focus on scalable logic and tactile UI design.
            </p>

            <p className="text-zinc-400 text-sm leading-relaxed">
              From college competitions like the SmartAbility Hackathon and REC Capture & Code to BUILDFEST '26, I thrive under tight constraints and high-stakes problem solving.
            </p>
          </div>

          {/* Timeline Column (Vertical minimalist line with glowing node markers) */}
          <div className="lg:col-span-7 flex flex-col gap-8 lg:pl-10">
            <h4 className="font-mono text-[10px] text-zinc-500 uppercase tracking-widest">
              Selected Benchmarks
            </h4>

            <div className="relative pl-6 border-l border-white/10 flex flex-col gap-10">
              
              {/* Event 1 */}
              <div className="relative">
                <div className="absolute -left-[30px] top-1.5 w-3 h-3 rounded-full bg-brand-gold shadow-[0_0_8px_#e2c08d]"></div>
                <div className="flex flex-col gap-1">
                  <span className="font-mono text-[9px] text-brand-gold uppercase tracking-widest font-bold">
                    August 2026
                  </span>
                  <h5 className="text-sm font-semibold text-white">
                    Won 1st Place at SmartAbility Hackathon
                  </h5>
                  <p className="text-xs text-zinc-500 leading-normal mt-1">
                    Developed AudioLens, an AI-powered clinical workup application for audiologists featuring test-by-test AI support and comprehensive PDF report generation.
                  </p>
                </div>
              </div>

              {/* Event 2 */}
              <div className="relative">
                <div className="absolute -left-[30px] top-1.5 w-3 h-3 rounded-full bg-sky-500 shadow-[0_0_8px_#0ea5e9]"></div>
                <div className="flex flex-col gap-1">
                  <span className="font-mono text-[9px] text-brand-gold uppercase tracking-widest font-bold">
                    August 2026
                  </span>
                  <h5 className="text-sm font-semibold text-white">
                    Won BUILDFEST '26 Hackathon
                  </h5>
                  <p className="text-xs text-zinc-500 leading-normal mt-1">
                    Secured top honors at BUILDFEST '26 by building high-impact software solutions under intensive competition timelines.
                  </p>
                </div>
              </div>

              {/* Event 3 */}
              <div className="relative">
                <div className="absolute -left-[30px] top-1.5 w-3 h-3 rounded-full bg-[#ff5c00] shadow-[0_0_8px_#ff5c00]"></div>
                <div className="flex flex-col gap-1">
                  <span className="font-mono text-[9px] text-brand-gold uppercase tracking-widest font-bold">
                    June 2026
                  </span>
                  <h5 className="text-sm font-semibold text-white">
                    Built Project EtherWave
                  </h5>
                  <p className="text-xs text-zinc-500 leading-normal mt-1">
                    Designed and developed an open-source desktop application to capture loopback audio and stream it over local network.
                  </p>
                </div>
              </div>

              {/* Event 4 */}
              <div className="relative">
                <div className="absolute -left-[30px] top-1.5 w-3 h-3 rounded-full bg-[#4f46e5] shadow-[0_0_8px_#4f46e5]"></div>
                <div className="flex flex-col gap-1">
                  <span className="font-mono text-[9px] text-brand-gold uppercase tracking-widest font-bold">
                    April 2026
                  </span>
                  <h5 className="text-sm font-semibold text-white">
                    Delivered Starbell Client Website
                  </h5>
                  <p className="text-xs text-zinc-500 leading-normal mt-1">
                    Successfully completed and deployed a multi-page web platform tailored to the client's branding and layout requirements.
                  </p>
                </div>
              </div>

              {/* Event 5 */}
              <div className="relative">
                <div className="absolute -left-[30px] top-1.5 w-3 h-3 rounded-full bg-brand-terracotta shadow-[0_0_8px_#c2593f]"></div>
                <div className="flex flex-col gap-1">
                  <span className="font-mono text-[9px] text-brand-gold uppercase tracking-widest font-bold">
                    March 2026
                  </span>
                  <h5 className="text-sm font-semibold text-white">
                    Won 1st Place at "Captured & Code" Hackathon
                  </h5>
                  <p className="text-xs text-zinc-500 leading-normal mt-1">
                    Developed and pitched 'Fotocode', a responsive demo website, winning first place in our college’s web development competition.
                  </p>
                </div>
              </div>

            </div>
          </div>

        </section>

        {/* Section 5: Core Skill Matrix (Filterable Skills bento sub-element) */}
        <section id="skills" className="scroll-mt-24 flex flex-col gap-10">
          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
            <div className="flex flex-col gap-2">
              <span className="font-mono text-[10px] text-brand-terracotta uppercase tracking-widest font-semibold">
                05 / Technical Matrix
              </span>
              <h2 className="font-serif text-3xl sm:text-5xl text-white tracking-tight">
                Core Competencies
              </h2>
            </div>

            {/* Filter pills */}
            <div className="flex flex-wrap gap-1.5">
              {skillCategories.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => setActiveSkillCategory(cat.id)}
                  className={`px-4 py-2 rounded-full font-mono text-[9px] uppercase tracking-wider border transition-all ${
                    activeSkillCategory === cat.id
                      ? "bg-white text-black border-white font-bold"
                      : "bg-white/5 border-white/5 text-zinc-400 hover:text-white"
                  }`}
                >
                  {cat.name}
                </button>
              ))}
            </div>
          </div>

          <div className="glass-card rounded-3xl p-6 sm:p-8">
            <motion.div layout className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 gap-4">
              <AnimatePresence mode="popLayout">
                {filteredSkills.map((skill) => (
                  <motion.div
                    layout
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ duration: 0.2 }}
                    key={skill.name}
                    className="border border-white/5 bg-[#0e0e12]/30 rounded-2xl p-4 flex flex-col items-center justify-center text-center gap-3 hover:border-white/10 hover:bg-white/5 transition-all group"
                  >
                    <div className="p-3 rounded-xl bg-black/40 border border-white/5 text-zinc-400 group-hover:text-brand-gold group-hover:border-brand-gold/20 transition-all shadow-inner">
                      {skill.category === "languages" && <Code size={16} />}
                      {skill.category === "frameworks" && <Layers2 size={16} />}
                      {skill.category === "tools" && <Sliders size={16} />}
                      {skill.category === "databases" && <Cpu size={16} />}
                    </div>
                    <div className="flex flex-col">
                      <span className="font-semibold text-zinc-300 text-xs group-hover:text-white transition-colors">
                        {skill.name}
                      </span>
                      <span className="font-mono text-[8px] text-zinc-600 uppercase tracking-widest mt-0.5">
                        {skill.category}
                      </span>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
            </motion.div>
          </div>
        </section>

        {/* Section 6: Contact Connection Section (Interactive Neumorphic/Glassmorphic Form) */}
        <section id="contact" className="scroll-mt-24 grid grid-cols-1 lg:grid-cols-12 gap-12 items-start">
          
          {/* Contact Details */}
          <div className="lg:col-span-5 flex flex-col gap-6">
            <div className="flex flex-col gap-2">
              <span className="font-mono text-[10px] text-brand-terracotta uppercase tracking-widest font-semibold">
                06 / Transmission
              </span>
              <h2 className="font-serif text-3xl sm:text-5xl text-white tracking-tight">
                Get In Touch
              </h2>
            </div>

            <p className="text-zinc-400 text-sm leading-relaxed">
              If you want to collaborate on AI audiologic tools, hackathon projects, or would like to request my engineering resume, send a message.
            </p>

            <div className="flex flex-col gap-4 font-mono text-[10px] tracking-widest mt-4">
              {portfolioData.personalInfo.email && (
                <a
                  href={`mailto:${portfolioData.personalInfo.email}`}
                  className="flex items-center gap-3 text-zinc-400 hover:text-white w-fit lowercase"
                >
                  <div className="p-2 border border-white/5 rounded-full bg-white/5 text-brand-gold">
                    <Mail size={12} />
                  </div>
                  <span>{portfolioData.personalInfo.email}</span>
                </a>
              )}
              
              <div className="flex items-center gap-3 text-zinc-400 uppercase">
                <div className="p-2 border border-white/5 rounded-full bg-white/5 text-brand-gold">
                  <MapPin size={12} />
                </div>
                <span>{portfolioData.personalInfo.location}</span>
              </div>
            </div>

            {/* Social profiles */}
            <div className="flex items-center gap-4 mt-2">
              <a
                href={portfolioData.personalInfo.github}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-2 border border-white/10 bg-white/5 hover:bg-white/10 hover:text-white px-4 py-2.5 rounded-full font-mono text-[9px] uppercase tracking-widest text-zinc-300 transition-all"
              >
                <GithubIcon size={12} /> GitHub
              </a>

              {portfolioData.personalInfo.linkedin && (
                <a
                  href={portfolioData.personalInfo.linkedin}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 border border-white/10 bg-white/5 hover:bg-white/10 hover:text-white px-4 py-2.5 rounded-full font-mono text-[9px] uppercase tracking-widest text-zinc-300 transition-all"
                >
                  <LinkedinIcon size={12} /> LinkedIn
                </a>
              )}
            </div>
          </div>

          {/* Neumorphic/Glassmorphic Form */}
          <div className="lg:col-span-7 glass-card rounded-3xl p-6 sm:p-8 relative">
            <h3 className="font-mono text-[10px] font-bold uppercase tracking-widest text-white border-b border-white/5 pb-4 mb-6">
              Console Message Interface
            </h3>

            {isSubmitted ? (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="flex flex-col items-center justify-center text-center py-12 gap-4"
              >
                <CheckCircle size={36} className="text-brand-gold" />
                <div className="flex flex-col gap-1">
                  <h4 className="font-serif text-lg text-white font-bold">Transmission Complete</h4>
                  <p className="text-xs text-zinc-500 max-w-sm">
                    Thank you. Your message has been successfully broadcast. I'll read the logs and respond.
                  </p>
                </div>
                <button
                  onClick={() => setIsSubmitted(false)}
                  className="mt-2 px-4 py-2 border border-white/10 hover:border-white rounded-full font-mono text-[9px] uppercase tracking-widest text-zinc-400 hover:text-white transition-colors"
                >
                  Send new transmission
                </button>
              </motion.div>
            ) : (
              <form onSubmit={handleFormSubmit} className="flex flex-col gap-5 font-mono text-[10px] tracking-wider uppercase text-zinc-400">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="form-name" className="text-zinc-500 text-[8px]">
                      Sender Name
                    </label>
                    <input
                      id="form-name"
                      type="text"
                      required
                      placeholder="John Doe"
                      value={contactForm.name}
                      onChange={(e) => setContactForm({ ...contactForm, name: e.target.value })}
                      className="border border-white/5 bg-black/40 rounded-full px-4 py-3 text-zinc-100 placeholder:text-zinc-700 focus:outline-none focus:border-brand-gold/40 transition-colors normal-case"
                    />
                  </div>
                  
                  <div className="flex flex-col gap-1.5">
                    <label htmlFor="form-email" className="text-zinc-500 text-[8px]">
                      Email Address
                    </label>
                    <input
                      id="form-email"
                      type="email"
                      required
                      placeholder="name@domain.com"
                      value={contactForm.email}
                      onChange={(e) => setContactForm({ ...contactForm, email: e.target.value })}
                      className="border border-white/5 bg-black/40 rounded-full px-4 py-3 text-zinc-100 placeholder:text-zinc-700 focus:outline-none focus:border-brand-gold/40 transition-colors normal-case"
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-1.5">
                  <label htmlFor="form-subject" className="text-zinc-500 text-[8px]">
                    Subject Topic
                  </label>
                  <input
                    id="form-subject"
                    type="text"
                    required
                    placeholder="Project inquiry"
                    value={contactForm.subject}
                    onChange={(e) => setContactForm({ ...contactForm, subject: e.target.value })}
                    className="border border-white/5 bg-black/40 rounded-full px-4 py-3 text-zinc-100 placeholder:text-zinc-700 focus:outline-none focus:border-brand-gold/40 transition-colors normal-case"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label htmlFor="form-message" className="text-zinc-500 text-[8px]">
                    Message Payload
                  </label>
                  <textarea
                    id="form-message"
                    required
                    rows={4}
                    placeholder="Describe your project request..."
                    value={contactForm.message}
                    onChange={(e) => setContactForm({ ...contactForm, message: e.target.value })}
                    className="border border-white/5 bg-black/40 rounded-[20px] px-4 py-3 text-zinc-100 placeholder:text-zinc-700 focus:outline-none focus:border-brand-gold/40 resize-none transition-colors normal-case"
                  />
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="clay-button py-3 text-white font-bold tracking-widest cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isSubmitting ? (
                    <>Transmitting...</>
                  ) : (
                    <>
                      <Send size={11} /> Broadcast Message
                    </>
                  )}
                </button>
              </form>
            )}
          </div>
        </section>

      </div>

      {/* Footer Details */}
      <footer className="w-full max-w-6xl mx-auto border-t border-white/5 px-6 py-8 flex flex-col sm:flex-row items-center justify-between gap-4 mt-20 font-mono text-[9px] text-zinc-500 mb-24">
        <div className="flex items-center gap-2">
          <span>© 2026 DEVESHWAR S.</span>
        </div>
        <div className="flex items-center gap-6">
          <span>SMARTABILITY & BUILDFEST '26 WINNER</span>
          <a
            href={portfolioData.personalInfo.github}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-white transition-colors"
          >
            GITHUB
          </a>
        </div>
      </footer>
    </div>
  );
}
