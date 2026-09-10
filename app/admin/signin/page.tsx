"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, CheckCircle2, LockKeyhole, Mail, Recycle, Scale, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export default function AdminSignInPage() {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (form: HTMLFormElement) => {
    const data = new FormData(form);
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/auth/signin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: data.get("email"), password: data.get("password") }),
      });
      const result = await response.json() as { error?: string; user?: { role: "volunteer" | "admin" } };
      if (!response.ok) { setError(result.error || "Could not sign in"); return; }
      if (result.user?.role !== "admin") {
        await fetch("/api/auth/signout?role=volunteer", { method: "POST" });
        setError("This account does not have collection-centre admin access.");
        return;
      }
      window.location.assign("/admin");
    } catch {
      setError("The local database is unavailable. Please try again.");
    } finally {
      setBusy(false);
    }
  };

  return <main className="admin-signin-shell">
    <section className="admin-signin-visual">
      <Link href="/signin" className="brand admin-login-brand" aria-label="ZeroTrash volunteer sign in"><span className="brand-mark"><Recycle /></span><span>zero<span>trash</span></span><b>ADMIN</b></Link>
      <div className="admin-login-message"><span className="admin-secure-pill"><ShieldCheck /> Protected centre access</span><h1>Verify impact.<br /><em>Keep rewards fair.</em></h1><p>Review cleanup proof, record the verified weight, and release credits to the right volunteer.</p></div>
      <div className="admin-login-flow" aria-label="Admin verification flow"><div><span><CheckCircle2 /></span><strong>Review proof</strong><small>Before + after photos</small></div><ArrowRight /><div><span><Scale /></span><strong>Record kg</strong><small>Collection-centre weight</small></div><ArrowRight /><div className="active"><span><ShieldCheck /></span><strong>Award credits</strong><small>Calculated automatically</small></div></div>
    </section>
    <section className="admin-signin-form-wrap">
      <form className="admin-signin-form" onSubmit={(event) => { event.preventDefault(); void submit(event.currentTarget); }}>
        <span className="admin-form-kicker">COLLECTION CENTRE</span><h2>Admin sign in</h2><p>Use the authorised ZeroTrash administrator account for this laptop.</p>
        <div className="login-field"><label htmlFor="admin-email">Admin email</label><div className="input-wrap"><Mail /><Input id="admin-email" name="email" type="email" autoComplete="username" placeholder="admin@zerotrash.local" required /></div></div>
        <div className="login-field"><label htmlFor="admin-password">Password</label><div className="input-wrap"><LockKeyhole /><Input id="admin-password" name="password" type="password" autoComplete="current-password" placeholder="Enter admin password" required /></div></div>
        {error && <p className="login-error" role="alert">{error}</p>}
        <Button type="submit" size="lg" className="login-submit" disabled={busy}>{busy ? "Checking access…" : <>Enter admin console <ArrowRight /></>}</Button>
        <p className="admin-access-note"><ShieldCheck /> Authorised actions are recorded locally</p>
        <Link href="/signin" className="volunteer-return">← Return to volunteer sign in</Link>
      </form>
    </section>
  </main>;
}
