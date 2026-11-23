import { useState } from "react";
import api, { errorMessage } from "../api";
import { Alert } from "./ui.jsx";

const WORDS = ["", "Very poor", "Poor", "Okay", "Good", "Excellent"];
const FACES = ["🙂", "😞", "🙁", "😐", "🙂", "😍"];
// the colour tells the level at a glance: red, orange, yellow, lime, green
export const LEVEL_COLORS = ["#cbd5e1", "#ef4444", "#f97316", "#eab308", "#84cc16", "#22c55e"];

const GOOD_TAGS = ["Easy to use", "Fast", "Secure", "Clear design", "Useful features"];
const BAD_TAGS = ["Slow", "Hard to use", "Confusing", "Errors", "Missing feature"];

/** 5 star rating, quick tags and an optional comment. Used at logout and on the Profile page. */
export default function RatingForm({ onDone, onSkip, skipLabel = "Skip", submitLabel = "Submit rating" }) {
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [tags, setTags] = useState([]);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const shown = hover || rating;
  const tagChoices = rating >= 4 ? GOOD_TAGS : rating ? BAD_TAGS : [];

  const choose = (n) => {
    // good and bad tags are different lists, so start fresh when the side changes
    if ((n >= 4) !== (rating >= 4)) setTags([]);
    setRating(n);
    setError("");
  };

  const toggleTag = (t) => setTags((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]));

  const submit = async (e) => {
    e.preventDefault();
    if (!rating) {
      setError("Please tap a star to rate.");
      return;
    }
    setBusy(true);
    setError("");
    const text = [tags.length ? `[${tags.join(", ")}]` : "", comment.trim()].filter(Boolean).join(" ");
    try {
      await api.post("/feedback/", { rating, comment: text });
      onDone?.();
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-4">
      <Alert>{error}</Alert>

      <div className="rounded-2xl bg-slate-50 px-4 pb-4 pt-5 text-center ring-1 ring-slate-200">
        <div key={shown} className="rating-face text-5xl leading-none" aria-hidden="true">{FACES[shown]}</div>
        <p className="mt-2 h-6 text-base font-extrabold" style={{ color: shown ? LEVEL_COLORS[shown] : "#94a3b8" }} aria-live="polite">
          {WORDS[shown] || "Tap a star"}
        </p>
        <div className="mt-1 flex justify-center gap-1 sm:gap-1.5" role="radiogroup" aria-label="Rating">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={rating === n}
              aria-label={`${n} star${n > 1 ? "s" : ""}`}
              onMouseEnter={() => setHover(n)}
              onMouseLeave={() => setHover(0)}
              onFocus={() => setHover(n)}
              onBlur={() => setHover(0)}
              onClick={() => choose(n)}
              className="rounded-lg p-1 transition hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
            >
              <svg
                viewBox="0 0 24 24"
                className={`h-10 w-10 transition-transform duration-150 sm:h-11 sm:w-11 ${n === rating ? "star-pop" : ""}`}
                style={n <= shown ? { fill: LEVEL_COLORS[shown], stroke: LEVEL_COLORS[shown] } : { fill: "#fff", stroke: "#cbd5e1" }}
                strokeWidth="1.5"
                strokeLinejoin="round"
              >
                <path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9z" />
              </svg>
            </button>
          ))}
        </div>
        <div className="mx-auto mt-2 flex max-w-[16rem] justify-between text-[11px] font-semibold text-slate-400">
          <span>Very poor</span>
          <span>Excellent</span>
        </div>
      </div>

      {tagChoices.length > 0 && (
        <div className="fade-in">
          <p className="mb-2 text-sm font-bold text-slate-700">{rating >= 4 ? "What did you like?" : "What went wrong?"}</p>
          <div className="flex flex-wrap gap-2">
            {tagChoices.map((t) => {
              const on = tags.includes(t);
              return (
                <button
                  key={t}
                  type="button"
                  aria-pressed={on}
                  onClick={() => toggleTag(t)}
                  className={`rounded-full px-3.5 py-1.5 text-sm font-semibold ring-1 transition ${
                    on ? "bg-brand-700 text-white ring-brand-700" : "bg-white text-slate-700 ring-slate-300 hover:ring-brand-400"
                  }`}
                >
                  {on && "✓ "}
                  {t}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div>
        <textarea
          className="input min-h-[5.5rem]"
          placeholder="Tell us more (optional)"
          maxLength={400}
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          aria-label="Your comment"
        />
        <p className="mt-1 text-right text-xs text-slate-400">{comment.length} / 400</p>
      </div>

      <div className="flex gap-2">
        {onSkip && (
          <button type="button" className="btn-outline flex-1" onClick={onSkip}>{skipLabel}</button>
        )}
        <button className="btn-primary flex-1" disabled={busy}>{busy ? "Sending..." : submitLabel}</button>
      </div>
    </form>
  );
}
