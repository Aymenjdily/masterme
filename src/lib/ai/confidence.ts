// Confidence gating, following TypeSafe's guidance for Jev answers:
// >= 0.9 act, 0.5–0.9 ask the user to confirm, < 0.5 don't act.

export const ACT_THRESHOLD = 0.9;
export const CONFIRM_THRESHOLD = 0.5;

/** "risky" actions (deleting, marking rejected, anything sent to someone) always need confirmation. */
export type ActionRisk = "low" | "risky";

/** apply: do it now · confirm: show as a suggestion · ask: don't guess, ask the user */
export type Gate = "apply" | "confirm" | "ask";

export function gate(confidence: number, risk: ActionRisk = "low"): Gate {
  if (confidence < CONFIRM_THRESHOLD) return "ask";
  if (risk === "risky" || confidence < ACT_THRESHOLD) return "confirm";
  return "apply";
}
