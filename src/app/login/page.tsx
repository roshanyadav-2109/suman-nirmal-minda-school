"use client";
import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowRightIcon } from "@/components/icons";
import { createClient } from "@/lib/supabase/client";
import { useT } from "@/i18n/provider";
import { SchoolEmblem } from "@/components/brand";
import { SCHOOL } from "@/lib/school";
import { DEMO_ACCOUNTS, DEMO_PASSWORD } from "@/lib/demo";
import { safeNext } from "@/lib/safe-next";

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
const PROVIDERS: { key: string; label: string; Mark: (p: { size?: number }) => React.ReactElement }[] = [
  { key: "google", label: "Continue with Google", Mark: GoogleMark },
];

// What to tell someone whose Google sign-in didn't go through.
const GOOGLE_ERRORS: Record<string, string> = {
  google_not_registered: "This Google account isn't registered with the school. Please ask the school office to add your email.",
  google_other_login: "Your school record is already linked to a different login. Please ask the school office.",
  google_ambiguous: "This email is on more than one school record. Please ask the school office.",
  google_failed: "Google sign-in didn't go through. Please try again.",
  google_off: "Google sign-in isn't set up yet.",
};

export default function LoginPage() {
  const t = useT();
  const router = useRouter();
  const params = useSearchParams();
  const supabase = createClient();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState(false);
  // The film is a large-screen affair: phones and tablets get the plain page and
  // never fetch it. And because the player shows its title strip and a control
  // cluster for the first moment of playback, it is held hidden until that has
  // passed, so the page only ever reveals the film itself.
  const [showFilm, setShowFilm] = useState(false);
  const [filmReady, setFilmReady] = useState(false);
  useEffect(() => {
    if (!window.matchMedia("(min-width: 1024px)").matches) return;
    setShowFilm(true);
    const id = setTimeout(() => setFilmReady(true), 8000);
    return () => clearTimeout(id);
  }, []);

  async function signIn(em: string, pw: string, key: string) {
    setBusy(key); setError(false);
    const { error } = await supabase.auth.signInWithPassword({ email: em, password: pw });
    if (error) { setError(true); setBusy(null); return; }
    router.push(safeNext(params.get("next")));
    router.refresh();
  }

  // Google signs in directly with the school's own site (see /auth/google).
  function providerSignIn(key: string) {
    setBusy(key);
    const next = params.get("next");
    window.location.assign(`/auth/google/start${next ? `?next=${encodeURIComponent(next)}` : ""}`);
  }
  const googleError = GOOGLE_ERRORS[params.get("error") ?? ""];

  const rowBase = "flex w-full items-center gap-3 rounded-sm border border-hair bg-surface px-4 py-2.5 text-[14px] font-normal text-ink-900 transition-colors hover:bg-panel disabled:opacity-50";

  return (
    <div className="relative min-h-dvh overflow-hidden bg-paper lg:bg-ink-900">
      {/* ── Full-bleed silent film of the school (large screens only) ────────
          Muted, autoplaying, endlessly looping and completely inert: the frame
          is cropped past the player chrome, pointer events are off and a
          transparent shield covers it, so no YouTube furniture is visible and
          nothing happens on click. The sign-in block floats over it. ─────── */}
      {showFilm && (
      <div className="fixed inset-0 hidden overflow-hidden bg-ink-900 lg:block">
        {/* The film's own opening frame, held under it: the wait for the player
            to settle reads as a still of the school, not as a blank screen. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={`https://i.ytimg.com/vi/${SCHOOL.loginVideoId}/maxresdefault.jpg`}
          alt=""
          aria-hidden
          className="absolute inset-0 h-full w-full object-cover"
        />
        <iframe
          src={`https://www.youtube-nocookie.com/embed/${SCHOOL.loginVideoId}?autoplay=1&mute=1&loop=1&playlist=${SCHOOL.loginVideoId}&controls=0&modestbranding=1&rel=0&showinfo=0&disablekb=1&fs=0&playsinline=1&iv_load_policy=3`}
          title={SCHOOL.fullName}
          allow="autoplay; encrypted-media"
          tabIndex={-1}
          aria-hidden
          // max(…) of the two cover dimensions is always exactly 16:9, so the
          // film fills any viewport without distorting; ×1.2 crops the frame
          // past the player's own chrome.
          className={`pointer-events-none absolute left-1/2 top-1/2 h-[calc(max(100dvh,100vw*0.5625)*1.2)] w-[calc(max(100vw,100dvh*1.7778)*1.2)] -translate-x-1/2 -translate-y-1/2 border-0 transition-opacity duration-700 ${filmReady ? "opacity-100" : "opacity-0"}`}
        />
        {/* Swallows every click/drag so the film can never be interacted with,
            and lifts the white block off the moving picture. */}
        <div className="absolute inset-0 bg-ink-900/25" aria-hidden />
      </div>
      )}

      {/* Emblem and name sit in the page's top-left corner with nothing behind
          them — light over the film, dark on the plain mobile ground. */}
      <div className="absolute left-5 right-5 top-5 z-20 flex items-center gap-3 sm:left-8 sm:right-auto sm:top-7">
        <SchoolEmblem size={52} />
        <div className="leading-tight lg:[text-shadow:0_1px_10px_rgba(0,0,0,0.55)]">
          <div className="text-[16px] font-semibold text-ink-900 lg:text-white">{SCHOOL.name}</div>
          {SCHOOL.place && (
            <div className="text-[12px] tracking-[0.1em] text-ink-500 uppercase lg:text-white/80">{SCHOOL.place}</div>
          )}
        </div>
      </div>

      <main className="relative z-10 flex min-h-dvh flex-col justify-center overflow-y-auto px-5 py-10 sm:px-8 lg:px-14">
        {/* The white block exists to lift the sign-in options off the film, so it
            only appears where the film does: from lg up, held to the right. Below
            that the options sit straight on the page. */}
        <div className="mx-auto w-full max-w-sm lg:mr-0 lg:ml-auto lg:rounded-md lg:border lg:border-hair lg:bg-white lg:p-8 lg:shadow-[var(--shadow-pop)]">
          <div className="mb-6">
            <h1 className="font-display text-center text-[42px] font-medium leading-[1.02] tracking-[-0.02em] text-ink-900">Welcomes</h1>
          </div>

          {error && (
            <p className="mb-3 rounded-sm border border-down/30 bg-down-soft px-3 py-2 text-[13px] text-down">{t("auth.invalid")}</p>
          )}
          {googleError && (
            <p className="mb-3 rounded-sm border border-down/30 bg-down-soft px-3 py-2 text-[13px] text-down">{googleError}</p>
          )}

          {/* Provider sign-in */}
          <div className="space-y-2">
            {PROVIDERS.map(({ key, label, Mark }) => (
              <button key={key} onClick={() => providerSignIn(key)} disabled={busy !== null} className={rowBase}>
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

          <a href="https://neuralai.in" target="_blank" rel="noreferrer"
            className="mt-6 block text-center text-[12px] text-ink-500 hover:text-[#0F6CBD]">
            Powered by <span className="font-semibold text-ink-700">Neural AI</span>
          </a>
        </div>
      </main>

    </div>
  );
}
