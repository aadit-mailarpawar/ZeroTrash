"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowRight, Bell, Broom, Camera, Check, CircleDollarSign, Gift, LayoutDashboard,
  Leaf, LockKeyhole, LogOut, Mail, MapPin, Plus, Recycle, Scale, ShieldCheck,
  Sparkles, Store, Ticket, TrendingUp, Upload, UserRound,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Toaster } from "@/components/ui/sonner";
import { Input } from "@/components/ui/input";

type Report = {
  id: number; location: string; wasteType: string; notes: string; beforeKey: string;
  afterKey: string | null; center: string | null; weight: number | null; credits: number;
  status: "awaiting_cleanup" | "awaiting_weighing" | "verified"; createdAt: string;
};

type AppState = { reports: Report[]; balance: number; totalWeight: number; verifiedCount: number };
type UserProfile = { name: string; email: string };

const rewards = [
  { id: "cafe-100", name: "Campus Café", value: 100, detail: "₹100 food voucher", icon: Store },
  { id: "books-250", name: "College Bookstore", value: 250, detail: "₹250 store voucher", icon: Ticket },
  { id: "canteen-500", name: "Main Canteen", value: 500, detail: "₹500 meal voucher", icon: Gift },
];

const statusCopy = {
  awaiting_cleanup: { label: "Awaiting cleanup", className: "waiting" },
  awaiting_weighing: { label: "Ready to weigh", className: "weighing" },
  verified: { label: "Verified", className: "verified" },
};

