"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, LockKeyhole, Mail, ShieldCheck } from "lucide-react";
import { AuthHeading, AuthShell } from "@/components/auth-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function SignInPage() {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (form: HTMLFormElement) => {
    const data = new FormData(form);
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/auth/signin", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: data.get("email"), password: data.get("password") }) });
      const result = await response.json() as { error?: string };
      if (!response.ok) { setError(result.error || "Could not sign in"); return; }
      window.location.assign("/dashboard");
    } catch { setError("The local database is unavailable. Please try again."); }
    finally { setBusy(false); }
  };

  return <AuthShell mode="signin"><AuthHeading mode="signin" /><form className="login-form" onSubmit={(event) => { event.preventDefault(); void submit(event.currentTarget); }}><div className="login-field"><label htmlFor="signin-email">College email</label><div className="input-wrap"><Mail /><Input id="signin-email" name="email" type="email" autoComplete="email" placeholder="you@college.edu" required /></div></div><div className="login-field"><div className="field-label-row"><label htmlFor="signin-password">Password</label><span>Stored only on this laptop</span></div><div className="input-wrap"><LockKeyhole /><Input id="signin-password" name="password" type="password" autoComplete="current-password" placeholder="Enter your password" required /></div></div>{error && <p className="login-error" role="alert">{error}</p>}<Button type="submit" size="lg" className="login-submit" disabled={busy}>{busy ? "Opening your dashboard…" : <>Sign in <ArrowRight /></>}</Button><p className="demo-note"><ShieldCheck /> Local prototype database · <Link href="/signup">Create an account</Link></p></form></AuthShell>;
}
