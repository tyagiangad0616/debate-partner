import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { CATEGORY_LABELS } from "@shared/types";
import { roundForDisplay } from "@shared/scores";
import { api, ApiError, type DebateDetail } from "../api";
import { Button, Notice } from "../components/ui";

export function Analysis() {
  const { id } = useParams();
  const [session, setSession] = useState<DebateDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function load() {
    if (!id) return;
    const data = await api.getDebate(id);
    setSession(data);
  }

  useEffect(() => {
    load().catch((err) => setError(err.message));
  }, [id]);

  async function retry() {
    if (!id) return;
    setPending(true);
    setError(null);
    try {
      setSession(await api.completeDebate(id));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Analysis retry failed.");
    } finally {
      setPending(false);
    }
  }

  if (!session) return <p className="text-muted">{error ?? "Loading report…"}</p>;
  const report = session.analysis;

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm uppercase tracking-[0.18em] text-gold">Post-debate report</p>
        <h1 className="font-display text-4xl text-navy">{session.topic}</h1>
        <p className="mt-2 text-muted">
          {session.userPosition} · rubric {session.rubricVersion} · scores are AI-generated estimates
        </p>
      </div>
      {error ? <Notice tone="error">{error}</Notice> : null}
      {!report ? (
        <div className="paper rounded-2xl p-6">
          <p>The transcript is saved, but analysis is not available yet.</p>
          <Button className="mt-4" onClick={() => void retry()} disabled={pending}>
            {pending ? "Retrying…" : "Retry analysis"}
          </Button>
        </div>
      ) : (
        <>
          <section className="grid gap-4 md:grid-cols-3">
            <article className="paper rounded-2xl p-5 md:col-span-1">
              <p className="text-sm text-muted">Overall</p>
              <p className="font-display text-6xl text-navy">{roundForDisplay(report.overallScore)}</p>
              <p className="text-xs text-muted">Unweighted mean of five dimensions, 0–10.</p>
            </article>
            <article className="paper rounded-2xl p-5 md:col-span-2">
              <h2 className="font-display text-2xl text-navy">Category scores</h2>
              <ul className="mt-3 space-y-2">
                {Object.entries(report.categoryScores).map(([key, value]) => (
                  <li key={key} className="flex items-center justify-between gap-4">
                    <span>{CATEGORY_LABELS[key as keyof typeof CATEGORY_LABELS]}</span>
                    <span className="font-semibold">{roundForDisplay(value)}</span>
                  </li>
                ))}
              </ul>
            </article>
          </section>

          <section className="grid gap-4 md:grid-cols-2">
            <ListCard title="Strengths" items={report.strengths.map((item) => ({ heading: item.title, quote: item.evidenceQuote, body: item.explanation }))} />
            <ListCard title="Weaknesses" items={report.weaknesses.map((item) => ({ heading: item.title, quote: item.evidenceQuote, body: item.suggestion ?? item.explanation }))} />
          </section>

          <section className="paper rounded-2xl p-5">
            <h2 className="font-display text-2xl text-navy">Possible fallacies</h2>
            {report.possibleFallacies.length === 0 ? (
              <p className="mt-2 text-muted">No clear fallacy was flagged. That is the correct result when evidence is thin.</p>
            ) : (
              <ul className="mt-3 space-y-3">
                {report.possibleFallacies.map((item) => (
                  <li key={item.name} className="rounded-lg border border-line p-3">
                    <p className="font-semibold">
                      {item.name} · {item.confidence} confidence
                    </p>
                    <blockquote className="mt-1 italic text-muted">“{item.evidenceQuote}”</blockquote>
                    <p className="mt-1">{item.explanation}</p>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="paper rounded-2xl p-5">
            <h2 className="font-display text-2xl text-navy">Speech metrics</h2>
            <dl className="mt-3 grid gap-3 sm:grid-cols-4">
              <Metric label="Words" value={String(report.speechMetrics.wordCount)} />
              <Metric label="Fillers" value={String(report.speechMetrics.fillerWordCount)} />
              <Metric
                label="Duration"
                value={
                  report.speechMetrics.speakingDurationSeconds
                    ? `${Math.round(report.speechMetrics.speakingDurationSeconds)}s`
                    : "n/a"
                }
              />
              <Metric
                label="Words / min"
                value={report.speechMetrics.wordsPerMinute ? String(Math.round(report.speechMetrics.wordsPerMinute)) : "n/a"}
              />
            </dl>
            <ul className="mt-3 list-disc pl-5 text-sm text-muted">
              {report.speechMetrics.limitations.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </section>

          <section className="paper rounded-2xl p-5">
            <h2 className="font-display text-2xl text-navy">Next steps</h2>
            <ol className="mt-3 list-decimal space-y-1 pl-5">
              {report.nextSteps.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
          </section>
        </>
      )}

      <section className="paper rounded-2xl p-5">
        <h2 className="font-display text-2xl text-navy">Transcript</h2>
        <ol className="mt-3 space-y-3">
          {session.messages.map((message) => (
            <li key={message.id}>
              <p className="text-xs uppercase tracking-wide text-gold">{message.speaker}</p>
              <p>{message.content}</p>
            </li>
          ))}
        </ol>
      </section>
      <Link to="/app" className="text-sm font-semibold text-accent">
        Back to dashboard
      </Link>
    </div>
  );
}

function ListCard({
  title,
  items,
}: {
  title: string;
  items: Array<{ heading: string; quote: string; body?: string }>;
}) {
  return (
    <article className="paper rounded-2xl p-5">
      <h2 className="font-display text-2xl text-navy">{title}</h2>
      <ul className="mt-3 space-y-3">
        {items.map((item) => (
          <li key={item.heading}>
            <p className="font-semibold">{item.heading}</p>
            <blockquote className="italic text-muted">“{item.quote}”</blockquote>
            {item.body ? <p className="text-sm">{item.body}</p> : null}
          </li>
        ))}
      </ul>
    </article>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted">{label}</p>
      <p className="font-display text-2xl text-navy">{value}</p>
    </div>
  );
}
