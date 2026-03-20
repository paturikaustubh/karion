"use client";

import { useEffect, useRef, useState, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/components/providers/auth-provider";
import { motion } from "framer-motion";
import { gsap } from "gsap";
import { toast } from "sonner";

function SignInForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { signIn } = useAuth();
  const cardRef = useRef<HTMLDivElement>(null);
  const [login, setLogin] = useState("");
  const [password, setPassword] = useState("");
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

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/auth/signin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ login, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.message || "Sign in failed");
        return;
      }
      localStorage.setItem("authToken", data.data.authToken);
      signIn(data.data);
      toast.success(data.message);
      const redirect = searchParams.get("redirect") || "/dashboard";
      router.push(redirect);
    } catch {
      setError("Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: "linear-gradient(135deg, #0f0c29 0%, #302b63 50%, #24243e 100%)" }}>
      {/* Blobs */}
      <div className="fixed top-0 left-0 w-96 h-96 rounded-full pointer-events-none opacity-20" style={{ background: "radial-gradient(circle, #667eea, transparent 70%)", filter: "blur(60px)", transform: "translate(-30%, -30%)" }} />
      <div className="fixed bottom-0 right-0 w-96 h-96 rounded-full pointer-events-none opacity-15" style={{ background: "radial-gradient(circle, #f093fb, transparent 70%)", filter: "blur(60px)", transform: "translate(30%, 30%)" }} />

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
            <h1 className="text-3xl font-bold text-white">Welcome back</h1>
            <p className="text-white/50 mt-2 text-sm">Sign in with your username or email</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-white/70 text-sm mb-1.5">Username or Email</label>
              <input
                type="text"
                value={login}
                onChange={(e) => setLogin(e.target.value)}
                required
                autoComplete="username"
                autoFocus
                className="w-full px-4 py-3 rounded-xl text-white text-sm outline-none transition-all"
                style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.12)", color: "white" }}
                onFocus={(e) => (e.target.style.borderColor = "rgba(102,126,234,0.7)")}
                onBlur={(e) => (e.target.style.borderColor = "rgba(255,255,255,0.12)")}
                placeholder="you@example.com"
              />
            </div>

            <div>
              <label className="block text-white/70 text-sm mb-1.5">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                className="w-full px-4 py-3 rounded-xl text-white text-sm outline-none transition-all"
                style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.12)", color: "white" }}
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
              {loading ? "Signing in…" : "Sign in"}
            </button>
          </form>

          <p className="mt-6 text-center text-white/40 text-sm">
            Don&apos;t have an account?{" "}
            <Link href="/auth/signup" className="text-indigo-400 hover:text-indigo-300 transition-colors">
              Sign up
            </Link>
          </p>
        </div>
      </motion.div>
    </div>
  );
}

export default function SignInPage() {
  return (
    <Suspense>
      <SignInForm />
    </Suspense>
  );
}