export default function Home() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [tab, setTab] = useState("dashboard");
  const [state, setState] = useState<AppState>({ reports: [], balance: 0, totalWeight: 0, verifiedCount: 0 });
  const [reportOpen, setReportOpen] = useState(false);
  const [afterReport, setAfterReport] = useState<Report | null>(null);
  const [weighReport, setWeighReport] = useState<Report | null>(null);
  const [redeemReward, setRedeemReward] = useState<(typeof rewards)[number] | null>(null);
  const [busy, setBusy] = useState(false);
  const [centre, setCentre] = useState("Main Gate Green Point");
  const [weight, setWeight] = useState("");
  const mounted = useRef(true);

  const loadState = useCallback(async () => {
    if (!user) return;
    try {
      const response = await fetch(`/api/state?email=${encodeURIComponent(user.email)}`, { cache: "no-store" });
      if (!response.ok) return;
      const next = await response.json() as AppState;
      if (mounted.current) setState(next);
    } catch { /* Preview can keep the realistic demo state while storage starts. */ }
  }, [user]);

  useEffect(() => {
    mounted.current = true;
    void loadState();
    return () => { mounted.current = false; };
  }, [loadState]);

  const logIn = (profile: UserProfile) => {
    setState({ reports: [], balance: 0, totalWeight: 0, verifiedCount: 0 });
    setUser(profile);
  };

  const logOut = () => {
    setUser(null);
    setTab("dashboard");
    setState({ reports: [], balance: 0, totalWeight: 0, verifiedCount: 0 });
  };

  const submitReport = async (form: HTMLFormElement) => {
    setBusy(true);
    try {
      const data = new FormData(form);
      data.set("volunteer", user?.name ?? "Volunteer");
      data.set("email", user?.email ?? "");
      const response = await fetch("/api/reports", { method: "POST", body: data });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error || "Could not save the report");
      await loadState(); setReportOpen(false); form.reset(); toast.success("Trash spot reported. Let’s clean it up!");
    } catch (error) { toast.error(error instanceof Error ? error.message : "Could not save the report"); }
    finally { setBusy(false); }
  };

  const submitAfterPhoto = async (form: HTMLFormElement) => {
    if (!afterReport) return;
    setBusy(true);
    try {
      const data = new FormData(form);
      data.set("email", user?.email ?? "");
      const response = await fetch(`/api/reports/${afterReport.id}/after`, { method: "POST", body: data });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error || "Could not save the photo");
      await loadState(); setAfterReport(null); toast.success("Cleanup proof added. Take it to a collection centre next.");
    } catch (error) { toast.error(error instanceof Error ? error.message : "Could not save the photo"); }
    finally { setBusy(false); }
  };

  const recordWeight = useCallback(async (reportId: number, kilograms: number, collectionCentre: string) => {
    const response = await fetch(`/api/reports/${reportId}/weigh`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ weight: kilograms, center: collectionCentre, email: user?.email }) });
    const result = await response.json() as { error?: string; credits?: number };
    if (!response.ok) throw new Error(result.error || "Could not record the weigh-in");
    await loadState();
    return result;
  }, [loadState, user]);

  const submitWeight = async () => {
    if (!weighReport) return;
    const kilograms = Number(weight);
    if (!Number.isFinite(kilograms) || kilograms <= 0) { toast.error("Enter a valid weight"); return; }
    setBusy(true);
    try {
      const result = await recordWeight(weighReport.id, kilograms, centre);
      setWeighReport(null); setWeight(""); toast.success(`Verified! ${result.credits} credits added.`);
    } catch (error) { toast.error(error instanceof Error ? error.message : "Could not record the weigh-in"); }
    finally { setBusy(false); }
  };

  const redeemVoucher = useCallback(async (rewardId: string) => {
    const response = await fetch("/api/redeem", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ rewardId, email: user?.email }) });
    const result = await response.json() as { error?: string; code?: string };
    if (!response.ok) throw new Error(result.error || "Could not redeem the voucher");
    await loadState();
    return result;
  }, [loadState, user]);

  const confirmRedeem = async () => {
    if (!redeemReward) return;
    setBusy(true);
    try {
      const result = await redeemVoucher(redeemReward.id);
      setRedeemReward(null); toast.success(`Voucher unlocked — code ${result.code}`);
    } catch (error) { toast.error(error instanceof Error ? error.message : "Could not redeem the voucher"); }
    finally { setBusy(false); }
  };

  useEffect(() => {
    if (!user) return;
    const context = document.modelContext;
    if (!context?.registerTool) return;
    const lifecycle = new AbortController();
    const reportTool = context.registerTool({
      name: "start_trash_report", title: "Start trash report", description: "Open the ZeroTrash report form so a volunteer can add a required before photo and location.",
      inputSchema: { type: "object", properties: {}, additionalProperties: false },
      annotations: { readOnlyHint: false, untrustedContentHint: false }, execute: () => { setTab("dashboard"); setReportOpen(true); return { status: "report_form_open" }; },
    }, { signal: lifecycle.signal });
    const weightTool = context.registerTool({
      name: "record_collection_weight", title: "Record collection weight", description: "Record a collection-centre weigh-in for a cleaned report and award 30 credits per kilogram.",
      inputSchema: { type: "object", properties: { reportId: { type: "number" }, kilograms: { type: "number", exclusiveMinimum: 0 }, center: { type: "string", minLength: 2 } }, required: ["reportId", "kilograms", "center"], additionalProperties: false },
      annotations: { readOnlyHint: false, untrustedContentHint: false },
      execute: async (input: unknown) => { const value = input as { reportId: number; kilograms: number; center: string }; if (!Number.isInteger(value.reportId) || !Number.isFinite(value.kilograms) || value.kilograms <= 0 || !value.center?.trim()) throw new Error("A valid report, weight and centre are required"); return recordWeight(value.reportId, value.kilograms, value.center.trim()); },
    }, { signal: lifecycle.signal });
    void Promise.allSettled([Promise.resolve(reportTool), Promise.resolve(weightTool)]);
    return () => lifecycle.abort();
  }, [recordWeight, user]);

  const pendingCount = useMemo(() => state.reports.filter((report) => report.status !== "verified").length, [state.reports]);
  const greeting = "afternoon";

  if (!user) return <LoginScreen onLogin={logIn} />;

  const firstName = user.name.trim().split(/\s+/)[0] || "Volunteer";
  const initials = user.name.trim().split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "ZT";

  return (
    <Tabs value={tab} onValueChange={setTab} className="app-shell">
      <aside className="sidebar">
        <div className="brand"><span className="brand-mark"><Recycle /></span><span>zero<span>trash</span></span></div>
        <TabsList className="side-tabs" aria-label="Primary navigation">
          <TabsTrigger value="dashboard"><LayoutDashboard /> Dashboard</TabsTrigger>
          <TabsTrigger value="cleanups"><Recycle /> My cleanups <span className="nav-count">{pendingCount}</span></TabsTrigger>
          <TabsTrigger value="rewards"><Gift /> Rewards</TabsTrigger>
        </TabsList>
        <div className="sidebar-foot"><p className="eyebrow">COMMUNITY GOAL</p><div className="goal-row"><strong>742 kg</strong><span>of 1,000 kg</span></div><div className="goal-track"><span /></div><p>258 kg to a cleaner campus</p></div>
      </aside>

      <section className="workspace">
        <header className="topbar"><div className="mobile-brand"><Recycle /> zerotrash</div><div className="top-actions"><button className="icon-button" aria-label="Notifications"><Bell /></button><div className="avatar">{initials}</div><div className="profile"><strong>{user.name}</strong><span>{user.email}</span></div><button className="icon-button logout-button" aria-label="Log out" title="Log out" onClick={logOut}><LogOut /></button></div></header>
        <TabsList className="mobile-tabs" aria-label="Primary navigation"><TabsTrigger value="dashboard">Home</TabsTrigger><TabsTrigger value="cleanups">Cleanups</TabsTrigger><TabsTrigger value="rewards">Rewards</TabsTrigger></TabsList>

        <TabsContent value="dashboard" className="content">
          <section className="welcome"><div><p className="eyebrow green">YOUR CAMPUS IMPACT</p><h1>Good {greeting}, {firstName}.</h1><p>{pendingCount ? `${pendingCount} cleanup${pendingCount === 1 ? "" : "s"} need your next step.` : "Your campus is looking cleaner already."} Ready to make a difference?</p></div><Button className="report-button" size="lg" onClick={() => setReportOpen(true)}><Plus /> Report trash</Button></section>
          <section className="stats-grid" aria-label="Impact summary">
            <article className="stat-card green-card"><div><span className="stat-label">AVAILABLE BALANCE</span><strong>{state.balance}</strong><span className="unit">credits</span></div><div className="coin"><Sparkles /></div><button onClick={() => setTab("rewards")}>Redeem rewards <span>→</span></button></article>
            <article className="stat-card"><span className="stat-label">TOTAL COLLECTED</span><strong>{state.totalWeight.toFixed(1)} <span>kg</span></strong><p>Across {state.verifiedCount} verified cleanups</p></article>
            <article className="stat-card"><span className="stat-label">CAMPUS RANK</span><strong>#12</strong><p><span className="up">↑ 3 places</span> this month</p></article>
          </section>
          <section className="lower-grid"><article className="panel cleanups-panel"><div className="panel-head"><div><span className="kicker">YOUR CLEANUPS</span><h2>{state.reports.length ? "Keep the streak alive" : "Start your first cleanup"}</h2></div>{state.reports.length > 0 && <button onClick={() => setTab("cleanups")}>View all</button>}</div>{state.reports.length ? state.reports.slice(0, 2).map((report) => <CleanupRow key={report.id} report={report} onAfter={setAfterReport} onWeigh={setWeighReport} />) : <div className="empty-state"><span><Camera /></span><div><strong>No reports yet</strong><p>Spot some trash on campus? Add a before photo to begin.</p></div><Button variant="outline" onClick={() => setReportOpen(true)}>Report a spot</Button></div>}</article><ProcessPanel /></section>
        </TabsContent>

        <TabsContent value="cleanups" className="content page-content">
          <section className="page-title"><div><p className="eyebrow green">PROOF TO PROGRESS</p><h1>My cleanups</h1><p>Each report moves through cleanup, collection-centre weighing and verification.</p></div><Button className="report-button" onClick={() => setReportOpen(true)}><Plus /> New report</Button></section>
          <div className="report-list">{state.reports.length ? state.reports.map((report) => <article className="report-card" key={report.id}><div className="report-thumb">{report.beforeKey ? <img src={`/api/images/${encodeURIComponent(report.beforeKey)}`} alt="Trash before cleanup" /> : <Camera />}</div><div className="report-main"><div className="report-title-row"><div><span className="status-step">REPORT #{String(report.id).padStart(3, "0")}</span><h2>{report.location}</h2></div><span className={`status ${statusCopy[report.status].className}`}>{statusCopy[report.status].label}</span></div><div className="report-meta"><span><Recycle /> {report.wasteType}</span><span><MapPin /> Campus</span>{report.weight ? <span><Scale /> {report.weight.toFixed(1)} kg</span> : null}</div><div className="journey"><span className="done"><i><Check /></i>Reported</span><b /><span className={report.status !== "awaiting_cleanup" ? "done" : ""}><i>{report.status !== "awaiting_cleanup" ? <Check /> : "2"}</i>Cleaned</span><b /><span className={report.status === "verified" ? "done" : ""}><i>{report.status === "verified" ? <Check /> : "3"}</i>Weighed</span></div><div className="report-actions">{report.status === "awaiting_cleanup" && <Button onClick={() => setAfterReport(report)}><Camera /> Add after photo</Button>}{report.status === "awaiting_weighing" && <Button onClick={() => setWeighReport(report)}><Scale /> Record weigh-in</Button>}{report.status === "verified" && <span className="earned"><CircleDollarSign /> +{report.credits} credits earned</span>}</div></div></article>) : <div className="empty-page"><span><Recycle /></span><h2>Your cleanup journey starts here.</h2><p>Report a trash spot with a clear before photo, then return after you clean it.</p><Button onClick={() => setReportOpen(true)}><Plus /> Create first report</Button></div>}</div>
        </TabsContent>

        <TabsContent value="rewards" className="content page-content">
          <section className="page-title rewards-title"><div><p className="eyebrow green">1 CREDIT = ₹1</p><h1>Rewards that give back</h1><p>Exchange your verified impact for vouchers of the same value.</p></div><div className="balance-pill"><Sparkles /><span><small>YOUR BALANCE</small><strong>{state.balance} credits</strong></span></div></section>
          <div className="reward-grid">{rewards.map((reward) => { const Icon = reward.icon; const available = state.balance >= reward.value; return <article className="reward-card" key={reward.id}><div className="reward-top"><div className="reward-icon"><Icon /></div><span>{reward.value} CR</span></div><div><p>{reward.name}</p><h2>{reward.detail}</h2></div><Button disabled={!available} variant={available ? "default" : "secondary"} onClick={() => setRedeemReward(reward)}>{available ? "Redeem voucher" : `Need ${reward.value - state.balance} more`}</Button></article>; })}</div>
          <div className="reward-note"><Recycle /><div><strong>Every reward has a footprint.</strong><p>Credits are issued only after a collection centre verifies the weight. That keeps the system fair and the impact real.</p></div></div>
        </TabsContent>
      </section>

      <Dialog open={reportOpen} onOpenChange={setReportOpen}><DialogContent className="form-dialog"><DialogHeader><span className="dialog-icon"><MapPin /></span><DialogTitle>Report a trash spot</DialogTitle><DialogDescription>Add the location and a clear before photo. You can return after cleaning it.</DialogDescription></DialogHeader><form onSubmit={(event) => { event.preventDefault(); void submitReport(event.currentTarget); }}><Field label="Where is it?"><input name="location" required placeholder="e.g. Behind the science block" /></Field><Field label="Waste type"><Select name="wasteType" defaultValue="Mixed waste"><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="Mixed waste">Mixed waste</SelectItem><SelectItem value="Plastic">Plastic</SelectItem><SelectItem value="Paper">Paper</SelectItem><SelectItem value="Glass & metal">Glass & metal</SelectItem><SelectItem value="E-waste">E-waste</SelectItem></SelectContent></Select></Field><Field label="Before photo"><label className="upload-box"><Upload /><strong>Choose a photo</strong><span>JPG, PNG or WebP · up to 5 MB</span><input name="photo" type="file" accept="image/jpeg,image/png,image/webp" required /></label></Field><Field label="Notes (optional)"><textarea name="notes" rows={3} placeholder="Add a landmark or useful detail" /></Field><DialogFooter><Button type="button" variant="outline" onClick={() => setReportOpen(false)}>Cancel</Button><Button type="submit" disabled={busy}>{busy ? "Saving…" : "Submit report"}</Button></DialogFooter></form></DialogContent></Dialog>

      <Dialog open={!!afterReport} onOpenChange={(open) => !open && setAfterReport(null)}><DialogContent className="form-dialog"><DialogHeader><span className="dialog-icon"><Camera /></span><DialogTitle>Add your after photo</DialogTitle><DialogDescription>Show the cleaned area clearly. This unlocks the collection-centre weigh-in.</DialogDescription></DialogHeader><form onSubmit={(event) => { event.preventDefault(); void submitAfterPhoto(event.currentTarget); }}><Field label="Cleanup location"><div className="readonly-field">{afterReport?.location}</div></Field><Field label="After photo"><label className="upload-box"><Upload /><strong>Choose the cleaned photo</strong><span>JPG, PNG or WebP · up to 5 MB</span><input name="photo" type="file" accept="image/jpeg,image/png,image/webp" required /></label></Field><DialogFooter><Button type="button" variant="outline" onClick={() => setAfterReport(null)}>Cancel</Button><Button type="submit" disabled={busy}>{busy ? "Uploading…" : "Save cleanup proof"}</Button></DialogFooter></form></DialogContent></Dialog>

      <Dialog open={!!weighReport} onOpenChange={(open) => !open && setWeighReport(null)}><DialogContent className="form-dialog"><DialogHeader><span className="dialog-icon"><Scale /></span><DialogTitle>Collection-centre weigh-in</DialogTitle><DialogDescription>Enter the verified weight. ZeroTrash awards 30 credits for every kilogram.</DialogDescription></DialogHeader><Field label="Collection centre"><Select value={centre} onValueChange={setCentre}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="Main Gate Green Point">Main Gate Green Point</SelectItem><SelectItem value="Hostel Block Collection Bay">Hostel Block Collection Bay</SelectItem><SelectItem value="Sports Complex Drop-off">Sports Complex Drop-off</SelectItem></SelectContent></Select></Field><Field label="Verified weight (kg)"><input type="number" min="0.1" max="100" step="0.1" value={weight} onChange={(event) => setWeight(event.target.value)} placeholder="0.0" /></Field>{Number(weight) > 0 && <div className="credit-preview"><Sparkles /><span>You’ll earn</span><strong>{Math.round(Number(weight) * 30)} credits</strong></div>}<DialogFooter><Button type="button" variant="outline" onClick={() => setWeighReport(null)}>Cancel</Button><Button onClick={() => void submitWeight()} disabled={busy}>{busy ? "Verifying…" : "Verify & award credits"}</Button></DialogFooter></DialogContent></Dialog>

      <Dialog open={!!redeemReward} onOpenChange={(open) => !open && setRedeemReward(null)}><DialogContent className="redeem-dialog"><DialogHeader><span className="dialog-icon"><Gift /></span><DialogTitle>Redeem {redeemReward?.detail}</DialogTitle><DialogDescription>{redeemReward?.value} credits will be exchanged for a ₹{redeemReward?.value} voucher from {redeemReward?.name}.</DialogDescription></DialogHeader><div className="redemption-math"><span>{state.balance} current credits</span><span>− {redeemReward?.value ?? 0} voucher</span><strong>{state.balance - (redeemReward?.value ?? 0)} credits left</strong></div><DialogFooter><Button type="button" variant="outline" onClick={() => setRedeemReward(null)}>Keep credits</Button><Button onClick={() => void confirmRedeem()} disabled={busy}>{busy ? "Redeeming…" : "Confirm redemption"}</Button></DialogFooter></DialogContent></Dialog>
      <Toaster position="top-right" richColors />
    </Tabs>
  );
}

function LoginScreen({ onLogin }: { onLogin: (profile: UserProfile) => void }) {
  const [error, setError] = useState("");

  const submit = (form: HTMLFormElement) => {
    const data = new FormData(form);
    const name = String(data.get("name") ?? "").trim();
    const email = String(data.get("email") ?? "").trim().toLowerCase();
    const password = String(data.get("password") ?? "");
    if (name.length < 2) { setError("Enter your name to continue."); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setError("Enter a valid college email."); return; }
    if (password.length < 4) { setError("Use at least 4 characters for the demo password."); return; }
    setError("");
    onLogin({ name, email });
  };

  return (
    <main className="login-shell">
      <header className="login-nav">
        <div className="brand login-brand"><span className="brand-mark"><Recycle /></span><span>zero<span>trash</span></span></div>
        <div className="login-nav-note"><span className="live-dot" /> Campus impact platform</div>
      </header>

      <div className="login-grid">
        <section className="login-copy">
          <div className="login-form-wrap">
            <div className="login-kicker"><Leaf /> Cleaner campus. Shared rewards.</div>
            <h1>Turn a quick cleanup into <em>real impact.</em></h1>
            <p className="login-lead">Join your campus community to report waste, document the cleanup and earn credits for every verified kilogram.</p>

            <form className="login-form" onSubmit={(event) => { event.preventDefault(); submit(event.currentTarget); }}>
              <div className="login-field"><label htmlFor="login-name">Your name</label><div className="input-wrap"><UserRound /><Input id="login-name" name="name" autoComplete="name" placeholder="e.g. Aanya Mehta" required /></div></div>
              <div className="login-field"><label htmlFor="login-email">College email</label><div className="input-wrap"><Mail /><Input id="login-email" name="email" type="email" autoComplete="email" placeholder="you@college.edu" required /></div></div>
              <div className="login-field"><div className="field-label-row"><label htmlFor="login-password">Password</label><span>Secure campus access</span></div><div className="input-wrap"><LockKeyhole /><Input id="login-password" name="password" type="password" autoComplete="current-password" placeholder="Enter your password" required /></div></div>
              {error && <p className="login-error" role="alert">{error}</p>}
              <Button type="submit" size="lg" className="login-submit">Enter ZeroTrash <ArrowRight /></Button>
              <p className="demo-note"><ShieldCheck /> Prototype access — any valid college email works.</p>
            </form>
          </div>
        </section>

        <section className="journey-stage" aria-labelledby="journey-title">
          <div className="stage-grid" aria-hidden="true" />
          <div className="stage-glow glow-one" aria-hidden="true" />
          <div className="stage-glow glow-two" aria-hidden="true" />
          <div className="journey-content">
            <div className="journey-head"><div><span>THE ZEROTRASH LOOP</span><h2 id="journey-title">Four moves. One cleaner campus.</h2></div><div className="loop-badge"><TrendingUp /> Live impact</div></div>
            <div className="flow-chart" aria-label="Report, clean, weigh and redeem flow">
              <FlowNode number="01" icon={Camera} title="Spot it" text="Photo + location" />
              <FlowLink />
              <FlowNode number="02" icon={Broom} title="Clean it" text="Upload after proof" />
              <FlowLink />
              <FlowNode number="03" icon={Scale} title="Weigh it" text="Centre verifies kg" />
              <FlowLink />
              <FlowNode number="04" icon={Gift} title="Redeem it" text="Credits = voucher" accent />
            </div>
            <div className="impact-equation"><span><strong>1 kg</strong><small>verified waste</small></span><ArrowRight /><span><strong>30</strong><small>green credits</small></span><ArrowRight /><span><strong>₹30</strong><small>voucher value</small></span></div>
            <div className="stage-bottom"><div className="before-after"><div><Camera /><span><small>BEFORE</small><strong>Report the spot</strong></span></div><i><ArrowRight /></i><div className="after"><Check /><span><small>AFTER</small><strong>Prove the change</strong></span></div></div><div className="campus-score"><span>Campus goal</span><strong>742 <small>kg</small></strong><div><i /></div><small>74% cleaned</small></div></div>
          </div>
        </section>
      </div>
    </main>
  );
}

function FlowNode({ number, icon: Icon, title, text, accent = false }: { number: string; icon: typeof Camera; title: string; text: string; accent?: boolean }) {
  return <article className={`flow-node${accent ? " accent" : ""}`}><span className="flow-number">{number}</span><div className="flow-icon"><Icon /></div><strong>{title}</strong><p>{text}</p></article>;
}

function FlowLink() { return <div className="flow-link" aria-hidden="true"><span /><ArrowRight /></div>; }

function Field({ label, children }: { label: string; children: React.ReactNode }) { return <div className="field"><span>{label}</span>{children}</div>; }

function CleanupRow({ report, onAfter, onWeigh }: { report: Report; onAfter: (report: Report) => void; onWeigh: (report: Report) => void }) {
  const status = statusCopy[report.status];
  return <div className="cleanup-row"><div className={`cleanup-icon ${report.status === "verified" ? "done" : ""}`}>{report.status === "verified" ? <Recycle /> : <MapPin />}</div><div><strong>{report.location}</strong><span>{report.weight ? `${report.weight.toFixed(1)} kg · ` : ""}{new Intl.DateTimeFormat("en-IN", { month: "short", day: "numeric", timeZone: "UTC" }).format(new Date(report.createdAt))}</span></div><span className={`status ${status.className}`}>{status.label}</span>{report.status === "awaiting_cleanup" ? <button className="small-action" onClick={() => onAfter(report)}>Add after photo</button> : report.status === "awaiting_weighing" ? <button className="small-action" onClick={() => onWeigh(report)}>Record weight</button> : <strong className="credit-gain">+{report.credits}</strong>}</div>;
}

function ProcessPanel() { return <article className="panel process-panel"><span className="kicker">HOW IT WORKS</span><h2>Trash to reward</h2><ol className="steps"><li><span>01</span><div><strong>Spot it</strong><p>Upload a photo and location.</p></div></li><li><span>02</span><div><strong>Clean it</strong><p>Add an after photo as proof.</p></div></li><li><span>03</span><div><strong>Weigh it</strong><p>Visit a collection centre.</p></div></li><li><span>04</span><div><strong>Earn it</strong><p>Get credits. Pick a voucher.</p></div></li></ol></article>; }

declare global {
  interface Document { modelContext?: { registerTool: (tool: { name: string; title?: string; description: string; inputSchema: object; annotations?: { readOnlyHint?: boolean; untrustedContentHint?: boolean }; execute: (input: unknown) => unknown | Promise<unknown> }, options?: { signal?: AbortSignal }) => void | Promise<void> } }
}
