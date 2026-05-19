import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { callAIJson } from "./ai.server";

export const deleteResume = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => z.object({ resumeId: z.string().uuid() }).parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: r, error: rErr } = await supabase
      .from("resumes").select("id, user_id, file_path").eq("id", data.resumeId).single();
    if (rErr || !r) throw new Error("Resume not found");
    if (r.user_id !== userId) throw new Error("Forbidden");

    await supabase.from("analyses").delete().eq("resume_id", data.resumeId);
    if (r.file_path) await supabase.storage.from("resumes").remove([r.file_path]);
    const { error: delErr } = await supabase.from("resumes").delete().eq("id", data.resumeId);
    if (delErr) throw new Error(delErr.message);
    return { ok: true };
  });


const ExtractInput = z.object({
  resumeId: z.string().uuid(),
  rawText: z.string().min(20).max(200_000),
});

type ExtractedResume = {
  candidate_name: string | null;
  candidate_email: string | null;
  summary: string;
  skills: string[];
  education: { degree?: string; institution?: string; year?: string }[];
  experience: { title?: string; company?: string; duration?: string; description?: string }[];
};

export const extractResumeData = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => ExtractInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    // ensure ownership
    const { data: resume, error: rErr } = await supabase
      .from("resumes")
      .select("id, user_id")
      .eq("id", data.resumeId)
      .single();
    if (rErr || !resume || resume.user_id !== userId) {
      throw new Error("Resume not found");
    }

    const parsed = await callAIJson<ExtractedResume>(
      "You are a precise resume parser. Extract structured data from resume text. Use null where unknown. Skills must be specific tech / tools / soft skills (no full sentences).",
      data.rawText.slice(0, 60_000),
      `{"candidate_name": string|null, "candidate_email": string|null, "summary": string, "skills": string[], "education": [{"degree": string, "institution": string, "year": string}], "experience": [{"title": string, "company": string, "duration": string, "description": string}]}`,
    );

    const { error: updErr } = await supabase
      .from("resumes")
      .update({
        raw_text: data.rawText,
        candidate_name: parsed.candidate_name,
        candidate_email: parsed.candidate_email,
        summary: parsed.summary ?? "",
        skills: parsed.skills ?? [],
        education: parsed.education ?? [],
        experience: parsed.experience ?? [],
        status: "parsed",
        updated_at: new Date().toISOString(),
      })
      .eq("id", data.resumeId);

    if (updErr) throw new Error(updErr.message);

    return { ok: true, parsed };
  });

const AnalyzeInput = z.object({
  resumeId: z.string().uuid(),
  jobTitle: z.string().max(200).optional(),
  jobDescription: z.string().min(20).max(20_000),
});

type AIAnalysis = {
  ats_score: number;
  matched_skills: string[];
  missing_skills: string[];
  strengths: string[];
  weaknesses: string[];
  suggestions: string[];
  verdict: string;
};

export const analyzeResume = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => AnalyzeInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: resume, error: rErr } = await supabase
      .from("resumes")
      .select("*")
      .eq("id", data.resumeId)
      .single();
    if (rErr || !resume) throw new Error("Resume not found");
    if (resume.user_id !== userId) throw new Error("Forbidden");

    const resumeContext = `RESUME SUMMARY:\n${resume.summary ?? ""}\n\nSKILLS: ${JSON.stringify(resume.skills)}\n\nEXPERIENCE: ${JSON.stringify(resume.experience)}\n\nEDUCATION: ${JSON.stringify(resume.education)}\n\nFULL TEXT (excerpt):\n${(resume.raw_text ?? "").slice(0, 8000)}`;

    const analysis = await callAIJson<AIAnalysis>(
      "You are an expert ATS (Applicant Tracking System) analyst and career coach. Score resumes against job descriptions on a 0-100 scale. Be honest, specific, and actionable. matched_skills must literally exist in the resume; missing_skills are required by the JD but absent. Provide 3-6 concrete suggestions.",
      `JOB TITLE: ${data.jobTitle ?? "(not specified)"}\n\nJOB DESCRIPTION:\n${data.jobDescription}\n\n---\n${resumeContext}`,
      `{"ats_score": number(0-100), "matched_skills": string[], "missing_skills": string[], "strengths": string[], "weaknesses": string[], "suggestions": string[], "verdict": string}`,
    );

    const score = Math.max(0, Math.min(100, Math.round(analysis.ats_score ?? 0)));

    const { data: inserted, error: insErr } = await supabase
      .from("analyses")
      .insert({
        user_id: userId,
        resume_id: data.resumeId,
        job_title: data.jobTitle ?? null,
        job_description: data.jobDescription,
        ats_score: score,
        matched_skills: analysis.matched_skills ?? [],
        missing_skills: analysis.missing_skills ?? [],
        strengths: analysis.strengths ?? [],
        weaknesses: analysis.weaknesses ?? [],
        suggestions: analysis.suggestions ?? [],
        verdict: analysis.verdict ?? "",
      })
      .select("*")
      .single();

    if (insErr) throw new Error(insErr.message);

    return { analysis: inserted };
  });
