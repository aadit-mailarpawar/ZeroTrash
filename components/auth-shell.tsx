"use client";

import Link from "next/link";
import { ArrowRight, Broom, Camera, Check, Gift, Leaf, Recycle, Scale, TrendingUp } from "lucide-react";

export function AuthShell({ mode, children }: { mode: "signin" | "signup"; children: React.ReactNode }) {
  const form = <section className="login-copy"><div className="login-form-wrap">{children}</div></section>;
  const visual = <JourneyVisual mode={mode} />;

  return <main className={`login-shell ${mode === "signup" ? "signup-shell" : "signin-shell"}`}>
    <header className="login-nav"><Link href="/signin" className="brand login-brand" aria-label="ZeroTrash home"><span className="brand-mark"><Recycle /></span><span>zero<span>trash</span></span></Link><div className="auth-switch">{mode === "signin" ? <>New here? <Link href="/signup">Create account</Link></> : <>Already a member? <Link href="/signin">Sign in</Link></>}</div></header>
    <div className="login-grid">{mode === "signin" ? <>{form}{visual}</> : <>{visual}{form}</>}</div>
  </main>;
}

function JourneyVisual({ mode }: { mode: "signin" | "signup" }) {
  return <section className="journey-stage" aria-labelledby={`${mode}-journey-title`}>
    <div className="stage-grid" aria-hidden="true" /><div className="stage-glow glow-one" aria-hidden="true" /><div className="stage-glow glow-two" aria-hidden="true" />
    <div className="journey-content">
      <div className="journey-head"><div><span>THE ZEROTRASH LOOP</span><h2 id={`${mode}-journey-title`}>{mode === "signin" ? "Four moves. One cleaner campus." : "Your first cleanup starts a ripple."}</h2></div><div className="loop-badge"><TrendingUp /> Live impact</div></div>
      <div className="flow-chart" aria-label="Report, clean, weigh and redeem flow"><FlowNode number="01" icon={Camera} title="Spot it" text="Photo + location" /><FlowLink /><FlowNode number="02" icon={Broom} title="Clean it" text="Upload after proof" /><FlowLink /><FlowNode number="03" icon={Scale} title="Weigh it" text="Centre verifies kg" /><FlowLink /><FlowNode number="04" icon={Gift} title="Redeem it" text="Credits = voucher" accent /></div>
      <div className="impact-equation"><span><strong>1 kg</strong><small>verified waste</small></span><ArrowRight /><span><strong>30</strong><small>green credits</small></span><ArrowRight /><span><strong>₹30</strong><small>voucher value</small></span></div>
      <div className="stage-bottom"><div className="before-after"><div><Camera /><span><small>BEFORE</small><strong>Report the spot</strong></span></div><i><ArrowRight /></i><div className="after"><Check /><span><small>AFTER</small><strong>Prove the change</strong></span></div></div><div className="campus-score"><span>Campus goal</span><strong>742 <small>kg</small></strong><div><i /></div><small>74% cleaned</small></div></div>
    </div>
  </section>;
}

function FlowNode({ number, icon: Icon, title, text, accent = false }: { number: string; icon: typeof Camera; title: string; text: string; accent?: boolean }) {
  return <article className={`flow-node${accent ? " accent" : ""}`}><span className="flow-number">{number}</span><div className="flow-icon"><Icon /></div><strong>{title}</strong><p>{text}</p></article>;
}

function FlowLink() { return <div className="flow-link" aria-hidden="true"><span /><ArrowRight /></div>; }

export function AuthHeading({ mode }: { mode: "signin" | "signup" }) {
  return <><div className="login-kicker"><Leaf /> {mode === "signin" ? "Welcome back to the movement" : "Join your campus cleanup crew"}</div><h1>{mode === "signin" ? <>Good to see you <em>again.</em></> : <>Make your campus <em>count.</em></>}</h1><p className="login-lead">{mode === "signin" ? "Sign in to continue your cleanup streak, track verified waste and use the credits you’ve earned." : "Create a local prototype account to report trash, upload proof and turn verified kilograms into rewards."}</p></>;
}
