import { englishMessages, type PartialMessages } from "./index";

type Vars = Record<string, string | number>;

// Resolve a dotted key ("progress.title") and interpolate {name} placeholders.
const lookup = (messages: unknown, key: string): unknown =>
  key.split(".").reduce<unknown>(
    (acc, part) => (acc && typeof acc === "object" ? (acc as Record<string, unknown>)[part] : undefined),
    messages,
  );

export function makeT(messages: PartialMessages) {
  return function t(key: string, vars?: Vars): string {
    // Fall back to English before falling back to the key itself: a missing
    // translation should read as English, never as "transport.title".
    const raw = lookup(messages, key) ?? lookup(englishMessages, key);
    let str = typeof raw === "string" ? raw : key;
    if (vars) for (const [k, v] of Object.entries(vars)) str = str.replaceAll(`{${k}}`, String(v));
    return str;
  };
}

export type TFunction = ReturnType<typeof makeT>;
