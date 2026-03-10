import { io } from "socket.io-client";
import { useAuthStore }   from "../store/auth.store";
import { useMeetingStore } from "../store/meeting.store";
import toast from "react-hot-toast";

let socket = null;

const ICE_SERVERS = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
  { urls: "stun:stun2.l.google.com:19302" },
  { urls: "stun:stun3.l.google.com:19302" },
  { urls: "stun:stun4.l.google.com:19302" },
];

// Track whether we are the "polite" peer for each remote socket (glare handling)
const politeFor = new Set();

export function getSocket() {
  if (!socket) {
    const token = useAuthStore.getState().token;
    socket = io(import.meta.env.VITE_SOCKET_URL || "/", {
      auth:        { token },
      transports:  ["websocket", "polling"],
      autoConnect: false,
    });
    attachListeners(socket);
  }
  return socket;
}

export function connectSocket()    { getSocket().connect(); }
export function disconnectSocket() {
  const store = useMeetingStore.getState();
  Object.values(store.peerConnections).forEach((pc) => pc.close());
  politeFor.clear();
  socket?.disconnect();
  socket = null;
}

// ── WebRTC peer connection management ──────────────────

function createPeerConnection(remoteSocketId) {
  const store = useMeetingStore.getState();

  // Close any existing PC for this peer before creating a new one
  const existingPc = store.peerConnections[remoteSocketId];
  if (existingPc) {
    existingPc.close();
  }

  const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });

  // Add local tracks to the connection
  const localStream = store.localStream;
  if (localStream) {
    localStream.getTracks().forEach((track) => {
      pc.addTrack(track, localStream);
    });
    console.log(`[WebRTC] Added ${localStream.getTracks().length} local tracks for ${remoteSocketId}`);
  } else {
    console.warn(`[WebRTC] No local stream when creating PC for ${remoteSocketId}`);
  }

  // When we get remote tracks
  pc.ontrack = (event) => {
    console.log(`[WebRTC] ontrack from ${remoteSocketId}:`, event.track.kind);
    const [remoteStream] = event.streams;
    if (remoteStream) {
      useMeetingStore.getState().setRemoteStream(remoteSocketId, remoteStream);
    }
  };

  // Send ICE candidates to the remote peer
  pc.onicecandidate = (event) => {
    if (event.candidate) {
      getSocket().emit("webrtc:ice-candidate", {
        to: remoteSocketId,
        candidate: event.candidate,
      });
    }
  };

  pc.oniceconnectionstatechange = () => {
    console.log(`[WebRTC] ICE state for ${remoteSocketId}: ${pc.iceConnectionState}`);
    if (pc.iceConnectionState === "failed") {
      console.warn(`[WebRTC] ICE failed for ${remoteSocketId}, attempting restart`);
      pc.restartIce();
      // Re-create offer with ICE restart
      pc.createOffer({ iceRestart: true })
        .then((offer) => pc.setLocalDescription(offer))
        .then(() => {
          getSocket().emit("webrtc:offer", { to: remoteSocketId, offer: pc.localDescription });
        })
        .catch((e) => console.error("[WebRTC] ICE restart failed:", e));
    }
  };

  pc.onconnectionstatechange = () => {
    console.log(`[WebRTC] Connection state for ${remoteSocketId}: ${pc.connectionState}`);
  };

  store.setPeerConnection(remoteSocketId, pc);
  return pc;
}

async function createOffer(remoteSocketId) {
  const pc = createPeerConnection(remoteSocketId);
  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);
  console.log(`[WebRTC] Sending offer to ${remoteSocketId}`);
  getSocket().emit("webrtc:offer", { to: remoteSocketId, offer });
}

async function handleOffer(fromSocketId, offer) {
  const store = useMeetingStore.getState();
  const existingPc = store.peerConnections[fromSocketId];

  // Glare handling: if we already have a PC with a local offer, decide who backs down
  if (existingPc && existingPc.signalingState === "have-local-offer") {
    // The "polite" peer rolls back; the "impolite" peer ignores the incoming offer
    if (politeFor.has(fromSocketId)) {
      console.log(`[WebRTC] Polite peer: rolling back for ${fromSocketId}`);
      await existingPc.setLocalDescription({ type: "rollback" });
      await existingPc.setRemoteDescription(new RTCSessionDescription(offer));
      const answer = await existingPc.createAnswer();
      await existingPc.setLocalDescription(answer);
      getSocket().emit("webrtc:answer", { to: fromSocketId, answer });
      return;
    } else {
      console.log(`[WebRTC] Impolite peer: ignoring offer from ${fromSocketId}`);
      return;
    }
  }

  const pc = createPeerConnection(fromSocketId);
  await pc.setRemoteDescription(new RTCSessionDescription(offer));
  const answer = await pc.createAnswer();
  await pc.setLocalDescription(answer);
  console.log(`[WebRTC] Sending answer to ${fromSocketId}`);
  getSocket().emit("webrtc:answer", { to: fromSocketId, answer });
}

