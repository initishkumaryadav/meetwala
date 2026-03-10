import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, LogOut, Video, Bot, Users, Copy, Send, ArrowRight, Calendar, CheckCircle2, Activity, X, Download, Zap, Clock, Share2, Link, ExternalLink } from "lucide-react";
import { meetingApi, proxyApi } from "../../services/api";
import { useAuthStore } from "../../store/auth.store";
import { useResponsive } from "../../hooks/useMediaQuery";
import ThemedCalendar from "../shared/ThemedCalendar";
import toast from "react-hot-toast";

export default function Dashboard() {
  const navigate = useNavigate();
  const qc       = useQueryClient();
  const { user, logout } = useAuthStore();
  const [showCreate, setShowCreate]     = useState(false);
  const [showJoin, setShowJoin]         = useState(false);
  const [showSendBot, setShowSendBot]   = useState(false);
  const [form, setForm]                 = useState({ title: "", scheduledAt: "" });
  const [joinCode, setJoinCode]         = useState("");
  const [selectedMeeting, setSelectedMeeting] = useState(null);
  const [botName, setBotName]           = useState("");
  const [meetingMode, setMeetingMode]   = useState("instant"); // "instant" | "schedule"
  const [createdMeeting, setCreatedMeeting] = useState(null); // holds created meeting for share view
  const { isMobile, isTablet } = useResponsive();

  const { data: meetings = [] } = useQuery({
    queryKey: ["meetings"],
    queryFn:  () => meetingApi.list().then((r) => r.data.meetings),
  });

  const { data: proxySessions = [] } = useQuery({
    queryKey: ["proxy-sessions"],
    queryFn:  () => proxyApi.listMine().then((r) => r.data.sessions),
  });

  const createMeeting = useMutation({
    mutationFn: () => meetingApi.create(meetingMode === "instant" ? { title: form.title } : form),
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ["meetings"] });
      if (meetingMode === "instant") {
        setShowCreate(false);
        setForm({ title: "", scheduledAt: "" });
        toast.success("Meeting created!");
        navigate(`/meeting/${r.data.meeting.roomCode}`);
      } else {
        setForm({ title: "", scheduledAt: "" });
        setCreatedMeeting(r.data.meeting);
        toast.success("Meeting scheduled!");
      }
    },
    onError: () => toast.error("Failed to create meeting"),
  });

  const joinMeeting = useMutation({
    mutationFn: () => meetingApi.join(joinCode.trim()),
    onSuccess: () => {
      setShowJoin(false);
      navigate(`/meeting/${joinCode.trim()}`);
    },
    onError: (err) => toast.error(err.response?.data?.error || "Meeting not found"),
  });

  const createProxy = useMutation({
    mutationFn: () => proxyApi.create({ meetingId: selectedMeeting.id, botName: botName || undefined }),
    onSuccess: (r) => {
      qc.invalidateQueries({ queryKey: ["proxy-sessions"] });
      setShowSendBot(false);
      setBotName("");
      setSelectedMeeting(null);
      toast.success("Proxy session created! Complete the briefing to activate.");
      navigate(`/brief/${r.data.session.id}`);
    },
    onError: () => toast.error("Failed to create proxy session"),
  });

  const activateBot = useMutation({
    mutationFn: (id) => proxyApi.activate(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["proxy-sessions"] });
      toast.success("Bot sent to meeting!");
    },
    onError: (err) => toast.error(err.response?.data?.error || "Failed to activate bot"),
  });

  const deactivateBot = useMutation({
    mutationFn: (id) => proxyApi.deactivate(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["proxy-sessions"] });
      toast.success("Bot removed from meeting");
    },
    onError: () => toast.error("Failed to deactivate bot"),
  });

  const endMeeting = useMutation({
    mutationFn: (id) => meetingApi.end(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["meetings"] });
      toast.success("Meeting ended");
    },
    onError: () => toast.error("Failed to end meeting"),
  });

  const copyRoomCode = (code) => {
    navigator.clipboard.writeText(code);
    toast.success("Room code copied!");
  };

  const statusColors = {
    LIVE:       { bg: "rgba(0,255,148,0.15)",  color: "#00FF94" },
    SCHEDULED:  { bg: "rgba(0,212,255,0.15)",  color: "#00D4FF" },
    ENDED:      { bg: "rgba(90,106,138,0.15)", color: "#5A6A8A" },
    IDLE:       { bg: "rgba(90,106,138,0.15)", color: "#5A6A8A" },
    BRIEFED:    { bg: "rgba(0,212,255,0.15)",  color: "#00D4FF" },
    ACTIVE:     { bg: "rgba(0,255,148,0.15)",  color: "#00FF94" },
    ESCALATING: { bg: "rgba(255,189,0,0.15)",  color: "#FFBD00" },
    COMPLETED:  { bg: "rgba(123,97,255,0.15)", color: "#7B61FF" },
  };

  const activeMeetings = meetings.filter((m) => m.status === "LIVE" || m.status === "SCHEDULED");
  const pastMeetings   = meetings.filter((m) => m.status === "ENDED");

  const statCards = [
    { icon: <Activity size={20} />, label: "Live Meetings",   value: activeMeetings.filter(m => m.status === "LIVE").length, color: "#00FF94", glow: "rgba(0,255,148,0.15)" },
    { icon: <Calendar size={20} />, label: "Scheduled",        value: activeMeetings.filter(m => m.status === "SCHEDULED").length, color: "#00D4FF", glow: "rgba(0,212,255,0.15)" },
    { icon: <Bot size={20} />,      label: "Active Bots",      value: proxySessions.filter(s => s.status === "ACTIVE" || s.status === "ESCALATING").length, color: "#7B61FF", glow: "rgba(123,97,255,0.15)" },
    { icon: <CheckCircle2 size={20} />, label: "Completed", value: pastMeetings.length, color: "#5A6A8A", glow: "rgba(90,106,138,0.1)" },
  ];

  return (
    <div style={{ minHeight: "100vh", background: "#0A0E1A" }}>
      {/* Background */}
      <div style={{ position: "fixed", inset: 0, overflow: "hidden", pointerEvents: "none" }}>
        <div style={{ position: "absolute", top: -100, right: -100, width: 600, height: 600, background: "radial-gradient(ellipse, rgba(0,212,255,0.04), transparent 70%)", borderRadius: "50%" }} />
        <div style={{ position: "absolute", bottom: -100, left: -50, width: 500, height: 500, background: "radial-gradient(ellipse, rgba(123,97,255,0.04), transparent 70%)", borderRadius: "50%" }} />
        <div style={{ position: "absolute", top: "40%", left: "60%", width: 350, height: 350, background: "radial-gradient(ellipse, rgba(0,255,148,0.02), transparent 70%)", borderRadius: "50%" }} />
        <div style={{
          position: "absolute", inset: 0, opacity: 0.02,
          backgroundImage: `linear-gradient(rgba(0,212,255,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(0,212,255,0.3) 1px, transparent 1px)`,
          backgroundSize: "80px 80px",
        }} />
      </div>

      {/* Navbar */}
      <nav style={{ borderBottom: "1px solid rgba(30,45,69,0.6)", padding: isMobile ? "0.625rem 0.75rem" : "0.875rem 1.5rem", display: "flex", alignItems: "center", justifyContent: "space-between", position: "relative", backdropFilter: "blur(12px)", background: "rgba(10,14,26,0.8)", gap: "0.5rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <motion.div
            animate={{ rotate: [0, 5, -5, 0] }}
            transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
            style={{ width: 38, height: 38, background: "linear-gradient(135deg, #00D4FF, #7B61FF)", borderRadius: "0.75rem", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.2rem", boxShadow: "0 0 20px rgba(0,212,255,0.2)" }}
          >🤖</motion.div>
          <span style={{ fontFamily: "Syne, sans-serif", fontWeight: 700, fontSize: isMobile ? "1rem" : "1.3rem" }}>
            <span className="gradient-text">MeetWala</span>
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          {!isMobile && (
            <div className="glass-card-static" style={{ padding: "0.375rem 0.875rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
              {user?.avatarUrl && <img src={user.avatarUrl} style={{ width: 26, height: 26, borderRadius: "50%", border: "2px solid rgba(0,212,255,0.3)" }} alt="" />}
              <span style={{ fontSize: "0.85rem", color: "#E8F0FE", fontWeight: 500 }}>{user?.name}</span>
            </div>
          )}
          {isMobile && user?.avatarUrl && (
            <img src={user.avatarUrl} style={{ width: 28, height: 28, borderRadius: "50%", border: "2px solid rgba(0,212,255,0.3)" }} alt="" />
          )}
          <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={logout} className="btn-secondary" style={{ padding: "0.5rem 0.75rem" }}>
            <LogOut size={16} />
          </motion.button>
        </div>
      </nav>

      <main style={{ maxWidth: 1140, margin: "0 auto", padding: isMobile ? "1.25rem 0.75rem" : isTablet ? "1.75rem 1rem" : "2.5rem 1.5rem", position: "relative" }}>
        {/* Header row */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}
          style={{ display: "flex", flexDirection: isMobile ? "column" : "row", justifyContent: "space-between", alignItems: isMobile ? "stretch" : "flex-end", marginBottom: isMobile ? "1.5rem" : "2.5rem", gap: isMobile ? "1rem" : "0" }}>
          <div>
            <h2 style={{ fontFamily: "Syne, sans-serif", fontSize: isMobile ? "1.4rem" : "2rem", fontWeight: 700, color: "#E8F0FE", lineHeight: 1.2 }}>
              Welcome back, <span className="gradient-text">{user?.name?.split(" ")[0]}</span>
            </h2>
            <p style={{ color: "#5A6A8A", marginTop: "0.375rem", fontSize: "0.9rem" }}>Your AI proxy is ready to represent you.</p>
          </div>
          <div style={{ display: "flex", gap: "0.75rem" }}>
            <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} onClick={() => setShowJoin(true)} className="btn-secondary" style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "0.5rem", flex: isMobile ? 1 : undefined, fontSize: isMobile ? "0.8rem" : undefined, padding: isMobile ? "0.5rem 0.75rem" : undefined }}>
              <Users size={isMobile ? 16 : 18} /> Join Meeting
            </motion.button>
            <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} onClick={() => setShowCreate(true)} className="btn-primary" style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "0.5rem", flex: isMobile ? 1 : undefined, fontSize: isMobile ? "0.8rem" : undefined, padding: isMobile ? "0.5rem 0.75rem" : undefined }}>
              <Plus size={isMobile ? 16 : 18} /> New Meeting
            </motion.button>
          </div>
        </motion.div>

        {/* Stats */}
        <div style={{ display: "grid", gridTemplateColumns: isMobile ? "repeat(2, 1fr)" : isTablet ? "repeat(2, 1fr)" : "repeat(4, 1fr)", gap: isMobile ? "0.625rem" : "1rem", marginBottom: isMobile ? "1.5rem" : "2.5rem" }}>
          {statCards.map((s, i) => (
            <motion.div key={i} initial={{ opacity: 0, y: 25 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.08, duration: 0.5 }}
              className="glass-card shimmer" style={{ padding: isMobile ? "0.875rem" : "1.25rem", position: "relative", overflow: "hidden", cursor: "default" }}>
              <div style={{ position: "absolute", top: -20, right: -20, width: 80, height: 80, borderRadius: "50%", background: s.glow, filter: "blur(20px)" }} />
              <div style={{ display: "flex", alignItems: "center", gap: "0.625rem", marginBottom: "0.75rem", position: "relative" }}>
                <div style={{ width: 36, height: 36, borderRadius: "0.625rem", background: s.glow, display: "flex", alignItems: "center", justifyContent: "center", color: s.color }}>
                  {s.icon}
                </div>
                <span style={{ color: "#5A6A8A", fontSize: "0.8rem", fontWeight: 500 }}>{s.label}</span>
              </div>
              <div style={{ fontFamily: "Syne, sans-serif", fontSize: "2rem", fontWeight: 700, color: s.color, position: "relative" }}>{s.value}</div>
            </motion.div>
          ))}
        </div>

        {/* Two column layout */}
        <div style={{ display: "grid", gridTemplateColumns: isMobile || isTablet ? "1fr" : "1fr 1fr", gap: isMobile ? "1rem" : "1.5rem" }}>

          {/* Meetings */}
          <motion.div initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3, duration: 0.5 }}
            className="glass-card-static" style={{ padding: "1.5rem" }}>
            <h3 style={{ fontFamily: "Syne, sans-serif", fontWeight: 600, color: "#E8F0FE", marginBottom: "1.25rem", display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "1.05rem" }}>
              <div style={{ width: 28, height: 28, borderRadius: "0.5rem", background: "rgba(0,212,255,0.15)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Video size={15} color="#00D4FF" />
              </div>
              My Meetings
              <span style={{ marginLeft: "auto", fontSize: "0.7rem", color: "#5A6A8A", fontWeight: 400, fontFamily: "DM Mono, monospace" }}>{meetings.length} total</span>
            </h3>
            {meetings.length === 0 && (
              <div style={{ textAlign: "center", padding: "3rem 1rem" }}>
                <div style={{ fontSize: "2.5rem", marginBottom: "0.75rem", opacity: 0.4 }}>📹</div>
                <p style={{ color: "#5A6A8A", fontSize: "0.875rem" }}>No meetings yet. Create one!</p>
              </div>
            )}
            <div style={{ display: "flex", flexDirection: "column", gap: "0.625rem", maxHeight: 420, overflowY: "auto" }}>
              {meetings.map((m, idx) => (
                <motion.div key={m.id}
                  initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 + idx * 0.05 }}
                  style={{ background: "rgba(17,24,39,0.6)", borderRadius: "0.75rem", padding: "0.875rem 1rem", transition: "all 0.25s", border: "1px solid transparent", cursor: "default" }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(26,37,64,0.6)"; e.currentTarget.style.borderColor = "rgba(0,212,255,0.1)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(17,24,39,0.6)"; e.currentTarget.style.borderColor = "transparent"; }}
                >
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.625rem" }}>
                    <div>
                      <p style={{ color: "#E8F0FE", fontWeight: 600, fontSize: "0.875rem" }}>{m.title}</p>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginTop: "0.3rem" }}>
                        <span style={{ color: "#5A6A8A", fontSize: "0.7rem", fontFamily: "DM Mono, monospace", background: "rgba(0,0,0,0.2)", padding: "0.1rem 0.4rem", borderRadius: "0.25rem" }}>{m.roomCode}</span>
                        <button onClick={() => copyRoomCode(m.roomCode)} style={{ background: "none", border: "none", cursor: "pointer", color: "#5A6A8A", padding: 0, display: "flex", transition: "color 0.2s" }}
                          onMouseEnter={(e) => e.currentTarget.style.color = "#00D4FF"} onMouseLeave={(e) => e.currentTarget.style.color = "#5A6A8A"}>
                          <Copy size={11} />
                        </button>
                      </div>
                    </div>
                    <span style={{ background: statusColors[m.status]?.bg, color: statusColors[m.status]?.color, padding: "0.2rem 0.6rem", borderRadius: "2rem", fontSize: "0.65rem", fontWeight: 600, letterSpacing: "0.03em" }}>
                      {m.status === "LIVE" && <span style={{ display: "inline-block", width: 5, height: 5, borderRadius: "50%", background: "#00FF94", marginRight: 4, animation: "pulse 1.5s infinite" }} />}
                      {m.status}
                    </span>
                  </div>
                  <div style={{ display: "flex", gap: "0.375rem" }}>
                    {m.status !== "ENDED" && (
                      <>
                        <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} onClick={() => navigate(`/meeting/${m.roomCode}`)}
                          style={{ flex: 1, padding: "0.4rem", borderRadius: "0.5rem", border: "1px solid rgba(0,212,255,0.2)", background: "rgba(0,212,255,0.08)", color: "#00D4FF", fontSize: "0.75rem", fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 4, transition: "all 0.2s" }}>
                          <Video size={13} /> Join
                        </motion.button>
                        <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} onClick={() => { setSelectedMeeting(m); setShowSendBot(true); }}
                          style={{ flex: 1, padding: "0.4rem", borderRadius: "0.5rem", border: "1px solid rgba(123,97,255,0.2)", background: "rgba(123,97,255,0.08)", color: "#7B61FF", fontSize: "0.75rem", fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 4, transition: "all 0.2s" }}>
                          <Bot size={13} /> Send Bot
                        </motion.button>
                        {m.status === "LIVE" && (
                          <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} onClick={() => endMeeting.mutate(m.id)}
                            style={{ padding: "0.4rem 0.625rem", borderRadius: "0.5rem", border: "1px solid rgba(239,68,68,0.2)", background: "rgba(239,68,68,0.08)", color: "#ef4444", fontSize: "0.75rem", fontWeight: 600, cursor: "pointer", transition: "all 0.2s" }}>
                            End
                          </motion.button>
                        )}
                      </>
                    )}
                    {m.status === "ENDED" && (
                      <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                        onClick={async () => {
                          try {
                            toast.loading("Generating PDF...", { id: "pdf-" + m.roomCode });
                            const resp = await meetingApi.downloadSummaryPdf(m.roomCode);
                            const url = window.URL.createObjectURL(new Blob([resp.data], { type: "application/pdf" }));
                            const a = document.createElement("a");
                            a.href = url;
                            a.download = `MeetWala-${m.roomCode}-Summary.pdf`;
                            document.body.appendChild(a);
                            a.click();
                            a.remove();
                            window.URL.revokeObjectURL(url);
                            toast.success("PDF downloaded!", { id: "pdf-" + m.roomCode });
                          } catch {
                            toast.error("Failed to generate PDF", { id: "pdf-" + m.roomCode });
                          }
                        }}
                        style={{ flex: 1, padding: "0.4rem", borderRadius: "0.5rem", border: "1px solid rgba(123,97,255,0.2)", background: "rgba(123,97,255,0.08)", color: "#7B61FF", fontSize: "0.75rem", fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 4, transition: "all 0.2s" }}>
                        <Download size={13} /> Download Summary
                      </motion.button>
                    )}
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>

          {/* Proxy Sessions */}
          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.3, duration: 0.5 }}
            className="glass-card-static" style={{ padding: "1.5rem" }}>
            <h3 style={{ fontFamily: "Syne, sans-serif", fontWeight: 600, color: "#E8F0FE", marginBottom: "1.25rem", display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "1.05rem" }}>
              <div style={{ width: 28, height: 28, borderRadius: "0.5rem", background: "rgba(123,97,255,0.15)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Bot size={15} color="#7B61FF" />
              </div>
              AI Bot Sessions
              <span style={{ marginLeft: "auto", fontSize: "0.7rem", color: "#5A6A8A", fontWeight: 400, fontFamily: "DM Mono, monospace" }}>{proxySessions.length} total</span>
            </h3>
            {proxySessions.length === 0 && (
              <div style={{ textAlign: "center", padding: "3rem 1rem" }}>
                <div style={{ fontSize: "2.5rem", marginBottom: "0.75rem", opacity: 0.4 }}>🤖</div>
                <p style={{ color: "#5A6A8A", fontSize: "0.875rem" }}>No bot sessions yet. Send a bot to a meeting!</p>
              </div>
            )}
            <div style={{ display: "flex", flexDirection: "column", gap: "0.625rem", maxHeight: 420, overflowY: "auto" }}>
              {proxySessions.map((s, idx) => (
                <motion.div key={s.id}
                  initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.35 + idx * 0.05 }}
                  style={{ background: "rgba(17,24,39,0.6)", borderRadius: "0.75rem", padding: "0.875rem 1rem", transition: "all 0.25s", border: "1px solid transparent" }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(26,37,64,0.6)"; e.currentTarget.style.borderColor = "rgba(123,97,255,0.1)"; }}
                  onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(17,24,39,0.6)"; e.currentTarget.style.borderColor = "transparent"; }}
                >
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.625rem" }}>
                    <div>
                      <p style={{ color: "#E8F0FE", fontWeight: 600, fontSize: "0.875rem" }}>🤖 {s.botName}</p>
                      <p style={{ color: "#5A6A8A", fontSize: "0.7rem", marginTop: "0.15rem" }}>{s.meeting?.title}</p>
                    </div>
                    <span style={{ background: statusColors[s.status]?.bg, color: statusColors[s.status]?.color, padding: "0.2rem 0.6rem", borderRadius: "2rem", fontSize: "0.65rem", fontWeight: 600, letterSpacing: "0.03em" }}>
                      {(s.status === "ACTIVE" || s.status === "ESCALATING") && <span style={{ display: "inline-block", width: 5, height: 5, borderRadius: "50%", background: statusColors[s.status]?.color, marginRight: 4, animation: "pulse 1.5s infinite" }} />}
                      {s.status}
                    </span>
                  </div>
                  <div style={{ display: "flex", gap: "0.375rem" }}>
                    {s.status === "IDLE" && (
                      <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} onClick={() => navigate(`/brief/${s.id}`)}
                        style={{ flex: 1, padding: "0.4rem", borderRadius: "0.5rem", border: "1px solid rgba(0,212,255,0.2)", background: "rgba(0,212,255,0.08)", color: "#00D4FF", fontSize: "0.75rem", fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 4, transition: "all 0.2s" }}>
                        <ArrowRight size={13} /> Complete Briefing
                      </motion.button>
                    )}
                    {s.status === "BRIEFED" && (
                      <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} onClick={() => activateBot.mutate(s.id)} disabled={activateBot.isPending}
                        style={{ flex: 1, padding: "0.4rem", borderRadius: "0.5rem", border: "1px solid rgba(0,255,148,0.2)", background: "rgba(0,255,148,0.08)", color: "#00FF94", fontSize: "0.75rem", fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 4, transition: "all 0.2s" }}>
                        <Send size={13} /> {activateBot.isPending ? "Sending..." : "Send Bot to Meeting"}
                      </motion.button>
                    )}
                    {(s.status === "ACTIVE" || s.status === "ESCALATING") && (
                      <>
                        <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} onClick={() => navigate(`/meeting/${s.meeting?.roomCode}`)}
                          style={{ flex: 1, padding: "0.4rem", borderRadius: "0.5rem", border: "1px solid rgba(0,212,255,0.2)", background: "rgba(0,212,255,0.08)", color: "#00D4FF", fontSize: "0.75rem", fontWeight: 600, cursor: "pointer", transition: "all 0.2s" }}>
                          Watch Meeting
                        </motion.button>
                        <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} onClick={() => deactivateBot.mutate(s.id)} disabled={deactivateBot.isPending}
                          style={{ padding: "0.4rem 0.625rem", borderRadius: "0.5rem", border: "1px solid rgba(239,68,68,0.2)", background: "rgba(239,68,68,0.08)", color: "#ef4444", fontSize: "0.75rem", fontWeight: 600, cursor: "pointer", transition: "all 0.2s" }}>
                          Recall Bot
                        </motion.button>
                      </>
                    )}
                    {s.status === "COMPLETED" && (
                      <span style={{ color: "#5A6A8A", fontSize: "0.75rem", padding: "0.375rem", display: "flex", alignItems: "center", gap: 4 }}>
                        <CheckCircle2 size={12} /> Session completed
                      </span>
                    )}
                  </div>
                </motion.div>
              ))}
            </div>
          </motion.div>
        </div>
      </main>

      {/* Create Meeting Modal */}
      <AnimatePresence>
        {showCreate && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.65)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, padding: "1rem" }}
            onClick={(e) => e.target === e.currentTarget && !createdMeeting && (setShowCreate(false), setMeetingMode("instant"), setCreatedMeeting(null))}>
            <motion.div initial={{ opacity: 0, scale: 0.92, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.92, y: 20 }} transition={{ type: "spring", damping: 25, stiffness: 300 }}
              style={{ padding: "2rem", width: "100%", maxWidth: 460, background: "rgba(15,20,35,0.95)", border: "1px solid rgba(30,45,69,0.6)", borderRadius: "1.25rem", position: "relative", overflow: "hidden", maxHeight: "90vh", overflowY: "auto" }}>
              <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: "linear-gradient(90deg, #00D4FF, #7B61FF, #00D4FF)", backgroundSize: "200% 100%", animation: "gradient-shift 3s linear infinite" }} />

              {/* ─── Share Link View (after scheduling) ─── */}
              {createdMeeting ? (
                <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <h3 style={{ fontFamily: "Syne, sans-serif", fontWeight: 700, fontSize: "1.2rem", color: "#E8F0FE" }}>Meeting Scheduled!</h3>
                    <button onClick={() => { setShowCreate(false); setCreatedMeeting(null); setMeetingMode("instant"); }} style={{ background: "none", border: "none", cursor: "pointer", color: "#5A6A8A", padding: 4, display: "flex", transition: "color 0.2s" }}
                      onMouseEnter={(e) => e.currentTarget.style.color = "#E8F0FE"} onMouseLeave={(e) => e.currentTarget.style.color = "#5A6A8A"}>
                      <X size={18} />
                    </button>
                  </div>

                  <div style={{ textAlign: "center", padding: "1rem 0" }}>
                    <div style={{ width: 56, height: 56, borderRadius: "50%", background: "linear-gradient(135deg, rgba(0,212,255,0.15), rgba(123,97,255,0.15))", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 0.75rem" }}>
                      <CheckCircle2 size={28} style={{ color: "#00FF94" }} />
                    </div>
                    <p style={{ color: "#E8F0FE", fontWeight: 600, fontSize: "1rem" }}>{createdMeeting.title}</p>
                    {createdMeeting.scheduledAt && (
                      <p style={{ color: "#5A6A8A", fontSize: "0.8rem", marginTop: "0.25rem" }}>
                        {new Date(createdMeeting.scheduledAt).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}
                      </p>
                    )}
                  </div>

                  {/* Meeting Link */}
                  <div>
                    <label style={{ display: "block", fontSize: "0.7rem", color: "#5A6A8A", marginBottom: "0.375rem", fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.05em" }}>Meeting Link</label>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                      <div style={{ flex: 1, padding: "0.625rem 0.75rem", background: "rgba(10,14,26,0.8)", border: "1px solid rgba(30,45,69,0.6)", borderRadius: "0.625rem", color: "#E8F0FE", fontSize: "0.8rem", fontFamily: "DM Mono, monospace", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {`${window.location.origin}/meeting/${createdMeeting.roomCode}`}
                      </div>
                      <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                        onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/meeting/${createdMeeting.roomCode}`); toast.success("Link copied!"); }}
                        style={{ padding: "0.625rem", background: "rgba(0,212,255,0.1)", border: "1px solid rgba(0,212,255,0.25)", borderRadius: "0.625rem", color: "#00D4FF", cursor: "pointer", display: "flex", transition: "all 0.2s" }}
                        onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(0,212,255,0.2)"; }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(0,212,255,0.1)"; }}>
                        <Copy size={16} />
                      </motion.button>
                    </div>
                  </div>

                  {/* Room Code */}
                  <div>
                    <label style={{ display: "block", fontSize: "0.7rem", color: "#5A6A8A", marginBottom: "0.375rem", fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.05em" }}>Room Code</label>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                      <div style={{ flex: 1, padding: "0.625rem 0.75rem", background: "rgba(10,14,26,0.8)", border: "1px solid rgba(30,45,69,0.6)", borderRadius: "0.625rem", color: "#00D4FF", fontSize: "1rem", fontFamily: "DM Mono, monospace", fontWeight: 600, letterSpacing: "0.1em" }}>
                        {createdMeeting.roomCode}
                      </div>
                      <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
                        onClick={() => { navigator.clipboard.writeText(createdMeeting.roomCode); toast.success("Room code copied!"); }}
                        style={{ padding: "0.625rem", background: "rgba(123,97,255,0.1)", border: "1px solid rgba(123,97,255,0.25)", borderRadius: "0.625rem", color: "#7B61FF", cursor: "pointer", display: "flex", transition: "all 0.2s" }}
                        onMouseEnter={(e) => { e.currentTarget.style.background = "rgba(123,97,255,0.2)"; }}
                        onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(123,97,255,0.1)"; }}>
                        <Copy size={16} />
                      </motion.button>
                    </div>
                  </div>

                  {/* Share + Join buttons */}
                  <div style={{ display: "flex", gap: "0.75rem", paddingTop: "0.25rem" }}>
                    {navigator.share && (
                      <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                        onClick={() => navigator.share({ title: createdMeeting.title, text: `Join my meeting: ${createdMeeting.title}`, url: `${window.location.origin}/meeting/${createdMeeting.roomCode}` }).catch(() => {})}
                        className="btn-secondary" style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: "0.5rem" }}>
                        <Share2 size={16} /> Share
                      </motion.button>
                    )}
                    <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                      onClick={() => { setShowCreate(false); setCreatedMeeting(null); setMeetingMode("instant"); navigate(`/meeting/${createdMeeting.roomCode}`); }}
                      className="btn-primary" style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: "0.5rem" }}>
                      <ExternalLink size={16} /> Join Now
                    </motion.button>
                  </div>
                  <button onClick={() => { setShowCreate(false); setCreatedMeeting(null); setMeetingMode("instant"); }}
                    style={{ background: "none", border: "none", cursor: "pointer", color: "#5A6A8A", fontSize: "0.8rem", textAlign: "center", padding: "0.25rem", transition: "color 0.2s" }}
                    onMouseEnter={(e) => e.currentTarget.style.color = "#E8F0FE"} onMouseLeave={(e) => e.currentTarget.style.color = "#5A6A8A"}>
                    Back to Dashboard
                  </button>
                </div>

              ) : (
              /* ─── Create Form ─── */
              <>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1.5rem" }}>
                <h3 style={{ fontFamily: "Syne, sans-serif", fontWeight: 700, fontSize: "1.2rem", color: "#E8F0FE" }}>New Meeting</h3>
                <button onClick={() => { setShowCreate(false); setMeetingMode("instant"); }} style={{ background: "none", border: "none", cursor: "pointer", color: "#5A6A8A", padding: 4, display: "flex", transition: "color 0.2s" }}
                  onMouseEnter={(e) => e.currentTarget.style.color = "#E8F0FE"} onMouseLeave={(e) => e.currentTarget.style.color = "#5A6A8A"}>
                  <X size={18} />
                </button>
              </div>

              {/* Mode Toggle */}
              <div style={{ display: "flex", background: "rgba(10,14,26,0.8)", borderRadius: "0.75rem", padding: "0.25rem", marginBottom: "1.25rem", border: "1px solid rgba(30,45,69,0.4)" }}>
                {[{ key: "instant", icon: <Zap size={14} />, label: "Start Now" }, { key: "schedule", icon: <Clock size={14} />, label: "Schedule" }].map((m) => (
                  <motion.button key={m.key} whileTap={{ scale: 0.97 }}
                    onClick={() => { setMeetingMode(m.key); if (m.key === "instant") setForm((f) => ({ ...f, scheduledAt: "" })); }}
                    style={{
                      flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: "0.375rem",
                      padding: "0.5rem 0.75rem", borderRadius: "0.5rem", border: "none", cursor: "pointer",
                      fontSize: "0.8rem", fontWeight: 600, transition: "all 0.25s",
                      background: meetingMode === m.key ? "linear-gradient(135deg, rgba(0,212,255,0.15), rgba(123,97,255,0.15))" : "transparent",
                      color: meetingMode === m.key ? "#E8F0FE" : "#5A6A8A",
                      boxShadow: meetingMode === m.key ? "0 0 12px rgba(0,212,255,0.1)" : "none",
                    }}>
                    {m.icon} {m.label}
                  </motion.button>
                ))}
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                <input className="input-field" placeholder="Meeting title" value={form.title}
                  onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />

                {/* Calendar (schedule mode only) */}
                <AnimatePresence mode="wait">
                  {meetingMode === "schedule" && (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.25 }}>
                      <label style={{ display: "block", fontSize: "0.75rem", color: "#5A6A8A", marginBottom: "0.375rem", fontWeight: 500 }}>Pick date & time</label>
                      <ThemedCalendar value={form.scheduledAt} onChange={(val) => setForm((f) => ({ ...f, scheduledAt: val }))} />
                    </motion.div>
                  )}
                </AnimatePresence>

                <div style={{ display: "flex", gap: "0.75rem", paddingTop: "0.5rem" }}>
                  <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={() => { setShowCreate(false); setMeetingMode("instant"); }} className="btn-secondary" style={{ flex: 1 }}>Cancel</motion.button>
                  <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                    onClick={() => createMeeting.mutate()}
                    disabled={!form.title || createMeeting.isPending || (meetingMode === "schedule" && !form.scheduledAt)}
                    className="btn-primary" style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: "0.375rem" }}>
                    {createMeeting.isPending ? "Creating..." : meetingMode === "instant" ? (<><Zap size={15} /> Start Now</>) : (<><Calendar size={15} /> Schedule</>)}
                  </motion.button>
                </div>
              </div>
              </>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Join Meeting Modal */}
      <AnimatePresence>
        {showJoin && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.65)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, padding: "1rem" }}
            onClick={(e) => e.target === e.currentTarget && setShowJoin(false)}>
            <motion.div initial={{ opacity: 0, scale: 0.92, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.92, y: 20 }} transition={{ type: "spring", damping: 25, stiffness: 300 }}
              style={{ padding: "2rem", width: "100%", maxWidth: 420, background: "rgba(15,20,35,0.95)", border: "1px solid rgba(30,45,69,0.6)", borderRadius: "1.25rem", position: "relative", overflow: "hidden" }}>
              <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: "linear-gradient(90deg, #00D4FF, #7B61FF, #00D4FF)", backgroundSize: "200% 100%", animation: "gradient-shift 3s linear infinite" }} />
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.5rem" }}>
                <h3 style={{ fontFamily: "Syne, sans-serif", fontWeight: 700, fontSize: "1.2rem", color: "#E8F0FE" }}>Join Meeting</h3>
                <button onClick={() => setShowJoin(false)} style={{ background: "none", border: "none", cursor: "pointer", color: "#5A6A8A", padding: 4, display: "flex", transition: "color 0.2s" }}
                  onMouseEnter={(e) => e.currentTarget.style.color = "#E8F0FE"} onMouseLeave={(e) => e.currentTarget.style.color = "#5A6A8A"}>
                  <X size={18} />
                </button>
              </div>
              <p style={{ color: "#5A6A8A", fontSize: "0.85rem", marginBottom: "1.5rem" }}>Enter the room code shared with you</p>
              <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                <input className="input-field" placeholder="e.g. mw-abc12345" value={joinCode}
                  onChange={(e) => setJoinCode(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && joinCode.trim() && joinMeeting.mutate()} />
                <div style={{ display: "flex", gap: "0.75rem", paddingTop: "0.5rem" }}>
                  <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={() => setShowJoin(false)} className="btn-secondary" style={{ flex: 1 }}>Cancel</motion.button>
                  <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={() => joinMeeting.mutate()} disabled={!joinCode.trim() || joinMeeting.isPending}
                    className="btn-primary" style={{ flex: 1 }}>
                    {joinMeeting.isPending ? "Joining..." : "Join"}
                  </motion.button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Send Bot Modal */}
      <AnimatePresence>
        {showSendBot && selectedMeeting && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.65)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, padding: "1rem" }}
            onClick={(e) => e.target === e.currentTarget && setShowSendBot(false)}>
            <motion.div initial={{ opacity: 0, scale: 0.92, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.92, y: 20 }} transition={{ type: "spring", damping: 25, stiffness: 300 }}
              style={{ padding: "2rem", width: "100%", maxWidth: 420, background: "rgba(15,20,35,0.95)", border: "1px solid rgba(30,45,69,0.6)", borderRadius: "1.25rem", position: "relative", overflow: "hidden" }}>
              <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: "linear-gradient(90deg, #7B61FF, #00FF94, #7B61FF)", backgroundSize: "200% 100%", animation: "gradient-shift 3s linear infinite" }} />
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.5rem" }}>
                <h3 style={{ fontFamily: "Syne, sans-serif", fontWeight: 700, fontSize: "1.2rem", color: "#E8F0FE" }}>Send AI Bot</h3>
                <button onClick={() => { setShowSendBot(false); setSelectedMeeting(null); }} style={{ background: "none", border: "none", cursor: "pointer", color: "#5A6A8A", padding: 4, display: "flex", transition: "color 0.2s" }}
                  onMouseEnter={(e) => e.currentTarget.style.color = "#E8F0FE"} onMouseLeave={(e) => e.currentTarget.style.color = "#5A6A8A"}>
                  <X size={18} />
                </button>
              </div>
              <p style={{ color: "#5A6A8A", fontSize: "0.85rem", marginBottom: "1.5rem" }}>
                Send your AI proxy to <strong style={{ color: "#E8F0FE" }}>{selectedMeeting.title}</strong>. You'll brief the bot on what to say.
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                <input className="input-field" placeholder={`${user?.name}'s Bot`} value={botName}
                  onChange={(e) => setBotName(e.target.value)} />
                <div style={{ display: "flex", gap: "0.75rem", paddingTop: "0.5rem" }}>
                  <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={() => { setShowSendBot(false); setSelectedMeeting(null); }} className="btn-secondary" style={{ flex: 1 }}>Cancel</motion.button>
                  <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={() => createProxy.mutate()} disabled={createProxy.isPending}
                    className="btn-primary" style={{ flex: 1 }}>
                    {createProxy.isPending ? "Creating..." : "Continue to Briefing"}
                  </motion.button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}