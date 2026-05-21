import { createFileRoute, redirect } from "@tanstack/react-router";
import { useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getAdminStats, bootstrapAdmin } from "@/lib/admin.functions";
import { getMyRoles } from "@/lib/recruiter.functions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Loader2, ShieldCheck, Users, FileText, BarChart3, Sparkles, Trophy } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  LineChart, Line, CartesianGrid, Legend, PieChart, Pie, Cell,
} from "recharts";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/admin")({
  component: AdminPage,
});

const ROLE_COLORS = ["hsl(var(--primary))", "#10b981", "#f59e0b"];

function AdminPage() {
  const rolesFn = useServerFn(getMyRoles);
  const statsFn = useServerFn(getAdminStats);
  const bootstrapFn = useServerFn(bootstrapAdmin);

  const rolesQ = useQuery({ queryKey: ["my-roles"], queryFn: rolesFn });
  const isAdmin = (rolesQ.data?.roles ?? []).includes("admin");

  const statsQ = useQuery({
    queryKey: ["admin-stats"],
    queryFn: statsFn,
    enabled: isAdmin,
  });

  const bootstrapMut = useMutation({
    mutationFn: () => bootstrapFn(),
    onSuccess: (r) => {
      if (r.granted) {
        toast.success("Admin access granted. Refreshing…");
        setTimeout(() => window.location.reload(), 600);
      } else {
        toast.error("Admin already exists. Ask an existing admin to grant access.");
      }
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  if (rolesQ.isLoading) {
    return <div className="grid h-[60vh] place-items-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  if (!isAdmin) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-16">
        <Card className="p-8 text-center">
          <ShieldCheck className="mx-auto h-10 w-10 text-primary" />
          <h1 className="mt-3 text-2xl font-bold">Admin access required</h1>
          <p className="mt-2 text-muted-foreground">
            This dashboard is for platform administrators. If no admin exists yet, you can claim it (one-time bootstrap).
          </p>
          <Button onClick={() => bootstrapMut.mutate()} disabled={bootstrapMut.isPending} className="mt-5">
            {bootstrapMut.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Claim admin access
          </Button>
        </Card>
      </div>
    );
  }

  if (statsQ.isLoading || !statsQ.data) {
    return <div className="grid h-[60vh] place-items-center"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>;
  }

  const s = statsQ.data;
  const roleData = [
    { name: "Candidates", value: s.totals.candidates },
    { name: "Recruiters", value: s.totals.recruiters },
    { name: "Admins", value: s.totals.admins },
  ];

  return (
    <div className="mx-auto max-w-7xl px-6 py-8 space-y-6">
      <div>
        <h1 className="flex items-center gap-2 text-3xl font-bold">
          <ShieldCheck className="h-7 w-7 text-primary" /> Admin dashboard
        </h1>
        <p className="text-muted-foreground">Platform-wide analytics across candidates and recruiters.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard icon={Users} label="Total users" value={s.totals.users} />
        <StatCard icon={Users} label="Candidates" value={s.totals.candidates} />
        <StatCard icon={Trophy} label="Recruiters" value={s.totals.recruiters} />
        <StatCard icon={Sparkles} label="Avg ATS score" value={`${s.totals.avg_ats}%`} />
        <StatCard icon={FileText} label="Resumes uploaded" value={s.totals.resumes} />
        <StatCard icon={BarChart3} label="Analyses run" value={s.totals.analyses} />
        <StatCard icon={ShieldCheck} label="Admins" value={s.totals.admins} />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-5">
          <h2 className="font-semibold mb-3">Activity — last 14 days</h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={s.activity}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="date" fontSize={11} stroke="hsl(var(--muted-foreground))" />
                <YAxis fontSize={11} stroke="hsl(var(--muted-foreground))" allowDecimals={false} />
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }} />
                <Legend />
                <Line type="monotone" dataKey="resumes" stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="analyses" stroke="#10b981" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-5">
          <h2 className="font-semibold mb-3">ATS score distribution</h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={s.buckets}>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis dataKey="range" fontSize={11} stroke="hsl(var(--muted-foreground))" />
                <YAxis fontSize={11} stroke="hsl(var(--muted-foreground))" allowDecimals={false} />
                <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }} />
                <Bar dataKey="count" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-5">
          <h2 className="font-semibold mb-3">User mix</h2>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={roleData} dataKey="value" nameKey="name" outerRadius={90} label>
                  {roleData.map((_, i) => <Cell key={i} fill={ROLE_COLORS[i % ROLE_COLORS.length]} />)}
                </Pie>
                <Tooltip />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card className="p-5">
          <h2 className="font-semibold mb-3">Top candidates by activity</h2>
          <div className="space-y-2 max-h-64 overflow-auto pr-1">
            {s.topCandidates.length === 0 && <p className="text-sm text-muted-foreground">No candidate activity yet.</p>}
            {s.topCandidates.map((c) => (
              <div key={c.user_id} className="flex items-center justify-between rounded-md border p-2.5">
                <div className="min-w-0">
                  <div className="truncate text-sm font-medium">{c.display_name ?? c.email ?? c.user_id.slice(0, 8)}</div>
                  <div className="truncate text-xs text-muted-foreground">{c.email}</div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Badge variant="secondary">{c.resumes} resumes</Badge>
                  <Badge variant="secondary">{c.analyses} analyses</Badge>
                  <Badge>{c.avg_ats}% avg</Badge>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Card className="p-5">
        <h2 className="font-semibold mb-3">Recruiters ({s.recruiters.length})</h2>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {s.recruiters.length === 0 && <p className="text-sm text-muted-foreground">No recruiters yet.</p>}
          {s.recruiters.map((r) => (
            <div key={r.user_id} className="rounded-md border p-3">
              <div className="text-sm font-medium truncate">{r.display_name ?? r.email ?? r.user_id.slice(0, 8)}</div>
              <div className="text-xs text-muted-foreground truncate">{r.email}</div>
              {r.created_at && <div className="text-xs text-muted-foreground mt-1">Joined {new Date(r.created_at).toLocaleDateString()}</div>}
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

function StatCard({ icon: Icon, label, value }: { icon: typeof Users; label: string; value: number | string }) {
  return (
    <Card className="p-4">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Icon className="h-3.5 w-3.5" /> {label}
      </div>
      <div className="mt-1 text-2xl font-bold">{value}</div>
    </Card>
  );
}
