import { useEffect, useRef, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  Mic, MicOff, Video, VideoOff, PhoneOff, MessageSquare, Copy,
  Send, Monitor, MonitorOff, Hand, Users, Smile, MoreVertical, Info,
  Pin, PinOff, Maximize2, Minimize2, Clock, Shield, ChevronDown,
  X, Layout, Grid3X3,
} from "lucide-react";
import { meetingApi } from "../../services/api";
import {
  connectSocket, disconnectSocket, joinRoom, leaveRoom,
  sendAudioChunk, sendChatMessage, getSocket,
} from "../../services/socket";
import { useMeetingStore } from "../../store/meeting.store";
import { useAuthStore } from "../../store/auth.store";
import { useResponsive } from "../../hooks/useMediaQuery";
import ParticipantTile from "./ParticipantTile";
import toast from "react-hot-toast";

// Module-level ref to persist stream across React StrictMode double-mounts
let _sharedStream = null;

const REACTIONS = [
  { emoji: "👍", label: "Like" },
  { emoji: "❤️", label: "Love" },
  { emoji: "😂", label: "Haha" },
  { emoji: "😮", label: "Wow" },
  { emoji: "👏", label: "Clap" },
  { emoji: "🎉", label: "Celebrate" },
];

export default function MeetingRoom() {
  const { roomCode } = useParams();
  const navigate = useNavigate();
  const { user } = useAuthStore();
  const participants = useMeetingStore((s) => s.participants);
  const localStream = useMeetingStore((s) => s.localStream);
  const messages = useMeetingStore((s) => s.messages);
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [panel, setPanel] = useState(null);
  const [chatMsg, setChatMsg] = useState("");
  const [showReactions, setShowReactions] = useState(false);
  const [floatingReactions, setFloatingReactions] = useState([]);
  const [handRaised, setHandRaised] = useState(false);
  const [isScreenSharing, setIsScreenSharing] = useState(false);
  const [screenStream, setScreenStream] = useState(null);
  const [pinnedParticipant, setPinnedParticipant] = useState(null);
  const [layoutMode, setLayoutMode] = useState("auto");
  const [showMeetingInfo, setShowMeetingInfo] = useState(false);
  const [showMoreMenu, setShowMoreMenu] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [joinTime] = useState(() => Date.now());
  const localVideoRef = useRef(null);
  const recorderRef = useRef(null);
  const chatEndRef = useRef(null);
  const reactionIdRef = useRef(0);
  const { isMobile, isTablet } = useResponsive();

  const { data: meeting } = useQuery({
    queryKey: ["meeting", roomCode],
    queryFn: () => meetingApi.get(roomCode).then((r) => r.data.meeting),
    enabled: !!roomCode,
  });

  // Meeting timer
  useEffect(() => {
    const t0 = joinTime;
    const interval = setInterval(() => setElapsed(Math.floor((Date.now() - t0) / 1000)), 1000);
    return () => clearInterval(interval);
  }, [joinTime]);

  const formatTime = (s) => {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
    return `${m}:${String(sec).padStart(2, "0")}`;
  };

  // Callback ref to ensure muted attribute is set via DOM (React muted bug workaround)
  const setVideoRef = (el) => {
    localVideoRef.current = el;
    if (el) {
      el.muted = true;
      const stream = useMeetingStore.getState().localStream;
      if (stream && el.srcObject !== stream) {
        el.srcObject = stream;
        el.play().catch(() => {});
      }
    }
  };

  useEffect(() => {
    if (!roomCode) return;
    let cancelled = false;

    useMeetingStore.getState().setRoomCode(roomCode);
    connectSocket();

    const setupMedia = async () => {
      try {
        let stream;
        // Reuse the existing stream if it's still active (StrictMode re-mount)
        if (_sharedStream && _sharedStream.active) {
          stream = _sharedStream;
        } else {
          stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        }

        if (cancelled) {
          // Only stop if this is a fresh stream (not the shared one)
          if (stream !== _sharedStream) {
            stream.getTracks().forEach((t) => t.stop());
          }
          return;
        }

        _sharedStream = stream;
        useMeetingStore.getState().setLocalStream(stream);

        // Assign to video element
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
          localVideoRef.current.muted = true;
          localVideoRef.current.play().catch(() => {});
        }

        startAudioStreaming(stream);
        joinRoom(roomCode);
      } catch (err) {
        if (cancelled) return;
        console.error("Media error:", err);
        toast.error("Camera/mic access denied – " + err.message);
        joinRoom(roomCode);
      }
    };

    setupMedia();

    return () => {
      cancelled = true;
      leaveRoom(roomCode);
      disconnectSocket();
      recorderRef.current?.stop();
      recorderRef.current = null;
      // Don't stop _sharedStream tracks here — StrictMode will re-mount and reuse them
      // Tracks are stopped explicitly in handleLeave or when roomCode changes
      const store = useMeetingStore.getState();
      Object.values(store.peerConnections).forEach((pc) => pc.close());
      useMeetingStore.setState({
        roomCode: null, participants: [], transcript: [], botStatus: "idle",
        botEvents: [], lastBotResponse: null, isWhatsAppPending: false,
        localStream: null, remoteStreams: {}, peerConnections: {}, messages: [],
      });
    };
  }, [roomCode]);

  // Backup: attach stream to video whenever localStream changes in the store
  useEffect(() => {
    if (localVideoRef.current && localStream) {
      localVideoRef.current.srcObject = localStream;
      localVideoRef.current.muted = true;
      localVideoRef.current.play().catch(() => {});
    }
  }, [localStream]);

  // Auto-scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  function startAudioStreaming(stream) {
    try {
      const audioTracks = stream.getAudioTracks();
      if (!audioTracks.length) return;
      const audioStream = new MediaStream(audioTracks);
      // Pick a supported mimeType
      const mimeType = MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : MediaRecorder.isTypeSupported("audio/webm")
          ? "audio/webm"
          : "";
      const recorder = mimeType
        ? new MediaRecorder(audioStream, { mimeType })
        : new MediaRecorder(audioStream);
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) e.data.arrayBuffer().then((buf) => sendAudioChunk(roomCode, buf));
      };
      recorder.start(250);
      recorderRef.current = recorder;
    } catch (err) {
      console.error("MediaRecorder init failed:", err);
    }
  }

  const toggleMic = () => {
    useMeetingStore.getState().localStream?.getAudioTracks().forEach((t) => { t.enabled = !micOn; });
    setMicOn((v) => !v);
  };

  const toggleCam = () => {
    useMeetingStore.getState().localStream?.getVideoTracks().forEach((t) => { t.enabled = !camOn; });
    setCamOn((v) => !v);
  };

  const handleLeave = () => {
    leaveRoom(roomCode);
    disconnectSocket();
    _sharedStream?.getTracks().forEach((t) => t.stop());
    _sharedStream = null;
    screenStream?.getTracks().forEach((t) => t.stop());
    recorderRef.current?.stop();
    useMeetingStore.getState().reset();
    navigate("/");
  };

  const copyRoomCode = () => {
    navigator.clipboard.writeText(roomCode);
    toast.success("Room code copied!");
  };

  const handleSendChat = (e) => {
    if (e?.preventDefault) e.preventDefault();
    if (!chatMsg.trim()) return;
    sendChatMessage(roomCode, chatMsg.trim());
    setChatMsg("");
  };

  // Screen sharing
  const toggleScreenShare = async () => {
    if (isScreenSharing) {
      screenStream?.getTracks().forEach((t) => t.stop());
      setScreenStream(null);
      setIsScreenSharing(false);
      toast("Screen sharing stopped", { icon: "🖥️" });
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getDisplayMedia({ video: true, audio: false });
      setScreenStream(stream);
      setIsScreenSharing(true);
      setPinnedParticipant("screen");
      stream.getVideoTracks()[0].onended = () => {
        setScreenStream(null);
        setIsScreenSharing(false);
        if (pinnedParticipant === "screen") setPinnedParticipant(null);
        toast("Screen sharing stopped", { icon: "🖥️" });
      };
      toast.success("Screen sharing started");
    } catch {
      // user cancelled
    }
  };

  // Reactions
  const sendReaction = useCallback((emoji) => {
    const id = ++reactionIdRef.current;
    setFloatingReactions((prev) => [...prev, { id, emoji, x: 20 + Math.random() * 60 }]);
    setTimeout(() => setFloatingReactions((prev) => prev.filter((r) => r.id !== id)), 3000);
    setShowReactions(false);
    const s = getSocket();
    if (s) s.emit("meeting:reaction", { roomCode, emoji });
  }, [roomCode]);

  // Listen for reactions from others
  useEffect(() => {
    const s = getSocket();
    if (!s) return;
    const handler = (data) => {
      const id = ++reactionIdRef.current;
      setFloatingReactions((prev) => [...prev, { id, emoji: data.emoji, x: 20 + Math.random() * 60 }]);
      setTimeout(() => setFloatingReactions((prev) => prev.filter((r) => r.id !== id)), 3000);
    };
    s.on("meeting:reaction", handler);
    return () => s.off("meeting:reaction", handler);
  }, []);

  const toggleRaiseHand = () => {
    setHandRaised((v) => !v);
    const s = getSocket();
    if (s) s.emit("meeting:hand", { roomCode, raised: !handRaised });
    toast(handRaised ? "Hand lowered" : "Hand raised ✋", { icon: handRaised ? "👋" : "✋" });
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", handler);
    return () => document.removeEventListener("fullscreenchange", handler);
  }, []);

  // Close popups on outside click
  useEffect(() => {
    const handler = () => { setShowReactions(false); setShowMoreMenu(false); setShowMeetingInfo(false); };
    document.addEventListener("click", handler);
    return () => document.removeEventListener("click", handler);
  }, []);

  const socketId = getSocket()?.id;
  const remotePeers = participants.filter((p) => p.socketId !== socketId);
  const totalTiles = 1 + remotePeers.length + (isScreenSharing ? 1 : 0);

  // Layout computation
  const getGridLayout = () => {
    if (pinnedParticipant || isScreenSharing || layoutMode === "spotlight") return "spotlight";
    if (layoutMode === "grid" || totalTiles > 2) return "grid";
    return "auto";
  };
  const layout = getGridLayout();

  const gridCols =
    totalTiles <= 1 ? "1fr" :
    isMobile ? (totalTiles <= 2 ? "1fr" : "repeat(2, 1fr)") :
    totalTiles <= 2 ? "repeat(2, 1fr)" :
    totalTiles <= 4 ? "repeat(2, 1fr)" :
    totalTiles <= 9 ? "repeat(3, 1fr)" :
    "repeat(4, 1fr)";

  const isSolo = totalTiles <= 1 && !isScreenSharing;

  const panelButtons = [
    { id: "chat", icon: <MessageSquare size={18} />, color: "#00FF94", label: "Chat" },
    { id: "participants", icon: <Users size={18} />, color: "#00D4FF", label: "Participants" },
  ];

  return (
    <div style={{ height: "100vh", background: "#0A0E1A", display: "flex", flexDirection: "column", overflow: "hidden", position: "relative" }}>

      {/* Floating reactions */}
      <AnimatePresence>
        {floatingReactions.map((r) => (
          <motion.div key={r.id}
            initial={{ opacity: 1, y: 0, x: `${r.x}%`, scale: 0.5 }}
            animate={{ opacity: 0, y: -400, scale: 1.4 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 2.8, ease: "easeOut" }}
            style={{ position: "fixed", bottom: 100, fontSize: "2.5rem", pointerEvents: "none", zIndex: 100 }}
          >{r.emoji}</motion.div>
        ))}
      </AnimatePresence>

      {/* ── Top bar ── */}
      <header style={{
        height: isMobile ? 48 : 56, padding: isMobile ? "0 0.5rem" : "0 1rem", display: "flex", alignItems: "center", gap: isMobile ? "0.375rem" : "0.75rem",
        background: "rgba(10,14,26,0.85)", backdropFilter: "blur(20px)",
        borderBottom: "1px solid rgba(30,45,69,0.4)", position: "relative", zIndex: 20,
      }}>
        <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 1, background: "linear-gradient(90deg, transparent 5%, rgba(0,212,255,0.15) 30%, rgba(123,97,255,0.15) 70%, transparent 95%)" }} />

        {/* Left — Meeting info */}
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", minWidth: 0, flex: "0 1 auto" }}>
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#00FF94", boxShadow: "0 0 10px rgba(0,255,148,0.6)", animation: "pulse 2s infinite", flexShrink: 0 }} />
          <div style={{ minWidth: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <h1 style={{ fontFamily: "Syne, sans-serif", fontWeight: 700, color: "#E8F0FE", fontSize: isMobile ? "0.8rem" : "0.95rem", margin: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: isMobile ? 100 : undefined }}>
                {meeting?.title || "Meeting Room"}
              </h1>
              <div style={{ position: "relative" }} onClick={(e) => e.stopPropagation()}>
                <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }}
                  onClick={() => setShowMeetingInfo((v) => !v)}
                  style={{ width: 22, height: 22, borderRadius: "50%", border: "none", background: "rgba(90,106,138,0.2)", color: "#5A6A8A", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <ChevronDown size={12} />
                </motion.button>
                <AnimatePresence>
                  {showMeetingInfo && (
                    <motion.div initial={{ opacity: 0, y: -5, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -5, scale: 0.95 }}
                      style={{ position: "absolute", top: "calc(100% + 8px)", left: 0, width: 280, background: "rgba(17,24,39,0.98)", backdropFilter: "blur(20px)", border: "1px solid rgba(30,45,69,0.6)", borderRadius: "0.75rem", padding: "1rem", zIndex: 50, boxShadow: "0 12px 40px rgba(0,0,0,0.5)" }}>
                      <p style={{ color: "#E8F0FE", fontSize: "0.85rem", fontWeight: 600, marginBottom: "0.75rem" }}>Meeting Details</p>
                      <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                          <Shield size={13} color="#5A6A8A" />
                          <span style={{ color: "#5A6A8A", fontSize: "0.75rem" }}>Room Code:</span>
                          <span style={{ color: "#E8F0FE", fontSize: "0.75rem", fontFamily: "DM Mono, monospace" }}>{roomCode}</span>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                          <Users size={13} color="#5A6A8A" />
                          <span style={{ color: "#5A6A8A", fontSize: "0.75rem" }}>{totalTiles} participant{totalTiles !== 1 ? "s" : ""}</span>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                          <Clock size={13} color="#5A6A8A" />
                          <span style={{ color: "#5A6A8A", fontSize: "0.75rem" }}>Duration: {formatTime(elapsed)}</span>
                        </div>
                      </div>
                      <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
                        onClick={copyRoomCode}
                        style={{ marginTop: "0.75rem", width: "100%", padding: "0.4rem", borderRadius: "0.5rem", border: "1px solid rgba(0,212,255,0.2)", background: "rgba(0,212,255,0.06)", color: "#00D4FF", fontSize: "0.75rem", fontWeight: 500, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "0.375rem" }}>
                        <Copy size={12} /> Copy invite code
                      </motion.button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          </div>
        </div>

        {/* Center — Timer */}
        {!isMobile && (
        <div style={{ flex: 1, display: "flex", justifyContent: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", background: "rgba(20,28,46,0.5)", padding: "0.25rem 0.75rem", borderRadius: "2rem", border: "1px solid rgba(30,45,69,0.4)" }}>
            <Clock size={13} color="#5A6A8A" />
            <span style={{ fontFamily: "DM Mono, monospace", fontSize: "0.8rem", color: "#8896B0", fontWeight: 500, letterSpacing: "0.05em" }}>
              {formatTime(elapsed)}
            </span>
          </div>
        </div>
        )}

        {/* Right — Panel toggles */}
        <div style={{ display: "flex", alignItems: "center", gap: "0.375rem", flexShrink: 0, marginLeft: isMobile ? "auto" : undefined }}>
          {panelButtons.map((b) => (
            <motion.button key={b.id} whileHover={{ scale: 1.08 }} whileTap={{ scale: 0.92 }}
              onClick={() => setPanel((p) => p === b.id ? null : b.id)} title={b.label}
              style={{
                position: "relative", width: isMobile ? 32 : 36, height: isMobile ? 32 : 36, borderRadius: "0.625rem",
                border: `1px solid ${panel === b.id ? b.color + "40" : "rgba(30,45,69,0.4)"}`,
                cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                transition: "all 0.2s ease",
                background: panel === b.id ? b.color + "15" : "rgba(20,28,46,0.4)",
                color: panel === b.id ? b.color : "#5A6A8A",
                boxShadow: panel === b.id ? `0 0 16px ${b.color}15` : "none",
              }}>
              {b.icon}
              {b.id === "participants" && (
                <span style={{ position: "absolute", top: -4, right: -4, minWidth: 16, height: 16, borderRadius: "50%", background: "rgba(0,212,255,0.2)", border: "1px solid rgba(0,212,255,0.3)", fontSize: "0.55rem", fontWeight: 700, color: "#00D4FF", display: "flex", alignItems: "center", justifyContent: "center", padding: "0 3px" }}>
                  {totalTiles}
                </span>
              )}
            </motion.button>
          ))}
          <div style={{ width: 1, height: 24, background: "rgba(30,45,69,0.6)", margin: "0 0.25rem" }} />
          {!isMobile && (
          <>
          <motion.button whileHover={{ scale: 1.08 }} whileTap={{ scale: 0.92 }}
            onClick={() => setLayoutMode((m) => m === "grid" ? "spotlight" : m === "spotlight" ? "auto" : "grid")}
            title={`Layout: ${layoutMode}`}
            style={{ width: 36, height: 36, borderRadius: "0.625rem", border: "1px solid rgba(30,45,69,0.4)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(20,28,46,0.4)", color: "#5A6A8A", transition: "all 0.2s" }}>
            {layoutMode === "grid" ? <Grid3X3 size={16} /> : <Layout size={16} />}
          </motion.button>
          <motion.button whileHover={{ scale: 1.08 }} whileTap={{ scale: 0.92 }}
            onClick={toggleFullscreen} title={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
            style={{ width: 36, height: 36, borderRadius: "0.625rem", border: "1px solid rgba(30,45,69,0.4)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(20,28,46,0.4)", color: "#5A6A8A", transition: "all 0.2s" }}>
            {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
          </motion.button>
          </>
          )}
        </div>
      </header>

      {/* ── Main content ── */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden", position: "relative" }}>
        {/* Video area */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", position: "relative", padding: "0.75rem" }}>

          {layout === "spotlight" ? (
            /* ── Spotlight layout ── */
            <div style={{ flex: 1, display: "flex", gap: "0.75rem", minHeight: 0 }}>
              {/* Main spotlight */}
              <div style={{ flex: 1, position: "relative", borderRadius: "1rem", overflow: "hidden", background: "#111827", border: "1px solid rgba(30,45,69,0.4)" }}>
                {isScreenSharing && pinnedParticipant === "screen" ? (
                  <video ref={(el) => { if (el && screenStream) { el.srcObject = screenStream; el.play().catch(() => {}); } }}
                    autoPlay playsInline
                    style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "contain", background: "#000" }} />
                ) : pinnedParticipant && pinnedParticipant !== "self" && pinnedParticipant !== "screen" ? (
                  <ParticipantTile participant={remotePeers.find((p) => p.socketId === pinnedParticipant) || remotePeers[0]} isSpotlight onPin={() => setPinnedParticipant(null)} />
                ) : (
                  <>
                    <video ref={setVideoRef} autoPlay playsInline muted
                      style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", transform: "scaleX(-1)" }} />
                    {!camOn && (
                      <div style={{ position: "absolute", inset: 0, background: "linear-gradient(135deg, #141C2E, #0A0E1A)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <div style={{ width: 96, height: 96, borderRadius: "50%", background: "linear-gradient(135deg, #7B61FF, #00D4FF)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "2.5rem", fontWeight: 700, color: "#fff", boxShadow: "0 0 40px rgba(123,97,255,0.3)" }}>
                          {user?.name?.[0]?.toUpperCase()}
                        </div>
                      </div>
                    )}
                    {handRaised && <HandBadge />}
                    <NameBadge name={`${user?.name} (You)`} micOn={micOn} highlight />
                  </>
                )}
                {isScreenSharing && pinnedParticipant === "screen" && (
                  <div style={{ position: "absolute", bottom: 12, left: 12, display: "flex", alignItems: "center", gap: "0.375rem", background: "rgba(0,0,0,0.7)", backdropFilter: "blur(8px)", padding: "0.25rem 0.625rem", borderRadius: "0.5rem" }}>
                    <Monitor size={13} color="#00D4FF" />
                    <span style={{ color: "#E8F0FE", fontSize: "0.75rem", fontWeight: 500 }}>Your Screen</span>
                  </div>
                )}
              </div>

              {/* Sidebar thumbnails */}
              {!isMobile && (
              <div style={{ width: isTablet ? 150 : 200, display: "flex", flexDirection: "column", gap: "0.5rem", overflowY: "auto", paddingRight: 2 }}>
                {pinnedParticipant !== "self" && pinnedParticipant && (
                  <motion.div whileHover={{ scale: 1.02 }} onClick={() => setPinnedParticipant("self")}
                    style={{ position: "relative", borderRadius: "0.75rem", overflow: "hidden", background: "#141C2E", border: "2px solid rgba(123,97,255,0.3)", aspectRatio: "16/10", cursor: "pointer", flexShrink: 0 }}>
                    <video ref={(el) => { if (el && localStream) { el.srcObject = localStream; el.muted = true; el.play().catch(() => {}); } }}
                      autoPlay playsInline muted style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", transform: "scaleX(-1)" }} />
                    {!camOn && (
                      <div style={{ position: "absolute", inset: 0, background: "#141C2E", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <div style={{ width: 32, height: 32, borderRadius: "50%", background: "linear-gradient(135deg, #7B61FF, #00D4FF)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.8rem", fontWeight: 700, color: "#fff" }}>
                          {user?.name?.[0]?.toUpperCase()}
                        </div>
                      </div>
                    )}
                    <SmallBadge name="You" />
                  </motion.div>
                )}
                {isScreenSharing && pinnedParticipant !== "screen" && (
                  <motion.div whileHover={{ scale: 1.02 }} onClick={() => setPinnedParticipant("screen")}
                    style={{ position: "relative", borderRadius: "0.75rem", overflow: "hidden", background: "#000", border: "2px solid rgba(0,212,255,0.3)", aspectRatio: "16/10", cursor: "pointer", flexShrink: 0 }}>
                    <video ref={(el) => { if (el && screenStream) { el.srcObject = screenStream; el.play().catch(() => {}); } }}
                      autoPlay playsInline style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "contain" }} />
                    <SmallBadge name="Screen" />
                  </motion.div>
                )}
                {remotePeers.map((p) => (
                  <motion.div key={p.socketId} whileHover={{ scale: 1.02 }}
                    onClick={() => setPinnedParticipant(pinnedParticipant === p.socketId ? null : p.socketId)}
                    style={{ flexShrink: 0, cursor: "pointer" }}>
                    <ParticipantTile participant={p} isThumb onPin={() => setPinnedParticipant(p.socketId)} />
                  </motion.div>
                ))}
              </div>
              )}
            </div>
          ) : (
            /* ── Grid layout ── */
            <div style={{
              flex: 1, display: "grid", gap: "0.625rem", gridTemplateColumns: gridCols,
              alignContent: isSolo ? "stretch" : "center", padding: "0.25rem",
            }}>
              {isScreenSharing && (
                <div onDoubleClick={() => setPinnedParticipant(pinnedParticipant === "screen" ? null : "screen")}
                  style={{ position: "relative", background: "#000", borderRadius: "1rem", overflow: "hidden", border: "2px solid rgba(0,212,255,0.3)", minHeight: 200, gridColumn: totalTiles <= 3 ? "span 1" : "span 2", gridRow: totalTiles <= 3 ? "span 1" : "span 2", boxShadow: "0 0 25px rgba(0,212,255,0.05)" }}>
                  <video ref={(el) => { if (el && screenStream) { el.srcObject = screenStream; el.play().catch(() => {}); } }}
                    autoPlay playsInline style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "contain" }} />
                  <NameBadge name="Your Screen" icon={<Monitor size={12} />} />
                </div>
              )}
              {/* Local video */}
              <div onDoubleClick={() => setPinnedParticipant(pinnedParticipant === "self" ? null : "self")}
                style={{ position: "relative", background: "#141C2E", borderRadius: "1rem", overflow: "hidden", border: "2px solid rgba(123,97,255,0.3)", minHeight: 200, aspectRatio: isSolo ? undefined : "16/9", boxShadow: "0 0 25px rgba(123,97,255,0.06)", transition: "border-color 0.3s, box-shadow 0.3s" }}>
                <video ref={setVideoRef} autoPlay playsInline muted
                  style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", transform: "scaleX(-1)" }} />
                {!camOn && (
                  <div style={{ position: "absolute", inset: 0, background: "linear-gradient(135deg, #141C2E, #0A0E1A)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <div style={{ width: 72, height: 72, borderRadius: "50%", background: "linear-gradient(135deg, #7B61FF, #00D4FF)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.75rem", fontWeight: 700, color: "#fff", boxShadow: "0 0 30px rgba(123,97,255,0.25)" }}>
                      {user?.name?.[0]?.toUpperCase()}
                    </div>
                  </div>
                )}
                {handRaised && <HandBadge />}
                <NameBadge name={`${user?.name} (You)`} micOn={micOn} highlight />
              </div>
              {remotePeers.map((p) => (
                <ParticipantTile key={p.socketId} participant={p}
                  onPin={() => setPinnedParticipant(pinnedParticipant === p.socketId ? null : p.socketId)}
                  isPinned={pinnedParticipant === p.socketId} />
              ))}
            </div>
          )}

          {/* Floating self-view PiP */}
          {layout === "spotlight" && pinnedParticipant && pinnedParticipant !== "self" && totalTiles <= 2 && (
            <motion.div drag dragMomentum={false}
              initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }}
          style={{ position: "absolute", bottom: 16, right: 16, width: isMobile ? 140 : 200, height: isMobile ? 90 : 130, borderRadius: "0.875rem", overflow: "hidden", border: "2px solid rgba(123,97,255,0.4)", background: "#141C2E", boxShadow: "0 8px 32px rgba(0,0,0,0.5)", cursor: "grab", zIndex: 10 }}>
              <video ref={(el) => { if (el && localStream) { el.srcObject = localStream; el.muted = true; el.play().catch(() => {}); } }}
                autoPlay playsInline muted style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", transform: "scaleX(-1)" }} />
              {!camOn && (
                <div style={{ position: "absolute", inset: 0, background: "#141C2E", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <div style={{ width: 40, height: 40, borderRadius: "50%", background: "linear-gradient(135deg, #7B61FF, #00D4FF)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1rem", fontWeight: 700, color: "#fff" }}>
                    {user?.name?.[0]?.toUpperCase()}
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </div>

        {/* ── Side panel ── */}
        <AnimatePresence>
          {panel && (
            <motion.div initial={{ width: 0, opacity: 0 }} animate={{ width: isMobile ? "100%" : 380, opacity: 1 }} exit={{ width: 0, opacity: 0 }}
              transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
              style={{ borderLeft: isMobile ? "none" : "1px solid rgba(30,45,69,0.4)", overflow: "hidden", flexShrink: 0, background: "rgba(13,18,32,0.95)", backdropFilter: "blur(20px)", position: isMobile ? "absolute" : "relative", inset: isMobile ? 0 : undefined, zIndex: isMobile ? 30 : undefined }}>
              <div style={{ width: isMobile ? "100%" : 380, height: "100%", display: "flex", flexDirection: "column" }}>

                {panel === "chat" && (
                  <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
                    <PanelHeader title="In-call chat" icon={<MessageSquare size={15} />} color="#00FF94" onClose={() => setPanel(null)} />
                    <div style={{ flex: 1, overflowY: "auto", padding: "0.75rem 1rem" }}>
                      {messages.length === 0 && <EmptyState text="Messages will appear here" sub="Send a message to start the conversation" />}
                      {messages.map((m, i) => (
                        <motion.div key={i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} style={{ marginBottom: "0.75rem" }}>
                          <div style={{ display: "flex", alignItems: "baseline", gap: "0.5rem", marginBottom: "0.2rem" }}>
                            <span style={{ color: "#7B61FF", fontSize: "0.78rem", fontWeight: 600 }}>{m.from}</span>
                            <span style={{ color: "#3A4A6A", fontSize: "0.6rem" }}>{new Date(m.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                          </div>
                          <div style={{ color: "#E8F0FE", fontSize: "0.82rem", lineHeight: 1.55, padding: "0.4rem 0.625rem", background: "rgba(20,28,46,0.5)", borderRadius: "0.5rem 0.5rem 0.5rem 0.125rem", border: "1px solid rgba(30,45,69,0.3)" }}>
                            {m.text}
                          </div>
                        </motion.div>
                      ))}
                      <div ref={chatEndRef} />
                    </div>
                    <div style={{ padding: "0.625rem 0.75rem", borderTop: "1px solid rgba(30,45,69,0.4)", display: "flex", gap: "0.375rem", background: "rgba(10,14,26,0.5)" }}>
                      <input value={chatMsg} onChange={(e) => setChatMsg(e.target.value)}
                        placeholder="Send a message to everyone"
                        onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSendChat(e); } }}
                        style={{ flex: 1, background: "rgba(20,28,46,0.6)", border: "1px solid rgba(30,45,69,0.4)", borderRadius: "1.5rem", padding: "0.5rem 0.875rem", color: "#E8F0FE", fontSize: "0.82rem", outline: "none", transition: "border-color 0.2s" }}
                        onFocus={(e) => (e.target.style.borderColor = "rgba(123,97,255,0.4)")}
                        onBlur={(e) => (e.target.style.borderColor = "rgba(30,45,69,0.4)")} />
                      <motion.button whileHover={{ scale: 1.08 }} whileTap={{ scale: 0.92 }}
                        onClick={handleSendChat}
                        style={{ width: 36, height: 36, borderRadius: "50%", border: "none", background: chatMsg.trim() ? "linear-gradient(135deg, #7B61FF, #00D4FF)" : "rgba(30,45,69,0.4)", color: "white", cursor: chatMsg.trim() ? "pointer" : "default", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: chatMsg.trim() ? "0 2px 12px rgba(123,97,255,0.3)" : "none", transition: "all 0.2s" }}>
                        <Send size={15} />
                      </motion.button>
                    </div>
                  </div>
                )}

                {panel === "participants" && (
                  <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
                    <PanelHeader title={`People (${totalTiles})`} icon={<Users size={15} />} color="#00D4FF" onClose={() => setPanel(null)} />
                    <div style={{ flex: 1, overflowY: "auto", padding: "0.75rem" }}>
                      <ParticipantListItem name={`${user?.name} (You)`} subtitle={handRaised ? "✋ Hand raised" : "In call"} avatar={user?.name?.[0]?.toUpperCase()} micOn={micOn} camOn={camOn} isYou />
                      {remotePeers.map((p) => (
                        <ParticipantListItem key={p.socketId} name={p.name} subtitle={p.isBot ? "AI Proxy Bot" : "In call"} avatar={p.isBot ? "🤖" : p.name?.[0]?.toUpperCase()} isBot={p.isBot} />
                      ))}
                    </div>
                  </div>
                )}


              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Bottom controls bar ── */}
      <div style={{
        height: isMobile ? 64 : 80, display: "flex", alignItems: "center", justifyContent: "center",
        background: "rgba(10,14,26,0.9)", backdropFilter: "blur(20px)",
        borderTop: "1px solid rgba(30,45,69,0.3)", position: "relative", zIndex: 20, gap: isMobile ? "0.25rem" : "0.5rem",
        padding: isMobile ? "0 0.5rem" : undefined,
      }}>
        {/* Left info */}
        {!isMobile && (
        <div style={{ position: "absolute", left: "1.25rem", display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <span style={{ fontFamily: "DM Mono, monospace", fontSize: "0.75rem", color: "#5A6A8A" }}>{formatTime(elapsed)}</span>
          <div style={{ width: 1, height: 16, background: "rgba(30,45,69,0.6)" }} />
          <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={copyRoomCode}
            style={{ display: "flex", alignItems: "center", gap: "0.25rem", border: "none", background: "none", color: "#5A6A8A", cursor: "pointer", fontFamily: "DM Mono, monospace", fontSize: "0.72rem", padding: "0.25rem 0.375rem", borderRadius: "0.375rem", transition: "color 0.2s" }}
            onMouseEnter={(e) => (e.currentTarget.style.color = "#E8F0FE")} onMouseLeave={(e) => (e.currentTarget.style.color = "#5A6A8A")}>
            {roomCode} <Copy size={11} />
          </motion.button>
        </div>
        )}

        {/* Center controls */}
        <div style={{ display: "flex", alignItems: "center", gap: isMobile ? "0.375rem" : "0.625rem" }}>
          <ControlButton onClick={toggleMic} active={micOn} icon={micOn ? <Mic size={isMobile ? 18 : 20} /> : <MicOff size={isMobile ? 18 : 20} />} tooltip={micOn ? "Turn off microphone" : "Turn on microphone"} dangerWhenOff small={isMobile} />
          <ControlButton onClick={toggleCam} active={camOn} icon={camOn ? <Video size={isMobile ? 18 : 20} /> : <VideoOff size={isMobile ? 18 : 20} />} tooltip={camOn ? "Turn off camera" : "Turn on camera"} dangerWhenOff small={isMobile} />
          <ControlButton onClick={toggleScreenShare} active={isScreenSharing} activeColor="#00D4FF" icon={isScreenSharing ? <MonitorOff size={isMobile ? 18 : 20} /> : <Monitor size={isMobile ? 18 : 20} />} tooltip={isScreenSharing ? "Stop presenting" : "Present now"} small={isMobile} />

          <div style={{ width: 1, height: 28, background: "rgba(30,45,69,0.5)", margin: "0 0.125rem" }} />

          {/* Reactions */}
          <div style={{ position: "relative" }} onClick={(e) => e.stopPropagation()}>
            <ControlButton onClick={() => setShowReactions(!showReactions)} icon={<Smile size={isMobile ? 18 : 20} />} tooltip="Reactions" small={isMobile} />
            <AnimatePresence>
              {showReactions && (
                <motion.div initial={{ opacity: 0, y: 10, scale: 0.9 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 10, scale: 0.9 }}
                  style={{ position: "absolute", bottom: "calc(100% + 12px)", left: "50%", transform: "translateX(-50%)", display: "flex", gap: "0.25rem", padding: "0.5rem 0.625rem", borderRadius: "2rem", background: "rgba(17,24,39,0.98)", border: "1px solid rgba(30,45,69,0.6)", boxShadow: "0 8px 32px rgba(0,0,0,0.5)", backdropFilter: "blur(16px)" }}>
                  {REACTIONS.map((r) => (
                    <motion.button key={r.emoji} whileHover={{ scale: 1.3, y: -4 }} whileTap={{ scale: 0.9 }}
                      onClick={() => sendReaction(r.emoji)} title={r.label}
                      style={{ width: 40, height: 40, borderRadius: "50%", border: "none", background: "transparent", fontSize: "1.5rem", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", transition: "background 0.15s" }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.08)")}
                      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}>
                      {r.emoji}
                    </motion.button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <ControlButton onClick={toggleRaiseHand} active={handRaised} activeColor="#FFBD00" icon={<Hand size={isMobile ? 18 : 20} />} tooltip={handRaised ? "Lower hand" : "Raise hand"} small={isMobile} />

          <div style={{ width: 1, height: isMobile ? 20 : 28, background: "rgba(30,45,69,0.5)", margin: "0 0.125rem" }} />

          {/* Leave */}
          <motion.button whileHover={{ scale: 1.06, boxShadow: "0 6px 24px rgba(239,68,68,0.4)" }} whileTap={{ scale: 0.94 }}
            onClick={handleLeave} title="Leave call"
            style={{ height: isMobile ? 40 : 48, padding: isMobile ? "0 0.875rem" : "0 1.5rem", borderRadius: "2rem", border: "none", cursor: "pointer", display: "flex", alignItems: "center", gap: "0.5rem", background: "#DC2626", color: "white", fontWeight: 600, fontSize: isMobile ? "0.75rem" : "0.85rem", boxShadow: "0 4px 16px rgba(239,68,68,0.3)", transition: "all 0.2s" }}>
            <PhoneOff size={isMobile ? 16 : 18} /> <span>{isMobile ? "" : "Leave"}</span>
          </motion.button>
        </div>

        {/* Right — More */}
        {!isMobile && (
        <div style={{ position: "absolute", right: "1.25rem" }}>
          <div style={{ position: "relative" }} onClick={(e) => e.stopPropagation()}>
            <ControlButton onClick={() => setShowMoreMenu(!showMoreMenu)} icon={<MoreVertical size={20} />} tooltip="More options" />
            <AnimatePresence>
              {showMoreMenu && (
                <motion.div initial={{ opacity: 0, y: 10, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 10, scale: 0.95 }}
                  style={{ position: "absolute", bottom: "calc(100% + 12px)", right: 0, width: 220, background: "rgba(17,24,39,0.98)", border: "1px solid rgba(30,45,69,0.6)", borderRadius: "0.75rem", padding: "0.375rem", boxShadow: "0 8px 32px rgba(0,0,0,0.5)", backdropFilter: "blur(16px)" }}>
                  <MoreMenuItem icon={<Layout size={15} />} label={`Layout: ${layoutMode}`} onClick={() => { setLayoutMode((m) => m === "grid" ? "spotlight" : m === "spotlight" ? "auto" : "grid"); setShowMoreMenu(false); }} />
                  <MoreMenuItem icon={isFullscreen ? <Minimize2 size={15} /> : <Maximize2 size={15} />} label={isFullscreen ? "Exit fullscreen" : "Fullscreen"} onClick={() => { toggleFullscreen(); setShowMoreMenu(false); }} />
                  <MoreMenuItem icon={<Info size={15} />} label="Meeting details" onClick={() => { setShowMeetingInfo(true); setShowMoreMenu(false); }} />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
        )}
      </div>
    </div>
  );
}

/* ═══ Sub-components ═══ */

function ControlButton({ onClick, active, activeColor, icon, tooltip, dangerWhenOff, small }) {
  const isOff = dangerWhenOff && !active;
  const isActive = active && activeColor;
  const size = small ? 40 : 48;
  return (
    <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} onClick={onClick} title={tooltip}
      style={{
        width: size, height: size, borderRadius: "50%", border: "none", cursor: "pointer",
        display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.2s ease",
        background: isOff ? "rgba(220,38,38,0.15)" : isActive ? activeColor + "20" : "rgba(30,45,69,0.5)",
        color: isOff ? "#f87171" : isActive ? activeColor : "#E8F0FE",
        boxShadow: isOff ? "inset 0 0 0 1.5px rgba(220,38,38,0.4)" : isActive ? `inset 0 0 0 1.5px ${activeColor}40, 0 0 12px ${activeColor}15` : "inset 0 0 0 1px rgba(30,45,69,0.5)",
      }}>
      {icon}
    </motion.button>
  );
}

function NameBadge({ name, micOn, icon, highlight }) {
  return (
    <div style={{
      position: "absolute", bottom: 10, left: 10, display: "flex", alignItems: "center", gap: "0.375rem",
      background: "rgba(0,0,0,0.65)", backdropFilter: "blur(8px)", padding: "0.3rem 0.625rem",
      borderRadius: "0.5rem", border: highlight ? "1px solid rgba(123,97,255,0.2)" : "1px solid rgba(255,255,255,0.06)",
    }}>
      {icon}
      {micOn === false && <MicOff size={11} color="#ef4444" />}
      <span style={{ color: "#fff", fontSize: "0.75rem", fontWeight: 500 }}>{name}</span>
    </div>
  );
}

function SmallBadge({ name }) {
  return (
    <div style={{
      position: "absolute", bottom: 4, left: 4, display: "flex", alignItems: "center", gap: "0.25rem",
      background: "rgba(0,0,0,0.7)", padding: "0.15rem 0.4rem", borderRadius: "0.375rem",
    }}>
      <span style={{ color: "#fff", fontSize: "0.6rem", fontWeight: 500 }}>{name}</span>
    </div>
  );
}

function HandBadge() {
  return (
    <motion.div initial={{ scale: 0, rotate: -20 }} animate={{ scale: 1, rotate: 0 }}
      style={{ position: "absolute", top: 10, left: 10, width: 32, height: 32, borderRadius: "50%", background: "rgba(255,189,0,0.2)", border: "1px solid rgba(255,189,0,0.4)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1rem" }}>
      ✋
    </motion.div>
  );
}

function PanelHeader({ title, icon, color, onClose }) {
  return (
    <div style={{ padding: "0.75rem 1rem", borderBottom: "1px solid rgba(30,45,69,0.4)", display: "flex", alignItems: "center", gap: "0.625rem", background: "rgba(10,14,26,0.6)" }}>
      <div style={{ width: 28, height: 28, borderRadius: "0.5rem", background: color + "15", display: "flex", alignItems: "center", justifyContent: "center", color }}>{icon}</div>
      <span style={{ fontFamily: "Syne, sans-serif", fontWeight: 600, fontSize: "0.9rem", color: "#E8F0FE", flex: 1 }}>{title}</span>
      <motion.button whileHover={{ scale: 1.1, background: "rgba(255,255,255,0.08)" }} whileTap={{ scale: 0.9 }}
        onClick={onClose} style={{ width: 28, height: 28, borderRadius: "0.5rem", border: "none", background: "transparent", color: "#5A6A8A", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>
        <X size={16} />
      </motion.button>
    </div>
  );
}

function EmptyState({ text, sub }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", height: "100%", gap: "0.5rem", opacity: 0.5 }}>
      <MessageSquare size={32} color="#3A4A6A" strokeWidth={1.5} />
      <p style={{ color: "#5A6A8A", fontSize: "0.82rem", fontWeight: 500 }}>{text}</p>
      {sub && <p style={{ color: "#3A4A6A", fontSize: "0.7rem" }}>{sub}</p>}
    </div>
  );
}

function ParticipantListItem({ name, subtitle, avatar, micOn, camOn, isYou, isBot }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", padding: "0.625rem 0.5rem", borderRadius: "0.625rem", transition: "background 0.15s", marginBottom: "0.25rem" }}
      onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(30,45,69,0.3)")}
      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}>
      <div style={{ width: 36, height: 36, borderRadius: "50%", flexShrink: 0, background: isBot ? "linear-gradient(135deg, #00D4FF, #7B61FF)" : "linear-gradient(135deg, #7B61FF, #00D4FF)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: isBot ? "1rem" : "0.85rem", fontWeight: 700, color: "#fff", boxShadow: isYou ? "0 0 0 2px rgba(123,97,255,0.3)" : "none" }}>
        {avatar}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ color: "#E8F0FE", fontSize: "0.82rem", fontWeight: 500, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{name}</p>
        <p style={{ color: "#5A6A8A", fontSize: "0.68rem" }}>{subtitle}</p>
      </div>
      {isYou && (
        <div style={{ display: "flex", gap: "0.375rem" }}>
          <div style={{ width: 24, height: 24, borderRadius: "50%", background: micOn ? "rgba(0,255,148,0.1)" : "rgba(239,68,68,0.1)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            {micOn ? <Mic size={12} color="#00FF94" /> : <MicOff size={12} color="#ef4444" />}
          </div>
          <div style={{ width: 24, height: 24, borderRadius: "50%", background: camOn ? "rgba(0,255,148,0.1)" : "rgba(239,68,68,0.1)", display: "flex", alignItems: "center", justifyContent: "center" }}>
            {camOn ? <Video size={12} color="#00FF94" /> : <VideoOff size={12} color="#ef4444" />}
          </div>
        </div>
      )}
    </div>
  );
}

function MoreMenuItem({ icon, label, onClick }) {
  return (
    <motion.button whileHover={{ background: "rgba(30,45,69,0.4)" }} onClick={onClick}
      style={{ width: "100%", display: "flex", alignItems: "center", gap: "0.625rem", padding: "0.5rem 0.625rem", borderRadius: "0.5rem", border: "none", background: "transparent", color: "#E8F0FE", cursor: "pointer", fontSize: "0.82rem", textAlign: "left", transition: "background 0.15s" }}>
      <span style={{ color: "#5A6A8A" }}>{icon}</span>
      {label}
    </motion.button>
  );
}