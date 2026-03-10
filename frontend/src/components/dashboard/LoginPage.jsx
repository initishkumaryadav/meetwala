import { useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight, MessageSquare, Bell, Mic } from "lucide-react";
import { useAuthStore } from "../../store/auth.store";
import { authApi } from "../../services/api";
import { useResponsive } from "../../hooks/useMediaQuery";

const STEPS = [
  { num: "01", title: "Brief", desc: "Tell your bot the context", icon: MessageSquare },
  { num: "02", title: "Deploy", desc: "Drop it into a live meeting", icon: Mic },
  { num: "03", title: "Relax", desc: "Get pinged only when needed", icon: Bell },
];

export default function LoginPage() {
  const [params]  = useSearchParams();
  const navigate  = useNavigate();
  const { setToken, setUser, token } = useAuthStore();
  const { isMobile, isTablet } = useResponsive();

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

  const isCompact = isMobile || isTablet;

  return (
    <div style={{ minHeight: "100vh", display: "flex", flexDirection: isCompact ? "column" : "row", background: "#080B14" }}>

      {/* ── Left Brand Panel ── */}
      {!isCompact && (
        <div style={{
          flex: "0 0 54%", display: "flex", flexDirection: "column",
          justifyContent: "space-between", padding: "3rem 3.5rem",
          position: "relative", overflow: "hidden",
        }}>
          {/* Decorative arcs */}
          <div style={{ position: "absolute", right: -140, top: "45%", transform: "translateY(-50%)", width: 520, height: 520, borderRadius: "50%", border: "1px solid rgba(0,212,255,0.06)", pointerEvents: "none" }} />
          <div style={{ position: "absolute", right: -70, top: "48%", transform: "translateY(-50%)", width: 340, height: 340, borderRadius: "50%", border: "1px solid rgba(0,212,255,0.035)", pointerEvents: "none" }} />
          {/* Ambient gradient wash */}
          <div style={{ position: "absolute", top: "30%", left: "15%", width: 400, height: 400, background: "radial-gradient(ellipse, rgba(0,212,255,0.03), transparent 70%)", pointerEvents: "none" }} />

          {/* Logo */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5 }}
            style={{ display: "flex", alignItems: "center", gap: "0.625rem" }}
          >
            <img src="/jaiLogo.webp" alt="MeetWala" style={{ width: 34, height: 34, borderRadius: "0.5rem", objectFit: "cover" }} />
            <span style={{ fontFamily: "Syne, sans-serif", fontWeight: 700, fontSize: "1.1rem", color: "#E8F0FE", letterSpacing: "-0.02em" }}>
              MeetWala
            </span>
          </motion.div>

          {/* Hero copy */}
          <div style={{ position: "relative", zIndex: 1 }}>
            <motion.h1
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.12 }}
              style={{
                fontFamily: "Syne, sans-serif", fontSize: "3.25rem", fontWeight: 800,
                lineHeight: 1.08, color: "#E8F0FE", letterSpacing: "-0.035em",
                marginBottom: "1.25rem", maxWidth: 440,
              }}
            >
              Your meetings,<br />
              <span style={{ color: "#00D4FF" }}>handled.</span>
            </motion.h1>
            <motion.p
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.28 }}
              style={{ color: "#586A8E", fontSize: "1.05rem", lineHeight: 1.65, maxWidth: 400 }}
            >
              Brief your AI proxy before any meeting. It listens, responds with your knowledge, and pings you when it needs help.
            </motion.p>
          </div>

          {/* Process steps */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.5 }}
            style={{
              display: "flex", gap: "2.25rem",
              borderTop: "1px solid rgba(30,45,69,0.35)", paddingTop: "1.75rem",
            }}
          >
            {STEPS.map((s) => (
              <div key={s.num} style={{ flex: 1 }}>
                <span style={{
                  color: "#00D4FF", fontSize: "0.65rem", fontWeight: 600,
                  letterSpacing: "0.1em", fontFamily: "monospace",
                }}>{s.num}</span>
                <p style={{ color: "#C8D3E8", fontWeight: 600, fontSize: "0.875rem", marginTop: "0.375rem" }}>{s.title}</p>
                <p style={{ color: "#42536F", fontSize: "0.8rem", marginTop: "0.125rem", lineHeight: 1.45 }}>{s.desc}</p>
              </div>
            ))}
          </motion.div>
        </div>
      )}

      {/* ── Right Login Panel ── */}
      <div style={{
        flex: isCompact ? "1" : "0 0 46%",
        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
        padding: isMobile ? "3rem 1.5rem" : isTablet ? "3rem 2.5rem" : "3rem 4.5rem",
        background: isCompact ? "#080B14" : "#0C1020",
        borderLeft: isCompact ? "none" : "1px solid rgba(30,45,69,0.25)",
        minHeight: isCompact ? "100vh" : undefined,
        position: "relative",
      }}>
        <div style={{ width: "100%", maxWidth: 380 }}>

          {/* Mobile / tablet logo */}
          {isCompact && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.4 }}
              style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "2.5rem" }}
            >
              <img src="/jaiLogo.webp" alt="MeetWala" style={{ width: 30, height: 30, borderRadius: "0.4375rem", objectFit: "cover" }} />
              <span style={{ fontFamily: "Syne, sans-serif", fontWeight: 700, fontSize: "1rem", color: "#E8F0FE" }}>
                MeetWala
              </span>
            </motion.div>
          )}

          {/* Mobile hero text */}
          {isCompact && (
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.08 }}
              style={{ marginBottom: "2rem" }}
            >
              <h1 style={{
                fontFamily: "Syne, sans-serif", fontSize: isMobile ? "2rem" : "2.5rem",
                fontWeight: 800, lineHeight: 1.1, color: "#E8F0FE",
                letterSpacing: "-0.03em", marginBottom: "0.75rem",
              }}>
                Your meetings,<br />
                <span style={{ color: "#00D4FF" }}>handled.</span>
              </h1>
              <p style={{ color: "#586A8E", fontSize: "0.9rem", lineHeight: 1.6, maxWidth: 340 }}>
                Brief your AI proxy before any meeting. It handles the rest.
              </p>
            </motion.div>
          )}

          {/* Sign in form */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: isCompact ? 0.2 : 0.3 }}
          >
            {!isCompact && (
              <>
                <h2 style={{
                  fontFamily: "Syne, sans-serif", fontSize: "1.625rem", fontWeight: 700,
                  color: "#E8F0FE", letterSpacing: "-0.02em", marginBottom: "0.375rem",
                }}>Sign in</h2>
                <p style={{ color: "#4E6086", fontSize: "0.875rem", lineHeight: 1.6, marginBottom: "2rem" }}>
                  Use your Google account to get started.
                </p>
              </>
            )}

            {/* Google button */}
            <motion.button
              onClick={handleGoogleLogin}
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.985 }}
              style={{
                width: "100%", display: "flex", alignItems: "center", justifyContent: "center",
                gap: "0.625rem", background: "#FFFFFF", color: "#1A1A1A", fontWeight: 500,
                padding: "0.85rem 1.5rem", borderRadius: "0.5rem", border: "none",
                cursor: "pointer", fontSize: "0.9rem", fontFamily: "'Plus Jakarta Sans', sans-serif",
                transition: "box-shadow 0.2s ease",
                boxShadow: "0 1px 3px rgba(0,0,0,0.12)",
              }}
              onMouseEnter={(e) => e.currentTarget.style.boxShadow = "0 4px 16px rgba(0,0,0,0.25)"}
              onMouseLeave={(e) => e.currentTarget.style.boxShadow = "0 1px 3px rgba(0,0,0,0.12)"}
            >
              <svg width="18" height="18" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              Continue with Google
            </motion.button>

            {/* Compact product preview — shows on mobile/tablet */}
            {isCompact && (
              <div style={{
                display: "flex", gap: "1rem", marginTop: "2.5rem", paddingTop: "1.5rem",
                borderTop: "1px solid rgba(30,45,69,0.3)",
              }}>
                {STEPS.map((s) => (
                  <div key={s.num} style={{ flex: 1, textAlign: "center" }}>
                    <div style={{
                      width: 32, height: 32, borderRadius: "0.5rem", margin: "0 auto 0.4rem",
                      background: "rgba(0,212,255,0.08)", display: "flex",
                      alignItems: "center", justifyContent: "center",
                    }}>
                      <s.icon size={15} color="#00D4FF" />
                    </div>
                    <p style={{ color: "#C8D3E8", fontWeight: 600, fontSize: "0.75rem" }}>{s.title}</p>
                    {!isMobile && (
                      <p style={{ color: "#42536F", fontSize: "0.7rem", marginTop: "0.125rem" }}>{s.desc}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </motion.div>

          {/* Terms */}
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.5, delay: 0.6 }}
            style={{ color: "#2E3D57", fontSize: "0.7rem", marginTop: "2.5rem", lineHeight: 1.5 }}
          >
            By continuing, you agree to our Terms of Service and Privacy Policy.
          </motion.p>
        </div>
      </div>
    </div>
  );
}