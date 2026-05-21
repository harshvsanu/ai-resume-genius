import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { toast } from "sonner";
import { Sparkles, Loader2, GraduationCap, Users, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";

type UserType = "candidate" | "recruiter" | "admin";

const ROLE_OPTIONS: { value: UserType; label: string; icon: typeof GraduationCap; desc: string }[] = [
  { value: "candidate", label: "Candidate", icon: GraduationCap, desc: "Upload & analyze resumes" },
  { value: "recruiter", label: "Recruiter", icon: Users, desc: "Rank & review candidates" },
  { value: "admin", label: "Admin", icon: ShieldCheck, desc: "Platform analytics" },
];

export const Route = createFileRoute("/login")({
  component: LoginPage,
  beforeLoad: async () => {
    const { data } = await supabase.auth.getSession();
    if (data.session) throw redirect({ to: "/dashboard" });
  },
});

function LoginPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [userType, setUserType] = useState<UserType>("candidate");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      if (session) {
        const target = userType === "admin" ? "/admin" : userType === "recruiter" ? "/recruiter" : "/dashboard";
        navigate({ to: target });
      }
    });
    return () => subscription.unsubscribe();
  }, [navigate, userType]);

  const onEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (mode === "signup") {
        if (userType === "admin") {
          throw new Error("Admin accounts can't be created via signup. Sign up as candidate or recruiter — the first admin can claim access from the Admin page.");
        }
        const signupRole = userType === "recruiter" ? "recruiter" : "student";
        const { error } = await supabase.auth.signUp({
          email, password,
          options: {
            emailRedirectTo: `${window.location.origin}/dashboard`,
            data: { full_name: name, role: signupRole },
          },
        });
        if (error) throw error;
        toast.success("Account created! Check your email to confirm, then sign in.");
        setMode("signin");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Authentication failed");
    } finally {
      setLoading(false);
    }
  };

  const onGoogle = async () => {
    setLoading(true);
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin + "/dashboard",
    });
    if (result.error) {
      toast.error(result.error.message ?? "Google sign-in failed");
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen hero-bg flex items-center justify-center px-4 py-12">
      <div className="absolute inset-0 mesh-bg opacity-60 pointer-events-none" />
      <Card className="relative w-full max-w-md p-8 glass shadow-[var(--shadow-elevated)]">
        <div className="flex flex-col items-center mb-6">
          <div className="grid h-12 w-12 place-items-center rounded-xl bg-gradient-to-br from-primary to-primary/70 text-primary-foreground mb-3">
            <Sparkles className="h-6 w-6" />
          </div>
          <h1 className="text-2xl font-bold">Welcome to ResumeIQ</h1>
          <p className="text-sm text-muted-foreground mt-1">Sign in to analyze your resume</p>
        </div>

        <div className="mb-5">
          <Label className="text-xs uppercase tracking-wider text-muted-foreground">I am a</Label>
          <div className="mt-2 grid grid-cols-3 gap-2">
            {ROLE_OPTIONS.map((r) => {
              const Icon = r.icon;
              const active = userType === r.value;
              return (
                <button
                  key={r.value}
                  type="button"
                  onClick={() => setUserType(r.value)}
                  className={cn(
                    "rounded-lg border p-2.5 text-left transition",
                    active ? "border-primary bg-primary/5 ring-2 ring-primary/30" : "border-border hover:bg-muted",
                  )}
                >
                  <Icon className={cn("h-4 w-4 mb-1", active ? "text-primary" : "text-muted-foreground")} />
                  <div className="text-xs font-semibold">{r.label}</div>
                  <div className="text-[10px] leading-tight text-muted-foreground">{r.desc}</div>
                </button>
              );
            })}
          </div>
        </div>

        <Button onClick={onGoogle} disabled={loading} variant="outline" className="w-full h-11">
          <GoogleIcon /> <span className="ml-2">Continue with Google</span>
        </Button>

        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center"><div className="w-full border-t" /></div>
          <div className="relative flex justify-center text-xs"><span className="bg-card px-2 text-muted-foreground">or with email</span></div>
        </div>

        <Tabs value={mode} onValueChange={(v) => setMode(v as "signin" | "signup")}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="signin">Sign in</TabsTrigger>
            <TabsTrigger value="signup">Sign up</TabsTrigger>
          </TabsList>
          <TabsContent value="signin" />
          <TabsContent value="signup" />
        </Tabs>

        <form onSubmit={onEmail} className="mt-4 space-y-3">
          {mode === "signup" && (
            <div>
              <Label htmlFor="name">Name</Label>
              <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required maxLength={100} />
            </div>
          )}
          <div>
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required maxLength={255} />
          </div>
          <div>
            <Label htmlFor="password">Password</Label>
            <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} maxLength={72} />
          </div>
          <Button type="submit" disabled={loading} className="w-full h-11">
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {mode === "signup" ? "Create account" : "Sign in"}
          </Button>
          {mode === "signup" && userType === "admin" && (
            <p className="text-xs text-muted-foreground">
              Admins are not created via signup. Sign up as candidate or recruiter; the first user can claim admin from the Admin page.
            </p>
          )}
        </form>
      </Card>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-4 w-4" aria-hidden>
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
      <path fill="#FBBC05" d="M5.84 14.1c-.22-.66-.35-1.36-.35-2.1s.13-1.44.35-2.1V7.07H2.18A10.97 10.97 0 0 0 1 12c0 1.77.42 3.45 1.18 4.93l3.66-2.84z"/>
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84C6.71 7.31 9.14 5.38 12 5.38z"/>
    </svg>
  );
}
