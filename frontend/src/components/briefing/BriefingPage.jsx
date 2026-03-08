import { useState, useRef, useEffect, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation } from "@tanstack/react-query";
import { motion, AnimatePresence } from "framer-motion";
import {
  Send, ArrowRight, CheckCircle, X, Paperclip, Mic, Volume2, VolumeX,
  FileText, Image, ArrowLeft, StopCircle,
} from "lucide-react";
import { proxyApi, briefingApi } from "../../services/api";
import toast from "react-hot-toast";

const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;

export default function BriefingPage() {
  const { sessionId } = useParams();
  const navigate = useNavigate();

  const [messages, setMessages] = useState([
    { role: "bot", text: "Hi! I'm your AI proxy. Tell me everything I need to know to represent you in this meeting \u2014 your position, key facts, decisions, boundaries, talking points. You can also attach documents or images, or just talk to me using the mic button." },
  ]);
  const [input, setInput] = useState("");
  const [pendingFiles, setPendingFiles] = useState([]);
  const [done, setDone] = useState(false);
  const [totalChunks, setTotalChunks] = useState(0);

  const [isListening, setIsListening] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const recognitionRef = useRef(null);
  const synthRef = useRef(window.speechSynthesis);

  const bottomRef = useRef(null);
  const fileInputRef = useRef(null);
  const inputRef = useRef(null);

  const { data: session } = useQuery({
    queryKey: ["proxy-session", sessionId],
    queryFn: () => proxyApi.get(sessionId).then((r) => r.data.session),
  });

  const speakText = useCallback(
    (text) => {
      if (!voiceEnabled || !synthRef.current) return;
      synthRef.current.cancel();
      const cleaned = text.replace(/[\u{1F300}-\u{1F9FF}]/gu, "").trim();
      if (!cleaned) return;
      const utterance = new SpeechSynthesisUtterance(cleaned);
      utterance.rate = 1.05;
      utterance.pitch = 1;
      utterance.lang = "en-US";
      synthRef.current.speak(utterance);
    },
    [voiceEnabled]
  );

  const addBotMessage = useCallback(
    (text) => {
      setMessages((m) => [...m, { role: "bot", text }]);
      speakText(text);
    },
    [speakText]
  );

  const chatMutation = useMutation({
    mutationFn: (userMessage) =>
      briefingApi.chat({ proxySessionId: sessionId, userMessage, chatHistory: messages }),
    onSuccess: (r) => {
      addBotMessage(r.data.reply);
      if (r.data.chunks_added > 0) setTotalChunks((c) => c + r.data.chunks_added);
    },
    onError: () => addBotMessage("Sorry, something went wrong. Please try again."),
  });

  const uploadMutation = useMutation({
    mutationFn: (files) => briefingApi.upload(sessionId, files),
    onSuccess: (r) => {
      const data = r.data;
      setTotalChunks((c) => c + data.total_new_chunks);
      const names = data.files.map((f) => f.filename).join(", ");
      addBotMessage(
        `Got it! I've processed ${data.files.length} file(s): ${names}. That's ${data.total_new_chunks} new knowledge chunks stored. Keep going or click "Finish Briefing" when you're done.`
      );
    },
    onError: () => addBotMessage("Failed to process files. Please try again."),
  });

  const finalizeMutation = useMutation({
    mutationFn: () => briefingApi.finalize({ proxySessionId: sessionId }),
    onSuccess: () => {
      toast.success("Briefing complete! Bot is ready.");
      setDone(true);
    },
    onError: (err) => toast.error(err.response?.data?.error || "Add some information first"),
  });

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Cleanup recognition on unmount
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        try { recognitionRef.current.abort(); } catch {}
      }
    };
  }, []);

  const toggleListening = () => {
    if (!SpeechRecognition) {
      toast.error("Speech recognition not supported in this browser");
      return;
    }

    if (isListening) {
      if (recognitionRef.current) {
        try { recognitionRef.current.stop(); } catch {}
      }
      setIsListening(false);
      return;
    }

    // Create a fresh instance every time
    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = "en-US";
    recognition.maxAlternatives = 1;

    recognition.onresult = (event) => {
      let finalTranscript = "";
      let interimTranscript = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const t = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += t;
        } else {
          interimTranscript += t;
        }
      }
      if (finalTranscript) {
        setInput((prev) => (prev ? prev + " " + finalTranscript : finalTranscript));
      }
    };

    recognition.onerror = (event) => {
      console.error("Speech recognition error:", event.error);
      if (event.error === "not-allowed") {
        toast.error("Microphone access denied. Please allow mic permission.");
      } else if (event.error === "no-speech") {
        toast.error("No speech detected. Try again.");
      } else if (event.error === "network") {
        toast.error("Speech recognition requires internet. Check your connection or try typing instead.");
      } else if (event.error === "aborted") {
        // User cancelled, no toast needed
      } else {
        toast.error(`Mic error: ${event.error}`);
      }
      setIsListening(false);
    };

    recognition.onend = () => {
      setIsListening(false);
    };

    recognitionRef.current = recognition;

    try {
      recognition.start();
      setIsListening(true);
    } catch (err) {
      console.error("Failed to start speech recognition:", err);
      toast.error("Failed to start microphone");
      setIsListening(false);
    }
  };

  const handleSend = () => {
    const hasText = input.trim().length > 0;
    const hasFiles = pendingFiles.length > 0;
    if (!hasText && !hasFiles) return;
    if (chatMutation.isPending || uploadMutation.isPending) return;

    if (hasText || hasFiles) {
      setMessages((m) => [
        ...m,
        {
          role: "user",
          text: hasText ? input.trim() : null,
          files: hasFiles ? pendingFiles.map((f) => ({ name: f.name, type: f.type })) : null,
        },
      ]);
    }

    const textMsg = input.trim();
    const filesToUpload = [...pendingFiles];
    setInput("");
    setPendingFiles([]);

    if (filesToUpload.length > 0) uploadMutation.mutate(filesToUpload);
    if (textMsg) chatMutation.mutate(textMsg);
  };

  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) setPendingFiles((prev) => [...prev, ...files]);
    e.target.value = "";
  };

  const removePendingFile = (idx) => setPendingFiles((prev) => prev.filter((_, i) => i !== idx));

  const handleCancel = () => {
    if (totalChunks > 0 && !window.confirm("You have briefing data stored. Are you sure you want to leave?"))
      return;
    synthRef.current?.cancel();
    navigate("/");
  };

  const fileIcon = (name) => {
    if (/\.(png|jpe?g|gif|webp|svg)$/i.test(name))
      return <Image size={14} style={{ color: "#7B61FF" }} />;
    return <FileText size={14} style={{ color: "#00D4FF" }} />;
  };

  const isLoading = chatMutation.isPending || uploadMutation.isPending;

  return (
    <div style={{ minHeight: "100vh", background: "#0A0E1A", display: "flex", flexDirection: "column", position: "relative" }}>
      {/* Background */}
      <div style={{ position: "fixed", inset: 0, overflow: "hidden", pointerEvents: "none" }}>
        <div style={{ position: "absolute", top: -100, left: "50%", width: 500, height: 500, background: "radial-gradient(ellipse, rgba(0,212,255,0.03), transparent 70%)", borderRadius: "50%", transform: "translateX(-50%)" }} />
        <div style={{ position: "absolute", bottom: -100, right: -50, width: 400, height: 400, background: "radial-gradient(ellipse, rgba(123,97,255,0.03), transparent 70%)", borderRadius: "50%" }} />
      </div>

      {/* Header */}
      <div style={{ borderBottom: "1px solid rgba(30,45,69,0.6)", padding: "0.65rem 1.25rem", display: "flex", alignItems: "center", gap: "0.75rem", background: "rgba(10,14,26,0.85)", backdropFilter: "blur(12px)", position: "relative", zIndex: 10 }}>
        <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, height: 1, background: "linear-gradient(90deg, transparent, rgba(0,212,255,0.2), rgba(123,97,255,0.2), transparent)" }} />

        <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={handleCancel}
          style={{ width: 34, height: 34, borderRadius: "0.5rem", background: "rgba(90,106,138,0.1)", border: "1px solid rgba(30,45,69,0.5)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#5A6A8A", transition: "all 0.2s", flexShrink: 0 }}
          onMouseEnter={(e) => { e.currentTarget.style.color = "#E8F0FE"; e.currentTarget.style.borderColor = "rgba(0,212,255,0.3)"; }}
          onMouseLeave={(e) => { e.currentTarget.style.color = "#5A6A8A"; e.currentTarget.style.borderColor = "rgba(30,45,69,0.5)"; }}>
          <ArrowLeft size={16} />
        </motion.button>

        <motion.div animate={{ rotate: [0, 3, -3, 0] }} transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
          style={{ width: 36, height: 36, background: "linear-gradient(135deg, #00D4FF, #7B61FF)", borderRadius: "0.625rem", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.1rem", boxShadow: "0 0 14px rgba(0,212,255,0.2)", flexShrink: 0 }}>
          🤖
        </motion.div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <h1 style={{ fontFamily: "Syne, sans-serif", fontWeight: 700, color: "#E8F0FE", fontSize: "0.95rem" }}>Bot Briefing</h1>
          <p style={{ color: "#5A6A8A", fontSize: "0.68rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {session?.meeting?.title || "Loading..."}
          </p>
        </div>

        {totalChunks > 0 && (
          <div style={{ background: "rgba(0,255,148,0.08)", border: "1px solid rgba(0,255,148,0.2)", padding: "0.2rem 0.6rem", borderRadius: "2rem", fontSize: "0.65rem", fontWeight: 600, color: "#00FF94", flexShrink: 0, whiteSpace: "nowrap" }}>
            {totalChunks} chunks
          </div>
        )}

        {/* Voice toggle */}
        <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
          onClick={() => { setVoiceEnabled((v) => !v); synthRef.current?.cancel(); }}
          title={voiceEnabled ? "Mute bot voice" : "Enable bot voice"}
          style={{ width: 34, height: 34, borderRadius: "0.5rem", background: voiceEnabled ? "rgba(0,212,255,0.1)" : "rgba(90,106,138,0.1)", border: `1px solid ${voiceEnabled ? "rgba(0,212,255,0.25)" : "rgba(30,45,69,0.5)"}`, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: voiceEnabled ? "#00D4FF" : "#5A6A8A", transition: "all 0.2s", flexShrink: 0 }}>
          {voiceEnabled ? <Volume2 size={15} /> : <VolumeX size={15} />}
        </motion.button>

        <motion.button whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }} onClick={handleCancel}
          style={{ padding: "0.35rem 0.7rem", borderRadius: "0.5rem", background: "rgba(255,80,80,0.08)", border: "1px solid rgba(255,80,80,0.2)", color: "#FF5050", cursor: "pointer", fontSize: "0.72rem", fontWeight: 600, display: "flex", alignItems: "center", gap: "0.25rem", transition: "all 0.2s", flexShrink: 0 }}
          onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,80,80,0.15)")}
          onMouseLeave={(e) => (e.currentTarget.style.background = "rgba(255,80,80,0.08)")}>
          <X size={13} /> Cancel
        </motion.button>
      </div>

      {/* Chat area */}
      <div style={{ flex: 1, overflowY: "auto", position: "relative" }}>
        <div style={{ maxWidth: 740, width: "100%", margin: "0 auto", padding: "1.25rem 1rem", display: "flex", flexDirection: "column", gap: "0.625rem" }}>
          <AnimatePresence initial={false}>
            {messages.map((m, i) => (
              <motion.div key={i} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}
                style={{ display: "flex", gap: "0.5rem", flexDirection: m.role === "user" ? "row-reverse" : "row", alignItems: "flex-end" }}>

                <div style={{
                  width: 28, height: 28, borderRadius: "50%", flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.75rem",
                  background: m.role === "bot" ? "linear-gradient(135deg, #00D4FF, #7B61FF)" : "rgba(123,97,255,0.2)",
                }}>
                  {m.role === "bot" ? "🤖" : "👤"}
                </div>

                <div style={{ maxWidth: "82%", display: "flex", flexDirection: "column", gap: "0.375rem", alignItems: m.role === "user" ? "flex-end" : "flex-start" }}>
                  {/* Attached files */}
                  {m.files && m.files.length > 0 && (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "0.375rem" }}>
                      {m.files.map((f, fi) => (
                        <div key={fi} style={{ display: "flex", alignItems: "center", gap: "0.3rem", padding: "0.3rem 0.6rem", background: "rgba(123,97,255,0.12)", border: "1px solid rgba(123,97,255,0.2)", borderRadius: "0.5rem", fontSize: "0.72rem", color: "#E8F0FE" }}>
                          {fileIcon(f.name)}
                          <span style={{ maxWidth: 140, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.name}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Text bubble */}
                  {m.text && (
                    <div style={{
                      padding: "0.6rem 0.85rem", fontSize: "0.83rem", lineHeight: 1.55,
                      borderRadius: m.role === "bot" ? "0.125rem 0.875rem 0.875rem 0.875rem" : "0.875rem 0.125rem 0.875rem 0.875rem",
                      background: m.role === "bot" ? "rgba(20,28,46,0.8)" : "linear-gradient(135deg, #00D4FF, #0092B3)",
                      border: m.role === "bot" ? "1px solid rgba(30,45,69,0.6)" : "none",
                      color: m.role === "bot" ? "#E8F0FE" : "#0A0E1A",
                      fontWeight: m.role === "user" ? 500 : 400,
                      whiteSpace: "pre-wrap",
                    }}>
                      {m.text}
                    </div>
                  )}
                </div>
              </motion.div>
            ))}
          </AnimatePresence>

          {/* Typing indicator */}
          {isLoading && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ display: "flex", gap: "0.5rem", alignItems: "flex-end" }}>
              <div style={{ width: 28, height: 28, borderRadius: "50%", background: "linear-gradient(135deg, #00D4FF, #7B61FF)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.75rem" }}>🤖</div>
              <div style={{ padding: "0.6rem 0.85rem", borderRadius: "0.125rem 0.875rem 0.875rem 0.875rem", background: "rgba(20,28,46,0.8)", border: "1px solid rgba(30,45,69,0.6)", display: "flex", gap: "0.3rem", alignItems: "center" }}>
                <motion.span animate={{ opacity: [0.3, 1, 0.3] }} transition={{ duration: 0.8, repeat: Infinity, delay: 0 }} style={{ width: 6, height: 6, borderRadius: "50%", background: "#00D4FF" }} />
                <motion.span animate={{ opacity: [0.3, 1, 0.3] }} transition={{ duration: 0.8, repeat: Infinity, delay: 0.2 }} style={{ width: 6, height: 6, borderRadius: "50%", background: "#00D4FF" }} />
                <motion.span animate={{ opacity: [0.3, 1, 0.3] }} transition={{ duration: 0.8, repeat: Infinity, delay: 0.4 }} style={{ width: 6, height: 6, borderRadius: "50%", background: "#00D4FF" }} />
              </div>
            </motion.div>
          )}

          <div ref={bottomRef} />
        </div>
      </div>

      {/* Done overlay */}
      <AnimatePresence>
        {done && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.7)", backdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 50, padding: "1.5rem" }}>
            <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ type: "spring", damping: 20 }}
              style={{ maxWidth: 420, width: "100%", textAlign: "center", padding: "2.5rem 2rem", background: "rgba(15,20,35,0.95)", border: "1px solid rgba(30,45,69,0.6)", borderRadius: "1.25rem" }}>
              <div style={{ width: 64, height: 64, borderRadius: "50%", background: "rgba(0,255,148,0.1)", border: "1px solid rgba(0,255,148,0.25)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 1rem" }}>
                <CheckCircle size={32} color="#00FF94" />
              </div>
              <h2 style={{ fontFamily: "Syne, sans-serif", fontWeight: 700, color: "#E8F0FE", fontSize: "1.3rem", marginBottom: "0.375rem" }}>Bot is Briefed & Ready!</h2>
              <p style={{ color: "#5A6A8A", fontSize: "0.82rem", marginBottom: "0.25rem" }}>{totalChunks} knowledge chunks stored</p>
              <p style={{ color: "#5A6A8A", fontSize: "0.78rem", marginBottom: "1.5rem" }}>Go to dashboard to activate your bot.</p>
              <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }} onClick={() => navigate("/")}
                className="btn-primary" style={{ display: "inline-flex", alignItems: "center", gap: "0.5rem", padding: "0.75rem 1.5rem", fontSize: "0.9rem" }}>
                Go to Dashboard <ArrowRight size={18} />
              </motion.button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Input bar */}
      {!done && (
        <div style={{ borderTop: "1px solid rgba(30,45,69,0.6)", background: "rgba(10,14,26,0.9)", backdropFilter: "blur(12px)", padding: "0.625rem 1rem", position: "relative", zIndex: 10 }}>
          <div style={{ maxWidth: 740, margin: "0 auto" }}>
            {/* Pending files preview */}
            <AnimatePresence>
              {pendingFiles.length > 0 && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                  style={{ display: "flex", flexWrap: "wrap", gap: "0.375rem", paddingBottom: "0.5rem" }}>
                  {pendingFiles.map((f, i) => (
                    <div key={i} style={{ display: "flex", alignItems: "center", gap: "0.3rem", padding: "0.25rem 0.5rem", background: "rgba(0,212,255,0.08)", border: "1px solid rgba(0,212,255,0.2)", borderRadius: "0.5rem", fontSize: "0.7rem", color: "#E8F0FE" }}>
                      {fileIcon(f.name)}
                      <span style={{ maxWidth: 120, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.name}</span>
                      <button onClick={() => removePendingFile(i)}
                        style={{ background: "none", border: "none", cursor: "pointer", color: "#5A6A8A", padding: 0, display: "flex", lineHeight: 1 }}
                        onMouseEnter={(e) => (e.currentTarget.style.color = "#FF5050")}
                        onMouseLeave={(e) => (e.currentTarget.style.color = "#5A6A8A")}>
                        <X size={12} />
                      </button>
                    </div>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Input row */}
            <div style={{ display: "flex", alignItems: "flex-end", gap: "0.375rem" }}>
              {/* Attach */}
              <motion.button whileHover={{ scale: 1.08 }} whileTap={{ scale: 0.92 }}
                onClick={() => fileInputRef.current?.click()}
                style={{ width: 38, height: 38, borderRadius: "0.625rem", background: "rgba(90,106,138,0.1)", border: "1px solid rgba(30,45,69,0.5)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#5A6A8A", transition: "all 0.2s", flexShrink: 0 }}
                onMouseEnter={(e) => { e.currentTarget.style.color = "#00D4FF"; e.currentTarget.style.borderColor = "rgba(0,212,255,0.3)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.color = "#5A6A8A"; e.currentTarget.style.borderColor = "rgba(30,45,69,0.5)"; }}>
                <Paperclip size={17} />
              </motion.button>
              <input ref={fileInputRef} type="file" multiple hidden
                accept=".pdf,.txt,.md,.csv,.json,.png,.jpg,.jpeg,.webp,.gif,.docx,.doc"
                onChange={handleFileSelect} />

              {/* Text input */}
              <div style={{ flex: 1 }}>
                <input ref={inputRef} className="input-field"
                  style={{ width: "100%" }}
                  placeholder={isListening ? "Listening..." : "Type a message, or press mic to speak..."}
                  value={input} onChange={(e) => setInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                  disabled={isLoading} />
              </div>

              {/* Mic */}
              <motion.button whileHover={{ scale: 1.08 }} whileTap={{ scale: 0.92 }}
                onClick={toggleListening}
                style={{
                  width: 38, height: 38, borderRadius: "0.625rem", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0, transition: "all 0.2s",
                  background: isListening ? "rgba(255,80,80,0.15)" : "rgba(90,106,138,0.1)",
                  border: `1px solid ${isListening ? "rgba(255,80,80,0.4)" : "rgba(30,45,69,0.5)"}`,
                  color: isListening ? "#FF5050" : "#5A6A8A",
                }}
                onMouseEnter={(e) => { if (!isListening) { e.currentTarget.style.color = "#7B61FF"; e.currentTarget.style.borderColor = "rgba(123,97,255,0.3)"; } }}
                onMouseLeave={(e) => { if (!isListening) { e.currentTarget.style.color = "#5A6A8A"; e.currentTarget.style.borderColor = "rgba(30,45,69,0.5)"; } }}>
                {isListening ? <StopCircle size={17} /> : <Mic size={17} />}
              </motion.button>

              {/* Send */}
              <motion.button whileHover={{ scale: 1.08 }} whileTap={{ scale: 0.92 }}
                onClick={handleSend} disabled={(!input.trim() && pendingFiles.length === 0) || isLoading}
                style={{
                  width: 38, height: 38, borderRadius: "0.625rem", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", flexShrink: 0, transition: "all 0.2s",
                  background: (input.trim() || pendingFiles.length > 0) ? "linear-gradient(135deg, #00D4FF, #7B61FF)" : "rgba(90,106,138,0.1)",
                  border: "none",
                  color: (input.trim() || pendingFiles.length > 0) ? "#0A0E1A" : "#5A6A8A",
                  opacity: isLoading ? 0.5 : 1,
                }}>
                <Send size={17} />
              </motion.button>
            </div>

            {/* Finalize bar */}
            {totalChunks > 0 && (
              <motion.div initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }}
                style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: "0.5rem", padding: "0.5rem 0.625rem", background: "rgba(0,255,148,0.04)", border: "1px solid rgba(0,255,148,0.12)", borderRadius: "0.625rem" }}>
                <span style={{ color: "#5A6A8A", fontSize: "0.75rem" }}>
                  <span style={{ color: "#00D4FF", fontWeight: 600 }}>{totalChunks}</span> knowledge chunks stored
                </span>
                <motion.button whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
                  onClick={() => finalizeMutation.mutate()} disabled={finalizeMutation.isPending}
                  style={{
                    padding: "0.35rem 0.85rem", borderRadius: "0.5rem", border: "none", cursor: "pointer",
                    background: "linear-gradient(135deg, #00D4FF, #7B61FF)", color: "#0A0E1A",
                    fontSize: "0.75rem", fontWeight: 700, display: "flex", alignItems: "center", gap: "0.35rem",
                    opacity: finalizeMutation.isPending ? 0.6 : 1,
                  }}>
                  {finalizeMutation.isPending ? "Finalizing..." : (<><CheckCircle size={13} /> Finish Briefing</>)}
                </motion.button>
              </motion.div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
