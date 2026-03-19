"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/providers/auth-provider";
import { motion } from "framer-motion";
import { gsap } from "gsap";
import { toast } from "sonner";

export default function SignUpPage() {
  const router = useRouter();
  const { signIn } = useAuth();
  const cardRef = useRef<HTMLDivElement>(null);
  const [form, setForm] = useState({ fullName: "", username: "", email: "", password: "", confirm: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.to(cardRef.current, {
        y: 0,
        opacity: 1,
        duration: 0.7,
        ease: "power3.out",
      });
    }, cardRef);
    return () => ctx.revert();
  }, []);

  function set(field: keyof typeof form) {
    return (e: React.ChangeEvent<HTMLInputElement>) => setForm((f) => ({ ...f, [field]: e.target.value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (form.password !== form.confirm) {
      setError("Passwords do not match");
      return;
    }
    setLoading(true);
    try {
      const res = await fetch("/api/auth/signup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fullName: form.fullName,
          username: form.username,
          email: form.email,
          password: form.password,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message || "Sign up failed");
        return;
      }
      localStorage.setItem("authToken", data.data.authToken);
      signIn(data.data);
      toast.success(data.message);
      router.push("/dashboard");
    } catch {
      setError("Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  const inputStyle = {
    background: "rgba(255,255,255,0.07)",
    border: "1px solid rgba(255,255,255,0.12)",
    color: "white",
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-12" style={{ background: "linear-gradient(135deg, #0f0c29 0%, #302b63 50%, #24243e 100%)" }}>
      <div className="fixed top-0 right-0 w-96 h-96 rounded-full pointer-events-none opacity-20" style={{ background: "radial-gradient(circle, #f093fb, transparent 70%)", filter: "blur(60px)", transform: "translate(30%, -30%)" }} />
      <div className="fixed bottom-0 left-0 w-96 h-96 rounded-full pointer-events-none opacity-15" style={{ background: "radial-gradient(circle, #667eea, transparent 70%)", filter: "blur(60px)", transform: "translate(-30%, 30%)" }} />

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0, y: -20 }}
        transition={{ duration: 0.3 }}
        className="w-full max-w-md"
      >
        <div ref={cardRef} className="rounded-2xl p-8" style={{ opacity: 0, transform: "translateY(40px)", background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.1)", backdropFilter: "blur(16px)" }}>
          <div className="mb-8">
            <Link href="/" className="text-white/40 text-sm hover:text-white/70 transition-colors mb-6 inline-block">
              ← Back to home
            </Link>
            <h1 className="text-3xl font-bold text-white">Create account</h1>
            <p className="text-white/50 mt-2 text-sm">Start tracking your work today</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-white/70 text-sm mb-1.5">Full Name</label>
              <input
                type="text"
                value={form.fullName}
                onChange={set("fullName")}
                required
                className="w-full px-4 py-3 rounded-xl text-sm outline-none transition-all"
                style={inputStyle}
                onFocus={(e) => (e.target.style.borderColor = "rgba(102,126,234,0.7)")}
                onBlur={(e) => (e.target.style.borderColor = "rgba(255,255,255,0.12)")}
                placeholder="Jane Smith"
              />
            </div>

            <div>
              <label className="block text-white/70 text-sm mb-1.5">Username</label>
              <input
                type="text"
                value={form.username}
                onChange={set("username")}
                required
                pattern="^[a-zA-Z0-9_]+$"
                minLength={3}
                maxLength={30}
                className="w-full px-4 py-3 rounded-xl text-sm outline-none transition-all"
                style={inputStyle}
                onFocus={(e) => (e.target.style.borderColor = "rgba(102,126,234,0.7)")}
                onBlur={(e) => (e.target.style.borderColor = "rgba(255,255,255,0.12)")}
                placeholder="jane_smith"
              />
            </div>

            <div>
              <label className="block text-white/70 text-sm mb-1.5">Email</label>
              <input
                type="email"
                value={form.email}
                onChange={set("email")}
                required
                className="w-full px-4 py-3 rounded-xl text-sm outline-none transition-all"
                style={inputStyle}
                onFocus={(e) => (e.target.style.borderColor = "rgba(102,126,234,0.7)")}
                onBlur={(e) => (e.target.style.borderColor = "rgba(255,255,255,0.12)")}
                placeholder="jane@example.com"
              />
            </div>

            <div>
              <label className="block text-white/70 text-sm mb-1.5">Password</label>
              <input
                type="password"
                value={form.password}
                onChange={set("password")}
                required
                minLength={8}
                className="w-full px-4 py-3 rounded-xl text-sm outline-none transition-all"
                style={inputStyle}
                onFocus={(e) => (e.target.style.borderColor = "rgba(102,126,234,0.7)")}
                onBlur={(e) => (e.target.style.borderColor = "rgba(255,255,255,0.12)")}
                placeholder="Min. 8 characters"
              />
            </div>

            <div>
              <label className="block text-white/70 text-sm mb-1.5">Confirm Password</label>
              <input
                type="password"
                value={form.confirm}
                onChange={set("confirm")}
                required
                className="w-full px-4 py-3 rounded-xl text-sm outline-none transition-all"
                style={inputStyle}
                onFocus={(e) => (e.target.style.borderColor = "rgba(102,126,234,0.7)")}
                onBlur={(e) => (e.target.style.borderColor = "rgba(255,255,255,0.12)")}
                placeholder="••••••••"
              />
            </div>

            {error && (
              <p className="text-sm px-4 py-2.5 rounded-lg" style={{ background: "rgba(239,68,68,0.15)", border: "1px solid rgba(239,68,68,0.3)", color: "#fca5a5" }}>
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 rounded-xl font-semibold text-white text-sm transition-all hover:scale-[1.02] disabled:opacity-60 disabled:cursor-not-allowed mt-2"
              style={{ background: "linear-gradient(135deg, #667eea, #764ba2)", boxShadow: "0 0 24px rgba(102,126,234,0.3)" }}
            >
              {loading ? "Creating account…" : "Create account"}
            </button>
          </form>

          <p className="mt-6 text-center text-white/40 text-sm">
            Already have an account?{" "}
            <Link href="/auth/signin" className="text-indigo-400 hover:text-indigo-300 transition-colors">
              Sign in
            </Link>
          </p>
        </div>
      </motion.div>
    </div>
  );
}
