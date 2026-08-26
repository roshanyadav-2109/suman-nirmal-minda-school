"use client";
import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRightIcon, AwardIcon, MarksIcon, StudentsIcon, ProgressIcon, AllotmentIcon, CloseIcon, type IconComponent } from "@/components/icons";
import { createClient } from "@/lib/supabase/client";
import { useT } from "@/i18n/provider";
import { SchoolEmblem } from "@/components/brand";
import { SCHOOL } from "@/lib/school";
import { DEMO_ACCOUNTS, DEMO_PASSWORD } from "@/lib/demo";

// A suitable icon per demo role.
const ROLE_ICON: Record<string, IconComponent> = {
  principal: AwardIcon,
  teacher: MarksIcon,
  guardian: StudentsIcon,
  student: ProgressIcon,
  office: AllotmentIcon,
};

// ── Provider brand marks (inline so they need no external assets) ──────────────
function GoogleMark({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden>
      <path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z" />
      <path fill="#FF3D00" d="M6.306 14.691l6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z" />
      <path fill="#4CAF50" d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238C29.211 35.091 26.715 36 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z" />
      <path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303c-.792 2.237-2.231 4.166-4.087 5.571l.003-.002 6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z" />
    </svg>
  );
}
function MicrosoftMark({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden>
      <rect x="1" y="1" width="10" height="10" fill="#F25022" />
      <rect x="13" y="1" width="10" height="10" fill="#7FBA00" />
      <rect x="1" y="13" width="10" height="10" fill="#00A4EF" />
      <rect x="13" y="13" width="10" height="10" fill="#FFB900" />
    </svg>
  );
}
// Zoho's brandmark is its four-colour wordmark.
function ZohoMark() {
  const letters: [string, string][] = [["Z", "#E42527"], ["o", "#F9B21D"], ["h", "#089949"], ["o", "#226DB4"]];
  return (
    <span className="text-[13px] font-bold leading-none tracking-tight" aria-hidden>
      {letters.map(([ch, c], i) => (<span key={i} style={{ color: c }}>{ch}</span>))}
    </span>
  );
}

const PROVIDERS: { key: string; label: string; Mark: (p: { size?: number }) => React.ReactElement }[] = [
  { key: "google", label: "Continue with Google", Mark: GoogleMark },
  { key: "microsoft", label: "Continue with Microsoft", Mark: MicrosoftMark },
  { key: "zoho", label: "Continue with Zoho", Mark: ZohoMark },
];

