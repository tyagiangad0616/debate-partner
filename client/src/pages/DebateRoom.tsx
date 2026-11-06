import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { DEBATE_FLOORS, EXTENSION_SECONDS, floorAt, isUserFloor } from "@shared/floors";
import { formatClock, remainingSeconds } from "@shared/timer";
import { api, ApiError, type DebateDetail } from "../api";
import { useAuth } from "../auth";
import { speak, stopSpeaking, useSpeechRecognition } from "../hooks/useSpeech";
import { Button, Notice, Textarea } from "../components/ui";

export function DebateRoom() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [session, setSession] = useState<DebateDetail | null>(null);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [countdown, setCountdown] = useState<number | null>(null);
  const [askExtension, setAskExtension] = useState(false);
  const [remaining, setRemaining] = useState<number | null>(null);
  const yielding = useRef(false);
  const starting = useRef(false);
  const spokenFor = useRef<string | null>(null);
  const speech = useSpeechRecognition();

  useEffect(() => {
    if (!id) return;
    api.getDebate(id).then(setSession).catch((err) => setError(err.message));
  }, [id]);

  const floor = session ? floorAt(session.floorIndex) : null;
  const userHasFloor = Boolean(session && floor && isUserFloor(session.userPosition, floor));
  const speaking = session?.floorPhase === "speaking" || session?.floorPhase === "extension";
  const floorDuration =
    session?.floorPhase === "extension" ? EXTENSION_SECONDS : session?.durationSeconds ?? 60;

  useEffect(() => {
    if (!session?.floorStartedAt || !speaking) {
      setRemaining(null);
      return;
    }
    const tick = () => setRemaining(remainingSeconds(session.floorStartedAt, floorDuration));
    tick();
    const timer = window.setInterval(tick, 200);
    return () => window.clearInterval(timer);
  }, [session?.floorStartedAt, session?.floorPhase, floorDuration, speaking]);

  useEffect(() => {
    if (!session || !floor || !speaking || remaining !== 0 || yielding.current) return;
    speech.stop();
    stopSpeaking();
    if (userHasFloor && !session.extensionUsed) {
      setAskExtension(true);
      return;
    }
    void yieldFloor();
  }, [remaining, speaking, session?.extensionUsed, userHasFloor]);

  useEffect(() => {
    if (!session || !floor || !speaking || userHasFloor) return;
    const latestAi = session.messages.filter((message) => message.speaker === "ai").at(-1);
    if (!latestAi || spokenFor.current === latestAi.id) return;
    spokenFor.current = latestAi.id;
    speak(latestAi.content);
  }, [session?.messages, speaking, userHasFloor, user?.ttsEnabled, floor]);

  useEffect(() => {
    if (session?.mode === "voice" && userHasFloor && speaking && speech.supported && !speech.listening && !askExtension) {
      speech.start((text) => setDraft(text));
    }
    if (!userHasFloor || !speaking) speech.stop();
  }, [userHasFloor, speaking, session?.mode, askExtension]);

  useEffect(() => {
    if (!askExtension) return;
    const timer = window.setTimeout(() => void yieldFloor(), 15000);
    return () => window.clearTimeout(timer);
  }, [askExtension]);

  function runCountdown(then: () => void) {
    setCountdown(3);
    let value = 3;
    const timer = window.setInterval(() => {
      value -= 1;
      if (value <= 0) {
        window.clearInterval(timer);
        setCountdown(0);
        window.setTimeout(() => {
          setCountdown(null);
          then();
        }, 500);
      } else {
        setCountdown(value);
      }
    }, 1000);
  }

  async function startFloor(index: number) {
    if (!id || starting.current) return;
    starting.current = true;
    setBusy(true);
    setError(null);
    setDraft("");
    setAskExtension(false);
    try {
      setSession(await api.startFloor(id, index));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "The chair could not open that speech.");
    } finally {
      setBusy(false);
      starting.current = false;
    }
  }

  function callNext(index: number) {
    runCountdown(() => void startFloor(index));
  }

  async function yieldFloor() {
    if (!id || yielding.current) return;
    yielding.current = true;
    setAskExtension(false);
    setBusy(true);
    speech.stop();
    stopSpeaking();
    try {
      const next = await api.yieldFloor(id, {
        content: draft.trim(),
        speakingDurationSeconds: speech.elapsedSeconds(),
      });
      setSession(next);
      setDraft("");
      if (next.floorPhase === "closed") {
        const analysed = await api.completeDebate(id);
        navigate(`/app/analysis/${analysed.id}`);
        return;
      }
      callNext(next.floorIndex + 1);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "The floor could not be yielded.");
    } finally {
      yielding.current = false;
      setBusy(false);
    }
  }

  async function grantExtension() {
    if (!id) return;
    setAskExtension(false);
    try {
      setSession(await api.extendFloor(id));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "The extension could not be granted.");
    }
  }

  async function finishEarly() {
    if (!id) return;
    stopSpeaking();
    speech.stop();
    try {
      const analysed = await api.completeDebate(id);
      navigate(`/app/analysis/${analysed.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "The house could not be adjourned.");
    }
  }

  if (!session) return <p className="text-muted">{error ?? "The chamber is being prepared…"}</p>;

  const closed = session.status !== "active" || session.floorPhase === "closed";
  const latestAi = session.messages.filter((message) => message.speaker === "ai").at(-1);

  return (
    <div className="space-y-6">
      {countdown !== null ? (
        <div className="fixed inset-0 z-20 grid place-items-center bg-navy/90 text-ivory">
          <div className="text-center">
            <p className="text-sm uppercase tracking-[0.25em] text-gold">
              {floorAt(Math.max(session.floorIndex + (session.floorPhase === "handoff" ? 1 : 0), 0))?.title}
            </p>
            <p className="mt-4 font-display text-8xl">{countdown === 0 ? "Start" : countdown}</p>
          </div>
        </div>
      ) : null}

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm uppercase tracking-[0.18em] text-gold">The house is in session</p>
          <h1 className="font-display text-3xl text-navy">{session.topic}</h1>
          <p className="mt-1 text-sm text-muted">
            You sit for the {session.userPosition}. Each speech is {session.durationSeconds / 60} minute
            {session.durationSeconds === 60 ? "" : "s"}.
          </p>
        </div>
        {speaking ? (
          <div
            className={`rounded-full border px-5 py-3 font-display text-3xl ${(remaining ?? floorDuration) <= 10 ? "border-warn text-warn" : "border-line text-navy"}`}
            aria-live="polite"
          >
            {formatClock(remaining ?? floorDuration)}
          </div>
        ) : null}
      </div>

      {error ? <Notice tone="error">{error}</Notice> : null}

      {session.floorPhase === "briefing" ? (
        <section className="paper space-y-4 rounded-2xl p-6">
          <h2 className="font-display text-3xl text-navy">Order of speeches</h2>
          <ol className="space-y-2">
            {DEBATE_FLOORS.map((item) => (
              <li key={item.index} className="flex justify-between gap-4 border-b border-line py-2">
                <span>
                  {item.title}
                  {item.side === session.userPosition ? " — you" : " — opponent"}
                </span>
                <span className="text-muted">{formatClock(session.durationSeconds)}</span>
              </li>
            ))}
          </ol>
          <p className="text-sm text-muted">
            Proposition speaks first. After each speech there is a 3–2–1 handoff. When time expires the microphone
            stops; a thirty-second conclusion may be granted once.
          </p>
          <Button disabled={busy} onClick={() => callNext(0)}>
            {busy ? "Calling the house…" : "Call the house to order"}
          </Button>
        </section>
      ) : null}

      {floor && speaking ? (
        <section className="paper space-y-4 rounded-2xl p-6">
          <p className="text-xs uppercase tracking-[0.2em] text-gold">{floor.chairLine}</p>
          <h2 className="font-display text-3xl text-navy">
            The floor: {floor.side === session.userPosition ? "You" : "Opponent"} · {floor.title}
          </h2>
          {session.floorPhase === "extension" ? (
            <Notice>Thirty-second conclusion. Please come to a close.</Notice>
          ) : null}
          {askExtension ? (
            <Notice>
              Time. Would you like thirty more seconds to conclude?
              <span className="mt-3 flex gap-2">
                <Button onClick={() => void grantExtension()}>Yes, thirty seconds</Button>
                <Button variant="secondary" onClick={() => void yieldFloor()}>
                  No, I yield
                </Button>
              </span>
            </Notice>
          ) : null}

          {userHasFloor && !askExtension ? (
            <>
              <Textarea
                rows={6}
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                placeholder="The chair is listening. State your case."
              />
              <div className="flex flex-wrap gap-2">
                <Button disabled={busy} onClick={() => void yieldFloor()}>
                  Yield the floor
                </Button>
              </div>
            </>
          ) : null}

          {!userHasFloor ? (
            <article className="rounded-xl bg-navy p-5 text-ivory">
              <p className="text-xs uppercase tracking-wide text-gold">Opponent speaking</p>
              <p className="mt-2">{latestAi?.content ?? (busy ? "The speaker is preparing…" : "Waiting for the speech.")}</p>
              <Button className="mt-4" variant="secondary" disabled={busy} onClick={() => void yieldFloor()}>
                The speaker has concluded
              </Button>
            </article>
          ) : null}
        </section>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2">
        <TranscriptColumn title="Proposition" side="proposition" session={session} />
        <TranscriptColumn title="Opposition" side="opposition" session={session} />
      </div>

      <div className="flex flex-wrap gap-2">
        {!closed ? (
          <Button variant="secondary" onClick={() => void finishEarly()}>
            Adjourn and analyse
          </Button>
        ) : (
          <Link to={`/app/analysis/${session.id}`} className="text-sm font-semibold text-accent">
            Open the report
          </Link>
        )}
      </div>
    </div>
  );
}

function TranscriptColumn({
  title,
  side,
  session,
}: {
  title: string;
  side: "proposition" | "opposition";
  session: DebateDetail;
}) {
  const speaker = session.userPosition === side ? "user" : "ai";
  const messages = session.messages.filter((message) => message.speaker === speaker);
  return (
    <section className="paper rounded-2xl p-4">
      <h2 className="font-display text-2xl text-navy">{title}</h2>
      <div className="mt-3 space-y-3">
        {messages.length === 0 ? <p className="text-sm text-muted">No speech yet.</p> : null}
        {messages.map((message) => (
          <article
            key={message.id}
            className={`rounded-lg border border-line p-3 text-sm ${speaker === "ai" ? "bg-navy text-ivory" : "bg-ivory"}`}
          >
            <p>{message.content}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
