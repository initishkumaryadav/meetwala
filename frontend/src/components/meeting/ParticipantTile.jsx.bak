import { useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { useMeetingStore } from "../../store/meeting.store";

export default function ParticipantTile({ participant }) {
  const videoRef = useRef(null);
  const remoteStream = useMeetingStore((s) => s.remoteStreams[participant.socketId]);
  const botStatus = useMeetingStore((s) => s.botStatus);

  useEffect(() => {
    if (videoRef.current && remoteStream) {
      videoRef.current.srcObject = remoteStream;
      const playVideo = () => {
        videoRef.current?.play().catch((e) => {
          console.warn("Autoplay blocked, retrying on user interaction:", e.message);
          const tryPlay = () => {
            videoRef.current?.play().catch(() => {});
            document.removeEventListener("click", tryPlay);
          };
          document.addEventListener("click", tryPlay, { once: true });
        });
      };
      playVideo();
    }
  }, [remoteStream]);

  if (participant.isBot) {
    const statusColors = {
      idle:       { bg: "rgba(0,212,255,0.15)",  color: "#00D4FF",  label: "LISTENING" },
      thinking:   { bg: "rgba(123,97,255,0.15)", color: "#7B61FF",  label: "THINKING..." },
      speaking:   { bg: "rgba(0,255,148,0.15)",  color: "#00FF94",  label: "SPEAKING" },
      escalating: { bg: "rgba(255,189,0,0.15)",  color: "#FFBD00",  label: "ASKING VIA WHATSAPP" },
    };
    const st = statusColors[botStatus] || statusColors.idle;

    return (
      <div style={{
        position: "relative", background: "linear-gradient(135deg, rgba(20,28,46,0.9), rgba(17,24,39,0.9))",
        borderRadius: "1rem", overflow: "hidden", border: `1px solid ${st.color}30`,
        display: "flex", alignItems: "center", justifyContent: "center", minHeight: 200,
        boxShadow: `0 0 25px ${st.color}10`,
      }}>
        {/* Ambient glow */}
        <div style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)", width: 200, height: 200, background: `radial-gradient(circle, ${st.color}08, transparent 70%)`, borderRadius: "50%", pointerEvents: "none" }} />
        <div style={{ textAlign: "center", position: "relative" }}>
          <motion.div
            animate={botStatus === "thinking" ? { scale: [1, 1.08, 1] } : botStatus === "speaking" ? { scale: [1, 1.05, 1] } : {}}
            transition={{ duration: botStatus === "thinking" ? 1.5 : 0.6, repeat: Infinity, ease: "easeInOut" }}
            style={{
              width: 72, height: 72, borderRadius: "1rem",
              background: "linear-gradient(135deg, #00D4FF, #7B61FF)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: "2rem", margin: "0 auto 0.75rem",
              boxShadow: `0 0 30px ${st.color}40`,
            }}>🤖</motion.div>
          <p style={{ color: st.color, fontWeight: 600, fontSize: "0.85rem" }}>{participant.name}</p>
          <p style={{ color: "#5A6A8A", fontSize: "0.7rem" }}>AI Proxy</p>
        </div>
        <div style={{ position: "absolute", top: "0.625rem", right: "0.625rem" }}>
          <span style={{ display: "flex", alignItems: "center", gap: 4, background: st.bg, color: st.color, padding: "0.2rem 0.5rem", borderRadius: "2rem", fontSize: "0.6rem", fontWeight: 600, border: `1px solid ${st.color}20` }}>
            <div style={{ width: 5, height: 5, borderRadius: "50%", background: st.color, boxShadow: `0 0 6px ${st.color}`, animation: "pulse 1.5s infinite" }} />
            {st.label}
          </span>
        </div>
      </div>
    );
  }

  return (
    <div style={{ position: "relative", background: "linear-gradient(135deg, rgba(20,28,46,0.9), rgba(17,24,39,0.9))", borderRadius: "1rem", overflow: "hidden", border: "1px solid rgba(30,45,69,0.5)", minHeight: 200, aspectRatio: "16/9", transition: "border-color 0.3s" }}
      onMouseEnter={(e) => e.currentTarget.style.borderColor = "rgba(123,97,255,0.3)"}
      onMouseLeave={(e) => e.currentTarget.style.borderColor = "rgba(30,45,69,0.5)"}>
      {remoteStream ? (
        <video ref={videoRef} autoPlay playsInline style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", objectFit: "cover" }} />
      ) : (
        <div style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ width: 64, height: 64, borderRadius: "50%", background: "linear-gradient(135deg, #7B61FF, #00D4FF)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.5rem", fontWeight: 700, color: "#fff", boxShadow: "0 0 20px rgba(123,97,255,0.2)" }}>
            {participant.avatar ? (
              <img src={participant.avatar} alt={participant.name} style={{ width: "100%", height: "100%", borderRadius: "50%", objectFit: "cover" }} />
            ) : (
              participant.name?.[0]?.toUpperCase()
            )}
          </div>
        </div>
      )}
      <div style={{ position: "absolute", bottom: "0.625rem", left: "0.625rem", background: "rgba(0,0,0,0.65)", backdropFilter: "blur(6px)", padding: "0.2rem 0.5rem", borderRadius: "0.4rem", color: "white", fontSize: "0.72rem", border: "1px solid rgba(255,255,255,0.05)" }}>
        {participant.name}
      </div>
    </div>
  );
}