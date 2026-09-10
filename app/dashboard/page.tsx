"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import {
  Bell, CalendarDays, Camera, Check, CircleDollarSign, Copy, Gift, LayoutDashboard, LogOut,
  MapPin, Plus, Recycle, Scale, Sparkles, Store, Ticket, Upload,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Toaster } from "@/components/ui/sonner";

type Report = {
  id: number; location: string; wasteType: string; notes: string; beforeKey: string;
  afterKey: string | null; center: string | null; weight: number | null; credits: number;
  status: "awaiting_cleanup" | "awaiting_weighing" | "verified"; createdAt: string;
};

type Redemption = { id: number; rewardId: string; name: string; description: string; value: number; code: string; redeemedAt: string };
type AppState = { reports: Report[]; redemptions: Redemption[]; balance: number; totalWeight: number; verifiedCount: number };
type UserProfile = { name: string; email: string; role: "volunteer" | "admin" };

const rewards = [
  { id: "cafe-100", name: "Campus Café", value: 100, detail: "₹100 food voucher", icon: Store },
  { id: "books-250", name: "College Bookstore", value: 250, detail: "₹250 store voucher", icon: Ticket },
  { id: "canteen-500", name: "Main Canteen", value: 500, detail: "₹500 meal voucher", icon: Gift },
];

const statusCopy = {
  awaiting_cleanup: { label: "Awaiting cleanup", className: "waiting" },
  awaiting_weighing: { label: "Pending admin verification", className: "weighing" },
  verified: { label: "Verified", className: "verified" },
};

const acceptedPhotoTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
const maxPhotoBytes = 5 * 1024 * 1024;

async function readApiResult<T extends object>(response: Response): Promise<T & { error?: string }> {
  const body = await response.text();
  if (!body) return {} as T & { error?: string };
  try {
    return JSON.parse(body) as T & { error?: string };
  } catch {
    const error = response.status === 413
      ? "That photo is too large. Choose one under 5 MB."
      : "The upload could not be completed. Try a JPG, PNG or WebP photo.";
    return { error } as T & { error?: string };
  }
}

