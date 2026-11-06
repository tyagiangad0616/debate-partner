import { Navigate, Outlet, Route, Routes } from "react-router-dom";
import { useAuth } from "./auth";
import { AppShell, GuestShell } from "./components/Layout";
import { Landing } from "./pages/Landing";
import { Login } from "./pages/Login";
import { Register } from "./pages/Register";
import { Dashboard } from "./pages/Dashboard";
import { Setup } from "./pages/Setup";
import { DebateRoom } from "./pages/DebateRoom";
import { Analysis } from "./pages/Analysis";
import { History } from "./pages/History";
import { Settings } from "./pages/Settings";

function Protected() {
  const { user, loading } = useAuth();
  if (loading) return <p className="p-8 text-muted">Loading session…</p>;
  if (!user) return <Navigate to="/login" replace />;
  return <Outlet />;
}

function GuestOnly() {
  const { user, loading } = useAuth();
  if (loading) return <p className="p-8 text-muted">Loading session…</p>;
  if (user) return <Navigate to="/app" replace />;
  return <Outlet />;
}

export function App() {
  return (
    <Routes>
      <Route element={<GuestOnly />}>
        <Route element={<GuestShell />}>
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
        </Route>
      </Route>
      <Route element={<Protected />}>
        <Route element={<AppShell />}>
          <Route path="/app" element={<Dashboard />} />
          <Route path="/app/setup" element={<Setup />} />
          <Route path="/app/debate/:id" element={<DebateRoom />} />
          <Route path="/app/analysis/:id" element={<Analysis />} />
          <Route path="/app/history" element={<History />} />
          <Route path="/app/settings" element={<Settings />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
