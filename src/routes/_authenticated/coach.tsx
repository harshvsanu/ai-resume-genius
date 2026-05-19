import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { supabase } from "@/integrations/supabase/client";
import { chatWithCoach } from "@/lib/ai-tools.functions";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Loader2, Send, Bot, User } from "lucide-react";
import ReactMarkdown from "react-markdown";

export const Route = createFileRoute("/_authenticated/coach")({
  component: CoachPage,
});

type Msg = { role: "user" | "assistant"; content: string };

function CoachPage() {
  const chatFn = useServerFn(chatWithCoach);
  const [messages, setMessages] = useState<Msg[]>([
    { role: "assistant", content: "Hi! I'm your AI career coach. Ask me anything about your resume, interview prep, or job search strategy." },
  ]);
  const [input, setInput] = useState("");
  const [resumeId, setResumeId] = useState<string | undefined>();
  const scrollRef = useRef<HTMLDivElement>(null);

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

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const sendMut = useMutation({
    mutationFn: async () => {
      const next: Msg[] = [...messages, { role: "user", content: input.trim() }];
      setMessages(next);
      setInput("");
      const res = await chatFn({ data: { resumeId, messages: next } });
      setMessages((m) => [...m, { role: "assistant", content: res.reply }]);
    },
  });

  const submit = () => {
    if (!input.trim() || sendMut.isPending) return;
    sendMut.mutate();
  };

  return (
    <div className="mx-auto max-w-4xl px-6 py-8">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="flex items-center gap-2 text-3xl font-bold">
            <Bot className="h-7 w-7 text-primary" /> AI Career Coach
          </h1>
          <p className="text-muted-foreground">Get personalized resume and interview advice.</p>
        </div>
        <div className="min-w-[240px]">
          <Select value={resumeId ?? "none"} onValueChange={(v) => setResumeId(v === "none" ? undefined : v)}>
            <SelectTrigger><SelectValue placeholder="Ground in a resume" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">No resume context</SelectItem>
              {(resumesQ.data ?? []).map((r) => (
                <SelectItem key={r.id} value={r.id}>{r.candidate_name || r.file_name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <Card className="flex flex-col h-[70vh]">
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 space-y-4">
          {messages.map((m, i) => (
            <div key={i} className={`flex gap-3 ${m.role === "user" ? "flex-row-reverse" : ""}`}>
              <div className={`grid h-8 w-8 shrink-0 place-items-center rounded-full ${m.role === "user" ? "bg-primary text-primary-foreground" : "bg-accent text-accent-foreground"}`}>
                {m.role === "user" ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
              </div>
              <div className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm ${m.role === "user" ? "bg-primary text-primary-foreground" : "bg-muted"}`}>
                <div className="prose prose-sm max-w-none dark:prose-invert prose-p:my-1 prose-headings:my-2 prose-ul:my-1">
                  <ReactMarkdown>{m.content}</ReactMarkdown>
                </div>
              </div>
            </div>
          ))}
          {sendMut.isPending && (
            <div className="flex gap-3">
              <div className="grid h-8 w-8 place-items-center rounded-full bg-accent"><Bot className="h-4 w-4" /></div>
              <div className="rounded-2xl bg-muted px-4 py-3"><Loader2 className="h-4 w-4 animate-spin" /></div>
            </div>
          )}
        </div>
        <div className="border-t p-3 flex gap-2">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); submit(); } }}
            placeholder="Ask anything…  (Enter to send, Shift+Enter for newline)"
            rows={2}
            maxLength={8000}
            className="resize-none"
          />
          <Button onClick={submit} disabled={!input.trim() || sendMut.isPending} className="h-auto">
            {sendMut.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          </Button>
        </div>
      </Card>
    </div>
  );
}