export default function Home() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [tab, setTab] = useState("dashboard");
  const [state, setState] = useState<AppState>({ reports: [], redemptions: [], balance: 0, totalWeight: 0, verifiedCount: 0 });
  const [reportOpen, setReportOpen] = useState(false);
  const [afterReport, setAfterReport] = useState<Report | null>(null);
  const [redeemReward, setRedeemReward] = useState<(typeof rewards)[number] | null>(null);
  const [busy, setBusy] = useState(false);
  const mounted = useRef(true);

  useEffect(() => {
    let active = true;
    const loadUser = async () => {
      try {
        const response = await fetch("/api/auth/me?role=volunteer", { cache: "no-store" });
        if (!response.ok) { window.location.replace("/signin"); return; }
        const result = await response.json() as { user: UserProfile };
        if (result.user.role !== "volunteer") { window.location.replace("/admin"); return; }
        if (active) setUser(result.user);
      } catch { window.location.replace("/signin"); }
      finally { if (active) setAuthReady(true); }
    };
    void loadUser();
    return () => { active = false; };
  }, []);

  const loadState = useCallback(async () => {
    if (!user) return;
    try {
      const response = await fetch("/api/state", { cache: "no-store" });
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

  const logOut = async () => {
    await fetch("/api/auth/signout?role=volunteer", { method: "POST" });
    window.location.assign("/signin");
  };

  const submitReport = async (form: HTMLFormElement) => {
    setBusy(true);
    try {
      const response = await fetch("/api/reports", { method: "POST", body: new FormData(form) });
      const result = await readApiResult(response);
      if (!response.ok) throw new Error(result.error || "Could not save the report");
      await loadState(); setReportOpen(false); form.reset(); toast.success("Trash spot reported. Let’s clean it up!");
    } catch (error) { toast.error(error instanceof Error ? error.message : "Could not save the report"); }
    finally { setBusy(false); }
  };

  const submitAfterPhoto = async (form: HTMLFormElement) => {
    if (!afterReport) return;
    setBusy(true);
    try {
      const response = await fetch(`/api/reports/${afterReport.id}/after`, { method: "POST", body: new FormData(form) });
      const result = await readApiResult(response);
      if (!response.ok) throw new Error(result.error || "Could not save the photo");
      await loadState(); setAfterReport(null); toast.success("Cleanup proof added. Take it to a collection centre for admin verification.");
    } catch (error) { toast.error(error instanceof Error ? error.message : "Could not save the photo"); }
    finally { setBusy(false); }
  };

  const redeemVoucher = useCallback(async (rewardId: string) => {
    const response = await fetch("/api/redeem", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ rewardId }) });
    const result = await response.json() as { error?: string; code?: string };
    if (!response.ok) throw new Error(result.error || "Could not redeem the voucher");
    await loadState();
    return result;
  }, [loadState]);

  const confirmRedeem = async () => {
    if (!redeemReward) return;
    setBusy(true);
    try {
      const result = await redeemVoucher(redeemReward.id);
      setRedeemReward(null); toast.success(`Voucher unlocked — code ${result.code}`);
    } catch (error) { toast.error(error instanceof Error ? error.message : "Could not redeem the voucher"); }
    finally { setBusy(false); }
  };

  const copyVoucherCode = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      toast.success("Voucher code copied");
    } catch {
      toast.error("Could not copy the code. Select it manually instead.");
    }
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
    void Promise.resolve(reportTool);
    return () => lifecycle.abort();
  }, [user]);

  const pendingCount = useMemo(() => state.reports.filter((report) => report.status !== "verified").length, [state.reports]);
  const greeting = "afternoon";

  if (!authReady || !user) return <DashboardLoading />;

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
          <TabsTrigger value="vouchers"><Ticket /> My vouchers {state.redemptions.length > 0 && <span className="nav-count">{state.redemptions.length}</span>}</TabsTrigger>
        </TabsList>
        <div className="sidebar-foot"><p className="eyebrow">COMMUNITY GOAL</p><div className="goal-row"><strong>742 kg</strong><span>of 1,000 kg</span></div><div className="goal-track"><span /></div><p>258 kg to a cleaner campus</p></div>
      </aside>

      <section className="workspace">
        <header className="topbar"><div className="mobile-brand"><Recycle /> zerotrash</div><div className="top-actions"><button className="icon-button" aria-label="Notifications"><Bell /></button><div className="avatar">{initials}</div><div className="profile"><strong>{user.name}</strong><span>{user.email}</span></div><button className="icon-button logout-button" aria-label="Log out" title="Log out" onClick={() => void logOut()}><LogOut /></button></div></header>
        <TabsList className="mobile-tabs" aria-label="Primary navigation"><TabsTrigger value="dashboard">Home</TabsTrigger><TabsTrigger value="cleanups">Cleanups</TabsTrigger><TabsTrigger value="rewards">Rewards</TabsTrigger><TabsTrigger value="vouchers">Vouchers</TabsTrigger></TabsList>

        <TabsContent value="dashboard" className="content">
          <section className="welcome"><div><p className="eyebrow green">YOUR CAMPUS IMPACT</p><h1>Good {greeting}, {firstName}.</h1><p>{pendingCount ? `${pendingCount} cleanup${pendingCount === 1 ? "" : "s"} need your next step.` : "Your campus is looking cleaner already."} Ready to make a difference?</p></div><Button className="report-button" size="lg" onClick={() => setReportOpen(true)}><Plus /> Report trash</Button></section>
          <section className="stats-grid" aria-label="Impact summary">
            <article className="stat-card green-card"><div><span className="stat-label">AVAILABLE BALANCE</span><strong>{state.balance}</strong><span className="unit">credits</span></div><div className="coin"><Sparkles /></div><button onClick={() => setTab("rewards")}>Redeem rewards <span>→</span></button></article>
            <article className="stat-card"><span className="stat-label">TOTAL COLLECTED</span><strong>{state.totalWeight.toFixed(1)} <span>kg</span></strong><p>Across {state.verifiedCount} verified cleanups</p></article>
            <article className="stat-card"><span className="stat-label">CAMPUS RANK</span><strong>#12</strong><p><span className="up">↑ 3 places</span> this month</p></article>
          </section>
          <section className="lower-grid"><article className="panel cleanups-panel"><div className="panel-head"><div><span className="kicker">YOUR CLEANUPS</span><h2>{state.reports.length ? "Keep the streak alive" : "Start your first cleanup"}</h2></div>{state.reports.length > 0 && <button onClick={() => setTab("cleanups")}>View all</button>}</div>{state.reports.length ? state.reports.slice(0, 2).map((report) => <CleanupRow key={report.id} report={report} onAfter={setAfterReport} />) : <div className="empty-state"><span><Camera /></span><div><strong>No reports yet</strong><p>Spot some trash on campus? Add a before photo to begin.</p></div><Button variant="outline" onClick={() => setReportOpen(true)}>Report a spot</Button></div>}</article><ProcessPanel /></section>
        </TabsContent>

        <TabsContent value="cleanups" className="content page-content">
          <section className="page-title"><div><p className="eyebrow green">PROOF TO PROGRESS</p><h1>My cleanups</h1><p>Each report moves through cleanup, collection-centre weighing and verification.</p></div><Button className="report-button" onClick={() => setReportOpen(true)}><Plus /> New report</Button></section>
          <div className="report-list">{state.reports.length ? state.reports.map((report) => <article className="report-card" key={report.id}><div className="report-thumb">{report.beforeKey ? <img src={`/api/images/${encodeURIComponent(report.beforeKey)}`} alt="Trash before cleanup" /> : <Camera />}</div><div className="report-main"><div className="report-title-row"><div><span className="status-step">REPORT #{String(report.id).padStart(3, "0")}</span><h2>{report.location}</h2></div><span className={`status ${statusCopy[report.status].className}`}>{statusCopy[report.status].label}</span></div><div className="report-meta"><span><Recycle /> {report.wasteType}</span><span><MapPin /> Campus</span>{report.weight ? <span><Scale /> {report.weight.toFixed(1)} kg</span> : null}</div><div className="journey"><span className="done"><i><Check /></i>Reported</span><b /><span className={report.status !== "awaiting_cleanup" ? "done" : ""}><i>{report.status !== "awaiting_cleanup" ? <Check /> : "2"}</i>Cleaned</span><b /><span className={report.status === "verified" ? "done" : ""}><i>{report.status === "verified" ? <Check /> : "3"}</i>Verified</span></div><div className="report-actions">{report.status === "awaiting_cleanup" && <Button onClick={() => setAfterReport(report)}><Camera /> Add after photo</Button>}{report.status === "awaiting_weighing" && <span className="centre-wait"><Scale /> Take the waste to a collection centre for verification</span>}{report.status === "verified" && <span className="earned"><CircleDollarSign /> +{report.credits} credits earned</span>}</div></div></article>) : <div className="empty-page"><span><Recycle /></span><h2>Your cleanup journey starts here.</h2><p>Report a trash spot with a clear before photo, then return after you clean it.</p><Button onClick={() => setReportOpen(true)}><Plus /> Create first report</Button></div>}</div>
        </TabsContent>

        <TabsContent value="rewards" className="content page-content">
          <section className="page-title rewards-title"><div><p className="eyebrow green">1 CREDIT = ₹1</p><h1>Rewards that give back</h1><p>Exchange your verified impact for vouchers of the same value.</p></div><div className="balance-pill"><Sparkles /><span><small>YOUR BALANCE</small><strong>{state.balance} credits</strong></span></div></section>
          <div className="reward-grid">{rewards.map((reward) => { const Icon = reward.icon; const available = state.balance >= reward.value; return <article className="reward-card" key={reward.id}><div className="reward-top"><div className="reward-icon"><Icon /></div><span>{reward.value} CR</span></div><div><p>{reward.name}</p><h2>{reward.detail}</h2></div><Button disabled={!available} variant={available ? "default" : "secondary"} onClick={() => setRedeemReward(reward)}>{available ? "Redeem voucher" : `Need ${reward.value - state.balance} more`}</Button></article>; })}</div>
          <div className="reward-note"><Recycle /><div><strong>Every reward has a footprint.</strong><p>Credits are issued only after a collection centre verifies the weight. That keeps the system fair and the impact real.</p></div></div>
        </TabsContent>

        <TabsContent value="vouchers" className="content page-content">
          <section className="page-title vouchers-title"><div><p className="eyebrow green">REDEMPTION WALLET</p><h1>My vouchers</h1><p>Find every voucher you have unlocked and copy its code when you are ready to use it.</p></div><div className="voucher-count"><Ticket /><span><small>REDEEMED</small><strong>{state.redemptions.length} voucher{state.redemptions.length === 1 ? "" : "s"}</strong></span></div></section>
          {state.redemptions.length ? <div className="redeemed-grid">{state.redemptions.map((redemption) => <article className="redeemed-card" key={redemption.id}><div className="redeemed-card-top"><span className="redeemed-brand"><Ticket /></span><span className="redeemed-status"><Check /> Ready to use</span></div><div className="redeemed-copy"><small>{redemption.name}</small><h2>{redemption.description}</h2><p><CalendarDays /> Redeemed {formatDashboardDate(redemption.redeemedAt)}</p></div><div className="voucher-code-row"><div><small>VOUCHER CODE</small><strong>{redemption.code}</strong></div><button type="button" onClick={() => void copyVoucherCode(redemption.code)} aria-label={`Copy voucher code ${redemption.code}`}><Copy /> Copy</button></div><footer><span>{redemption.value} credits</span><span>Keep this code private</span></footer></article>)}</div> : <div className="voucher-empty"><span><Ticket /></span><h2>No redeemed vouchers yet</h2><p>Redeem a reward with your verified cleanup credits and it will appear here automatically.</p><Button onClick={() => setTab("rewards")}><Gift /> Browse rewards</Button></div>}
        </TabsContent>
      </section>

      <Dialog open={reportOpen} onOpenChange={setReportOpen}><DialogContent className="form-dialog"><DialogHeader><span className="dialog-icon"><MapPin /></span><DialogTitle>Report a trash spot</DialogTitle><DialogDescription>Add the location and a clear before photo. You can return after cleaning it.</DialogDescription></DialogHeader><form onSubmit={(event) => { event.preventDefault(); void submitReport(event.currentTarget); }}><Field label="Where is it?"><input name="location" required placeholder="e.g. Behind the science block" /></Field><Field label="Waste type"><Select name="wasteType" defaultValue="Mixed waste"><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="Mixed waste">Mixed waste</SelectItem><SelectItem value="Plastic">Plastic</SelectItem><SelectItem value="Paper">Paper</SelectItem><SelectItem value="Glass & metal">Glass & metal</SelectItem><SelectItem value="E-waste">E-waste</SelectItem></SelectContent></Select></Field><Field label="Before photo"><PhotoPicker stage="before" /></Field><Field label="Notes (optional)"><textarea name="notes" rows={3} placeholder="Add a landmark or useful detail" /></Field><DialogFooter><Button type="button" variant="outline" onClick={() => setReportOpen(false)}>Cancel</Button><Button type="submit" disabled={busy}>{busy ? "Saving…" : "Submit report"}</Button></DialogFooter></form></DialogContent></Dialog>

      <Dialog open={!!afterReport} onOpenChange={(open) => !open && setAfterReport(null)}><DialogContent className="form-dialog"><DialogHeader><span className="dialog-icon"><Camera /></span><DialogTitle>Add your after photo</DialogTitle><DialogDescription>Show the cleaned area clearly. This sends the cleanup to the admin verification queue.</DialogDescription></DialogHeader><form onSubmit={(event) => { event.preventDefault(); void submitAfterPhoto(event.currentTarget); }}><Field label="Cleanup location"><div className="readonly-field">{afterReport?.location}</div></Field><Field label="After photo"><PhotoPicker stage="after" /></Field><DialogFooter><Button type="button" variant="outline" onClick={() => setAfterReport(null)}>Cancel</Button><Button type="submit" disabled={busy}>{busy ? "Uploading…" : "Send for verification"}</Button></DialogFooter></form></DialogContent></Dialog>

      <Dialog open={!!redeemReward} onOpenChange={(open) => !open && setRedeemReward(null)}><DialogContent className="redeem-dialog"><DialogHeader><span className="dialog-icon"><Gift /></span><DialogTitle>Redeem {redeemReward?.detail}</DialogTitle><DialogDescription>{redeemReward?.value} credits will be exchanged for a ₹{redeemReward?.value} voucher from {redeemReward?.name}.</DialogDescription></DialogHeader><div className="redemption-math"><span>{state.balance} current credits</span><span>− {redeemReward?.value ?? 0} voucher</span><strong>{state.balance - (redeemReward?.value ?? 0)} credits left</strong></div><DialogFooter><Button type="button" variant="outline" onClick={() => setRedeemReward(null)}>Keep credits</Button><Button onClick={() => void confirmRedeem()} disabled={busy}>{busy ? "Redeeming…" : "Confirm redemption"}</Button></DialogFooter></DialogContent></Dialog>
      <Toaster position="top-right" richColors />
    </Tabs>
  );
}

