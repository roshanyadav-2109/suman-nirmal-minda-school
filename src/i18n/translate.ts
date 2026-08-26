import type { Messages } from "./index";

type Vars = Record<string, string | number>;

// Resolve a dotted key ("progress.title") and interpolate {name} placeholders.
export function makeT(messages: Messages) {
  return function t(key: string, vars?: Vars): string {
    const raw = key.split(".").reduce<unknown>(
      (acc, part) => (acc && typeof acc === "object" ? (acc as Record<string, unknown>)[part] : undefined),
      messages,
    );
    let str = typeof raw === "string" ? raw : key;
    if (vars) for (const [k, v] of Object.entries(vars)) str = str.replaceAll(`{${k}}`, String(v));
    return str;
  };
}

export type TFunction = ReturnType<typeof makeT>;
