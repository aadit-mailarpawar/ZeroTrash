"use client";

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import {
  Bell, CalendarDays, Camera, Check, CircleDollarSign, Copy, Gift, LayoutDashboard, LogOut,
  MapPin, Navigation, Recycle, Scale, Sparkles, Store, Ticket, Upload,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Toaster } from "@/components/ui/sonner";

type Report = {
  id: number; location: string; wasteType: string; notes: string; beforeKey: string | null;
  afterKey: string | null; center: string | null; weight: number | null; credits: number;
  status: "open" | "awaiting_after" | "awaiting_weighing" | "verified"; createdAt: string;
};

type Redemption = { id: number; rewardId: string; name: string; description: string; value: number; code: string; redeemedAt: string };
type AppState = { reports: Report[]; availableSpots: Report[]; redemptions: Redemption[]; balance: number; totalWeight: number; verifiedCount: number };
type UserProfile = { name: string; email: string; role: "volunteer" | "admin" };

const rewards = [
  { id: "cafe-100", name: "Campus Café", value: 100, detail: "₹100 food voucher", icon: Store },
  { id: "books-250", name: "College Bookstore", value: 250, detail: "₹250 store voucher", icon: Ticket },
  { id: "canteen-500", name: "Main Canteen", value: 500, detail: "₹500 meal voucher", icon: Gift },
];

const statusCopy = {
  open: { label: "Open spot", className: "open" },
  awaiting_after: { label: "Add after photo", className: "waiting" },
  awaiting_weighing: { label: "Pending admin verification", className: "weighing" },
  verified: { label: "Verified", className: "verified" },
};

const acceptedPhotoTypes = new Set(["image/jpeg", "image/png", "image/webp"]);
const maxPhotoBytes = 5 * 1024 * 1024;
const photoLocationEnabled = import.meta.env.VITE_PHOTO_LOCATION_ENABLED === "true";

