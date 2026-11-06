import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "../auth";
import { Button } from "./ui";

export function AppShell() {
  const { user, logout, aiMode } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen">
      <header className="border-b border-line bg-navy text-ivory">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-4 py-3">
          <NavLink to="/app" className="font-display whitespace-nowrap text-lg tracking-tight sm:text-xl">
            AI Debate Partner
          </NavLink>
          <nav className="flex flex-wrap items-center justify-end gap-x-3 gap-y-2 text-sm">
            <NavLink to="/app" end className={({ isActive }) => (isActive ? "text-gold" : "text-ivory/80")}>
              Dashboard
            </NavLink>
            <NavLink to="/app/history" className={({ isActive }) => (isActive ? "text-gold" : "text-ivory/80")}>
              History
            </NavLink>
            <NavLink to="/app/settings" className={({ isActive }) => (isActive ? "text-gold" : "text-ivory/80")}>
              Settings
            </NavLink>
            <span className="hidden text-ivory/60 sm:inline">{user?.displayName}</span>
            <Button
              variant="secondary"
              className="whitespace-nowrap !bg-transparent !text-ivory !border-ivory/30"
              onClick={async () => {
                await logout();
                navigate("/");
              }}
            >
              Sign out
            </Button>
          </nav>
        </div>
      </header>
      {aiMode === "mock" ? (
        <div className="bg-gold/15 px-4 py-2 text-center text-sm text-navy">
          Demonstration mode is on. Put <code>OPENAI_API_KEY</code> in <code>server/.env</code> and restart the API for
          live opponent replies and analysis.
        </div>
      ) : null}
      <main className="mx-auto max-w-6xl px-4 py-8">
        <Outlet />
      </main>
    </div>
  );
}

export function GuestShell() {
  return (
    <div className="min-h-screen">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-4 py-6">
        <Link to="/" className="font-display text-2xl text-navy">
          AI Debate Partner
        </Link>
        <nav className="flex gap-3">
          <Link className="rounded-md px-3 py-2 text-sm font-semibold text-navy" to="/login">
            Sign in
          </Link>
          <Link className="rounded-md bg-navy px-3 py-2 text-sm font-semibold text-ivory" to="/register">
            Create account
          </Link>
        </nav>
      </header>
      <Outlet />
    </div>
  );
}
