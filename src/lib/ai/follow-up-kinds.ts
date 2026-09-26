// Shared by the follow-up route and the dialog (no server imports here).

export const FOLLOW_UP_ACTIONS = ["next_steps", "thank_interview", "share_update", "check_in", "wait"] as const;
export type FollowUpAction = (typeof FOLLOW_UP_ACTIONS)[number];

export const FOLLOW_UP_LANGUAGES = ["en", "fr"] as const;
export type FollowUpLanguage = (typeof FOLLOW_UP_LANGUAGES)[number];

export const FOLLOW_UP_TONES = ["friendly", "formal"] as const;
export type FollowUpTone = (typeof FOLLOW_UP_TONES)[number];

export type FollowUpChannel = "email" | "linkedin";
export type FollowUpTarget = "application" | "recruiter";

export const LINKEDIN_MAX_CHARS = 300;

export const ACTION_LABEL: Record<FollowUpAction, string> = {
  next_steps: "Ask about next steps",
  thank_interview: "Thank them for the interview",
  share_update: "Share an update or new work",
  check_in: "Polite check-in",
  wait: "Wait, don't write yet",
};

export type FollowUpResult = {
  /** Decision event (null when every choice was given by the user) */
  decisionEventId: string | null;
  draftEventId: string | null;
  action: FollowUpAction;
  language: FollowUpLanguage;
  tone: FollowUpTone;
  channel: FollowUpChannel;
  /** Probabilities for whatever the AI decided in this call */
  probabilities: {
    action?: Record<FollowUpAction, number>;
    language?: Record<FollowUpLanguage, number>;
    tone?: Record<FollowUpTone, number>;
  };
  /** Set when the AI says wait and the user didn't ask to write anyway */
  wait?: { title: string; text: string; probability: number };
  draft?: { subject: string | null; body: string };
  aiCalls: number;
  ms: number;
};
