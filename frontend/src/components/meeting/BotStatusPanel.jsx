import { motion, AnimatePresence } from "framer-motion";
import { PhoneCall } from "lucide-react";
import { useMeetingStore } from "../../store/meeting.store";

const STATUS = {
  idle:       { label: "Idle",                         color: "#5A6A8A", bg: "rgba(90,106,138,0.15)" },
  thinking:   { label: "Thinking...",                  color: "#00D4FF", bg: "rgba(0,212,255,0.15)" },
  speaking:   { label: "Speaking",                     color: "#00FF94", bg: "rgba(0,255,148,0.15)" },
  escalating: { label: "Asking you via WhatsApp...",   color: "#FF8C42", bg: "rgba(255,140,66,0.15)" },
};

const EVENT_ICONS = {
  response:         "💬",
  whatsapp_sent:    "📱",
  whatsapp_replied: "✅",
};

export default function BotStatusPanel() {
  const { botStatus, botEvents, lastBotResponse, isWhatsAppPending } = useMeetingStore();
  const cfg = STATUS[botStatus] || STATUS.idle;

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", background: "rgba(17,24,39,0.5)" }}>

      {/* Header */}
      <div style={{ padding: "0.875rem 1rem", borderBottom: "1px solid rgba(30,45,69,0.6)", display: "flex", alignItems: "center", gap: "0.75rem", background: "rgba(10,14,26,0.5)" }}>
        <div style={{ width: 32, height: 32, background: "linear-gradient(135deg, #00D4FF, #7B61FF)", borderRadius: "0.625rem", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 0 12px rgba(0,212,255,0.15)" }}>🤖</div>
        <div>
          <p style={{ fontFamily: "Syne, sans-serif", fontWeight: 600, fontSize: "0.85rem", color: "#E8F0FE" }}>AI Proxy Bot</p>
          <p style={{ fontSize: "0.65rem", color: "#5A6A8A" }}>Activity Monitor</p>
        </div>
      </div>

      {/* Status badge */}
      <div style={{ margin: "0.875rem 1rem 0", padding: "0.625rem 0.875rem", borderRadius: "0.75rem", background: cfg.bg, display: "flex", alignItems: "center", gap: "0.5rem", border: `1px solid ${cfg.color}20` }}>
        <div style={{ width: 8, height: 8, borderRadius: "50%", background: cfg.color, boxShadow: botStatus !== "idle" ? `0 0 8px ${cfg.color}80` : "none", animation: botStatus !== "idle" ? "pulse 1.5s infinite" : "none" }} />
        <span style={{ fontSize: "0.8rem", fontWeight: 500, color: cfg.color }}>{cfg.label}</span>
      </div>

      {/* Thinking animation */}
      <AnimatePresence>
        {botStatus === "thinking" && (
          <motion.div initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -5 }}
            style={{ margin: "0.75rem 1rem 0", padding: "0.75rem", borderRadius: "0.75rem", background: "rgba(20,28,46,0.8)", border: "1px solid rgba(0,212,255,0.15)", display: "flex", alignItems: "center", gap: "0.75rem" }}>
            <div style={{ display: "flex", gap: 3 }}>
              {[0, 1, 2].map((i) => (
                <div key={i} style={{ width: 4, height: 16, background: "#00D4FF", borderRadius: 2, animation: `waveform 1.2s ease-in-out infinite ${i * 0.15}s` }} />
              ))}
            </div>
            <span style={{ fontSize: "0.72rem", color: "#5A6A8A" }}>Running RAG pipeline...</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* WhatsApp pending */}
      <AnimatePresence>
        {isWhatsAppPending && (
          <motion.div initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -5 }}
            style={{ margin: "0.75rem 1rem 0", padding: "0.75rem", borderRadius: "0.75rem", background: "rgba(255,140,66,0.06)", border: "1px solid rgba(255,140,66,0.2)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.25rem" }}>
              <PhoneCall size={13} color="#FF8C42" />
              <span style={{ fontSize: "0.72rem", fontWeight: 600, color: "#FF8C42" }}>Waiting for WhatsApp reply</span>
            </div>
            <p style={{ fontSize: "0.65rem", color: "#5A6A8A" }}>Message sent to your phone. Reply to continue.</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Last response */}
      {lastBotResponse && (
        <div style={{ margin: "0.75rem 1rem 0", padding: "0.75rem", borderRadius: "0.75rem", background: "rgba(20,28,46,0.8)", border: "1px solid rgba(30,45,69,0.6)" }}>
          <p style={{ fontSize: "0.65rem", color: "#5A6A8A", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.375rem" }}>Last Response</p>
          <p style={{ fontSize: "0.78rem", color: "#E8F0FE", lineHeight: 1.5, fontStyle: "italic" }}>"{lastBotResponse}"</p>
        </div>
      )}

      {/* Event log */}
      <div style={{ flex: 1, overflowY: "auto", padding: "0.875rem 1rem" }}>
        <p style={{ fontSize: "0.65rem", color: "#5A6A8A", fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "0.625rem" }}>Event Log</p>
        {botEvents.length === 0 && (
          <p style={{ color: "#5A6A8A", fontSize: "0.72rem", textAlign: "center", padding: "2rem 0", opacity: 0.6 }}>No events yet. Bot is monitoring.</p>
        )}
        <div style={{ display: "flex", flexDirection: "column", gap: "0.375rem" }}>
          <AnimatePresence initial={false}>
            {[...botEvents].reverse().map((ev, i) => (
              <motion.div key={i} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
                style={{ display: "flex", gap: "0.5rem", background: "rgba(20,28,46,0.6)", borderRadius: "0.5rem", padding: "0.4rem 0.5rem", fontSize: "0.72rem", border: "1px solid rgba(30,45,69,0.3)" }}>
                <span style={{ flexShrink: 0, fontSize: "0.8rem" }}>{EVENT_ICONS[ev.type] || "📌"}</span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ color: "#E8F0FE", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{ev.text || ev.type}</p>
                  <p style={{ color: "#3A4A6A", marginTop: 2, fontSize: "0.6rem" }}>{new Date(ev.timestamp).toLocaleTimeString()}</p>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );
}