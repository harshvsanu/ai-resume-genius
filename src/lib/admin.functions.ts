import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";

async function assertAdmin(userId: string) {
  const { data, error } = await supabaseAdmin
    .from("user_roles")
    .select("role")
    .eq("user_id", userId);
  if (error) throw new Error(error.message);
  const roles = (data ?? []).map((r) => r.role as string);
  if (!roles.includes("admin")) throw new Error("Forbidden: admin only");
}

export const bootstrapAdmin = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId } = context;
    const { data, error } = await supabaseAdmin.rpc("bootstrap_admin", { _user_id: userId });
    if (error) throw new Error(error.message);
    return { granted: data === true };
  });

export const getAdminStats = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await assertAdmin(context.userId);

    const [rolesRes, resumesRes, analysesRes, profilesRes] = await Promise.all([
      supabaseAdmin.from("user_roles").select("role, user_id, created_at"),
      supabaseAdmin.from("resumes").select("id, user_id, status, created_at"),
      supabaseAdmin.from("analyses").select("id, user_id, resume_id, ats_score, created_at, job_title"),
      supabaseAdmin.from("profiles").select("id, email, display_name, created_at"),
    ]);
    if (rolesRes.error) throw new Error(rolesRes.error.message);
    if (resumesRes.error) throw new Error(resumesRes.error.message);
    if (analysesRes.error) throw new Error(analysesRes.error.message);
    if (profilesRes.error) throw new Error(profilesRes.error.message);

    const roles = rolesRes.data ?? [];
    const resumes = resumesRes.data ?? [];
    const analyses = analysesRes.data ?? [];
    const profiles = profilesRes.data ?? [];

    const candidates = new Set(roles.filter((r) => r.role === "student").map((r) => r.user_id));
    const recruiters = new Set(roles.filter((r) => r.role === "recruiter").map((r) => r.user_id));
    const admins = new Set(roles.filter((r) => r.role === "admin").map((r) => r.user_id));

    const avgAts = analyses.length
      ? Math.round(analyses.reduce((s, a) => s + (a.ats_score ?? 0), 0) / analyses.length)
      : 0;

    // ATS score distribution buckets
    const buckets = [
      { range: "0-20", count: 0 },
      { range: "21-40", count: 0 },
      { range: "41-60", count: 0 },
      { range: "61-80", count: 0 },
      { range: "81-100", count: 0 },
    ];
    for (const a of analyses) {
      const s = a.ats_score ?? 0;
      const idx = Math.min(4, Math.floor(s / 20.0001));
      buckets[idx].count += 1;
    }

    // Activity over last 14 days
    const days: { date: string; resumes: number; analyses: number }[] = [];
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    for (let i = 13; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      days.push({ date: d.toISOString().slice(5, 10), resumes: 0, analyses: 0 });
    }
    const dayIndex = (iso: string) => {
      const d = new Date(iso);
      d.setHours(0, 0, 0, 0);
      const diff = Math.floor((today.getTime() - d.getTime()) / 86400000);
      return 13 - diff;
    };
    for (const r of resumes) {
      const i = dayIndex(r.created_at);
      if (i >= 0 && i < days.length) days[i].resumes += 1;
    }
    for (const a of analyses) {
      const i = dayIndex(a.created_at);
      if (i >= 0 && i < days.length) days[i].analyses += 1;
    }

    // Per-user candidate summary (top 10 by resume count)
    const byUser = new Map<string, { user_id: string; resumes: number; analyses: number; avg_ats: number }>();
    for (const r of resumes) {
      const e = byUser.get(r.user_id) ?? { user_id: r.user_id, resumes: 0, analyses: 0, avg_ats: 0 };
      e.resumes += 1;
      byUser.set(r.user_id, e);
    }
    const sumByUser = new Map<string, { sum: number; n: number }>();
    for (const a of analyses) {
      const e = byUser.get(a.user_id) ?? { user_id: a.user_id, resumes: 0, analyses: 0, avg_ats: 0 };
      e.analyses += 1;
      byUser.set(a.user_id, e);
      const s = sumByUser.get(a.user_id) ?? { sum: 0, n: 0 };
      s.sum += a.ats_score ?? 0;
      s.n += 1;
      sumByUser.set(a.user_id, s);
    }
    for (const [uid, e] of byUser) {
      const s = sumByUser.get(uid);
      e.avg_ats = s && s.n ? Math.round(s.sum / s.n) : 0;
    }
    const profileMap = new Map(profiles.map((p) => [p.id, p]));
    const topCandidates = Array.from(byUser.values())
      .filter((u) => candidates.has(u.user_id))
      .sort((a, b) => b.resumes - a.resumes || b.avg_ats - a.avg_ats)
      .slice(0, 10)
      .map((u) => ({
        ...u,
        email: profileMap.get(u.user_id)?.email ?? null,
        display_name: profileMap.get(u.user_id)?.display_name ?? null,
      }));

    const recruiterList = Array.from(recruiters).map((uid) => ({
      user_id: uid,
      email: profileMap.get(uid)?.email ?? null,
      display_name: profileMap.get(uid)?.display_name ?? null,
      created_at: profileMap.get(uid)?.created_at ?? null,
    }));

    return {
      totals: {
        users: profiles.length,
        candidates: candidates.size,
        recruiters: recruiters.size,
        admins: admins.size,
        resumes: resumes.length,
        analyses: analyses.length,
        avg_ats: avgAts,
      },
      buckets,
      activity: days,
      topCandidates,
      recruiters: recruiterList,
    };
  });
