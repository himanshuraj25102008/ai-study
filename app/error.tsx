"use client";

export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <main className="error-shell">
      <span className="eyebrow">A SMALL DETOUR</span>
      <h1>That didn’t go as planned.</h1>
      <p>The request could not be completed. Your saved progress is unchanged; please try again.</p>
      <button className="button button-primary" onClick={() => reset()}>Try again</button>
    </main>
  );
}
