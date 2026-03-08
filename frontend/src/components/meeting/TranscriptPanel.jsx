import { useRef, useEffect } from "react";
import { motion } from "framer-motion";
import { useMeetingStore } from "../../store/meeting.store";

export default function TranscriptPanel() {
  const { transcript } = useMeetingStore();
  const bottomRef = useRef(null);

  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [transcript]);

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", background: "rgba(17,24,39,0.5)" }}>

      <div style={{ padding: "0.875rem 1rem", borderBottom: "1px solid rgba(30,45,69,0.6)", background: "rgba(10,14,26,0.5)" }}>
        <h3 style={{ fontFamily: "Syne, sans-serif", fontWeight: 600, fontSize: "0.85rem", color: "#E8F0FE", display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#00D4FF" }} />
          Live Transcript
        </h3>
        <p style={{ fontSize: "0.65rem", color: "#5A6A8A", marginTop: "0.15rem" }}>Powered by Deepgram Nova-2</p>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "0.875rem 1rem", display: "flex", flexDirection: "column", gap: "0.625rem" }}>
        {transcript.length === 0 && (
          <p style={{ color: "#5A6A8A", fontSize: "0.72rem", textAlign: "center", padding: "2rem 0", opacity: 0.6 }}>
            Transcript will appear here once people start speaking.
          </p>
        )}
        {transcript.map((line, i) => (
          <motion.div key={i} initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }}
            style={{ fontSize: "0.8rem", opacity: line.isFinal ? 1 : 0.45, padding: "0.375rem 0.5rem", borderRadius: "0.5rem", background: line.isFinal ? "rgba(20,28,46,0.4)" : "transparent", transition: "all 0.3s" }}>
            <span style={{ fontWeight: 600, fontSize: "0.65rem", color: line.speaker === "BOT" ? "#00D4FF" : "#7B61FF", display: "inline-flex", alignItems: "center", gap: "0.25rem" }}>
              {line.speaker === "BOT" ? "🤖" : ""} {line.speaker === "BOT" ? "Bot" : line.speaker}
            </span>
            <p style={{ color: "#E8F0FE", lineHeight: 1.5, marginTop: "0.125rem" }}>{line.text}</p>
          </motion.div>
        ))}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}