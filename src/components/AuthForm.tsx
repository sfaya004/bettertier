"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Button, Field, inputClass } from "./ui";
import type { FormState } from "@/app/account/actions";

export function AuthForm({ mode, action, next }: { mode: "sign-in" | "sign-up"; action: (prev: FormState, data: FormData) => Promise<FormState>; next?: string }) {
  const [state, formAction, pending] = useActionState(action, {});
  return (
    <form action={formAction} className="max-w-xl" noValidate>
      {next ? <input type="hidden" name="next" value={next} /> : null}
      {state.error ? (
        <p role="alert" className="mb-5 rounded-[var(--radius-md)] border-2 border-[var(--color-danger)] bg-[var(--color-danger-soft)] p-4 font-semibold">
          {state.error}
        </p>
      ) : null}
      <Field id="email" label="Email address" error={state.fieldErrors?.email}>
        <input id="email" name="email" type="email" autoComplete="email" required defaultValue={state.email ?? ""} className={inputClass} aria-invalid={Boolean(state.fieldErrors?.email)} aria-describedby={state.fieldErrors?.email ? "email-error" : undefined} />
      </Field>
      <Field id="password" label="Password" hint={mode === "sign-up" ? "At least 10 characters. A short sentence you'll remember works well." : undefined} error={state.fieldErrors?.password}>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete={mode === "sign-up" ? "new-password" : "current-password"}
          required
          minLength={mode === "sign-up" ? 10 : undefined}
          className={inputClass}
          aria-invalid={Boolean(state.fieldErrors?.password)}
          aria-describedby={[mode === "sign-up" ? "password-hint" : null, state.fieldErrors?.password ? "password-error" : null].filter(Boolean).join(" ") || undefined}
        />
      </Field>
      <Button type="submit" disabled={pending} className="w-full sm:w-auto">
        {pending ? "One moment…" : mode === "sign-up" ? "Create my free account" : "Sign in"}
      </Button>
      <p className="mt-6">
        {mode === "sign-up" ? (
          <>
            Already have an account? <Link href="/account/sign-in">Sign in</Link>
          </>
        ) : (
          <>
            No account yet? <Link href="/account/sign-up">Create a free account</Link>
          </>
        )}
      </p>
    </form>
  );
}
