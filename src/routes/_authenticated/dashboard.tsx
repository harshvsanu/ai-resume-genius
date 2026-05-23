import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { extractResumeData, analyzeResume, deleteResume } from "@/lib/resume.functions";
import { extractTextFromFile } from "@/lib/extract-text";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, CartesianGrid, LineChart, Line, PieChart, Pie, Cell, RadialBarChart, RadialBar, PolarAngleAxis } from "recharts";
import {
  Upload, FileText, Loader2, Target, CheckCircle2, XCircle, Lightbulb, Award, Sparkles, TrendingUp, Trash2, FileSearch,
} from "lucide-react";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: Dashboard,
});

type Resume = {
  id: string; file_name: string; status: string; created_at: string;
  candidate_name: string | null; summary: string | null;
  skills: string[]; education: any[]; experience: any[];
};

type Analysis = {
  id: string; resume_id: string; job_title: string | null; ats_score: number;
  matched_skills: string[]; missing_skills: string[]; strengths: string[];
  weaknesses: string[]; suggestions: string[]; verdict: string | null;
  created_at: string;
};

function Dashboard() {
  const qc = useQueryClient();
  const extractFn = useServerFn(extractResumeData);
  const analyzeFn = useServerFn(analyzeResume);
  const [userId, setUserId] = useState<string | null>(null);
  const [selectedResume, setSelectedResume] = useState<string | null>(null);
  const [jobTitle, setJobTitle] = useState("");
  const [jobDescription, setJobDescription] = useState("");
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserId(data.user?.id ?? null));
  }, []);

  const resumesQ = useQuery({
    queryKey: ["resumes", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("resumes").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as Resume[];
    },
  });

  const analysesQ = useQuery({
    queryKey: ["analyses", userId],
    enabled: !!userId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("analyses").select("*").order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as Analysis[];
    },
  });

  const handleUpload = useCallback(async (file: File) => {
    if (!userId) return;
    setUploading(true);
    try {
      if (file.size > 10 * 1024 * 1024) throw new Error("File too large (max 10 MB).");
      toast.info("Extracting text…");
      const rawText = await extractTextFromFile(file);
      if (rawText.length < 50) throw new Error("Could not extract enough text from this file.");

      const path = `${userId}/${crypto.randomUUID()}-${file.name}`;
      toast.info("Uploading…");
      const { error: upErr } = await supabase.storage.from("resumes").upload(path, file, {
        contentType: file.type || "application/octet-stream",
      });
      if (upErr) throw upErr;

      const { data: inserted, error: insErr } = await supabase.from("resumes").insert({
        user_id: userId,
        file_name: file.name,
        file_path: path,
        mime_type: file.type || "application/octet-stream",
        status: "parsing",
      }).select("id").single();
      if (insErr) throw insErr;

      toast.info("AI is parsing your resume…");
      await extractFn({ data: { resumeId: inserted.id, rawText } });
      toast.success("Resume parsed! Click it in the list to view details.");
      qc.invalidateQueries({ queryKey: ["resumes"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }, [userId, extractFn, qc]);

  const deleteFn = useServerFn(deleteResume);
  const deleteMut = useMutation({
    mutationFn: (id: string) => deleteFn({ data: { resumeId: id } }),
    onSuccess: (_d, id) => {
      toast.success("Resume deleted");
      if (selectedResume === id) setSelectedResume(null);
      qc.invalidateQueries({ queryKey: ["resumes"] });
      qc.invalidateQueries({ queryKey: ["analyses"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Delete failed"),
  });

  const analyzeMut = useMutation({
    mutationFn: async () => {
      if (!selectedResume) throw new Error("Select a resume first");
      if (jobDescription.trim().length < 20) throw new Error("Paste a longer job description");
      return await analyzeFn({
        data: { resumeId: selectedResume, jobTitle: jobTitle || undefined, jobDescription },
      });
    },
    onSuccess: () => {
      toast.success("Analysis complete!");
      qc.invalidateQueries({ queryKey: ["analyses"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Analysis failed"),
  });

  const resumes = resumesQ.data ?? [];
  const analyses = analysesQ.data ?? [];
  const currentResume = resumes.find((r) => r.id === selectedResume);
  const relevantAnalyses = selectedResume
    ? analyses.filter((a) => a.resume_id === selectedResume)
    : analyses;

  return (
    <div className="mx-auto max-w-7xl px-6 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Welcome To AGMRCET Placement Cell</h1>
        <p className="text-muted-foreground">Powered By Realtime Ai Analysis</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-1">
          <UploadCard onUpload={handleUpload} uploading={uploading} />
          <ResumesList
            resumes={resumes} loading={resumesQ.isLoading}
            selected={selectedResume} onSelect={setSelectedResume}
            onDelete={(id) => deleteMut.mutate(id)}
            deletingId={deleteMut.isPending ? deleteMut.variables ?? null : null}
          />
        </div>

        <div className="space-y-6 lg:col-span-2">
          {currentResume ? (
            <ResumeDetails resume={currentResume} onClose={() => setSelectedResume(null)} />
          ) : (
            <Card className="p-10 text-center">
              <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-full bg-accent text-accent-foreground">
                <FileSearch className="h-5 w-5" />
              </div>
              <h3 className="font-semibold">No resume selected</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Click a resume in the list to view its parsed details, or upload a new one.
              </p>
            </Card>
          )}

          <Card className="p-6">
            <div className="flex items-center gap-2 mb-4">
              <Target className="h-5 w-5 text-primary" />
              <h2 className="text-lg font-semibold">Match against a job description</h2>
            </div>
            <div className="space-y-3">
              <div>
                <Label htmlFor="jt">Job title (optional)</Label>
                <Input id="jt" value={jobTitle} onChange={(e) => setJobTitle(e.target.value)}
                  placeholder="Senior Frontend Engineer" maxLength={200} />
              </div>
              <div>
                <Label htmlFor="jd">Job description</Label>
                <Textarea id="jd" value={jobDescription} onChange={(e) => setJobDescription(e.target.value)}
                  rows={8} maxLength={20000} placeholder="Paste the full job description here…" />
              </div>
              <Button
                onClick={() => analyzeMut.mutate()}
                disabled={!selectedResume || analyzeMut.isPending}
                className="w-full h-11"
              >
                {analyzeMut.isPending
                  ? <><Loader2 className="mr-2 h-4 w-4 animate-spin" /> Analyzing…</>
                  : <><Sparkles className="mr-2 h-4 w-4" /> Run AI analysis</>}
              </Button>
              {!selectedResume && <p className="text-xs text-muted-foreground">Select a resume above to enable analysis.</p>}
            </div>
          </Card>

          <AnalyticsPanel analyses={analyses} />
          <AnalysesList analyses={relevantAnalyses} loading={analysesQ.isLoading} />
        </div>
      </div>
    </div>
  );
}

function UploadCard({ onUpload, uploading }: { onUpload: (f: File) => void; uploading: boolean }) {
  const [dragging, setDragging] = useState(false);
  return (
    <Card
      className={`p-6 border-2 border-dashed transition ${dragging ? "border-primary bg-accent/40" : "border-border"}`}
      onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault(); setDragging(false);
        const f = e.dataTransfer.files?.[0]; if (f) onUpload(f);
      }}
    >
      <div className="flex flex-col items-center text-center">
        <div className="mb-3 grid h-12 w-12 place-items-center rounded-full bg-accent text-accent-foreground">
          {uploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Upload className="h-5 w-5" />}
        </div>
        <h3 className="font-semibold">Upload a resume</h3>
        <p className="text-xs text-muted-foreground mt-1">PDF, DOCX, or TXT · up to 10 MB</p>
        <label className="mt-4">
          <input
            type="file" accept=".pdf,.docx,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,text/plain"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) onUpload(f); e.target.value = ""; }}
            disabled={uploading}
          />
          <span className="inline-flex items-center justify-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 cursor-pointer">
            {uploading ? "Working…" : "Choose file"}
          </span>
        </label>
      </div>
    </Card>
  );
}


function ResumesList({ resumes, loading, selected, onSelect, onDelete, deletingId }: {
  resumes: Resume[]; loading: boolean; selected: string | null;
  onSelect: (id: string) => void; onDelete: (id: string) => void; deletingId: string | null;
}) {
  return (
    <Card className="p-4">
      <h3 className="text-sm font-semibold mb-3 px-2">Your resumes</h3>
      {loading && <div className="p-4 text-sm text-muted-foreground">Loading…</div>}
      {!loading && resumes.length === 0 && <div className="p-4 text-sm text-muted-foreground">No resumes yet.</div>}
      <ul className="space-y-1">
        {resumes.map((r) => (
          <li key={r.id} className={`group flex items-stretch rounded-md transition ${selected === r.id ? "bg-accent text-accent-foreground" : "hover:bg-muted"}`}>
            <button
              onClick={() => onSelect(r.id)}
              className="flex-1 text-left px-3 py-2 text-sm flex items-start gap-2 min-w-0"
            >
              <FileText className="h-4 w-4 mt-0.5 shrink-0" />
              <div className="min-w-0">
                <div className="truncate font-medium">{r.file_name}</div>
                <div className="text-xs text-muted-foreground">{new Date(r.created_at).toLocaleDateString()} · {r.status}</div>
              </div>
            </button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <button
                  className="px-2 text-muted-foreground hover:text-destructive opacity-60 group-hover:opacity-100 transition"
                  aria-label="Delete resume"
                  disabled={deletingId === r.id}
                  onClick={(e) => e.stopPropagation()}
                >
                  {deletingId === r.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                </button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete this resume?</AlertDialogTitle>
                  <AlertDialogDescription>
                    “{r.file_name}” and all its analyses will be permanently removed.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={() => onDelete(r.id)} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                    Delete
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </li>
        ))}
      </ul>
    </Card>
  );
}

function ResumeDetails({ resume, onClose }: { resume: Resume; onClose: () => void }) {
  return (
    <Card className="p-6">
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          <Award className="h-5 w-5 text-primary" />
          <h2 className="text-lg font-semibold">Parsed resume</h2>
        </div>
        <Button variant="ghost" size="sm" onClick={onClose}>Close</Button>
      </div>
      <div className="text-xs text-muted-foreground mb-2">{resume.file_name}</div>
      {resume.candidate_name && <p className="text-sm"><span className="text-muted-foreground">Name:</span> {resume.candidate_name}</p>}
      {resume.summary && <p className="text-sm mt-2 text-muted-foreground">{resume.summary}</p>}
      {resume.skills?.length > 0 && (
        <div className="mt-4">
          <div className="text-xs font-medium text-muted-foreground mb-2">Skills</div>
          <div className="flex flex-wrap gap-1.5">
            {resume.skills.slice(0, 30).map((s, i) => <Badge key={i} variant="secondary">{s}</Badge>)}
          </div>
        </div>
      )}
      <div className="grid sm:grid-cols-2 gap-4 mt-4 text-sm">
        {resume.experience?.length > 0 && (
          <div>
            <div className="text-xs font-medium text-muted-foreground mb-2">Experience</div>
            <ul className="space-y-1.5">
              {resume.experience.slice(0, 4).map((e: any, i: number) => (
                <li key={i}><span className="font-medium">{e.title}</span> {e.company && <span className="text-muted-foreground">@ {e.company}</span>}</li>
              ))}
            </ul>
          </div>
        )}
        {resume.education?.length > 0 && (
          <div>
            <div className="text-xs font-medium text-muted-foreground mb-2">Education</div>
            <ul className="space-y-1.5">
              {resume.education.slice(0, 4).map((e: any, i: number) => (
                <li key={i}><span className="font-medium">{e.degree}</span> {e.institution && <span className="text-muted-foreground">— {e.institution}</span>}</li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </Card>
  );
}

function AnalysesList({ analyses, loading }: { analyses: Analysis[]; loading: boolean }) {
  if (loading) return null;
  if (analyses.length === 0) return null;
  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Analyses</h2>
      {analyses.map((a) => <AnalysisCard key={a.id} a={a} />)}
    </div>
  );
}

function AnalysisCard({ a }: { a: Analysis }) {
  const tone = a.ats_score >= 75 ? "text-[var(--color-success)]" : a.ats_score >= 50 ? "text-[var(--color-warning)]" : "text-destructive";
  const matched = a.matched_skills?.length ?? 0;
  const missing = a.missing_skills?.length ?? 0;
  const total = matched + missing;
  const pieData = total > 0
    ? [{ name: "Matched", value: matched }, { name: "Missing", value: missing }]
    : [{ name: "No data", value: 1 }];
  const PIE_COLORS = total > 0
    ? ["var(--color-success)", "var(--destructive)"]
    : ["var(--muted)"];
  const scoreData = [{ name: "ATS", value: a.ats_score, fill: a.ats_score >= 75 ? "var(--color-success)" : a.ats_score >= 50 ? "var(--color-warning)" : "var(--destructive)" }];

  return (
    <Card className="p-6">
      <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
        <div>
          <div className="text-xs text-muted-foreground">{new Date(a.created_at).toLocaleString()}</div>
          <h3 className="font-semibold">{a.job_title || "Untitled role"}</h3>
        </div>
        <div className="text-right">
          <div className={`font-display text-4xl font-bold ${tone}`}>{a.ats_score}</div>
          <div className="text-xs text-muted-foreground">ATS score</div>
        </div>
      </div>
      <Progress value={a.ats_score} className="mb-4" />
      {a.verdict && <p className="text-sm mb-4">{a.verdict}</p>}

      <div className="grid sm:grid-cols-2 gap-4 mb-4">
        <div className="rounded-lg border p-3">
          <div className="text-xs font-medium text-muted-foreground mb-1 text-center">Skill match</div>
          <ResponsiveContainer width="100%" height={160}>
            <PieChart>
              <Pie data={pieData} dataKey="value" cx="50%" cy="50%" innerRadius={40} outerRadius={65} paddingAngle={2}>
                {pieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
              </Pie>
              <Tooltip contentStyle={{ background: "var(--background)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }} />
            </PieChart>
          </ResponsiveContainer>
          <div className="flex justify-center gap-4 text-xs">
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full" style={{ background: "var(--color-success)" }} /> {matched} matched</span>
            <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-destructive" /> {missing} missing</span>
          </div>
        </div>
        <div className="rounded-lg border p-3">
          <div className="text-xs font-medium text-muted-foreground mb-1 text-center">ATS gauge</div>
          <ResponsiveContainer width="100%" height={160}>
            <RadialBarChart data={scoreData} startAngle={210} endAngle={-30} innerRadius={55} outerRadius={75}>
              <PolarAngleAxis type="number" domain={[0, 100]} tick={false} />
              <RadialBar background={{ fill: "var(--muted)" }} dataKey="value" cornerRadius={8} />
            </RadialBarChart>
          </ResponsiveContainer>
          <div className="text-center text-xs text-muted-foreground -mt-2">{a.ats_score} / 100</div>
        </div>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        <Section title="Matched skills" icon={<CheckCircle2 className="h-4 w-4 text-[var(--color-success)]" />} items={a.matched_skills} variant="success" />
        <Section title="Missing skills" icon={<XCircle className="h-4 w-4 text-destructive" />} items={a.missing_skills} variant="destructive" />
      </div>

      {a.strengths?.length > 0 && <List title="Strengths" items={a.strengths} className="mt-4" />}
      {a.weaknesses?.length > 0 && <List title="Weaknesses" items={a.weaknesses} className="mt-4" />}
      {a.suggestions?.length > 0 && (
        <div className="mt-4">
          <div className="flex items-center gap-1.5 text-sm font-medium mb-2">
            <Lightbulb className="h-4 w-4 text-[var(--color-warning)]" /> Suggestions
          </div>
          <ul className="space-y-1.5 text-sm">
            {a.suggestions.map((s, i) => <li key={i} className="flex gap-2"><span className="text-primary">→</span><span>{s}</span></li>)}
          </ul>
        </div>
      )}
    </Card>
  );
}

function AnalyticsPanel({ analyses }: { analyses: Analysis[] }) {
  if (!analyses || analyses.length === 0) return null;

  const trend = [...analyses]
    .sort((a, b) => +new Date(a.created_at) - +new Date(b.created_at))
    .slice(-12)
    .map((a) => ({
      date: new Date(a.created_at).toLocaleDateString(undefined, { month: "short", day: "numeric" }),
      score: a.ats_score,
    }));

  const skillCounts = new Map<string, number>();
  for (const a of analyses) {
    for (const s of a.matched_skills ?? []) {
      const k = s.trim().toLowerCase();
      if (k) skillCounts.set(k, (skillCounts.get(k) ?? 0) + 1);
    }
  }
  const topSkills = [...skillCounts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([name, count]) => ({ name, count }));

  const avg = Math.round(analyses.reduce((s, a) => s + a.ats_score, 0) / analyses.length);
  const best = Math.max(...analyses.map((a) => a.ats_score));

  return (
    <Card className="p-6">
      <div className="flex items-center gap-2 mb-4">
        <TrendingUp className="h-5 w-5 text-primary" />
        <h2 className="font-semibold">Analytics</h2>
      </div>
      <div className="grid grid-cols-3 gap-3 mb-6">
        <Stat label="Analyses" value={analyses.length} />
        <Stat label="Avg ATS" value={avg} />
        <Stat label="Best ATS" value={best} />
      </div>
      <div className="grid lg:grid-cols-2 gap-6">
        <div>
          <div className="text-xs font-medium text-muted-foreground mb-2">ATS score trend</div>
          <ResponsiveContainer width="100%" height={180}>
            <LineChart data={trend}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" opacity={0.4} />
              <XAxis dataKey="date" stroke="var(--muted-foreground)" fontSize={11} />
              <YAxis domain={[0, 100]} stroke="var(--muted-foreground)" fontSize={11} />
              <Tooltip contentStyle={{ background: "var(--background)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }} />
              <Line type="monotone" dataKey="score" stroke="var(--primary)" strokeWidth={2} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </div>
        <div>
          <div className="text-xs font-medium text-muted-foreground mb-2">Top matched skills</div>
          {topSkills.length === 0 ? (
            <p className="text-sm text-muted-foreground">No matched skills yet.</p>
          ) : (
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={topSkills} layout="vertical" margin={{ left: 8 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" opacity={0.4} />
                <XAxis type="number" stroke="var(--muted-foreground)" fontSize={11} />
                <YAxis type="category" dataKey="name" width={80} stroke="var(--muted-foreground)" fontSize={11} />
                <Tooltip contentStyle={{ background: "var(--background)", border: "1px solid var(--border)", borderRadius: 8, fontSize: 12 }} />
                <Bar dataKey="count" fill="var(--primary)" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </Card>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-lg border bg-card p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="font-display text-2xl font-bold">{value}</div>
    </div>
  );
}

function Section({ title, icon, items, variant }: { title: string; icon: React.ReactNode; items: string[]; variant: "success" | "destructive" }) {
  return (
    <div>
      <div className="flex items-center gap-1.5 text-sm font-medium mb-2">{icon} {title}</div>
      <div className="flex flex-wrap gap-1.5">
        {items?.length > 0 ? items.map((s, i) => (
          <Badge key={i} variant={variant === "success" ? "secondary" : "destructive"}>{s}</Badge>
        )) : <span className="text-xs text-muted-foreground">None</span>}
      </div>
    </div>
  );
}

function List({ title, items, className }: { title: string; items: string[]; className?: string }) {
  return (
    <div className={className}>
      <div className="text-sm font-medium mb-2">{title}</div>
      <ul className="space-y-1 text-sm text-muted-foreground">
        {items.map((s, i) => <li key={i}>• {s}</li>)}
      </ul>
    </div>
  );
}