export default function LoginPage() {
  const t = useT();
  const router = useRouter();
  const params = useSearchParams();
  const supabase = createClient();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState(false);
  const [showDemo, setShowDemo] = useState(false);

  async function signIn(em: string, pw: string, key: string) {
    setBusy(key); setError(false);
    const { error } = await supabase.auth.signInWithPassword({ email: em, password: pw });
    if (error) { setError(true); setBusy(null); return; }
    router.push(params.get("next") || "/");
    router.refresh();
  }

  const rowBase = "flex w-full items-center gap-3 rounded-sm border border-hair bg-surface px-4 py-2.5 text-[14px] font-normal text-ink-900 transition-colors hover:bg-panel disabled:opacity-50";

  return (
    <div className="grid min-h-dvh lg:h-dvh lg:grid-cols-[1.05fr_1fr]">
      {/* ── Left: image frame ────────────────────────────────────────────────── */}
      <aside className="hidden p-3 lg:block">
        <div className="h-full w-full overflow-hidden rounded-md border border-hair bg-ink-900">
          {SCHOOL.loginImage ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={SCHOOL.loginImage} alt={SCHOOL.fullName} className="h-full w-full object-cover" />
          ) : (
            // No photograph supplied for this school — a plain branded panel
            // reads as intentional, where a missing <img> would not.
            <div className="flex h-full w-full flex-col items-center justify-center gap-5 px-10 text-center">
              <span className="flex h-20 w-20 items-center justify-center rounded-md bg-white/95 p-2">
                <SchoolEmblem size={60} />
              </span>
              <div className="font-display text-[30px] font-medium leading-[1.15] tracking-[-0.01em] text-white">
                {SCHOOL.name}
              </div>
              {SCHOOL.place && (
                <div className="text-[14px] tracking-[0.14em] text-white/70 uppercase">{SCHOOL.place}</div>
              )}
            </div>
          )}
        </div>
      </aside>

      {/* ── Right: welcome + sign-in options ─────────────────────────────────── */}
      <main className="flex flex-col justify-center overflow-y-auto px-6 py-8 sm:px-14">
        <div className="mx-auto w-full max-w-sm">
          <div className="mb-6">
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-md border border-hair bg-surface p-1">
                <SchoolEmblem size={34} />
              </span>
              <div className="text-[15px] font-semibold leading-snug text-ink-900">{SCHOOL.fullName}</div>
            </div>
            <h1 className="font-display mt-3 text-center text-[42px] font-medium leading-[1.02] tracking-[-0.02em] text-ink-900">Welcomes</h1>
          </div>

          {error && (
            <p className="mb-3 rounded-sm border border-down/30 bg-down-soft px-3 py-2 text-[13px] text-down">{t("auth.invalid")}</p>
          )}

          {/* Provider sign-in */}
          <div className="space-y-2">
            {PROVIDERS.map(({ key, label, Mark }) => (
              <button key={key} onClick={() => setShowDemo(true)} disabled={busy !== null} className={rowBase}>
                <span className="flex w-7 shrink-0 justify-center"><Mark size={20} /></span>
                <span className="flex-1 text-left font-semibold">{label}</span>
                {busy === key && <span className="h-3.5 w-3.5 shrink-0 animate-spin rounded-full border-2 border-hair border-t-ink-900" />}
              </button>
            ))}
          </div>

          {/* Demo logins, listed the same way */}
          <div className="my-4 flex items-center gap-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-muted">
            <span className="h-px flex-1 bg-hair" />
            {t("auth.demoTitle")}
            <span className="h-px flex-1 bg-hair" />
          </div>

          <div className="space-y-2">
            {DEMO_ACCOUNTS.map((a) => (
              <button key={a.email} onClick={() => signIn(a.email, DEMO_PASSWORD, a.email)} disabled={busy !== null}
                className={`${rowBase} group justify-between`}>
                <span className="flex min-w-0 items-center gap-3">
                  <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-panel text-[12px] font-semibold text-ink-900">
                    {t(`roles.${a.role}`).charAt(0)}
                  </span>
                  <span className="truncate text-[14px] font-normal text-ink-900">{t(`roles.${a.role}`)}</span>
                </span>
                {busy === a.email ? (
                  <span className="h-3.5 w-3.5 shrink-0 animate-spin rounded-full border-2 border-hair border-t-ink-900" />
                ) : (
                  <ArrowRightIcon size={16} className="shrink-0 text-muted transition-transform group-hover:translate-x-0.5 group-hover:text-ink-900" />
                )}
              </button>
            ))}
          </div>

          <a href="https://hebrewtechnologies.com" target="_blank" rel="noreferrer" className="mt-6 block text-center text-[15px] font-normal text-ink-900 hover:underline">
            hebrew technologies
          </a>
        </div>
      </main>

      {/* Not-public-yet notice for provider sign-in → offer the demo logins */}
      {showDemo && (
        <div role="dialog" aria-modal="true" className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-ink-900/40 backdrop-blur-md" onClick={() => setShowDemo(false)} />
          <div className="relative z-10 flex max-h-[88vh] w-[92vw] flex-col items-center justify-center overflow-y-auto rounded-md bg-surface p-5 text-center shadow-[var(--shadow-pop)] sm:h-[70vh] sm:w-[70vw] sm:p-8">
            <button onClick={() => setShowDemo(false)} aria-label="Close" className="absolute right-3 top-3 rounded-sm p-1.5 text-ink-500 hover:bg-panel">
              <CloseIcon size={20} />
            </button>
            <div className="text-[36px] leading-none">🙈</div>
            <h2 className="font-display mt-3 text-[22px] font-medium leading-tight text-ink-900 sm:text-[28px]">Uh oh — we&apos;re not public yet!</h2>
            <p className="mt-2 text-[13px] text-ink-500 sm:text-[14px]">Try one of the demo logins instead.</p>

            <div className="mt-6 grid w-full max-w-md grid-cols-2 gap-2.5 sm:mt-8 sm:flex sm:flex-wrap sm:justify-center">
              {DEMO_ACCOUNTS.map((a) => {
                const Icon = ROLE_ICON[a.role] ?? ProgressIcon;
                return (
                  <button key={a.email} onClick={() => signIn(a.email, DEMO_PASSWORD, a.email)} disabled={busy !== null}
                    className="flex w-full flex-col items-center gap-2 rounded-sm border border-hair bg-surface px-3 py-3.5 transition-colors hover:border-black hover:bg-panel disabled:opacity-50 sm:w-[128px]">
                    <span className="flex h-11 w-11 items-center justify-center rounded-full bg-panel text-ink-900">
                      {busy === a.email
                        ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-hair border-t-ink-900" />
                        : <Icon size={22} />}
                    </span>
                    <span className="text-[13px] font-semibold text-ink-900">{t(`roles.${a.role}`)}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
