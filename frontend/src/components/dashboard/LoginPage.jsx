import { useEffect, useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { Sparkles, Zap, Shield, Globe } from "lucide-react";
import { useAuthStore } from "../../store/auth.store";
import { authApi } from "../../services/api";

function FloatingOrb({ delay, size, x, y, color }) {
  return (
    <motion.div
      style={{
        position: "absolute", left: `${x}%`, top: `${y}%`, width: size, height: size,
        borderRadius: "50%", background: `radial-gradient(circle, ${color}, transparent 70%)`,
        filter: "blur(40px)", pointerEvents: "none",
      }}
      animate={{ y: [0, -30, 0], x: [0, 15, 0], scale: [1, 1.2, 1] }}
      transition={{ duration: 8, repeat: Infinity, delay, ease: "easeInOut" }}
    />
  );
}

const FEATURES = [
  { icon: Zap, label: "AI-Powered", desc: "Gemini 1.5 Pro understands context" },
  { icon: Shield, label: "Secure", desc: "End-to-end encrypted meetings" },
  { icon: Globe, label: "Always-On", desc: "Your AI proxy never misses a beat" },
];

export default function LoginPage() {
  const [params]  = useSearchParams();
  const navigate  = useNavigate();
  const { setToken, setUser, token } = useAuthStore();

  useEffect(() => {
    const t = params.get("token");
    if (t) {
      setToken(t);
      authApi.me()
        .then((r) => { setUser(r.data.user); navigate("/"); })
        .catch(console.error);
    }
  }, [params]);

  useEffect(() => { if (token) navigate("/"); }, [token]);

  const handleGoogleLogin = () => {
    window.location.href = `${import.meta.env.VITE_API_URL || "/api"}/auth/google`;
  };

  const orbs = useMemo(() => [
    { delay: 0, size: 300, x: 15, y: 20, color: "rgba(0,212,255,0.08)" },
    { delay: 2, size: 250, x: 75, y: 60, color: "rgba(123,97,255,0.08)" },
    { delay: 4, size: 200, x: 50, y: 10, color: "rgba(0,255,148,0.05)" },
    { delay: 1, size: 180, x: 85, y: 15, color: "rgba(0,212,255,0.06)" },
    { delay: 3, size: 220, x: 25, y: 75, color: "rgba(123,97,255,0.06)" },
  ], []);

  return (
    <div style={{ minHeight: "100vh", background: "#0A0E1A", display: "flex", alignItems: "center", justifyContent: "center", padding: "1rem", position: "relative", overflow: "hidden" }}>

      {/* Animated background orbs */}
      <div style={{ position: "fixed", inset: 0, pointerEvents: "none" }}>
        {orbs.map((o, i) => <FloatingOrb key={i} {...o} />)}
      </div>

      {/* Grid pattern overlay */}
      <div style={{
        position: "fixed", inset: 0, pointerEvents: "none", opacity: 0.03,
        backgroundImage: `linear-gradient(rgba(0,212,255,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(0,212,255,0.3) 1px, transparent 1px)`,
        backgroundSize: "60px 60px",
      }} />

      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "2rem", position: "relative", zIndex: 1 }}>

        {/* Main card */}
        <motion.div
          initial={{ opacity: 0, y: 40, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          className="glass-card"
          style={{ padding: "3rem 2.5rem", width: "100%", maxWidth: 440, textAlign: "center", position: "relative" }}
        >
          {/* Animated border glow */}
          <div style={{
            position: "absolute", inset: -1, borderRadius: "1rem", padding: 1, pointerEvents: "none",
            background: "linear-gradient(135deg, rgba(0,212,255,0.2), rgba(123,97,255,0.2), rgba(0,255,148,0.1))",
            backgroundSize: "200% 200%", animation: "gradient-shift 6s ease infinite",
            WebkitMask: "linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0)", WebkitMaskComposite: "xor", maskComposite: "exclude",
          }} />

          {/* Logo */}
          <motion.div
            style={{ display: "flex", justifyContent: "center", marginBottom: "1.75rem" }}
            animate={{ y: [0, -6, 0] }}
            transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
          >
            <div style={{
              width: 72, height: 72, borderRadius: "1.25rem",
              background: "linear-gradient(135deg, #00D4FF, #7B61FF)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: "2.25rem",
              boxShadow: "0 0 40px rgba(0,212,255,0.3), 0 0 80px rgba(123,97,255,0.15)",
              animation: "glow-pulse 3s ease-in-out infinite",
            }}>🤖</div>
          </motion.div>

          <h1 style={{ fontFamily: "Syne, sans-serif", fontSize: "2.25rem", fontWeight: 800, marginBottom: "0.5rem" }}>
            <span className="gradient-text">MeetWala</span>
          </h1>
          <p style={{ color: "#5A6A8A", fontSize: "0.9rem", marginBottom: "0.25rem", lineHeight: 1.6 }}>
            AI Proxy Attendee for Smart Virtual Meetings
          </p>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "0.375rem", marginBottom: "2.25rem" }}>
            <Sparkles size={14} color="#00D4FF" />
            <span style={{ color: "#00D4FF", fontSize: "0.75rem", fontWeight: 500 }}>Powered by Gemini 1.5 Pro</span>
          </div>

          <motion.button
            onClick={handleGoogleLogin}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            style={{
              width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: "0.75rem",
              background: "#FFFFFF", color: "#1a1a1a", fontWeight: 600, padding: "0.9rem 1.5rem",
              borderRadius: "0.75rem", border: "none", cursor: "pointer", fontSize: "0.95rem",
              boxShadow: "0 4px 20px rgba(0,0,0,0.3), 0 0 0 1px rgba(255,255,255,0.1)",
              transition: "box-shadow 0.3s",
            }}
          >
            <svg width="20" height="20" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
            Continue with Google
          </motion.button>

          <p style={{ color: "#3D4A63", fontSize: "0.7rem", marginTop: "1.5rem" }}>
            By signing in you agree to our Terms & Privacy Policy
          </p>
        </motion.div>

        {/* Feature pills */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.6 }}
          style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", justifyContent: "center" }}
        >
          {FEATURES.map((f, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 + i * 0.15 }}
              style={{
                display: "flex", alignItems: "center", gap: "0.5rem",
                background: "rgba(20,28,46,0.5)", backdropFilter: "blur(8px)",
                border: "1px solid rgba(30,45,69,0.6)", borderRadius: "2rem",
                padding: "0.5rem 1rem",
              }}
            >
              <f.icon size={14} color="#00D4FF" />
              <span style={{ fontSize: "0.75rem", color: "#8A95AD" }}>
                <strong style={{ color: "#C3CBE0" }}>{f.label}</strong> — {f.desc}
              </span>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </div>
  );
}