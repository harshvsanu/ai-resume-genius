import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { rankCandidates, becomeRecruiter, getMyRoles } from "@/lib/recruiter.functions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Loader2, Trophy, Users, ShieldCheck, Sparkles } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/recruiter")({
  component: RecruiterPage,
});

function RecruiterPage() {
  const qc = useQueryClient();
  const rankFn = useServerFn(rankCandidates);
  const rolesFn = useServerFn(getMyRoles);
  const becomeFn = useServerFn(becomeRecruiter);
  const [jobTitle, setJobTitle] = useState("");
  const [jd, setJd] = useState("");

  const rolesQ = useQuery({ queryKey: ["my-roles"], queryFn: rolesFn });
  const isRecruiter = (rolesQ.data?.roles ?? []).includes("recruiter") || (rolesQ.data?.roles ?? []).includes("admin");

  const rankMut = useMutation({
    mutationFn: async () => {
      if (jd.trim().length < 20) throw new Error("Paste a longer job description");
      return rankFn({ data: { jobTitle: jobTitle || undefined, jobDescription: jd } });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Ranking failed"),
  });

  const grantMut = useMutation({
    mutationFn: () => becomeFn(),
    onSuccess: () => {
      toast.success("Recruiter mode enabled — you can now rank all candidates.");
      qc.invalidateQueries({ queryKey: ["my-roles"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const results = rankMut.data?.results ?? [];

  return (
    <div className="mx-auto max-w-7xl px-6 py-8">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-3xl font-bold">
            <Users className="h-7 w-7 text-primary" /> Recruiter ranking
          </h1>
          <p className="text-muted-foreground">
            Rank candidate resumes by ATS fit for a single job description.
          </p>
        </div>
        {!isRecruiter && !rolesQ.isLoading && (
          <Button onClick={() => grantMut.mutate()} disabled={grantMut.isPending} variant="outline">
            {grantMut.isPending ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <ShieldCheck className="h-4 w-4 mr-1.5" />}
            Enable recruiter mode
          </Button>
        )}
        {isRecruiter && (
          <Badge variant="secondary" className="h-7"><ShieldCheck className="h-3.5 w-3.5 mr-1" /> Recruiter</Badge>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="p-6 lg:col-span-1 h-fit">
          <h2 className="font-semibold mb-3">Job description</h2>
          <div className="space-y-3">
            <div>
              <Label htmlFor="jt">Job title</Label>
              <Input id="jt" value={jobTitle} onChange={(e) => setJobTitle(e.target.value)} placeholder="Senior Backend Engineer" maxLength={200} />
            </div>
            <div>
              <Label htmlFor="jd">Description</Label>
              <Textarea id="jd" rows={12} value={jd} onChange={(e) => setJd(e.target.value)} maxLength={20000} placeholder="Paste the full JD…" />
            </div>
            <Button className="w-full h-11" onClick={() => rankMut.mutate()} disabled={rankMut.isPending}>
              {rankMut.isPending
                ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Scoring candidates…</>
                : <><Sparkles className="h-4 w-4 mr-2" /> Rank candidates</>}
            </Button>
            <p className="text-xs text-muted-foreground">
              {isRecruiter ? "Ranks every parsed resume in the system." : "Ranks only your own uploaded resumes. Enable recruiter mode to see everyone."}
            </p>
          </div>
        </Card>

        <div className="lg:col-span-2 space-y-3">
          <div className="flex items-center gap-2">
            <Trophy className="h-5 w-5 text-primary" />
            <h2 className="font-semibold">Leaderboard</h2>
            {results.length > 0 && <Badge variant="secondary">{results.length} candidates</Badge>}
          </div>
          {results.length === 0 && !rankMut.isPending && (
            <Card className="p-10 text-center text-sm text-muted-foreground">
              Run a ranking to see candidates here.
            </Card>
          )}
          {results.map((r, idx) => (
            <Card key={r.resume_id} className="p-5">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span className="grid h-6 w-6 place-items-center rounded-full bg-accent font-bold text-accent-foreground">{idx + 1}</span>
                    <span className="truncate">{r.file_name}</span>
                  </div>
                  <h3 className="font-semibold mt-1">{r.candidate_name || "Unnamed candidate"}</h3>
                </div>
                <div className="text-right">
                  <div className={`font-display text-3xl font-bold ${r.ats_score >= 75 ? "text-[var(--color-success)]" : r.ats_score >= 50 ? "text-[var(--color-warning)]" : "text-destructive"}`}>
                    {r.ats_score}
                  </div>
                  <div className="text-xs text-muted-foreground">ATS fit</div>
                </div>
              </div>
              <Progress value={r.ats_score} className="my-3" />
              {r.reasoning && <p className="text-sm text-muted-foreground">{r.reasoning}</p>}
              <div className="mt-3 grid sm:grid-cols-2 gap-3">
                <SkillRow label="Matched" items={r.matched_skills} variant="secondary" />
                <SkillRow label="Missing" items={r.missing_skills} variant="destructive" />
              </div>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}

function SkillRow({ label, items, variant }: { label: string; items: string[]; variant: "secondary" | "destructive" }) {
  return (
    <div>
      <div className="text-xs font-medium text-muted-foreground mb-1.5">{label}</div>
      <div className="flex flex-wrap gap-1">
        {items.length === 0 ? <span className="text-xs text-muted-foreground">None</span> :
          items.slice(0, 12).map((s, i) => <Badge key={i} variant={variant}>{s}</Badge>)}
      </div>
    </div>
  );
}
