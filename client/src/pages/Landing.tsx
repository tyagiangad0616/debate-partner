import { Link } from "react-router-dom";

export function Landing() {
  return (
    <div className="mx-auto max-w-6xl px-4 pb-16">
      <section className="grid items-center gap-10 py-10 md:grid-cols-2">
        <div>
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-gold">Timed debate practice</p>
          <h1 className="mt-4 font-display text-5xl leading-tight text-navy md:text-6xl">
            Practise the argument. Understand the weakness.
          </h1>
          <p className="mt-5 max-w-xl text-lg text-muted">
            A short, timed debate against an AI opponent, followed by a structured report on reasoning, rebuttal,
            evidence, and transcript-based speech metrics.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link to="/register" className="rounded-md bg-navy px-5 py-3 font-semibold text-ivory">
              Start practising
            </Link>
            <Link to="/login" className="rounded-md border border-line px-5 py-3 font-semibold text-navy">
              Sign in
            </Link>
          </div>
        </div>
        <div className="paper rounded-2xl p-6">
          <p className="text-xs uppercase tracking-[0.18em] text-gold">Chamber card</p>
          <h2 className="mt-2 font-display text-3xl text-navy">Should university education be free?</h2>
          <div className="mt-6 grid grid-cols-2 gap-4 text-sm">
            <div className="rounded-lg border border-line p-4">
              <p className="text-muted">You</p>
              <p className="mt-2 font-semibold text-navy">Proposition</p>
              <p className="mt-3 text-ink">Cost is the barrier that keeps capable students out.</p>
            </div>
            <div className="rounded-lg border border-line bg-navy p-4 text-ivory">
              <p className="text-ivory/70">Opponent</p>
              <p className="mt-2 font-semibold">Opposition</p>
              <p className="mt-3">The claim assumes funding can expand without crowding out other public goods.</p>
            </div>
          </div>
        </div>
      </section>
      <div className="hairline my-4" />
      <section className="grid gap-6 py-8 md:grid-cols-3">
        {[
          ["Timed rounds", "One to three minutes, with a visible timer and a turn-based transcript."],
          ["Voice or text", "Browser speech recognition where supported; typed input always remains available."],
          ["Evidence-backed reports", "Scores, quoted excerpts, possible fallacies, and next steps stored in your history."],
        ].map(([title, copy]) => (
          <article key={title} className="paper rounded-xl p-5">
            <h3 className="font-display text-2xl text-navy">{title}</h3>
            <p className="mt-2 text-muted">{copy}</p>
          </article>
        ))}
      </section>
    </div>
  );
}
