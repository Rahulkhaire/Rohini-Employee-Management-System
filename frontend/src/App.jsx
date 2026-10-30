import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./auth.jsx";
import Layout from "./components/Layout.jsx";
import Login from "./pages/Login.jsx";
import Dashboard from "./pages/Dashboard.jsx";
import Tasks from "./pages/Tasks.jsx";
import Team from "./pages/Team.jsx";
import EmailLog from "./pages/EmailLog.jsx";
import Profile from "./pages/Profile.jsx";
import Attendance from "./pages/Attendance.jsx";

export default function App() {
  const { user, loading, isAdmin } = useAuth();
  if (loading) return <div className="center-screen">Loading…</div>;
  if (!user) return <Login />;

  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Dashboard />} />
        <Route path="/tasks" element={<Tasks />} />
        <Route path="/attendance" element={<Attendance />} />
        <Route path="/team" element={isAdmin ? <Team /> : <Navigate to="/" replace />} />
        <Route path="/emails" element={isAdmin ? <EmailLog /> : <Navigate to="/" replace />} />
        <Route path="/profile" element={<Profile />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  );
}
