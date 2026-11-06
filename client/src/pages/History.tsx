import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api, type DebateSummary } from "../api";
import { Button, Notice } from "../components/ui";

export function History() {
  const [items, setItems] = useState<DebateSummary[]>([]);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    const data = await api.listDebates();
    setItems(data.items);
  }

  useEffect(() => {
    load().catch((err) => setError(err.message));
  }, []);

  async function remove(id: string) {
    if (!window.confirm("Delete this debate, transcript and analysis? This cannot be undone.")) return;
    await api.deleteDebate(id);
    await load();
  }

  return (
    <div className="space-y-6">
      <h1 className="font-display text-4xl text-navy">Session history</h1>
      {error ? <Notice tone="error">{error}</Notice> : null}
      {items.length === 0 ? (
        <div className="paper rounded-2xl p-8 text-center text-muted">No saved debates yet.</div>
      ) : (
        <ul className="paper divide-y divide-line rounded-2xl">
          {items.map((session) => (
            <li key={session.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
              <div>
                <p className="font-semibold text-navy">{session.topic}</p>
                <p className="text-sm text-muted">
                  {session.startedAt ? new Date(session.startedAt).toLocaleString() : "unstarted"} · {session.status} ·
                  score {session.overallScore ?? "—"}
                </p>
              </div>
              <div className="flex gap-2">
                <Link to={`/app/analysis/${session.id}`}>
                  <Button variant="secondary">Open</Button>
                </Link>
                <Button variant="danger" onClick={() => void remove(session.id)}>
                  Delete
                </Button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
