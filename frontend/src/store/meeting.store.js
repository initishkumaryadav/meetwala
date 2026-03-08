import { create } from "zustand";

export const useMeetingStore = create((set, get) => ({
  roomCode:          null,
  participants:      [],
  transcript:        [],
  botStatus:         "idle",   // idle | thinking | speaking | escalating
  botEvents:         [],
  lastBotResponse:   null,
  isWhatsAppPending: false,
  localStream:       null,
  remoteStreams:     {},        // socketId → MediaStream
  peerConnections:   {},        // socketId → RTCPeerConnection
  messages:          [],        // chat messages

  setRoomCode:       (roomCode)    => set({ roomCode }),
  setBotStatus:      (botStatus)   => set({ botStatus }),
  setLastBotResponse:(text)        => set({ lastBotResponse: text }),
  setWhatsAppPending:(v)           => set({ isWhatsAppPending: v }),
  setLocalStream:    (localStream) => set({ localStream }),

  addParticipant: (p) => set((s) => ({
    participants: [...s.participants.filter((x) => x.socketId !== p.socketId), p],
  })),

  removeParticipant: (socketId) => set((s) => {
    // Clean up peer connection & remote stream
    const pc = s.peerConnections[socketId];
    if (pc) pc.close();
    const { [socketId]: _pc, ...restPc } = s.peerConnections;
    const { [socketId]: _rs, ...restRs } = s.remoteStreams;
    return {
      participants:   s.participants.filter((p) => p.socketId !== socketId),
      peerConnections: restPc,
      remoteStreams:   restRs,
    };
  }),

  setRemoteStream: (socketId, stream) => set((s) => ({
    remoteStreams: { ...s.remoteStreams, [socketId]: stream },
  })),

  setPeerConnection: (socketId, pc) => set((s) => ({
    peerConnections: { ...s.peerConnections, [socketId]: pc },
  })),

  addTranscriptLine: (line) => set((s) => {
    const last = s.transcript[s.transcript.length - 1];
    if (last && !last.isFinal && last.speaker === line.speaker) {
      return { transcript: [...s.transcript.slice(0, -1), line] };
    }
    return { transcript: [...s.transcript.slice(-200), line] };
  }),

  addMessage: (msg) => set((s) => ({
    messages: [...s.messages.slice(-200), msg],
  })),

  addBotEvent: (event) => set((s) => ({
    botEvents: [...s.botEvents.slice(-100), event],
  })),

  reset: () => {
    // Close all peer connections on reset
    const { peerConnections } = get();
    Object.values(peerConnections).forEach((pc) => pc.close());
    set({
      roomCode: null, participants: [], transcript: [], botStatus: "idle",
      botEvents: [], lastBotResponse: null, isWhatsAppPending: false,
      localStream: null, remoteStreams: {}, peerConnections: {}, messages: [],
    });
  },
}));