function DashboardLoading() {
  return <main className="dashboard-loading"><div className="brand"><span className="brand-mark"><Recycle /></span><span>zero<span>trash</span></span></div><div className="loading-ring" aria-label="Opening your dashboard" /></main>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) { return <div className="field"><span>{label}</span>{children}</div>; }

function PhotoPicker({ stage }: { stage: "before" | "after" }) {
  const inputId = useId();
  const [photo, setPhoto] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!photo) { setPreviewUrl(null); return; }
    const nextUrl = URL.createObjectURL(photo);
    setPreviewUrl(nextUrl);
    return () => URL.revokeObjectURL(nextUrl);
  }, [photo]);

  const selectPhoto = (event: React.ChangeEvent<HTMLInputElement>) => {
    const input = event.currentTarget;
    const nextPhoto = input.files?.[0] ?? null;
    input.setCustomValidity("");
    setError("");

    if (!nextPhoto) { setPhoto(null); return; }
    if (!acceptedPhotoTypes.has(nextPhoto.type)) {
      const message = "Choose a JPG, PNG or WebP photo.";
      input.value = "";
      input.setCustomValidity(message);
      setPhoto(null);
      setError(message);
      return;
    }
    if (nextPhoto.size > maxPhotoBytes) {
      const message = "This photo is over 5 MB. Choose a smaller image.";
      input.value = "";
      input.setCustomValidity(message);
      setPhoto(null);
      setError(message);
      return;
    }
    setPhoto(nextPhoto);
  };

  const label = stage === "before" ? "trash before cleanup" : "cleaned area";

  return <div className="photo-picker">
    <label className={`upload-box${photo ? " has-photo" : ""}`} htmlFor={inputId}>
      {previewUrl && photo ? <>
        <span className="upload-preview"><img src={previewUrl} alt={`Preview of ${label}`} /></span>
        <span className="upload-copy"><strong>{photo.name}</strong><span>{(photo.size / (1024 * 1024)).toFixed(1)} MB · Ready to upload</span><b>Click to change photo</b></span>
        <Check className="upload-check" aria-hidden="true" />
      </> : <>
        <Upload aria-hidden="true" />
        <strong>{stage === "before" ? "Choose the before photo" : "Choose the cleaned photo"}</strong>
        <span>Click or drop a JPG, PNG or WebP · up to 5 MB</span>
      </>}
      <input id={inputId} name="photo" type="file" accept="image/jpeg,image/png,image/webp" required onChange={selectPhoto} aria-describedby={`${inputId}-status`} />
    </label>
    <span id={`${inputId}-status`} className={`photo-status${error ? " error" : ""}`} aria-live="polite">{error || (photo ? "Photo selected successfully." : "No photo selected yet.")}</span>
  </div>;
}

