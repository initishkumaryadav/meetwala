import { useNavigate } from "react-router-dom";
import { motion } from "framer-motion";

export default function NotFound() {
  const navigate = useNavigate();
  return (
    <div style={{ minHeight: "100vh", background: "#0A0E1A", display: "flex", alignItems: "center", justifyContent: "center", textAlign: "center", padding: "1.5rem", position: "relative", overflow: "hidden" }}>
      {/* Background accents */}
      <div style={{ position: "absolute", top: "20%", left: "30%", width: 400, height: 400, background: "radial-gradient(circle, rgba(0,212,255,0.04), transparent 70%)", borderRadius: "50%", pointerEvents: "none" }} />
      <div style={{ position: "absolute", bottom: "20%", right: "25%", width: 300, height: 300, background: "radial-gradient(circle, rgba(123,97,255,0.04), transparent 70%)", borderRadius: "50%", pointerEvents: "none" }} />

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
        <motion.div
          animate={{ y: [0, -12, 0], rotate: [0, 5, -5, 0] }}
          transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
          style={{ fontSize: "4rem", marginBottom: "1rem", display: "inline-block", filter: "drop-shadow(0 0 20px rgba(0,212,255,0.3))" }}>🤖</motion.div>
        <h1 style={{ fontFamily: "Syne, sans-serif", fontSize: "5rem", fontWeight: 800, marginBottom: "0.5rem", lineHeight: 1 }}>
          <span className="gradient-text">404</span>
        </h1>
        <p style={{ color: "#5A6A8A", marginBottom: "2rem", fontSize: "0.95rem", maxWidth: 360, margin: "0 auto 2rem" }}>This page doesn't exist. Even my AI brain can't find it.</p>
        <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={() => navigate("/")} className="btn-primary" style={{ padding: "0.75rem 2rem" }}>
          Go Home
        </motion.button>
      </motion.div>
    </div>
  );
}