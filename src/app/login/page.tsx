import type { Metadata } from "next";
import { LOGIN_ERROR_MESSAGES, type LoginError } from "@/lib/auth/paths";
import { signInWithGoogle } from "./actions";

export const metadata: Metadata = { title: "Entrar · Personal Dashboard" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string }> }) {
  const { error } = await searchParams;
  const message = error && error in LOGIN_ERROR_MESSAGES ? LOGIN_ERROR_MESSAGES[error as LoginError] : null;

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col justify-center gap-6 px-4 py-10">
      <span className="font-display text-2xl font-extrabold tracking-tight">
        Personal<span className="text-finance">·</span>Dashboard
      </span>
      <section className="rounded-tile border-border bg-surface border p-7">
        <h1 className="font-display text-4xl leading-none font-extrabold tracking-tight">Entrar</h1>
        <p className="text-muted mt-3">
          Solo con tu cuenta de Google. Se pedirá permiso para tu calendario y para guardar los vídeos del estudio en tu
          Drive.
        </p>
        {message && (
          <p role="alert" className="bg-surface-2 text-attention rounded-inner mt-5 px-4 py-3 text-sm">
            {message}
          </p>
        )}
        <form action={signInWithGoogle} className="mt-6">
          <button
            type="submit"
            className="bg-finance text-ink focus-visible:outline-text flex w-full items-center justify-center gap-3 rounded-full px-5 py-3.5 font-semibold transition-transform duration-200 hover:scale-[1.02] focus-visible:outline-2 focus-visible:outline-offset-2 motion-reduce:transition-none motion-reduce:hover:scale-100"
          >
            <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor">
              <path d="M21.35 11.1H12v2.98h5.35c-.23 1.4-1.66 4.1-5.35 4.1a5.94 5.94 0 0 1 0-11.88c1.84 0 3.07.78 3.78 1.46l2.58-2.49C16.72 3.74 14.56 2.8 12 2.8a9.2 9.2 0 1 0 0 18.4c5.31 0 8.83-3.73 8.83-8.99 0-.6-.07-1.06-.15-1.51Z" />
            </svg>
            Continuar con Google
          </button>
        </form>
      </section>
    </main>
  );
}
