import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { extractResumeData, analyzeResume } from "@/lib/resume.functions";
import { extractTextFromFile } from "@/lib/extract-text";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import {
  Upload, FileText, Loader2, Target, CheckCircle2, XCircle, Lightbulb, Award, Sparkles,
} from "lucide-react";

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
      toast.success("Resume parsed!");
      setSelectedResume(inserted.id);
      qc.invalidateQueries({ queryKey: ["resumes"] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  }, [userId, extractFn, qc]);

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
        <h1 className="text-3xl font-bold">Your dashboard</h1>
        <p className="text-muted-foreground">Upload resumes, match them to jobs, get AI feedback.</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-1">
          <UploadCard onUpload={handleUpload} uploading={uploading} />
          <ResumesList
            resumes={resumes} loading={resumesQ.isLoading}
            selected={selectedResume} onSelect={setSelectedResume}
          />
        </div>

        <div className="space-y-6 lg:col-span-2">
          {currentResume && <ResumeDetails resume={currentResume} />}

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

function ResumesList({ resumes, loading, selected, onSelect }: {
  resumes: Resume[]; loading: boolean; selected: string | null; onSelect: (id: string) => void;
}) {
  return (
    <Card className="p-4">
      <h3 className="text-sm font-semibold mb-3 px-2">Your resumes</h3>
      {loading && <div className="p-4 text-sm text-muted-foreground">Loading…</div>}
      {!loading && resumes.length === 0 && <div className="p-4 text-sm text-muted-foreground">No resumes yet.</div>}
      <ul className="space-y-1">
        {resumes.map((r) => (
          <li key={r.id}>
            <button
              onClick={() => onSelect(r.id)}
              className={`w-full text-left rounded-md px-3 py-2 text-sm transition flex items-start gap-2 ${selected === r.id ? "bg-accent text-accent-foreground" : "hover:bg-muted"}`}
            >
              <FileText className="h-4 w-4 mt-0.5 shrink-0" />
              <div className="min-w-0">
                <div className="truncate font-medium">{r.file_name}</div>
                <div className="text-xs text-muted-foreground">{new Date(r.created_at).toLocaleDateString()} · {r.status}</div>
              </div>
            </button>
          </li>
        ))}
      </ul>
    </Card>
  );
}

function ResumeDetails({ resume }: { resume: Resume }) {
  return (
    <Card className="p-6">
      <div className="flex items-center gap-2 mb-3">
        <Award className="h-5 w-5 text-primary" />
        <h2 className="text-lg font-semibold">Parsed resume</h2>
      </div>
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
