import { Routes, Route, Navigate } from "react-router-dom";
import { useAuthStore } from "./store/auth.store";
import LoginPage    from "./components/dashboard/LoginPage";
import Dashboard    from "./components/dashboard/Dashboard";
import BriefingPage from "./components/briefing/BriefingPage";
import MeetingRoom  from "./components/meeting/MeetingRoom";
import NotFound     from "./components/shared/NotFound";

function PrivateRoute({ children }) {
  const token = useAuthStore((s) => s.token);
  return token ? children : <Navigate to="/login" replace />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login"             element={<LoginPage />} />
      <Route path="/"                  element={<PrivateRoute><Dashboard /></PrivateRoute>} />
      <Route path="/brief/:sessionId"  element={<PrivateRoute><BriefingPage /></PrivateRoute>} />
      <Route path="/meeting/:roomCode" element={<PrivateRoute><MeetingRoom /></PrivateRoute>} />
      <Route path="*"                  element={<NotFound />} />
    </Routes>
  );
}