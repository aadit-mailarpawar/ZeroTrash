"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Camera, CheckCircle2, CircleDollarSign, Clock3, FileCheck2, ImageIcon,
  LogOut, MapPin, Plus, Recycle, Scale, ShieldCheck, UserRound,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Toaster } from "@/components/ui/sonner";

type AdminUser = { name: string; email: string; role: "admin" };
type AdminReport = {
  id: number; volunteer: string; volunteerEmail: string; location: string; wasteType: string;
  notes: string; beforeKey: string | null; afterKey: string | null; center: string | null;
  beforeLat: number | null; beforeLng: number | null; afterLat: number | null; afterLng: number | null;
  weight: number | null; credits: number; status: "open" | "awaiting_after" | "awaiting_weighing" | "verified";
  verifiedBy: string | null; verifiedAt: string | null; createdAt: string;
};
type AdminSummary = { totalEntries: number; pendingVerification: number; openSpots: number; awaitingCleanup: number; verifiedCount: number; totalWeight: number; creditsIssued: number };
type AdminState = { reports: AdminReport[]; summary: AdminSummary };

const emptyState: AdminState = { reports: [], summary: { totalEntries: 0, pendingVerification: 0, openSpots: 0, awaitingCleanup: 0, verifiedCount: 0, totalWeight: 0, creditsIssued: 0 } };
const statusCopy = {
  open: { label: "Open for volunteers", className: "open" },
  awaiting_after: { label: "Cleanup in progress", className: "waiting" },
  awaiting_weighing: { label: "Ready to verify", className: "weighing" },
  verified: { label: "Verified", className: "verified" },
};

