import { FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";
import { DURATION_OPTIONS, SUGGESTED_TOPICS } from "@shared/types";
import { api, ApiError } from "../api";
import { recognitionSupported } from "../hooks/useSpeech";
import { useAuth } from "../auth";
import { Button, Field, Input, Notice } from "../components/ui";

export function Setup() {
  const navigate = useNavigate();
  const { aiMode } = useAuth();
  const [topic, setTopic] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const voiceOk = recognitionSupported();

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setPending(true);
    setError(null);
    try {
      const session = await api.createDebate({
        topic: String(form.get("topic")),
        userPosition: form.get("userPosition") as "proposition" | "opposition",
        mode: form.get("mode") as "text" | "voice",
        durationSeconds: Number(form.get("durationSeconds")) as 60 | 120 | 180,
      });
      navigate(`/app/debate/${session.id}`);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Unable to start the debate.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="font-display text-4xl text-navy">Set up a debate</h1>
      <p className="mt-2 text-muted">
        School format: Proposition speaks first, then Opposition, then a rebuttal each. Both sides get the same time.
      </p>
      <form className="paper mt-6 space-y-5 rounded-2xl p-6" onSubmit={onSubmit}>
        {aiMode === "mock" ? (
          <Notice>
            The API is in demonstration mode because <code>server/.env</code> has no OpenAI key.
          </Notice>
        ) : (
          <Notice tone="ok">Live model is connected from server environment variables.</Notice>
        )}
        {error ? <Notice tone="error">{error}</Notice> : null}
        <Field label="Motion / topic">
          <Input name="topic" value={topic} onChange={(event) => setTopic(event.target.value)} required minLength={8} />
        </Field>
        <div className="flex flex-wrap gap-2">
          {SUGGESTED_TOPICS.map((item) => (
            <button
              type="button"
              key={item}
              className="rounded-full border border-line px-3 py-1 text-sm text-navy hover:border-gold"
              onClick={() => setTopic(item)}
            >
              {item}
            </button>
          ))}
        </div>
        <fieldset className="space-y-2">
          <legend className="text-sm font-semibold text-navy">Your position</legend>
          <label className="mr-4">
            <input type="radio" name="userPosition" value="proposition" defaultChecked /> Proposition
          </label>
          <label>
            <input type="radio" name="userPosition" value="opposition" /> Opposition
          </label>
        </fieldset>
        <fieldset className="space-y-2">
          <legend className="text-sm font-semibold text-navy">Input mode</legend>
          <label className="mr-4">
            <input type="radio" name="mode" value="text" defaultChecked /> Text
          </label>
          <label>
            <input type="radio" name="mode" value="voice" disabled={!voiceOk} /> Voice {voiceOk ? "" : "(unavailable here)"}
          </label>
          {!voiceOk ? (
            <p className="text-xs text-muted">
              This browser does not expose SpeechRecognition. Text mode remains fully usable.
            </p>
          ) : (
            <p className="text-xs text-muted">
              Voice mode uses live browser recognition. You can edit the captured text before sending.
            </p>
          )}
        </fieldset>
        <Field label="Time per speech" hint="Each speaker receives this time. A 30-second conclusion can be granted once per speech.">
          <select name="durationSeconds" className="w-full rounded-md border border-line bg-paper px-3 py-2.5" defaultValue="60">
            {DURATION_OPTIONS.map((seconds) => (
              <option key={seconds} value={seconds}>
                {seconds / 60} minute{seconds === 60 ? "" : "s"} each
              </option>
            ))}
          </select>
        </Field>
        <Button type="submit" disabled={pending}>
          {pending ? "Opening chamber…" : "Enter the chamber"}
        </Button>
      </form>
    </div>
  );
}
