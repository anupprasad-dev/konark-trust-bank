import { useState } from "react";
import api, { errorMessage } from "../api";
import { Alert } from "./ui.jsx";

const WORDS = ["", "Very poor", "Poor", "Okay", "Good", "Excellent"];
// the colour tells the level at a glance: red, orange, yellow, lime, green
export const LEVEL_COLORS = ["#cbd5e1", "#ef4444", "#f97316", "#eab308", "#84cc16", "#22c55e"];

/** 5 star rating + optional comment. Used at logout and on the Profile page. */
export default function RatingForm({ onDone, onSkip, skipLabel = "Skip", submitLabel = "Submit rating" }) {
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const shown = hover || rating;

  const submit = async (e) => {
    e.preventDefault();
    if (!rating) {
      setError("Please tap a star to rate.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      await api.post("/feedback/", { rating, comment });
      onDone?.();
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <Alert>{error}</Alert>
      <div className="text-center">
        <div className="flex justify-center gap-1.5" role="radiogroup" aria-label="Rating">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={rating === n}
              aria-label={`${n} star${n > 1 ? "s" : ""}`}
              onMouseEnter={() => setHover(n)}
              onMouseLeave={() => setHover(0)}
              onClick={() => setRating(n)}
              className="rounded-lg p-1 transition hover:scale-110"
            >
              <svg
                viewBox="0 0 24 24"
                className="h-10 w-10 transition-transform duration-150"
                style={n <= shown ? { fill: LEVEL_COLORS[shown], stroke: LEVEL_COLORS[shown] } : { fill: "#f1f5f9", stroke: "#cbd5e1" }}
                strokeWidth="1.5"
                strokeLinejoin="round"
              >
                <path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z" />
              </svg>
            </button>
          ))}
        </div>
        <p className="mt-1 h-5 text-sm font-bold" style={{ color: LEVEL_COLORS[shown] }} aria-live="polite">{WORDS[shown]}</p>
      </div>
      <textarea
        className="input min-h-[5rem]"
        placeholder="Tell us more (optional)"
        maxLength={500}
        value={comment}
        onChange={(e) => setComment(e.target.value)}
      />
      <div className="flex gap-2">
        {onSkip && (
          <button type="button" className="btn-outline flex-1" onClick={onSkip}>{skipLabel}</button>
        )}
        <button className="btn-primary flex-1" disabled={busy}>{busy ? "Sending..." : submitLabel}</button>
      </div>
    </form>
  );
}
