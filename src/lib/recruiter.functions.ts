import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { supabaseAdmin } from "@/integrations/supabase/client.server";
import { callAIJson } from "./ai.server";

const RankInput = z.object({
  jobTitle: z.string().max(200).optional(),
  jobDescription: z.string().min(20).max(20_000),
  limit: z.number().int().min(1).max(50).optional(),
});

type RankScore = {
  ats_score: number;
  matched_skills: string[];
  missing_skills: string[];
  reasoning: string;
};

export const rankCandidates = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => RankInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase } = context;

    // RLS scopes this: students see only their own resumes, recruiters/admins see all.
    const { data: resumes, error } = await supabase
      .from("resumes")
      .select("id, user_id, candidate_name, file_name, summary, skills, experience, education, raw_text")
      .eq("status", "parsed")
      .order("created_at", { ascending: false })
      .limit(data.limit ?? 25);
    if (error) throw new Error(error.message);
    if (!resumes || resumes.length === 0) {
      return { results: [] as Array<RankScore & { resume_id: string; candidate_name: string | null; file_name: string }> };
    }

    const results = await Promise.all(
      resumes.map(async (r) => {
        const ctx = `SUMMARY:\n${r.summary ?? ""}\n\nSKILLS: ${JSON.stringify(r.skills)}\n\nEXPERIENCE: ${JSON.stringify(r.experience)}\n\nEDUCATION: ${JSON.stringify(r.education)}\n\nEXCERPT:\n${(r.raw_text ?? "").slice(0, 4000)}`;
        try {
          const scored = await callAIJson<RankScore>(
            "You are an ATS scoring engine. Score 0-100 how well the candidate matches the role. matched_skills must literally appear in the resume; missing_skills are required by the JD but absent. Keep reasoning to 1-2 sentences.",
            `JOB TITLE: ${data.jobTitle ?? "(none)"}\n\nJOB DESCRIPTION:\n${data.jobDescription}\n\n---\n${ctx}`,
            `{"ats_score": number(0-100), "matched_skills": string[], "missing_skills": string[], "reasoning": string}`,
          );
          return {
            resume_id: r.id,
            candidate_name: r.candidate_name,
            file_name: r.file_name,
            ats_score: Math.max(0, Math.min(100, Math.round(scored.ats_score ?? 0))),
            matched_skills: scored.matched_skills ?? [],
            missing_skills: scored.missing_skills ?? [],
            reasoning: scored.reasoning ?? "",
          };
        } catch (e) {
          return {
            resume_id: r.id,
            candidate_name: r.candidate_name,
            file_name: r.file_name,
            ats_score: 0,
            matched_skills: [],
            missing_skills: [],
            reasoning: e instanceof Error ? e.message : "Failed",
          };
        }
      }),
    );

    results.sort((a, b) => b.ats_score - a.ats_score);
    return { results };
  });

export const becomeRecruiter = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { userId } = context;
    const { error } = await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: userId, role: "recruiter" });
    // ignore duplicate unique constraint
    if (error && !/duplicate|unique/i.test(error.message)) throw new Error(error.message);
    return { ok: true };
  });

export const getMyRoles = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data, error } = await supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
    return { roles: (data ?? []).map((r) => r.role as string) };
  });