export default function AdminPage() {
  const [user, setUser] = useState<AdminUser | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [data, setData] = useState<AdminState>(emptyState);
  const [filter, setFilter] = useState("all");
  const [selected, setSelected] = useState<AdminReport | null>(null);
  const [spotOpen, setSpotOpen] = useState(false);
  const [centre, setCentre] = useState("Main Gate Green Point");
  const [weight, setWeight] = useState("");
  const [busy, setBusy] = useState(false);
  const [loadError, setLoadError] = useState("");

  const loadEntries = useCallback(async () => {
    try {
      const response = await fetch("/api/admin/state", { cache: "no-store" });
      const result = await response.json() as AdminState & { error?: string };
      if (response.status === 401 || response.status === 403) { window.location.replace("/admin/signin"); return; }
      if (!response.ok) throw new Error(result.error || "Could not load entries");
      setData(result);
      setLoadError("");
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Could not load entries");
    }
  }, []);

  useEffect(() => {
    let active = true;
    const start = async () => {
      try {
        const response = await fetch("/api/auth/me?role=admin", { cache: "no-store" });
        if (!response.ok) { window.location.replace("/admin/signin"); return; }
        const result = await response.json() as { user: AdminUser | { role: "volunteer" } };
        if (result.user.role !== "admin") { window.location.replace("/admin/signin"); return; }
        if (active) setUser(result.user as AdminUser);
      } catch { window.location.replace("/admin/signin"); }
      finally { if (active) setAuthReady(true); }
    };
    void start();
    return () => { active = false; };
  }, []);

  useEffect(() => { if (user) void loadEntries(); }, [loadEntries, user]);

  const openVerification = (report: AdminReport) => {
    setSelected(report);
    setWeight("");
    setCentre("Main Gate Green Point");
  };

  const verify = async () => {
    if (!selected) return;
    const kilograms = Number(weight);
    if (!Number.isFinite(kilograms) || kilograms <= 0 || kilograms > 100) { toast.error("Enter a weight between 0.1 and 100 kg"); return; }
    setBusy(true);
    try {
      const response = await fetch(`/api/admin/reports/${selected.id}/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ weight: kilograms, center: centre }),
      });
      const result = await response.json() as { error?: string; credits?: number };
      if (!response.ok) throw new Error(result.error || "Could not verify this cleanup");
      await loadEntries();
      setSelected(null);
      setWeight("");
      toast.success(`Verified. ${result.credits} credits were awarded to ${selected.volunteer}.`);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not verify this cleanup");
    } finally {
      setBusy(false);
    }
  };

  const createSpot = async (form: HTMLFormElement) => {
    const formData = new FormData(form);
    setBusy(true);
    try {
      const response = await fetch("/api/admin/spots", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ location: formData.get("location"), wasteType: formData.get("wasteType"), notes: formData.get("notes") }),
      });
      const result = await response.json() as { error?: string };
      if (!response.ok) throw new Error(result.error || "Could not list the cleanup spot");
      await loadEntries();
      setSpotOpen(false);
      form.reset();
      toast.success("Cleanup spot is now visible to volunteers.");
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not list the cleanup spot");
    } finally {
      setBusy(false);
    }
  };

  const logOut = async () => {
    await fetch("/api/auth/signout?role=admin", { method: "POST" });
    window.location.assign("/admin/signin");
  };

  const visibleReports = useMemo(() => data.reports.filter((report) => {
    if (filter === "open") return report.status === "open";
    if (filter === "ready") return report.status === "awaiting_weighing";
    if (filter === "verified") return report.status === "verified";
    return true;
  }), [data.reports, filter]);
  const creditsPreview = Number(weight) > 0 ? Math.round(Number(weight) * 30) : 0;

  if (!authReady || !user) return <AdminLoading />;

  const initials = user.name.split(/\s+/).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "AD";

  return <main className="admin-console">
    <aside className="admin-sidebar"><div className="brand admin-console-brand"><span className="brand-mark"><Recycle /></span><span>zero<span>trash</span></span><b>ADMIN</b></div><div className="admin-side-copy"><ShieldCheck /><strong>Collection control</strong><p>Only verified weight releases volunteer credits.</p></div><div className="admin-rule"><span>REWARD RULE</span><strong>1 kg = 30 credits</strong><small>Credits are calculated automatically</small></div></aside>
    <section className="admin-workspace">
      <header className="admin-topbar"><div><span className="admin-live-dot" /> Local verification desk</div><div className="top-actions"><div className="avatar">{initials}</div><div className="profile"><strong>{user.name}</strong><span>{user.email}</span></div><button className="icon-button logout-button" aria-label="Log out" onClick={() => void logOut()}><LogOut /></button></div></header>
      <div className="admin-content">
        <section className="admin-welcome"><div><span className="eyebrow green">ADMIN CONSOLE</span><h1>Campus cleanup spots</h1><p>Publish locations for volunteers, review their geotagged proof, and verify completed cleanups.</p></div><div className="admin-welcome-actions"><Button className="admin-list-spot" onClick={() => setSpotOpen(true)}><Plus /> List cleanup spot</Button><div className="admin-queue-callout"><Clock3 /><span><small>NEEDS ATTENTION</small><strong>{data.summary.pendingVerification} weigh-in{data.summary.pendingVerification === 1 ? "" : "s"}</strong></span></div></div></section>

        <section className="admin-stats" aria-label="Verification summary">
          <article className="admin-stat primary"><span><Clock3 /></span><div><small>READY TO VERIFY</small><strong>{data.summary.pendingVerification}</strong></div></article>
          <article className="admin-stat"><span><MapPin /></span><div><small>OPEN SPOTS</small><strong>{data.summary.openSpots}</strong></div></article>
          <article className="admin-stat"><span><Scale /></span><div><small>TOTAL VERIFIED</small><strong>{data.summary.totalWeight.toFixed(1)} <b>kg</b></strong></div></article>
          <article className="admin-stat"><span><CircleDollarSign /></span><div><small>CREDITS ISSUED</small><strong>{data.summary.creditsIssued}</strong></div></article>
        </section>

        <Tabs value={filter} onValueChange={setFilter} className="admin-records">
          <div className="admin-records-head"><div><span className="kicker">CLEANUP LOCATIONS</span><h2>Spot activity</h2></div><TabsList className="admin-filter-tabs"><TabsTrigger value="all">All <b>{data.summary.totalEntries}</b></TabsTrigger><TabsTrigger value="open">Open <b>{data.summary.openSpots}</b></TabsTrigger><TabsTrigger value="ready">Ready <b>{data.summary.pendingVerification}</b></TabsTrigger><TabsTrigger value="verified">Verified <b>{data.summary.verifiedCount}</b></TabsTrigger></TabsList></div>
          {loadError ? <div className="admin-error"><p>{loadError}</p><Button variant="outline" onClick={() => void loadEntries()}>Try again</Button></div> : ["all", "open", "ready", "verified"].map((value) => <TabsContent key={value} value={value} className="admin-entry-list"><EntryList reports={visibleReports} onVerify={openVerification} /></TabsContent>)}
        </Tabs>
      </div>
    </section>

    <Dialog open={spotOpen} onOpenChange={setSpotOpen}><DialogContent className="admin-verify-dialog"><DialogHeader><span className="dialog-icon"><MapPin /></span><DialogTitle>List a cleanup spot</DialogTitle><DialogDescription>Add a clear campus location and instructions. Volunteers will see it in their available spots list.</DialogDescription></DialogHeader><form className="admin-spot-form" onSubmit={(event) => { event.preventDefault(); void createSpot(event.currentTarget); }}><div className="field"><span>Campus location</span><input name="location" required minLength={3} maxLength={120} placeholder="e.g. Behind the science block" autoFocus /></div><div className="field"><span>Waste type</span><Select name="wasteType" defaultValue="Mixed waste"><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="Mixed waste">Mixed waste</SelectItem><SelectItem value="Plastic">Plastic</SelectItem><SelectItem value="Paper">Paper</SelectItem><SelectItem value="Glass & metal">Glass & metal</SelectItem><SelectItem value="E-waste">E-waste</SelectItem></SelectContent></Select></div><div className="field"><span>Instructions or landmark</span><textarea name="notes" rows={3} maxLength={500} placeholder="Describe the exact spot or anything volunteers should know" /></div><DialogFooter><Button type="button" variant="outline" onClick={() => setSpotOpen(false)}>Cancel</Button><Button type="submit" disabled={busy}>{busy ? "Publishing…" : "Publish spot"}</Button></DialogFooter></form></DialogContent></Dialog>

    <Dialog open={!!selected} onOpenChange={(open) => !open && setSelected(null)}><DialogContent className="admin-verify-dialog"><DialogHeader><span className="dialog-icon"><Scale /></span><DialogTitle>Verify spot #{selected?.id}</DialogTitle><DialogDescription>Enter the measured weight from the collection-centre scale. Credits cannot be edited manually.</DialogDescription></DialogHeader><div className="verify-volunteer"><UserRound /><span><small>CREDIT RECIPIENT</small><strong>{selected?.volunteer}</strong><b>{selected?.volunteerEmail}</b></span></div><div className="field"><span>Collection centre</span><Select value={centre} onValueChange={setCentre}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="Main Gate Green Point">Main Gate Green Point</SelectItem><SelectItem value="Hostel Block Collection Bay">Hostel Block Collection Bay</SelectItem><SelectItem value="Sports Complex Drop-off">Sports Complex Drop-off</SelectItem></SelectContent></Select></div><div className="field"><span>Verified weight (kg)</span><input type="number" min="0.1" max="100" step="0.1" inputMode="decimal" value={weight} onChange={(event) => setWeight(event.target.value)} placeholder="0.0" autoFocus /></div><div className="admin-credit-math"><span><b>{Number(weight) > 0 ? Number(weight).toFixed(1) : "0.0"} kg</b><small>verified waste</small></span><strong>× 30</strong><span className="result"><b>{creditsPreview}</b><small>credits awarded</small></span></div><DialogFooter><Button variant="outline" onClick={() => setSelected(null)}>Cancel</Button><Button onClick={() => void verify()} disabled={busy || creditsPreview <= 0}>{busy ? "Verifying…" : `Verify & award ${creditsPreview} credits`}</Button></DialogFooter></DialogContent></Dialog>
    <Toaster position="top-right" richColors />
  </main>;
}

function EntryList({ reports, onVerify }: { reports: AdminReport[]; onVerify: (report: AdminReport) => void }) {
  if (!reports.length) return <div className="admin-empty"><span><FileCheck2 /></span><h3>No spots in this view</h3><p>List a campus cleanup spot to get the volunteer flow moving.</p></div>;
  return <>{reports.map((report) => <AdminEntry key={report.id} report={report} onVerify={onVerify} />)}</>;
}

function AdminEntry({ report, onVerify }: { report: AdminReport; onVerify: (report: AdminReport) => void }) {
  const status = statusCopy[report.status];
  return <article className={`admin-entry ${report.status}`}>
    <header><div><span className="status-step">SPOT #{String(report.id).padStart(3, "0")}</span><h3>{report.location}</h3></div><span className={`status ${status.className}`}>{status.label}</span></header>
    {(report.beforeLat != null || report.afterLat != null) && <div className="proof-geotags">{report.beforeLat != null && <span><MapPin /> Before: {report.beforeLat.toFixed(5)}, {report.beforeLng?.toFixed(5)}</span>}{report.afterLat != null && <span><MapPin /> After: {report.afterLat.toFixed(5)}, {report.afterLng?.toFixed(5)}</span>}</div>}
    <div className="admin-entry-grid"><div className="proof-pair"><Proof label="BEFORE · GEOTAGGED" imageKey={report.beforeKey} alt={`Trash at ${report.location} before cleanup`} /><Proof label="AFTER · GEOTAGGED" imageKey={report.afterKey} alt={`Cleaned area at ${report.location}`} /></div><div className="admin-entry-details"><div className={`volunteer-chip${report.status === "open" ? " unclaimed" : ""}`}><UserRound /><span><small>VOLUNTEER</small><strong>{report.status === "open" ? "Waiting for a volunteer" : report.volunteer}</strong><b>{report.volunteerEmail || "Nobody has claimed this spot yet"}</b></span></div><dl><div><dt><MapPin /> Location</dt><dd>{report.location}</dd></div><div><dt><Recycle /> Waste type</dt><dd>{report.wasteType}</dd></div><div><dt><Clock3 /> Listed</dt><dd>{formatDate(report.createdAt)}</dd></div></dl>{report.notes && <div className="admin-notes"><small>CLEANUP INSTRUCTIONS</small><p>{report.notes}</p></div>}{report.status === "awaiting_weighing" && report.volunteerEmail ? <Button className="admin-verify-button" onClick={() => onVerify(report)}><Scale /> Enter verified weight</Button> : report.status === "verified" ? <div className="verified-result"><CheckCircle2 /><span><small>{report.center}</small><strong>{report.weight?.toFixed(1)} kg · {report.credits} credits</strong>{report.verifiedAt && <b>Verified {formatDate(report.verifiedAt)}</b>}</span></div> : report.status === "open" ? <div className="admin-open-note"><MapPin /> Visible in the volunteer cleanup list.</div> : <div className="admin-waiting-note"><Camera /> Volunteer claimed this spot and still needs to upload the after photo.</div>}</div></div>
  </article>;
}

function Proof({ label, imageKey, alt }: { label: string; imageKey: string | null; alt: string }) {
  return <figure className={`proof-photo${imageKey ? "" : " missing"}`}><figcaption>{label}</figcaption>{imageKey ? <img src={`/api/images/${encodeURIComponent(imageKey)}`} alt={alt} /> : <div><ImageIcon /><span>Not uploaded yet</span></div>}</figure>;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" }).format(new Date(value.endsWith("Z") ? value : `${value.replace(" ", "T")}Z`));
}

function AdminLoading() { return <main className="dashboard-loading"><div className="brand"><span className="brand-mark"><ShieldCheck /></span><span>zero<span>trash</span> admin</span></div><div className="loading-ring" aria-label="Opening the admin console" /></main>; }
