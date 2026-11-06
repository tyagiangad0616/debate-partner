import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { api, type DashboardSummary } from "../api";
import { roundForDisplay } from "@shared/scores";
import { Button, Notice } from "../components/ui";

export function Dashboard() {
  const [data, setData] = useState<DashboardSummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api.dashboard().then(setData).catch((err) => setError(err.message));
  }, []);

  if (error) return <Notice tone="error">{error}</Notice>;
  if (!data) return <p className="text-muted">Loading dashboard…</p>;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-sm uppercase tracking-[0.18em] text-gold">Practice record</p>
          <h1 className="font-display text-4xl text-navy">Dashboard</h1>
        </div>
        <Link to="/app/setup">
          <Button>Start a debate</Button>
        </Link>
      </div>

      {data.active ? (
        <Notice>
          You have an active debate on “{data.active.topic}”.{" "}
          <Link className="font-semibold" to={`/app/debate/${data.active.id}`}>
            Resume
          </Link>
        </Notice>
      ) : null}

      <section className="grid gap-4 md:grid-cols-3">
        <Metric label="Completed analyses" value={String(data.totalCompleted)} hint={`${data.totalSessions} total sessions`} />
        <Metric
          label="Average overall score"
          value={data.averageScore == null ? "—" : String(roundForDisplay(data.averageScore))}
          hint={`Rubric v1 • n = ${data.sampleCount}`}
        />
        <Metric
          label="Trend context"
          value={data.sampleCount < 2 ? "Need 2+" : "Ready"}
          hint="Trends are shown only from saved analyses."
        />
      </section>

      <section className="paper rounded-2xl p-5">
        <h2 className="font-display text-2xl text-navy">Score trend</h2>
        {data.trend.length < 2 ? (
          <p className="mt-4 text-muted">Complete at least two analysed debates to see a trend line.</p>
        ) : (
          <div className="mt-4 h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data.trend.map((point, index) => ({ ...point, index: index + 1 }))}>
                <CartesianGrid stroke="#d9ccb6" strokeDasharray="4 4" />
                <XAxis dataKey="index" />
                <YAxis domain={[0, 10]} />
                <Tooltip />
                <Line type="monotone" dataKey="overallScore" stroke="#255ea8" strokeWidth={2} dot />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </section>

      <section>
        <h2 className="font-display text-2xl text-navy">Recent sessions</h2>
        {data.recent.length === 0 ? (
          <div className="paper mt-4 rounded-2xl p-8 text-center">
            <p className="text-muted">No debates yet. Start a short round to generate your first report.</p>
            <Link to="/app/setup" className="mt-4 inline-block">
              <Button>Start a debate</Button>
            </Link>
          </div>
        ) : (
          <ul className="mt-4 divide-y divide-line paper rounded-2xl">
            {data.recent.map((session) => (
              <li key={session.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
                <div>
                  <p className="font-semibold text-navy">{session.topic}</p>
                  <p className="text-sm text-muted">
                    {session.userPosition} · {session.status} · {session.overallScore ?? "no score yet"}
                  </p>
                </div>
                <Link className="text-sm font-semibold text-accent" to={`/app/analysis/${session.id}`}>
                  Open
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function Metric({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <article className="paper rounded-2xl p-5">
      <p className="text-sm text-muted">{label}</p>
      <p className="mt-2 font-display text-4xl text-navy">{value}</p>
      <p className="mt-2 text-xs text-muted">{hint}</p>
    </article>
  );
}
