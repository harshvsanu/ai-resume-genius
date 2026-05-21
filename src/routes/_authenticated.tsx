import { createFileRoute, redirect, Outlet, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useServerFn } from "@tanstack/react-start";
import { useQuery } from "@tanstack/react-query";
import { getMyRoles } from "@/lib/recruiter.functions";
import { Button } from "@/components/ui/button";
import { Sparkles, LogOut, LayoutDashboard, Users, Bot, MessageSquareQuote, ShieldCheck } from "lucide-react";

const BASE_NAV = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/recruiter", label: "Recruiter", icon: Users },
  { to: "/coach", label: "Coach", icon: Bot },
  { to: "/interview", label: "Interview", icon: MessageSquareQuote },
] as const;

export const Route = createFileRoute("/_authenticated")({
  beforeLoad: async () => {
    const { data } = await supabase.auth.getSession();
    if (!data.session) throw redirect({ to: "/login" });
  },
  component: AuthLayout,
});

function AuthLayout() {
  const navigate = useNavigate();
  const [email, setEmail] = useState<string | null>(null);
  const rolesFn = useServerFn(getMyRoles);
  const rolesQ = useQuery({ queryKey: ["my-roles"], queryFn: rolesFn });
  const isAdmin = (rolesQ.data?.roles ?? []).includes("admin");

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setEmail(data.user?.email ?? null));
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/login" });
  };

  const NAV = isAdmin
    ? [...BASE_NAV, { to: "/admin" as const, label: "Admin", icon: ShieldCheck }]
    : BASE_NAV;

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 glass">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
          <Link to="/dashboard" className="flex items-center gap-2 font-display text-lg font-bold">
            <div className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-primary to-primary/70 text-primary-foreground">
              <Sparkles className="h-4 w-4" />
            </div>
            ResumeIQ
          </Link>
          <nav className="hidden md:flex items-center gap-1">
            {NAV.map((n) => (
              <Link
                key={n.to}
                to={n.to}
                className="rounded-md px-3 py-1.5 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition flex items-center gap-1.5"
                activeProps={{ className: "rounded-md px-3 py-1.5 text-sm font-medium bg-accent text-accent-foreground flex items-center gap-1.5" }}
              >
                <n.icon className="h-3.5 w-3.5" /> {n.label}
              </Link>
            ))}
          </nav>
          <div className="flex items-center gap-3">
            {email && <span className="hidden text-sm text-muted-foreground lg:inline">{email}</span>}
            <Button onClick={signOut} variant="ghost" size="sm"><LogOut className="h-4 w-4 mr-1.5" /> Sign out</Button>
          </div>
        </div>
      </header>
      <main><Outlet /></main>
    </div>
  );
}
