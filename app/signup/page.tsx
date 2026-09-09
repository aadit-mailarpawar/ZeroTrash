"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, LockKeyhole, Mail, ShieldCheck, UserRound } from "lucide-react";
import { AuthHeading, AuthShell } from "@/components/auth-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function SignUpPage() {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (form: HTMLFormElement) => {
    const data = new FormData(form);
    const password = String(data.get("password") ?? "");
    if (password !== String(data.get("confirmPassword") ?? "")) { setError("Passwords do not match"); return; }
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/auth/signup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: data.get("name"), email: data.get("email"), password }) });
      const result = await response.json() as { error?: string };
      if (!response.ok) { setError(result.error || "Could not create the account"); return; }
      window.location.assign("/dashboard");
    } catch { setError("The local database is unavailable. Please try again."); }
    finally { setBusy(false); }
  };

  return <AuthShell mode="signup"><AuthHeading mode="signup" /><form className="login-form signup-form" onSubmit={(event) => { event.preventDefault(); void submit(event.currentTarget); }}><div className="login-field"><label htmlFor="signup-name">Full name</label><div className="input-wrap"><UserRound /><Input id="signup-name" name="name" autoComplete="name" placeholder="e.g. Aanya Mehta" required /></div></div><div className="login-field"><label htmlFor="signup-email">College email</label><div className="input-wrap"><Mail /><Input id="signup-email" name="email" type="email" autoComplete="email" placeholder="you@college.edu" required /></div></div><div className="password-grid"><div className="login-field"><label htmlFor="signup-password">Create password</label><div className="input-wrap"><LockKeyhole /><Input id="signup-password" name="password" type="password" autoComplete="new-password" placeholder="At least 6 characters" required minLength={6} /></div></div><div className="login-field"><label htmlFor="signup-confirm">Confirm password</label><div className="input-wrap"><LockKeyhole /><Input id="signup-confirm" name="confirmPassword" type="password" autoComplete="new-password" placeholder="Repeat password" required minLength={6} /></div></div></div>{error && <p className="login-error" role="alert">{error}</p>}<Button type="submit" size="lg" className="login-submit" disabled={busy}>{busy ? "Creating your account…" : <>Create my account <ArrowRight /></>}</Button><p className="demo-note"><ShieldCheck /> Your prototype data stays on this laptop · <Link href="/signin">Sign in instead</Link></p></form></AuthShell>;
}
