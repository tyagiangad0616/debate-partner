import { FormEvent, useState } from "react";
import { useAuth } from "../auth";
import { api } from "../api";
import { Button, Field, Input, Notice } from "../components/ui";

export function Settings() {
  const { user, setUser, aiMode, model } = useAuth();
  const [message, setMessage] = useState<string | null>(null);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!user) return;
    const form = new FormData(event.currentTarget);
    const next = await api.updateMe({
      displayName: String(form.get("displayName")),
      ttsEnabled: form.get("ttsEnabled") === "on",
    });
    setUser(next as typeof user);
    setMessage("Preferences saved.");
  }

  if (!user) return null;

  return (
    <div className="mx-auto max-w-xl space-y-6">
      <h1 className="font-display text-4xl text-navy">Settings</h1>
      <section className="paper space-y-3 rounded-2xl p-6">
        <h2 className="font-display text-2xl text-navy">Model configuration</h2>
        {aiMode === "openai" ? (
          <Notice tone="ok">The API is using {model ?? "OpenAI"} from server environment variables.</Notice>
        ) : (
          <Notice>
            No live key is loaded. Set <code>OPENAI_API_KEY</code> in <code>server/.env</code>, then restart the API.
            The browser never stores or sends that secret.
          </Notice>
        )}
      </section>
      <form className="paper space-y-4 rounded-2xl p-6" onSubmit={onSubmit}>
        {message ? <Notice tone="ok">{message}</Notice> : null}
        <Field label="Display name">
          <Input name="displayName" defaultValue={user.displayName} />
        </Field>
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" name="ttsEnabled" defaultChecked={user.ttsEnabled} />
          Speak AI replies with browser text-to-speech
        </label>
        <p className="text-sm text-muted">
          Voice playback uses your browser and operating system voices. Transcript text remains visible either way.
          Browser speech recognition, where used, may be processed by a vendor service; raw audio is not stored.
        </p>
        <Button type="submit">Save</Button>
      </form>
      <section className="paper rounded-2xl p-6 text-sm text-muted">
        <h2 className="font-display text-2xl text-navy">History deletion</h2>
        <p className="mt-2">
          Individual debates can be deleted from History. Deleting a session removes its transcript and analysis from
          your account and recalculates dashboard totals.
        </p>
      </section>
    </div>
  );
}
