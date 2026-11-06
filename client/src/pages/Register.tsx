import { FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../auth";
import { ApiError } from "../api";
import { Button, Field, Input, Notice } from "../components/ui";

export function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setPending(true);
    setError(null);
    try {
      await register(String(form.get("displayName")), String(form.get("email")), String(form.get("password")));
      navigate("/app");
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Unable to create the account.");
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="mx-auto max-w-md px-4 pb-16">
      <div className="paper rounded-2xl p-6">
        <h1 className="font-display text-4xl text-navy">Create account</h1>
        <p className="mt-2 text-muted">Your debates and reports stay attached to this account.</p>
        <form className="mt-6 space-y-4" onSubmit={onSubmit}>
          {error ? <Notice tone="error">{error}</Notice> : null}
          <Field label="Display name">
            <Input name="displayName" minLength={2} required />
          </Field>
          <Field label="Email">
            <Input name="email" type="email" autoComplete="email" required />
          </Field>
          <Field label="Password" hint="At least 8 characters.">
            <Input name="password" type="password" minLength={8} autoComplete="new-password" required />
          </Field>
          <Button type="submit" disabled={pending} className="w-full">
            {pending ? "Creating…" : "Create account"}
          </Button>
        </form>
        <p className="mt-4 text-sm text-muted">
          Already registered? <Link to="/login">Sign in</Link>
        </p>
      </div>
    </div>
  );
}
