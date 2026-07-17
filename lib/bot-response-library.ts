export type BotRule = {
  id?: string;
  label: string;
  matchPhrases: string[];
  response: string;
  priority: number;
  enabled?: boolean;
};

export const DEFAULT_BOT_DISCLOSURE = "Automated assistant";

export const DEFAULT_BOT_FALLBACK =
  "Thanks for your message. I’m the automated assistant for this profile. I don’t have a preset answer for that yet, so I’ve left it for the creator to review.";

export const DEFAULT_BOT_LIBRARY: BotRule[] = [
  {
    label: "Greeting",
    matchPhrases: ["hi", "hello", "hey", "good morning", "good afternoon", "good evening"],
    response: "Hi! Thanks for your message. I’m the automated assistant for this profile. What would you like to know?",
    priority: 10
  },
  {
    label: "Location",
    matchPhrases: ["where are you", "where are you from", "location", "what country", "what region"],
    response: "The creator’s public country and region are shown on the profile. They can choose whether to share anything more personally.",
    priority: 20
  },
  {
    label: "Interests",
    matchPhrases: ["interests", "hobbies", "what do you like", "what are you into"],
    response: "You can see the creator’s interests on the profile. Tell me which one caught your attention.",
    priority: 30
  },
  {
    label: "Meeting requests",
    matchPhrases: ["meet", "meeting", "date", "available tonight", "available today", "when are you free"],
    response: "I can’t arrange meetings or make commitments. Leave a respectful message and the creator can reply personally.",
    priority: 40
  },
  {
    label: "Likes and gifts",
    matchPhrases: ["gift", "gifts", "paid like", "send crypto", "send money", "support you"],
    response: "Use only Crypto Sugar Babes’ official wallet flow for paid likes, gifts, or boosts. Never send a recovery phrase or private key.",
    priority: 50
  },
  {
    label: "Wallet safety",
    matchPhrases: ["seed phrase", "recovery phrase", "private key", "password", "wallet scam"],
    response: "Never share a password, recovery phrase, or private key. If a message feels unsafe, use Report or Block.",
    priority: 1
  }
];

function normalize(value: string) {
  return value
    .toLocaleLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9']+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function phraseMatches(message: string, phrase: string) {
  const normalizedPhrase = normalize(phrase);
  if (!normalizedPhrase) return false;
  return ` ${message} `.includes(` ${normalizedPhrase} `);
}

export function selectBotResponse(message: string, rules: BotRule[], fallback = DEFAULT_BOT_FALLBACK) {
  const normalizedMessage = normalize(message);
  const matched = [...rules]
    .filter((rule) => rule.enabled !== false)
    .sort((left, right) => left.priority - right.priority)
    .find((rule) => rule.matchPhrases.some((phrase) => phraseMatches(normalizedMessage, phrase)));
  return {
    label: matched?.label || "Needs creator review",
    response: (matched?.response || fallback).trim().slice(0, 800),
    matched: Boolean(matched)
  };
}
