import { useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { MicOff, Pin } from "lucide-react";
import { useMeetingStore } from "../../store/meeting.store";

export default function ParticipantTile({ participant, isSpotlight, isThumb, onPin, isPinned }) {
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

  // ── Bot tile ──
  if (participant.isBot) {
    const statusColors = {
      idle:       { bg: "rgba(0,212,255,0.08)",  color: "#00D4FF",  label: "LISTENING",  glow: "rgba(0,212,255,0.15)" },
      thinking:   { bg: "rgba(123,97,255,0.08)", color: "#7B61FF",  label: "THINKING",   glow: "rgba(123,97,255,0.2)" },
      speaking:   { bg: "rgba(0,255,148,0.08)",  color: "#00FF94",  label: "SPEAKING",   glow: "rgba(0,255,148,0.2)" },
      escalating: { bg: "rgba(255,189,0,0.08)",  color: "#FFBD00",  label: "ESCALATING", glow: "rgba(255,189,0,0.2)" },
    };
    const st = statusColors[botStatus] || statusColors.idle;

    if (isThumb) {
      return (
        <div style={{
          position: "relative", background: "linear-gradient(135deg, #141C2E, #111827)", borderRadius: "0.75rem",
          overflow: "hidden", border: `2px solid ${st.color}30`, aspectRatio: "16/10",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <motion.div
            animate={botStatus === "thinking" ? { scale: [1, 1.1, 1] } : {}}
            transition={{ duration: 1.5, repeat: Infinity }}
            style={{ fontSize: "1.5rem" }}>🤖</motion.div>
          <div style={{ position: "absolute", bottom: 4, left: 4, background: "rgba(0,0,0,0.7)", padding: "0.1rem 0.35rem", borderRadius: "0.3rem" }}>
            <span style={{ color: st.color, fontSize: "0.5rem", fontWeight: 600 }}>{st.label}</span>
          </div>
        </div>
      );
    }

    return (
      <div style={{
        position: "relative", borderRadius: isSpotlight ? 0 : "1rem", overflow: "hidden",
        border: isSpotlight ? "none" : `1px solid ${st.color}20`,
        display: "flex", alignItems: "center", justifyContent: "center",
        minHeight: isSpotlight ? "100%" : 200,
        height: isSpotlight ? "100%" : undefined,
        background: `linear-gradient(135deg, rgba(20,28,46,0.95), rgba(13,18,32,0.95))`,
        boxShadow: isSpotlight ? "none" : `0 0 30px ${st.glow}`,
        transition: "all 0.3s ease",
      }}
        onDoubleClick={onPin}
      >
        {/* Ambient animated glow */}
        <motion.div
          animate={{ scale: [1, 1.2, 1], opacity: [0.3, 0.6, 0.3] }}
          transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
          style={{ position: "absolute", top: "50%", left: "50%", transform: "translate(-50%, -50%)", width: isSpotlight ? 300 : 180, height: isSpotlight ? 300 : 180, background: `radial-gradient(circle, ${st.color}10, transparent 70%)`, borderRadius: "50%", pointerEvents: "none" }}
        />

        <div style={{ textAlign: "center", position: "relative", zIndex: 1 }}>
          <motion.div
            animate={
              botStatus === "thinking" ? { scale: [1, 1.08, 1], rotate: [0, 3, -3, 0] } :
              botStatus === "speaking" ? { scale: [1, 1.04, 1] } : {}
            }
            transition={{ duration: botStatus === "thinking" ? 2 : 0.8, repeat: Infinity, ease: "easeInOut" }}
            style={{
              width: isSpotlight ? 100 : 80, height: isSpotlight ? 100 : 80, borderRadius: "1.25rem",
              background: "linear-gradient(135deg, #00D4FF, #7B61FF)",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: isSpotlight ? "3rem" : "2.25rem", margin: "0 auto 1rem",
              boxShadow: `0 0 40px ${st.color}30, inset 0 -2px 8px rgba(0,0,0,0.2)`,
            }}>🤖</motion.div>
          <p style={{ color: "#E8F0FE", fontWeight: 600, fontSize: isSpotlight ? "1.1rem" : "0.9rem", marginBottom: 4 }}>{participant.name}</p>
          <p style={{ color: "#5A6A8A", fontSize: isSpotlight ? "0.8rem" : "0.7rem", marginBottom: isSpotlight ? 16 : 0 }}>AI Proxy</p>

          {/* Waveform when speaking */}
          {botStatus === "speaking" && (
            <div style={{ display: "flex", justifyContent: "center", gap: 3, marginTop: 12 }}>
              {[0, 1, 2, 3, 4].map((i) => (
                <div key={i} style={{ width: 3, height: 16, background: st.color, borderRadius: 2, animation: `waveform 1s ease-in-out infinite ${i * 0.12}s` }} />
              ))}
            </div>
          )}
        </div>

        {/* Status badge */}
        <div style={{ position: "absolute", top: isSpotlight ? 16 : 10, right: isSpotlight ? 16 : 10 }}>
          <span style={{
            display: "flex", alignItems: "center", gap: 5,
            background: st.bg, color: st.color, padding: "0.25rem 0.6rem",
            borderRadius: "2rem", fontSize: "0.6rem", fontWeight: 600,
            border: `1px solid ${st.color}15`, backdropFilter: "blur(8px)",
          }}>
            <motion.div
              animate={{ scale: [1, 1.4, 1] }}
              transition={{ duration: 1.5, repeat: Infinity }}
              style={{ width: 5, height: 5, borderRadius: "50%", background: st.color, boxShadow: `0 0 6px ${st.color}` }}
            />
            {st.label}
          </span>
        </div>

        {/* Pin indicator */}
        {isPinned && (
          <div style={{ position: "absolute", top: isSpotlight ? 16 : 10, left: isSpotlight ? 16 : 10 }}>
            <Pin size={14} color="#7B61FF" fill="#7B61FF" />
          </div>
        )}
      </div>
    );
  }

  // ── Thumbnail tile ──
  if (isThumb) {
    return (
      <div style={{
        position: "relative", borderRadius: "0.75rem", overflow: "hidden",
        background: "#141C2E", border: "2px solid rgba(30,45,69,0.4)",
        aspectRatio: "16/10",
      }}>
        {remoteStream ? (
          <video ref={videoRef} autoPlay playsInline
            style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
        ) : (
          <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <div style={{ width: 32, height: 32, borderRadius: "50%", background: "linear-gradient(135deg, #7B61FF, #00D4FF)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.8rem", fontWeight: 700, color: "#fff" }}>
              {participant.name?.[0]?.toUpperCase()}
            </div>
          </div>
        )}
        <div style={{ position: "absolute", bottom: 4, left: 4, background: "rgba(0,0,0,0.7)", padding: "0.1rem 0.35rem", borderRadius: "0.3rem" }}>
          <span style={{ color: "#fff", fontSize: "0.55rem", fontWeight: 500 }}>{participant.name}</span>
        </div>
      </div>
    );
  }

  // ── Spotlight tile ──
  if (isSpotlight) {
    return (
      <div style={{ position: "relative", height: "100%", width: "100%" }}>
        {remoteStream ? (
          <video ref={videoRef} autoPlay playsInline
            style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
        ) : (
          <div style={{ position: "absolute", inset: 0, background: "linear-gradient(135deg, #141C2E, #0A0E1A)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <div style={{ width: 96, height: 96, borderRadius: "50%", background: "linear-gradient(135deg, #7B61FF, #00D4FF)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "2.5rem", fontWeight: 700, color: "#fff", boxShadow: "0 0 40px rgba(123,97,255,0.25)" }}>
              {participant.name?.[0]?.toUpperCase()}
            </div>
          </div>
        )}
        <div style={{
          position: "absolute", bottom: 16, left: 16, display: "flex", alignItems: "center", gap: "0.375rem",
          background: "rgba(0,0,0,0.65)", backdropFilter: "blur(8px)", padding: "0.3rem 0.75rem",
          borderRadius: "0.5rem", border: "1px solid rgba(255,255,255,0.06)",
        }}>
          <span style={{ color: "#fff", fontSize: "0.85rem", fontWeight: 500 }}>{participant.name}</span>
        </div>
        {isPinned && (
          <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} onClick={onPin}
            style={{ position: "absolute", top: 16, right: 16, width: 32, height: 32, borderRadius: "50%", background: "rgba(0,0,0,0.5)", border: "none", color: "#7B61FF", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", backdropFilter: "blur(8px)" }}>
            <Pin size={14} fill="#7B61FF" />
          </motion.button>
        )}
      </div>
    );
  }

  // ── Default grid tile ──
  return (
    <div style={{
      position: "relative", background: "linear-gradient(135deg, rgba(20,28,46,0.95), rgba(13,18,32,0.95))",
      borderRadius: "1rem", overflow: "hidden",
      border: isPinned ? "2px solid rgba(123,97,255,0.4)" : "1px solid rgba(30,45,69,0.3)",
      minHeight: 200, aspectRatio: "16/9",
      transition: "all 0.3s ease",
      boxShadow: isPinned ? "0 0 25px rgba(123,97,255,0.1)" : "none",
    }}
      onMouseEnter={(e) => { if (!isPinned) e.currentTarget.style.borderColor = "rgba(123,97,255,0.25)"; }}
      onMouseLeave={(e) => { if (!isPinned) e.currentTarget.style.borderColor = "rgba(30,45,69,0.3)"; }}
      onDoubleClick={onPin}
    >
      {remoteStream ? (
        <video ref={videoRef} autoPlay playsInline
          style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
      ) : (
        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ width: 72, height: 72, borderRadius: "50%", background: "linear-gradient(135deg, #7B61FF, #00D4FF)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.75rem", fontWeight: 700, color: "#fff", boxShadow: "0 0 25px rgba(123,97,255,0.2)" }}>
            {participant.avatar ? (
              <img src={participant.avatar} alt={participant.name} style={{ width: "100%", height: "100%", borderRadius: "50%", objectFit: "cover" }} />
            ) : participant.name?.[0]?.toUpperCase()}
          </div>
        </div>
      )}

      {/* Name badge */}
      <div style={{
        position: "absolute", bottom: 10, left: 10, display: "flex", alignItems: "center", gap: "0.375rem",
        background: "rgba(0,0,0,0.65)", backdropFilter: "blur(8px)", padding: "0.25rem 0.6rem",
        borderRadius: "0.5rem", border: "1px solid rgba(255,255,255,0.05)",
      }}>
        <span style={{ color: "#fff", fontSize: "0.75rem", fontWeight: 500 }}>{participant.name}</span>
      </div>

      {/* Pin button on hover */}
      {onPin && (
        <motion.button
          initial={{ opacity: 0 }} whileHover={{ opacity: 1, scale: 1.1 }}
          onClick={(e) => { e.stopPropagation(); onPin(); }}
          style={{
            position: "absolute", top: 8, right: 8, width: 28, height: 28, borderRadius: "50%",
            background: isPinned ? "rgba(123,97,255,0.3)" : "rgba(0,0,0,0.5)", border: "none",
            color: isPinned ? "#7B61FF" : "#ccc", cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center", backdropFilter: "blur(8px)",
            opacity: isPinned ? 1 : 0, transition: "opacity 0.2s",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.opacity = "1")}
          onMouseLeave={(e) => { if (!isPinned) e.currentTarget.style.opacity = "0"; }}
        >
          <Pin size={12} fill={isPinned ? "#7B61FF" : "transparent"} />
        </motion.button>
      )}
    </div>
  );
}