function CleanupRow({ report, onAfter }: { report: Report; onAfter: (report: Report) => void }) {
  const status = statusCopy[report.status];
  return <div className="cleanup-row"><div className={`cleanup-icon ${report.status === "verified" ? "done" : ""}`}>{report.status === "verified" ? <Recycle /> : <MapPin />}</div><div><strong>{report.location}</strong><span>{report.weight ? `${report.weight.toFixed(1)} kg · ` : ""}{new Intl.DateTimeFormat("en-IN", { month: "short", day: "numeric", timeZone: "UTC" }).format(new Date(report.createdAt))}</span></div><span className={`status ${status.className}`}>{status.label}</span>{report.status === "awaiting_cleanup" ? <button className="small-action" onClick={() => onAfter(report)}>Add after photo</button> : report.status === "awaiting_weighing" ? <span className="centre-wait compact"><Scale /> Centre check</span> : <strong className="credit-gain">+{report.credits}</strong>}</div>;
}

function ProcessPanel() { return <article className="panel process-panel"><span className="kicker">HOW IT WORKS</span><h2>Trash to reward</h2><ol className="steps"><li><span>01</span><div><strong>Spot it</strong><p>Upload a photo and location.</p></div></li><li><span>02</span><div><strong>Clean it</strong><p>Add an after photo as proof.</p></div></li><li><span>03</span><div><strong>Centre verifies</strong><p>An admin records the weight.</p></div></li><li><span>04</span><div><strong>Earn it</strong><p>Get credits. Pick a voucher.</p></div></li></ol></article>; }

function formatDashboardDate(value: string) {
  return new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric" }).format(new Date(value.endsWith("Z") ? value : `${value.replace(" ", "T")}Z`));
}

declare global {
  interface Document { modelContext?: { registerTool: (tool: { name: string; title?: string; description: string; inputSchema: object; annotations?: { readOnlyHint?: boolean; untrustedContentHint?: boolean }; execute: (input: unknown) => unknown | Promise<unknown> }, options?: { signal?: AbortSignal }) => void | Promise<void> } }
}