async function handleAnswer(fromSocketId, answer) {
  const store = useMeetingStore.getState();
  const pc = store.peerConnections[fromSocketId];
  if (pc && pc.signalingState === "have-local-offer") {
    console.log(`[WebRTC] Received answer from ${fromSocketId}`);
    await pc.setRemoteDescription(new RTCSessionDescription(answer));
  } else {
    console.warn(`[WebRTC] Ignoring answer from ${fromSocketId} (state: ${pc?.signalingState})`);
  }
}

async function handleIceCandidate(fromSocketId, candidate) {
  const store = useMeetingStore.getState();
  const pc = store.peerConnections[fromSocketId];
  if (pc && pc.remoteDescription) {
    await pc.addIceCandidate(new RTCIceCandidate(candidate));
  } else {
    console.warn(`[WebRTC] Queuing/dropping ICE candidate for ${fromSocketId} (no remote description yet)`);
  }
}

// ── Socket event listeners ──────────────────────────────

function attachListeners(s) {
  s.on("connect",    () => console.log("🔌 Socket connected:", s.id));
  s.on("disconnect", () => console.log("🔌 Socket disconnected"));
  s.on("connect_error", (e) => console.error("Socket connect error:", e.message));

  // Room state — create offers to all existing participants
  s.on("meeting:room_state", (data) => {
    const store = useMeetingStore.getState();
    console.log(`[WebRTC] Room state: ${data.participants.length} participants, my id: ${s.id}`);
    data.participants.forEach((p) => {
      store.addParticipant(p);
      // Create offer to each existing peer (not self, not bots)
      if (p.socketId !== s.id && !p.isBot) {
        // We are the new joiner → we are "polite" for existing peers
        politeFor.add(p.socketId);
        createOffer(p.socketId).catch((e) => console.error(`[WebRTC] createOffer to ${p.socketId} failed:`, e));
      }
    });
  });

  s.on("meeting:user_joined", (data) => {
    useMeetingStore.getState().addParticipant(data);
    toast(`${data.name} joined`, { icon: data.isBot ? "🤖" : "👤" });
    // Also create offer from existing peer side for redundancy
    if (!data.isBot) {
      // We are the existing peer → we are "impolite" for the new joiner
      setTimeout(() => {
        createOffer(data.socketId).catch((e) => console.error(`[WebRTC] createOffer to new peer ${data.socketId} failed:`, e));
      }, 500);
    }
  });

  s.on("meeting:user_left", (data) => {
    useMeetingStore.getState().removeParticipant(data.socketId);
    politeFor.delete(data.socketId);
    toast(`${data.name} left`, { icon: "👋" });
  });

  s.on("meeting:transcript", (data) => {
    useMeetingStore.getState().addTranscriptLine(data);
  });

  s.on("meeting:message", (data) => {
    useMeetingStore.getState().addMessage(data);
  });

  // WebRTC signaling
  s.on("webrtc:offer", async ({ from, offer }) => {
    console.log(`[WebRTC] Received offer from ${from}`);
    try { await handleOffer(from, offer); } catch (e) { console.error("Handle offer error:", e); }
  });

  s.on("webrtc:answer", async ({ from, answer }) => {
    console.log(`[WebRTC] Received answer from ${from}`);
    try { await handleAnswer(from, answer); } catch (e) { console.error("Handle answer error:", e); }
  });

  s.on("webrtc:ice-candidate", async ({ from, candidate }) => {
    try { await handleIceCandidate(from, candidate); } catch (e) { console.error("Handle ICE error:", e); }
  });

  // Bot events
  s.on("bot:status", (data) => {
    useMeetingStore.getState().setBotStatus(data.status);
  });

  s.on("bot:response", (data) => {
    const store = useMeetingStore.getState();
    store.setLastBotResponse(data.text);
    store.addBotEvent({ type: "response", text: data.text, source: data.source, timestamp: data.timestamp });
    store.setBotStatus("idle");

    // Show text response as toast so user always gets feedback
    if (data.text) {
      toast(data.text, { icon: "🤖", duration: 6000, style: { maxWidth: 420 } });
    }

    if (data.audioBase64) {
      const audio = new Audio(`data:audio/mpeg;base64,${data.audioBase64}`);
      audio.play().catch(console.error);
    }
  });

  s.on("bot:whatsapp_sent", (data) => {
    useMeetingStore.getState().setWhatsAppPending(true);
    useMeetingStore.getState().addBotEvent({
      type: "whatsapp_sent", text: data.question, timestamp: new Date().toISOString(),
    });
    toast("Bot asked you via WhatsApp!", { icon: "📱" });
  });

  s.on("bot:whatsapp_replied", (data) => {
    useMeetingStore.getState().setWhatsAppPending(false);
    useMeetingStore.getState().addBotEvent({
      type: "whatsapp_replied", text: data.replyText, timestamp: new Date().toISOString(),
    });
    toast("WhatsApp reply received!", { icon: "✅" });
  });
}

export function joinRoom(roomCode, proxySessionId) {
  getSocket().emit("meeting:join", { roomCode, proxySessionId });
}

export function leaveRoom(roomCode) {
  getSocket().emit("meeting:leave", { roomCode });
}

export function sendAudioChunk(roomCode, chunk) {
  getSocket().emit("meeting:audio_chunk", { roomCode, chunk });
}

export function sendChatMessage(roomCode, text) {
  getSocket().emit("meeting:send_message", { roomCode, text });
}