function getCurrentCoordinates() {
  return new Promise<{ latitude: number; longitude: number }>((resolve, reject) => {
    if (!navigator.geolocation) { reject(new Error("Location services are not available on this device.")); return; }
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => resolve({ latitude: coords.latitude, longitude: coords.longitude }),
      () => reject(new Error("Allow location access so the photo can be geotagged.")),
      { enableHighAccuracy: true, timeout: 12_000, maximumAge: 30_000 },
    );
  });
}

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
  const [state, setState] = useState<AppState>({ reports: [], availableSpots: [], redemptions: [], balance: 0, totalWeight: 0, verifiedCount: 0 });
  const [startSpot, setStartSpot] = useState<Report | null>(null);
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

  const submitBeforePhoto = async (form: HTMLFormElement) => {
    if (!startSpot) return;
    setBusy(true);
    try {
      const formData = new FormData(form);
      if (photoLocationEnabled) {
        const coordinates = await getCurrentCoordinates();
        formData.set("latitude", String(coordinates.latitude));
        formData.set("longitude", String(coordinates.longitude));
      }
      const response = await fetch(`/api/spots/${startSpot.id}/start`, { method: "POST", body: formData });
      const result = await readApiResult(response);
      if (!response.ok) throw new Error(result.error || "Could not start this cleanup");
      await loadState(); setStartSpot(null); form.reset(); setTab("cleanups"); toast.success("Before photo saved. This spot is now assigned to you.");
    } catch (error) { toast.error(error instanceof Error ? error.message : "Could not start this cleanup"); }
    finally { setBusy(false); }
  };

  const submitAfterPhoto = async (form: HTMLFormElement) => {
    if (!afterReport) return;
    setBusy(true);
    try {
      const formData = new FormData(form);
      if (photoLocationEnabled) {
        const coordinates = await getCurrentCoordinates();
        formData.set("latitude", String(coordinates.latitude));
        formData.set("longitude", String(coordinates.longitude));
      }
      const response = await fetch(`/api/reports/${afterReport.id}/after`, { method: "POST", body: formData });
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
      name: "find_cleanup_spot", title: "Find cleanup spot", description: "Open the available cleanup spots listed by campus administrators.",
      inputSchema: { type: "object", properties: {}, additionalProperties: false },
      annotations: { readOnlyHint: true, untrustedContentHint: false }, execute: () => { setTab("spots"); return { status: "available_spots_open" }; },
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
          <TabsTrigger value="spots"><MapPin /> Available spots <span className="nav-count">{state.availableSpots.length}</span></TabsTrigger>
          <TabsTrigger value="cleanups"><Recycle /> My cleanups <span className="nav-count">{pendingCount}</span></TabsTrigger>
          <TabsTrigger value="rewards"><Gift /> Rewards</TabsTrigger>
          <TabsTrigger value="vouchers"><Ticket /> My vouchers {state.redemptions.length > 0 && <span className="nav-count">{state.redemptions.length}</span>}</TabsTrigger>
        </TabsList>
        <div className="sidebar-foot"><p className="eyebrow">COMMUNITY GOAL</p><div className="goal-row"><strong>742 kg</strong><span>of 1,000 kg</span></div><div className="goal-track"><span /></div><p>258 kg to a cleaner campus</p></div>
      </aside>

      <section className="workspace">
        <header className="topbar"><div className="mobile-brand"><Recycle /> zerotrash</div><div className="top-actions"><button className="icon-button" aria-label="Notifications"><Bell /></button><div className="avatar">{initials}</div><div className="profile"><strong>{user.name}</strong><span>{user.email}</span></div><button className="icon-button logout-button" aria-label="Log out" title="Log out" onClick={() => void logOut()}><LogOut /></button></div></header>
        <TabsList className="mobile-tabs" aria-label="Primary navigation"><TabsTrigger value="dashboard">Home</TabsTrigger><TabsTrigger value="spots">Spots</TabsTrigger><TabsTrigger value="cleanups">Cleanups</TabsTrigger><TabsTrigger value="rewards">Rewards</TabsTrigger><TabsTrigger value="vouchers">Vouchers</TabsTrigger></TabsList>

        <TabsContent value="dashboard" className="content">
          <section className="welcome"><div><p className="eyebrow green">YOUR CAMPUS IMPACT</p><h1>Good {greeting}, {firstName}.</h1><p>{pendingCount ? `${pendingCount} cleanup${pendingCount === 1 ? "" : "s"} need your next step.` : `${state.availableSpots.length} campus spot${state.availableSpots.length === 1 ? " is" : "s are"} ready to be cleaned.`}</p></div><Button className="report-button" size="lg" onClick={() => setTab("spots")}><Navigation /> Find a cleanup</Button></section>
          <section className="stats-grid" aria-label="Impact summary">
            <article className="stat-card green-card"><div><span className="stat-label">AVAILABLE BALANCE</span><strong>{state.balance}</strong><span className="unit">credits</span></div><div className="coin"><Sparkles /></div><button onClick={() => setTab("rewards")}>Redeem rewards <span>→</span></button></article>
            <article className="stat-card"><span className="stat-label">TOTAL COLLECTED</span><strong>{state.totalWeight.toFixed(1)} <span>kg</span></strong><p>Across {state.verifiedCount} verified cleanups</p></article>
            <article className="stat-card"><span className="stat-label">CAMPUS RANK</span><strong>#12</strong><p><span className="up">↑ 3 places</span> this month</p></article>
          </section>
          <section className="lower-grid"><article className="panel cleanups-panel"><div className="panel-head"><div><span className="kicker">YOUR CLEANUPS</span><h2>{state.reports.length ? "Keep the streak alive" : "Choose your first spot"}</h2></div>{state.reports.length > 0 && <button onClick={() => setTab("cleanups")}>View all</button>}</div>{state.reports.length ? state.reports.slice(0, 2).map((report) => <CleanupRow key={report.id} report={report} onAfter={setAfterReport} />) : <div className="empty-state"><span><MapPin /></span><div><strong>No assigned spots yet</strong><p>Choose a location listed by the admin and add your before photo there.</p></div><Button variant="outline" onClick={() => setTab("spots")}>View open spots</Button></div>}</article><ProcessPanel /></section>
        </TabsContent>

        <TabsContent value="spots" className="content page-content">
          <section className="page-title"><div><p className="eyebrow green">ADMIN-LISTED LOCATIONS</p><h1>Available cleanup spots</h1><p>Go to a listed location, then upload a before photo with your device location to claim it.</p></div><div className="spots-count"><MapPin /><span><small>AVAILABLE NOW</small><strong>{state.availableSpots.length} spot{state.availableSpots.length === 1 ? "" : "s"}</strong></span></div></section>
          {state.availableSpots.length ? <div className="spot-grid">{state.availableSpots.map((spot) => <article className="spot-card" key={spot.id}><header><span><MapPin /></span><b>SPOT #{String(spot.id).padStart(3, "0")}</b></header><div><small>{spot.wasteType}</small><h2>{spot.location}</h2><p>{spot.notes || "Go to this location and capture the trash before you begin cleaning."}</p></div><footer><span><Navigation /> Location required</span><Button onClick={() => setStartSpot(spot)}><Camera /> Upload before photo</Button></footer></article>)}</div> : <div className="empty-page"><span><MapPin /></span><h2>No open spots right now.</h2><p>The admin will publish new campus locations here when cleanup is needed.</p></div>}
        </TabsContent>

        <TabsContent value="cleanups" className="content page-content">
          <section className="page-title"><div><p className="eyebrow green">PROOF TO PROGRESS</p><h1>My cleanups</h1><p>Your claimed spots move from before proof to after proof and verification.</p></div><Button className="report-button" onClick={() => setTab("spots")}><MapPin /> Find another spot</Button></section>
          <div className="report-list">{state.reports.length ? state.reports.map((report) => <article className="report-card" key={report.id}><div className="report-thumb">{report.beforeKey ? <img src={`/api/images/${encodeURIComponent(report.beforeKey)}`} alt="Trash before cleanup" /> : <Camera />}</div><div className="report-main"><div className="report-title-row"><div><span className="status-step">SPOT #{String(report.id).padStart(3, "0")}</span><h2>{report.location}</h2></div><span className={`status ${statusCopy[report.status].className}`}>{statusCopy[report.status].label}</span></div><div className="report-meta"><span><Recycle /> {report.wasteType}</span><span><MapPin /> Before location saved</span>{report.weight ? <span><Scale /> {report.weight.toFixed(1)} kg</span> : null}</div><div className="journey"><span className="done"><i><Check /></i>Before proof</span><b /><span className={report.status !== "awaiting_after" ? "done" : ""}><i>{report.status !== "awaiting_after" ? <Check /> : "2"}</i>After proof</span><b /><span className={report.status === "verified" ? "done" : ""}><i>{report.status === "verified" ? <Check /> : "3"}</i>Verified</span></div><div className="report-actions">{report.status === "awaiting_after" && <Button onClick={() => setAfterReport(report)}><Camera /> Add after photo</Button>}{report.status === "awaiting_weighing" && <span className="centre-wait"><Scale /> Take the waste to a collection centre for verification</span>}{report.status === "verified" && <span className="earned"><CircleDollarSign /> +{report.credits} credits earned</span>}</div></div></article>) : <div className="empty-page"><span><Recycle /></span><h2>Your cleanup journey starts with a listed spot.</h2><p>Choose an admin-listed location and upload the before photo when you arrive.</p><Button onClick={() => setTab("spots")}><MapPin /> Browse available spots</Button></div>}</div>
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

      <Dialog open={!!startSpot} onOpenChange={(open) => !open && setStartSpot(null)}><DialogContent className="form-dialog"><DialogHeader><span className="dialog-icon"><Navigation /></span><DialogTitle>Start cleanup at {startSpot?.location}</DialogTitle><DialogDescription>Upload a clear photo of the trash before cleanup.</DialogDescription></DialogHeader><form onSubmit={(event) => { event.preventDefault(); void submitBeforePhoto(event.currentTarget); }}><Field label="Admin-listed location"><div className="readonly-field">{startSpot?.location}</div></Field>{startSpot?.notes && <div className="spot-instructions"><small>ADMIN INSTRUCTIONS</small><p>{startSpot.notes}</p></div>}<Field label="Before photo"><PhotoPicker stage="before" /></Field><div className="geotag-note"><Navigation /><span><strong>{photoLocationEnabled ? "Location is required" : "Location check temporarily off"}</strong><small>{photoLocationEnabled ? "Your coordinates are saved only with this cleanup proof." : "The admin-listed spot is used while ZeroTrash runs locally."}</small></span></div><DialogFooter><Button type="button" variant="outline" onClick={() => setStartSpot(null)}>Cancel</Button><Button type="submit" disabled={busy}>{busy ? "Uploading…" : "Claim spot & upload"}</Button></DialogFooter></form></DialogContent></Dialog>

      <Dialog open={!!afterReport} onOpenChange={(open) => !open && setAfterReport(null)}><DialogContent className="form-dialog"><DialogHeader><span className="dialog-icon"><Camera /></span><DialogTitle>Add your after photo</DialogTitle><DialogDescription>Show the cleaned area clearly before sending it to the admin queue.</DialogDescription></DialogHeader><form onSubmit={(event) => { event.preventDefault(); void submitAfterPhoto(event.currentTarget); }}><Field label="Cleanup location"><div className="readonly-field">{afterReport?.location}</div></Field><Field label="After photo"><PhotoPicker stage="after" /></Field><div className="geotag-note"><Navigation /><span><strong>{photoLocationEnabled ? "Location will be captured" : "Location check temporarily off"}</strong><small>{photoLocationEnabled ? "This confirms the after photo was taken at the cleanup spot." : "You can upload this proof without granting browser location access."}</small></span></div><DialogFooter><Button type="button" variant="outline" onClick={() => setAfterReport(null)}>Cancel</Button><Button type="submit" disabled={busy}>{busy ? "Uploading…" : "Send for verification"}</Button></DialogFooter></form></DialogContent></Dialog>

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
  return <div className="cleanup-row"><div className={`cleanup-icon ${report.status === "verified" ? "done" : ""}`}>{report.status === "verified" ? <Recycle /> : <MapPin />}</div><div><strong>{report.location}</strong><span>{report.weight ? `${report.weight.toFixed(1)} kg · ` : ""}{new Intl.DateTimeFormat("en-IN", { month: "short", day: "numeric", timeZone: "UTC" }).format(new Date(report.createdAt))}</span></div><span className={`status ${status.className}`}>{status.label}</span>{report.status === "awaiting_after" ? <button className="small-action" onClick={() => onAfter(report)}>Add after photo</button> : report.status === "awaiting_weighing" ? <span className="centre-wait compact"><Scale /> Centre check</span> : <strong className="credit-gain">+{report.credits}</strong>}</div>;
}

function ProcessPanel() { return <article className="panel process-panel"><span className="kicker">HOW IT WORKS</span><h2>Listed spot to reward</h2><ol className="steps"><li><span>01</span><div><strong>Choose a spot</strong><p>Pick a location listed by the admin.</p></div></li><li><span>02</span><div><strong>Upload before</strong><p>Claim it with a clear before photo.</p></div></li><li><span>03</span><div><strong>Clean and prove</strong><p>Add a clear after photo.</p></div></li><li><span>04</span><div><strong>Get verified</strong><p>Centre weight unlocks your credits.</p></div></li></ol></article>; }

function formatDashboardDate(value: string) {
  return new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric" }).format(new Date(value.endsWith("Z") ? value : `${value.replace(" ", "T")}Z`));
}

declare global {
  interface Document { modelContext?: { registerTool: (tool: { name: string; title?: string; description: string; inputSchema: object; annotations?: { readOnlyHint?: boolean; untrustedContentHint?: boolean }; execute: (input: unknown) => unknown | Promise<unknown> }, options?: { signal?: AbortSignal }) => void | Promise<void> } }
}
