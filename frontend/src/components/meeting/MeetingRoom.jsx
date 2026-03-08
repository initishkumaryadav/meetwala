import { useEffect, useRef, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import { Mic, MicOff, Video, VideoOff, PhoneOff, MessageSquare, Bot, Copy, Send } from "lucide-react";
import { meetingApi } from "../../services/api";
import { connectSocket, disconnectSocket, joinRoom, leaveRoom, sendAudioChunk, sendChatMessage, getSocket } from "../../services/socket";
import { useMeetingStore } from "../../store/meeting.store";
import { useAuthStore } from "../../store/auth.store";
import BotStatusPanel   from "./BotStatusPanel";
import TranscriptPanel  from "./TranscriptPanel";
import ParticipantTile  from "./ParticipantTile";
import toast from "react-hot-toast";

// Module-level ref to persist stream across React StrictMode double-mounts
let _sharedStream = null;

export default function MeetingRoom() {
  const { roomCode }   = useParams();
  const navigate       = useNavigate();
  const { user }       = useAuthStore();
  const participants   = useMeetingStore((s) => s.participants);
  const localStream    = useMeetingStore((s) => s.localStream);
  const messages       = useMeetingStore((s) => s.messages);
  const [micOn, setMicOn]   = useState(true);
  const [camOn, setCamOn]   = useState(true);
  const [panel, setPanel]   = useState(null); // "bot" | "transcript" | "chat" | null
  const [chatMsg, setChatMsg] = useState("");
  const localVideoRef  = useRef(null);
  const recorderRef    = useRef(null);

  const { data: meeting } = useQuery({
    queryKey: ["meeting", roomCode],
    queryFn:  () => meetingApi.get(roomCode).then((r) => r.data.meeting),
    enabled:  !!roomCode,
  });

  // Callback ref to ensure muted attribute is set via DOM (React muted bug workaround)
  // and to attach the stream as soon as the element exists
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
    // Stop and clear the shared stream
    _sharedStream?.getTracks().forEach((t) => t.stop());
    _sharedStream = null;
    recorderRef.current?.stop();
    useMeetingStore.getState().reset();
    navigate("/");
  };

  const copyRoomCode = () => {
    navigator.clipboard.writeText(roomCode);
    toast.success("Room code copied!");
  };

  const handleSendChat = (e) => {
    e.preventDefault();
    if (!chatMsg.trim()) return;
    sendChatMessage(roomCode, chatMsg.trim());
    setChatMsg("");
  };

  // Filter out self from participants for remote tiles
  const socketId = getSocket()?.id;
  const remotePeers = participants.filter((p) => p.socketId !== socketId);

  // Compute grid columns based on total tile count
  const totalTiles = 1 + remotePeers.length;
  const gridCols = totalTiles <= 1 ? "1fr" : totalTiles <= 4 ? "repeat(2, 1fr)" : totalTiles <= 9 ? "repeat(3, 1fr)" : "repeat(4, 1fr)";
  const isSolo = totalTiles <= 1;

  const ctrlBtn = (active, danger) => ({
    width: 48, height: 48, borderRadius: "0.75rem", border: "none", cursor: "pointer",
    display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.2s",
    background: danger ? "#ef4444" : active ? "#141C2E" : "rgba(239,68,68,0.2)",
    color: danger ? "white" : active ? "#E8F0FE" : "#f87171",
    boxShadow: danger ? "0 4px 15px rgba(239,68,68,0.4)" : "none",
  });

  return (
    <div style={{ minHeight: "100vh", background: "#0A0E1A", display: "flex", flexDirection: "column" }}>

      {/* Top bar */}
      <div style={{ height: 56, borderBottom: "1px solid rgba(30,45,69,0.6)", padding: "0 1.25rem", display: "flex", alignItems: "center", gap: "1rem", background: "rgba(10,14,26,0.8)", backdropFilter: "blur(12px)", position: "relative" }}>
        <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 1, background: "linear-gradient(90deg, transparent, rgba(0,212,255,0.2), rgba(123,97,255,0.2), transparent)" }} />
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#00FF94", boxShadow: "0 0 8px rgba(0,255,148,0.5)", animation: "pulse 2s infinite" }} />
          <span style={{ fontFamily: "Syne, sans-serif", fontWeight: 600, color: "#E8F0FE", fontSize: "0.9rem" }}>{meeting?.title || "Meeting"}</span>
        </div>
        <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={copyRoomCode} style={{ fontFamily: "DM Mono, monospace", fontSize: "0.72rem", color: "#5A6A8A", background: "rgba(20,28,46,0.8)", border: "1px solid rgba(30,45,69,0.6)", padding: "0.2rem 0.6rem", borderRadius: "0.5rem", cursor: "pointer", display: "flex", alignItems: "center", gap: 4, transition: "all 0.2s" }}>
          {roomCode} <Copy size={11} />
        </motion.button>
        <span style={{ color: "#5A6A8A", fontSize: "0.72rem", display: "flex", alignItems: "center", gap: "0.35rem" }}>
          <span style={{ width: 5, height: 5, borderRadius: "50%", background: "#5A6A8A", display: "inline-block" }} />
          {totalTiles} participant{totalTiles !== 1 ? "s" : ""}
        </span>
        <div style={{ marginLeft: "auto", display: "flex", gap: "0.375rem" }}>
          {[
            { id: "chat",       icon: <MessageSquare size={15} />, active: "rgba(0,255,148,0.15)", activeColor: "#00FF94", label: "Chat" },
            { id: "transcript", icon: <MessageSquare size={15} />, active: "rgba(0,212,255,0.15)", activeColor: "#00D4FF", label: "Transcript" },
            { id: "bot",        icon: <Bot size={15} />,           active: "rgba(123,97,255,0.15)", activeColor: "#7B61FF", label: "Bot" },
          ].map((b) => (
            <motion.button key={b.id} whileHover={{ scale: 1.08 }} whileTap={{ scale: 0.92 }}
              onClick={() => setPanel((p) => p === b.id ? null : b.id)}
              title={b.label}
              style={{ width: 34, height: 34, borderRadius: "0.5rem", border: `1px solid ${panel === b.id ? b.activeColor + "40" : "rgba(30,45,69,0.6)"}`, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.2s",
                background: panel === b.id ? b.active : "rgba(20,28,46,0.6)",
                color:      panel === b.id ? b.activeColor : "#5A6A8A",
                boxShadow:  panel === b.id ? `0 0 12px ${b.activeColor}20` : "none",
              }}>
              {b.icon}
            </motion.button>
          ))}
        </div>
      </div>

      {/* Main content */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>

        {/* Video grid */}
        <div style={{ flex: 1, padding: "1rem", display: "flex", flexDirection: "column" }}>
          <div style={{
            flex: 1, display: "grid", gap: "0.75rem",
            gridTemplateColumns: gridCols,
            gridTemplateRows: isSolo ? "1fr" : undefined,
            alignContent: isSolo ? "stretch" : "center",
          }}>
            {/* Local video */}
            <div style={{ position: "relative", background: "#141C2E", borderRadius: "1rem", overflow: "hidden", border: "2px solid rgba(123,97,255,0.4)", minHeight: 200, aspectRatio: isSolo ? undefined : "16/9", boxShadow: "0 0 20px rgba(123,97,255,0.1)" }}>
              <video ref={setVideoRef} autoPlay playsInline style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", objectFit: "cover", transform: "scaleX(-1)" }} />
              {!camOn && (
                <div style={{ position: "absolute", inset: 0, background: "linear-gradient(135deg, #141C2E, #0A0E1A)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <div style={{ width: 64, height: 64, borderRadius: "50%", background: "linear-gradient(135deg, #7B61FF, #00D4FF)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.5rem", fontWeight: 700, color: "#fff", boxShadow: "0 0 25px rgba(123,97,255,0.3)" }}>
                    {user?.name?.[0]?.toUpperCase()}
                  </div>
                </div>
              )}
              <div style={{ position: "absolute", bottom: "0.75rem", left: "0.75rem", background: "rgba(0,0,0,0.65)", backdropFilter: "blur(6px)", padding: "0.2rem 0.6rem", borderRadius: "0.5rem", color: "white", fontSize: "0.72rem", display: "flex", alignItems: "center", gap: 4, border: "1px solid rgba(123,97,255,0.2)" }}>
                {!micOn && <MicOff size={11} color="#ef4444" />} {user?.name} (You)
              </div>
            </div>

            {/* Remote participants */}
            {remotePeers.map((p) => (
              <ParticipantTile key={p.socketId} participant={p} />
            ))}
          </div>
        </div>

        {/* Side panel */}
        <AnimatePresence>
          {panel && (
            <motion.div initial={{ width: 0, opacity: 0 }} animate={{ width: 360, opacity: 1 }} exit={{ width: 0, opacity: 0 }}
              transition={{ duration: 0.3 }} style={{ borderLeft: "1px solid rgba(30,45,69,0.6)", overflow: "hidden", flexShrink: 0, background: "rgba(17,24,39,0.5)" }}>
              <div style={{ width: 360, height: "100%", display: "flex", flexDirection: "column" }}>
                {panel === "chat" && (
                  <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
                    <div style={{ padding: "0.75rem 1rem", borderBottom: "1px solid rgba(30,45,69,0.6)", color: "#E8F0FE", fontWeight: 600, fontSize: "0.875rem", display: "flex", alignItems: "center", gap: "0.5rem", background: "rgba(10,14,26,0.5)" }}>
                      <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#00FF94" }} /> Chat
                    </div>
                    <div style={{ flex: 1, overflowY: "auto", padding: "0.75rem 1rem" }}>
                      {messages.map((m, i) => (
                        <div key={i} style={{ marginBottom: "0.625rem" }}>
                          <span style={{ color: "#7B61FF", fontSize: "0.72rem", fontWeight: 600 }}>{m.from}</span>
                          <span style={{ color: "#3A4A6A", fontSize: "0.6rem", marginLeft: 6 }}>{new Date(m.timestamp).toLocaleTimeString()}</span>
                          <div style={{ color: "#E8F0FE", fontSize: "0.8rem", marginTop: 2, lineHeight: 1.5 }}>{m.text}</div>
                        </div>
                      ))}
                    </div>
                    <form onSubmit={handleSendChat} style={{ padding: "0.5rem", borderTop: "1px solid rgba(30,45,69,0.6)", display: "flex", gap: "0.375rem", background: "rgba(10,14,26,0.3)" }}>
                      <input value={chatMsg} onChange={(e) => setChatMsg(e.target.value)} placeholder="Type a message..."
                        style={{ flex: 1, background: "rgba(20,28,46,0.8)", border: "1px solid rgba(30,45,69,0.6)", borderRadius: "0.5rem", padding: "0.5rem 0.625rem", color: "#E8F0FE", fontSize: "0.8rem", outline: "none", transition: "border-color 0.2s" }}
                        onFocus={(e) => e.target.style.borderColor = "rgba(123,97,255,0.4)"} onBlur={(e) => e.target.style.borderColor = "rgba(30,45,69,0.6)"} />
                      <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} type="submit" style={{ width: 34, height: 34, borderRadius: "0.5rem", border: "none", background: "linear-gradient(135deg, #7B61FF, #00D4FF)", color: "white", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: "0 2px 10px rgba(123,97,255,0.3)" }}>
                        <Send size={14} />
                      </motion.button>
                    </form>
                  </div>
                )}
                {panel === "transcript" && <TranscriptPanel />}
                {panel === "bot" && <BotStatusPanel />}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Controls bar */}
      <div style={{ height: 80, borderTop: "1px solid rgba(30,45,69,0.6)", display: "flex", alignItems: "center", justifyContent: "center", gap: "0.75rem", background: "rgba(10,14,26,0.8)", backdropFilter: "blur(12px)" }}>
        <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} onClick={toggleMic}  style={{...ctrlBtn(micOn, false), borderRadius: "50%"}} title={micOn ? "Mute" : "Unmute"}>{micOn  ? <Mic size={20}   /> : <MicOff size={20}   />}</motion.button>
        <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} onClick={toggleCam}  style={{...ctrlBtn(camOn, false), borderRadius: "50%"}} title={camOn ? "Turn off camera" : "Turn on camera"}>{camOn  ? <Video size={20} /> : <VideoOff size={20} />}</motion.button>
        <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} onClick={handleLeave} style={{...ctrlBtn(false, true), borderRadius: "50%", width: 52, height: 52}} title="Leave meeting"><PhoneOff size={20} /></motion.button>
      </div>
    </div>
  );
}