import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { generateInterviewQuestions } from "@/lib/ai-tools.functions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Loader2, MessageSquareQuote, AlertTriangle, Sparkles } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/interview")({
  component: InterviewPage,
});

function InterviewPage() {
  const genFn = useServerFn(generateInterviewQuestions);
  const [resumeId, setResumeId] = useState<string>("");
  const [jobTitle, setJobTitle] = useState("");
  const [jobDescription, setJobDescription] = useState("");
  const [difficulty, setDifficulty] = useState<"entry" | "mid" | "senior">("mid");

  const resumesQ = useQuery({
    queryKey: ["resumes-mini"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("resumes")
        .select("id, file_name, candidate_name")
        .eq("status", "parsed")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const genMut = useMutation({
    mutationFn: async () => {
      if (!resumeId) throw new Error("Choose a resume");
      if (jobTitle.trim().length < 2) throw new Error("Enter a job title");
      return genFn({
        data: {
          resumeId,
          jobTitle,
          jobDescription: jobDescription || undefined,
          difficulty,
        },
      });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const q = genMut.data?.questions;

  return (
    <div className="mx-auto max-w-6xl px-6 py-8">
      <div className="mb-6">
        <h1 className="flex items-center gap-2 text-3xl font-bold">
          <MessageSquareQuote className="h-7 w-7 text-primary" /> Interview Question Generator
        </h1>
        <p className="text-muted-foreground">AI-generated questions tailored to the candidate and target role.</p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="p-6 h-fit lg:col-span-1">
          <div className="space-y-3">
            <div>
              <Label>Resume</Label>
              <Select value={resumeId} onValueChange={setResumeId}>
                <SelectTrigger><SelectValue placeholder="Choose a resume" /></SelectTrigger>
                <SelectContent>
                  {(resumesQ.data ?? []).map((r) => (
                    <SelectItem key={r.id} value={r.id}>{r.candidate_name || r.file_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="jt">Target role</Label>
              <Input id="jt" value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} placeholder="Senior Frontend Engineer" maxLength={200} />
            </div>
            <div>
              <Label>Difficulty</Label>
              <Select value={difficulty} onValueChange={(v) => setDifficulty(v as typeof difficulty)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="entry">Entry</SelectItem>
                  <SelectItem value="mid">Mid</SelectItem>
                  <SelectItem value="senior">Senior</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="jd">Job description (optional)</Label>
              <Textarea id="jd" rows={6} value={jobDescription} onChange={(e) => setJobDescription(e.target.value)} maxLength={20000} placeholder="Paste to sharpen the questions…" />
            </div>
            <Button className="w-full h-11" onClick={() => genMut.mutate()} disabled={genMut.isPending}>
              {genMut.isPending
                ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Generating…</>
                : <><Sparkles className="h-4 w-4 mr-2" /> Generate questions</>}
            </Button>
          </div>
        </Card>

        <div className="lg:col-span-2 space-y-4">
          {!q && !genMut.isPending && (
            <Card className="p-10 text-center text-sm text-muted-foreground">
              Choose a resume, target role, and click Generate.
            </Card>
          )}
          {q && (
            <>
              <QSection title="Technical" items={q.technical} />
              <QSection title="Role-specific" items={q.role_specific} />
              <QSection title="Behavioral" items={q.behavioral} />
              {q.red_flags?.length > 0 && (
                <Card className="p-6">
                  <h3 className="flex items-center gap-2 font-semibold mb-3">
                    <AlertTriangle className="h-4 w-4 text-[var(--color-warning)]" /> Areas to probe
                  </h3>
                  <ul className="space-y-2 text-sm">
                    {q.red_flags.map((r, i) => <li key={i} className="flex gap-2"><span className="text-primary">→</span><span>{r}</span></li>)}
                  </ul>
                </Card>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function QSection({ title, items }: { title: string; items: { question: string; rationale: string }[] }) {
  if (!items?.length) return null;
  return (
    <Card className="p-6">
      <div className="flex items-center gap-2 mb-4">
        <h3 className="font-semibold">{title}</h3>
        <Badge variant="secondary">{items.length}</Badge>
      </div>
      <ol className="space-y-4">
        {items.map((it, i) => (
          <li key={i} className="border-l-2 border-primary/50 pl-4">
            <p className="font-medium text-sm">{i + 1}. {it.question}</p>
            <p className="text-xs text-muted-foreground mt-1 italic">{it.rationale}</p>
          </li>
        ))}
      </ol>
    </Card>
  );
}
