"use client";

import { useEffect, useRef } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { gsap } from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

const features = [
  {
    icon: "⚡",
    title: "Task Tracking",
    desc: "Create, prioritize, and track tasks with real-time status updates and severity levels.",
  },
  {
    icon: "⏱",
    title: "Time Sessions",
    desc: "Start and stop work timers per task. Total work time auto-accumulates.",
  },
  {
    icon: "📊",
    title: "Analytics",
    desc: "Daily stats, top tasks by time, completion trends across any date range.",
  },
  {
    icon: "📝",
    title: "AI Reports",
    desc: "Generate professional daily work reports powered by AI from your activity.",
  },
  {
    icon: "💬",
    title: "Comments",
    desc: "Log updates and notes directly on tasks. Full comment history preserved.",
  },
  {
    icon: "🔒",
    title: "Secure Auth",
    desc: "Session-based auth with secure tokens. Your data is yours alone.",
  },
];

export default function LandingPage() {
  const heroRef = useRef<HTMLDivElement>(null);
  const headlineRef = useRef<HTMLHeadingElement>(null);
  const subRef = useRef<HTMLParagraphElement>(null);
  const ctaRef = useRef<HTMLDivElement>(null);
  const featuresRef = useRef<HTMLDivElement>(null);
  const floatRef = useRef<HTMLDivElement>(null);

  // Redirect authenticated users to dashboard
  useEffect(() => {
    const token = localStorage.getItem("authToken");
    if (!token) return;
    fetch("/api/auth/me", {
      headers: { Authorization: `Bearer ${token}` },
    }).then((res) => {
      if (res.ok) window.location.replace("/dashboard");
    }).catch(() => {});
  }, []);

  useEffect(() => {
    const ctx = gsap.context(() => {
      // Hero entrance
      const tl = gsap.timeline({ defaults: { ease: "power3.out" } });
      tl.to(headlineRef.current, { y: 0, opacity: 1, duration: 0.9 })
        .to(subRef.current, { y: 0, opacity: 1, duration: 0.7 }, "-=0.5")
        .to(ctaRef.current, { y: 0, opacity: 1, duration: 0.6 }, "-=0.4");

      // Floating blob
      gsap.to(floatRef.current, {
        y: -24,
        duration: 3,
        repeat: -1,
        yoyo: true,
        ease: "sine.inOut",
      });

      // Feature cards scroll entrance
      const cards = featuresRef.current?.querySelectorAll(".feature-card");
      if (cards) {
        cards.forEach((card, i) => {
          gsap.to(card, {
            scrollTrigger: { trigger: card, start: "top 85%", toggleActions: "play none none none" },
            y: 0,
            opacity: 1,
            duration: 0.6,
            delay: (i % 3) * 0.1,
            ease: "power2.out",
          });
        });
      }
    }, heroRef);

    return () => ctx.revert();
  }, []);

  return (
    <div className="min-h-screen overflow-x-hidden" style={{ background: "linear-gradient(135deg, #0f0c29 0%, #302b63 50%, #24243e 100%)" }}>
      {/* Nav */}
      <nav className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-8 py-4" style={{ backdropFilter: "blur(12px)", background: "rgba(15,12,41,0.6)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        <span className="text-white font-bold text-xl tracking-tight">Karion</span>
        <div className="flex gap-3">
          <Link href="/auth/signin" className="px-4 py-2 text-sm text-white/80 hover:text-white transition-colors rounded-lg hover:bg-white/10">
            Sign In
          </Link>
          <Link href="/auth/signup" className="px-4 py-2 text-sm text-white font-medium rounded-lg transition-all" style={{ background: "linear-gradient(135deg, #667eea, #764ba2)" }}>
            Get Started
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <section ref={heroRef} className="relative flex flex-col items-center justify-center min-h-screen text-center px-6 pt-24">
        {/* Floating blob */}
        <div ref={floatRef} className="absolute top-32 right-24 w-64 h-64 rounded-full opacity-20 pointer-events-none" style={{ background: "radial-gradient(circle, #667eea, transparent 70%)", filter: "blur(40px)" }} />
        <div className="absolute bottom-32 left-24 w-48 h-48 rounded-full opacity-15 pointer-events-none" style={{ background: "radial-gradient(circle, #f093fb, transparent 70%)", filter: "blur(32px)" }} />

        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
          className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-medium mb-6"
          style={{ background: "rgba(102,126,234,0.2)", border: "1px solid rgba(102,126,234,0.4)", color: "#a5b4fc" }}
        >
          ✦ Personal productivity, redefined
        </motion.div>

        <h1 ref={headlineRef} style={{ opacity: 0, transform: "translateY(60px)" }} className="text-5xl md:text-7xl font-bold text-white leading-tight max-w-5xl">
          Your work,
          <br />
          <span style={{ backgroundImage: "linear-gradient(135deg, #667eea, #f093fb)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", whiteSpace: "nowrap" }}>
            beautifully tracked
          </span>
        </h1>

        <p ref={subRef} style={{ opacity: 0, transform: "translateY(30px)" }} className="mt-6 text-base md:text-lg text-white/60 max-w-xl leading-relaxed">
          Karion combines task management, time tracking, and AI-powered reports into one elegant system built for deep focus.
        </p>

        <div ref={ctaRef} style={{ opacity: 0, transform: "translateY(20px)" }} className="mt-10 flex flex-col sm:flex-row gap-4">
          <Link href="/auth/signup" className="px-8 py-3.5 text-white font-semibold rounded-xl text-base transition-all hover:scale-105 hover:shadow-2xl" style={{ background: "linear-gradient(135deg, #667eea, #764ba2)", boxShadow: "0 0 32px rgba(102,126,234,0.4)" }}>
            Start for free
          </Link>
          <Link href="/auth/signin" className="px-8 py-3.5 font-semibold rounded-xl text-base transition-all hover:bg-white/10" style={{ border: "1px solid rgba(255,255,255,0.2)", color: "rgba(255,255,255,0.8)" }}>
            Sign in
          </Link>
        </div>

        {/* Hero gradient line */}
        <div className="absolute bottom-0 left-0 right-0 h-px" style={{ background: "linear-gradient(90deg, transparent, rgba(102,126,234,0.5), transparent)" }} />
      </section>

      {/* Features */}
      <section className="py-32 px-6">
        <div className="max-w-6xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="text-center mb-16"
          >
            <h2 className="text-4xl md:text-5xl font-bold text-white mb-4">
              Everything you need
            </h2>
            <p className="text-white/50 text-lg max-w-md mx-auto">
              Built for individuals who want real insight into how they spend their time.
            </p>
          </motion.div>

          <div ref={featuresRef} className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((f) => (
              <div
                key={f.title}
                className="feature-card p-6 rounded-2xl transition-all hover:scale-[1.02]"
                style={{ opacity: 0, transform: "translateY(50px)", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", backdropFilter: "blur(8px)" }}
              >
                <div className="text-3xl mb-4">{f.icon}</div>
                <h3 className="text-white font-semibold text-lg mb-2">{f.title}</h3>
                <p className="text-white/50 text-sm leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Footer */}
      <section className="py-24 text-center px-6">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
        >
          <h2 className="text-4xl md:text-5xl font-bold text-white mb-6">
            Ready to take control?
          </h2>
          <Link href="/auth/signup" className="inline-block px-10 py-4 text-white font-semibold rounded-xl text-lg transition-all hover:scale-105" style={{ background: "linear-gradient(135deg, #667eea, #764ba2)", boxShadow: "0 0 40px rgba(102,126,234,0.5)" }}>
            Get started — it&apos;s free
          </Link>
        </motion.div>
      </section>

      <footer className="text-center py-8 text-white/20 text-sm border-t" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
        © 2026 Karion. Built for focus.
      </footer>
    </div>
  );
}
