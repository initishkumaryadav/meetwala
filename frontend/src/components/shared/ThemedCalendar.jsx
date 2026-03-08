import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import { ChevronLeft, ChevronRight, Clock } from "lucide-react";

const DAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];
const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

export default function ThemedCalendar({ value, onChange }) {
  const now = new Date();
  const selected = value ? new Date(value) : null;
  const [viewYear, setViewYear] = useState(selected?.getFullYear() || now.getFullYear());
  const [viewMonth, setViewMonth] = useState(selected?.getMonth() ?? now.getMonth());
  const [hour, setHour] = useState(selected ? String(selected.getHours()).padStart(2, "0") : "10");
  const [minute, setMinute] = useState(selected ? String(selected.getMinutes()).padStart(2, "0") : "00");

  const todayStr = `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}`;

  const calendarDays = useMemo(() => {
    const first = new Date(viewYear, viewMonth, 1);
    const startDay = first.getDay();
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();
    const daysInPrevMonth = new Date(viewYear, viewMonth, 0).getDate();

    const days = [];

    // Previous month trailing days
    for (let i = startDay - 1; i >= 0; i--) {
      days.push({ day: daysInPrevMonth - i, outside: true, date: null });
    }

    // Current month days
    for (let d = 1; d <= daysInMonth; d++) {
      const date = new Date(viewYear, viewMonth, d);
      const isPast = date < new Date(now.getFullYear(), now.getMonth(), now.getDate());
      days.push({ day: d, outside: false, date, isPast });
    }

    // Next month leading days to fill grid
    const remaining = 42 - days.length;
    for (let d = 1; d <= remaining; d++) {
      days.push({ day: d, outside: true, date: null });
    }

    return days;
  }, [viewYear, viewMonth]);

  function prevMonth() {
    if (viewMonth === 0) { setViewMonth(11); setViewYear((y) => y - 1); }
    else setViewMonth((m) => m - 1);
  }

  function nextMonth() {
    if (viewMonth === 11) { setViewMonth(0); setViewYear((y) => y + 1); }
    else setViewMonth((m) => m + 1);
  }

  function selectDay(d) {
    if (d.outside || d.isPast) return;
    const dt = new Date(viewYear, viewMonth, d.day, parseInt(hour), parseInt(minute));
    const iso = toLocalISOString(dt);
    onChange(iso);
  }

  function handleTimeChange(h, m) {
    const hh = h ?? hour;
    const mm = m ?? minute;
    if (h !== undefined) setHour(hh);
    if (m !== undefined) setMinute(mm);
    if (selected) {
      const dt = new Date(selected.getFullYear(), selected.getMonth(), selected.getDate(), parseInt(hh), parseInt(mm));
      onChange(toLocalISOString(dt));
    }
  }

  function toLocalISOString(dt) {
    const y = dt.getFullYear();
    const mo = String(dt.getMonth() + 1).padStart(2, "0");
    const d = String(dt.getDate()).padStart(2, "0");
    const h = String(dt.getHours()).padStart(2, "0");
    const mi = String(dt.getMinutes()).padStart(2, "0");
    return `${y}-${mo}-${d}T${h}:${mi}`;
  }

  function isSelected(d) {
    if (!selected || d.outside) return false;
    return selected.getFullYear() === viewYear && selected.getMonth() === viewMonth && selected.getDate() === d.day;
  }

  function isToday(d) {
    return !d.outside && `${viewYear}-${viewMonth}-${d.day}` === todayStr;
  }

  const navBtn = {
    width: 30, height: 30, borderRadius: "0.5rem", border: "1px solid rgba(30,45,69,0.6)",
    background: "rgba(20,28,46,0.6)", color: "#5A6A8A", cursor: "pointer",
    display: "flex", alignItems: "center", justifyContent: "center", transition: "all 0.2s",
  };

  return (
    <div style={{ background: "rgba(10,14,26,0.6)", borderRadius: "0.75rem", border: "1px solid rgba(30,45,69,0.6)", padding: "0.875rem", userSelect: "none" }}>

      {/* Month/Year Navigation */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.75rem" }}>
        <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} onClick={prevMonth} style={navBtn}>
          <ChevronLeft size={16} />
        </motion.button>
        <span style={{ fontFamily: "Syne, sans-serif", fontWeight: 600, fontSize: "0.9rem", color: "#E8F0FE" }}>
          {MONTHS[viewMonth]} {viewYear}
        </span>
        <motion.button whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.9 }} onClick={nextMonth} style={navBtn}>
          <ChevronRight size={16} />
        </motion.button>
      </div>

      {/* Day Headers */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 2, marginBottom: "0.25rem" }}>
        {DAYS.map((d) => (
          <div key={d} style={{ textAlign: "center", fontSize: "0.65rem", fontWeight: 600, color: "#5A6A8A", padding: "0.25rem 0", letterSpacing: "0.05em" }}>
            {d}
          </div>
        ))}
      </div>

      {/* Calendar Grid */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 2 }}>
        {calendarDays.map((d, i) => {
          const sel = isSelected(d);
          const today = isToday(d);
          const disabled = d.outside || d.isPast;

          return (
            <motion.button
              key={i}
              whileHover={disabled ? {} : { scale: 1.15 }}
              whileTap={disabled ? {} : { scale: 0.9 }}
              onClick={() => selectDay(d)}
              style={{
                width: "100%", aspectRatio: "1", borderRadius: "0.5rem", border: "none",
                cursor: disabled ? "default" : "pointer",
                fontSize: "0.75rem", fontWeight: sel ? 700 : 500,
                display: "flex", alignItems: "center", justifyContent: "center",
                position: "relative",
                transition: "all 0.15s",
                background: sel
                  ? "linear-gradient(135deg, #00D4FF, #7B61FF)"
                  : today
                    ? "rgba(0,212,255,0.12)"
                    : disabled
                      ? "transparent"
                      : "rgba(20,28,46,0.4)",
                color: sel
                  ? "#0A0E1A"
                  : disabled
                    ? "#2A3550"
                    : today
                      ? "#00D4FF"
                      : "#E8F0FE",
                boxShadow: sel ? "0 0 12px rgba(0,212,255,0.3)" : "none",
              }}
            >
              {d.day}
              {today && !sel && (
                <div style={{ position: "absolute", bottom: 3, width: 4, height: 4, borderRadius: "50%", background: "#00D4FF" }} />
              )}
            </motion.button>
          );
        })}
      </div>

      {/* Time Picker */}
      <div style={{ marginTop: "0.75rem", paddingTop: "0.75rem", borderTop: "1px solid rgba(30,45,69,0.6)", display: "flex", alignItems: "center", gap: "0.625rem" }}>
        <Clock size={14} color="#5A6A8A" />
        <span style={{ color: "#5A6A8A", fontSize: "0.75rem", fontWeight: 500 }}>Time</span>
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: "0.25rem" }}>
          <select
            value={hour}
            onChange={(e) => handleTimeChange(e.target.value, undefined)}
            style={{
              background: "rgba(20,28,46,0.8)", border: "1px solid rgba(30,45,69,0.6)",
              borderRadius: "0.5rem", padding: "0.35rem 0.25rem", color: "#E8F0FE",
              fontSize: "0.8rem", fontFamily: "DM Mono, monospace", outline: "none",
              cursor: "pointer", textAlign: "center", appearance: "none", width: 48,
            }}
          >
            {Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0")).map((h) => (
              <option key={h} value={h} style={{ background: "#0A0E1A" }}>{h}</option>
            ))}
          </select>
          <span style={{ color: "#5A6A8A", fontWeight: 700, fontSize: "0.9rem" }}>:</span>
          <select
            value={minute}
            onChange={(e) => handleTimeChange(undefined, e.target.value)}
            style={{
              background: "rgba(20,28,46,0.8)", border: "1px solid rgba(30,45,69,0.6)",
              borderRadius: "0.5rem", padding: "0.35rem 0.25rem", color: "#E8F0FE",
              fontSize: "0.8rem", fontFamily: "DM Mono, monospace", outline: "none",
              cursor: "pointer", textAlign: "center", appearance: "none", width: 48,
            }}
          >
            {["00", "05", "10", "15", "20", "25", "30", "35", "40", "45", "50", "55"].map((m) => (
              <option key={m} value={m} style={{ background: "#0A0E1A" }}>{m}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Selected date display */}
      {selected && (
        <div style={{ marginTop: "0.5rem", textAlign: "center" }}>
          <span style={{ fontSize: "0.7rem", color: "#00D4FF", fontFamily: "DM Mono, monospace", background: "rgba(0,212,255,0.08)", padding: "0.2rem 0.5rem", borderRadius: "0.375rem", border: "1px solid rgba(0,212,255,0.15)" }}>
            {selected.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })} at {hour}:{minute}
          </span>
        </div>
      )}
    </div>
  );
}
