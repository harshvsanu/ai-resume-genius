import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { callAIChat, callAIJson, type ChatMessage } from "./ai.server";

const ChatInput = z.object({
  resumeId: z.string().uuid().optional(),
  messages: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().min(1).max(8000),
      }),
    )
    .min(1)
    .max(40),
});

export const chatWithCoach = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => ChatInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    let resumeContext = "";
    if (data.resumeId) {
      const { data: r } = await supabase
        .from("resumes")
        .select("user_id, candidate_name, summary, skills, experience, education")
        .eq("id", data.resumeId)
        .single();
      if (r && r.user_id === userId) {
        resumeContext = `\n\nCANDIDATE RESUME CONTEXT:\nName: ${r.candidate_name ?? "n/a"}\nSummary: ${r.summary ?? ""}\nSkills: ${JSON.stringify(r.skills)}\nExperience: ${JSON.stringify(r.experience)}\nEducation: ${JSON.stringify(r.education)}`;
      }
    }

    const messages: ChatMessage[] = [
      {
        role: "system",
        content: `You are ResumeIQ Coach, an expert career & resume coach. Give concise, actionable, encouraging advice. Use markdown (bullet lists, bold) when helpful. If a resume is in context, ground answers in it.${resumeContext}`,
      },
      ...data.messages,
    ];

    const reply = await callAIChat(messages);
    return { reply };
  });

const InterviewInput = z.object({
  resumeId: z.string().uuid(),
  jobTitle: z.string().min(2).max(200),
  jobDescription: z.string().max(20_000).optional(),
  difficulty: z.enum(["entry", "mid", "senior"]).optional(),
});

type InterviewSet = {
  technical: { question: string; rationale: string }[];
  behavioral: { question: string; rationale: string }[];
  role_specific: { question: string; rationale: string }[];
  red_flags: string[];
};

export const generateInterviewQuestions = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((input: unknown) => InterviewInput.parse(input))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: r, error } = await supabase
      .from("resumes")
      .select("*")
      .eq("id", data.resumeId)
      .single();
    if (error || !r) throw new Error("Resume not found");
    if (r.user_id !== userId) throw new Error("Forbidden");

    const result = await callAIJson<InterviewSet>(
      "You are a senior hiring manager. Generate sharp, role-specific interview questions tailored to the candidate's actual background and the target role. Avoid generic boilerplate. Each item: a question and a 1-line rationale.",
      `TARGET ROLE: ${data.jobTitle}\nDIFFICULTY: ${data.difficulty ?? "mid"}\nJOB DESCRIPTION:\n${data.jobDescription ?? "(not provided — infer from role)"}\n\nCANDIDATE:\nSummary: ${r.summary ?? ""}\nSkills: ${JSON.stringify(r.skills)}\nExperience: ${JSON.stringify(r.experience)}\nEducation: ${JSON.stringify(r.education)}\n\nReturn 5 technical, 4 behavioral, 4 role_specific, and 3 red_flags to probe.`,
      `{"technical":[{"question":string,"rationale":string}],"behavioral":[{"question":string,"rationale":string}],"role_specific":[{"question":string,"rationale":string}],"red_flags":string[]}`,
    );

    return { questions: result };
  });
