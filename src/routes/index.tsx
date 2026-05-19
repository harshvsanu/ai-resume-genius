import { createFileRoute, Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import {
  Sparkles, FileSearch, Target, BarChart3, ShieldCheck, Brain, Upload, Zap, ArrowRight,
} from "lucide-react";

export const Route = createFileRoute("/")({
  component: Landing,
  head: () => ({
    meta: [
      { title: "ResumeIQ — AI Resume Analyzer with Real ATS Scoring" },
      { name: "description", content: "Upload your resume, get an instant ATS score, skill-gap analysis, and AI-powered improvement suggestions. Free, fast, and built for modern hiring." },
    ],
  }),
});

function Landing() {
  return (
    <div className="min-h-screen bg-background">
      <Nav />
      <Hero />
      <Features />
      <HowItWorks />
      <CTA />
      <Footer />
    </div>
  );
}

function Nav() {
  return (
    <header className="sticky top-0 z-50 glass">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
        <Link to="/" className="flex items-center gap-2 font-display text-lg font-bold">
          <div className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-primary to-primary/70 text-primary-foreground">
            <Sparkles className="h-4 w-4" />
          </div>
          ResumeIQ
        </Link>
        <nav className="hidden items-center gap-8 md:flex">
          <a href="#features" className="text-sm text-muted-foreground hover:text-foreground">Features</a>
          <a href="#how" className="text-sm text-muted-foreground hover:text-foreground">How it works</a>
        </nav>
        <div className="flex items-center gap-2">
          <Link to="/login"><Button variant="ghost" size="sm">Sign in</Button></Link>
          <Link to="/login"><Button size="sm">Get started</Button></Link>
        </div>
      </div>
    </header>
  );
}

function Hero() {
  return (
    <section className="relative overflow-hidden hero-bg">
      <div className="absolute inset-0 mesh-bg opacity-70" />
      <div className="relative mx-auto max-w-7xl px-6 pt-20 pb-24 text-center sm:pt-28 sm:pb-32">
        <div className="mx-auto mb-6 inline-flex items-center gap-2 rounded-full border bg-card/60 px-4 py-1.5 text-xs font-medium text-muted-foreground backdrop-blur">
          <Zap className="h-3.5 w-3.5 text-primary" />
          Powered by real-time AI analysis · 100% free
        </div>
        <h1 className="mx-auto max-w-4xl text-5xl font-bold tracking-tight sm:text-7xl">
          Land more interviews with an{" "}
          <span className="gradient-text">AI resume analyzer</span> that's brutally honest.
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg text-muted-foreground">
          Upload your resume, paste a job description, and get a real ATS score, skill-gap report, and concrete rewrite suggestions in seconds.
        </p>
        <div className="mt-10 flex flex-wrap items-center justify-center gap-3">
          <Link to="/login">
            <Button size="lg" className="h-12 px-6">
              Analyze my resume <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
          <a href="#how">
            <Button size="lg" variant="outline" className="h-12 px-6">
              See how it works
            </Button>
          </a>
        </div>

        <div className="mx-auto mt-16 max-w-5xl">
          <div className="glass rounded-2xl p-2 shadow-[var(--shadow-elevated)]">
            <div className="grid gap-6 rounded-xl bg-card p-8 md:grid-cols-3">
              <Stat label="Avg ATS lift" value="+34%" />
              <Stat label="Analysis time" value="<10s" />
              <Stat label="Skills detected" value="500+" />
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="text-center">
      <div className="font-display text-4xl font-bold gradient-text">{value}</div>
      <div className="mt-1 text-sm text-muted-foreground">{label}</div>
    </div>
  );
}

const FEATURES = [
  { icon: FileSearch, title: "Smart parsing", desc: "Extract skills, education, and experience from PDF or DOCX with real NLP." },
  { icon: Target, title: "ATS score", desc: "Match your resume against any job description with a 0–100 score and verdict." },
  { icon: Brain, title: "AI rewrite suggestions", desc: "Get specific, actionable improvements — not generic advice." },
  { icon: BarChart3, title: "Skill-gap analytics", desc: "See exactly which required skills you're missing or under-emphasizing." },
  { icon: ShieldCheck, title: "Private & secure", desc: "Your resumes are encrypted and only accessible to you." },
  { icon: Sparkles, title: "Free, forever", desc: "Every feature, every analysis, no paywalls." },
];

function Features() {
  return (
    <section id="features" className="mx-auto max-w-7xl px-6 py-24">
      <div className="text-center">
        <h2 className="text-4xl font-bold sm:text-5xl">Everything you need to <span className="gradient-text">stand out</span></h2>
        <p className="mx-auto mt-4 max-w-2xl text-muted-foreground">A complete toolkit for candidates and recruiters — built on real AI, not templates.</p>
      </div>
      <div className="mt-16 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {FEATURES.map((f) => (
          <div key={f.title} className="glass rounded-2xl p-6 transition hover:shadow-[var(--shadow-elevated)]">
            <div className="mb-4 inline-flex h-10 w-10 items-center justify-center rounded-lg bg-accent text-accent-foreground">
              <f.icon className="h-5 w-5" />
            </div>
            <h3 className="text-lg font-semibold">{f.title}</h3>
            <p className="mt-2 text-sm text-muted-foreground">{f.desc}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

const STEPS = [
  { icon: Upload, title: "Upload", desc: "Drop your resume — PDF, DOCX, or TXT." },
  { icon: Brain, title: "AI extracts", desc: "We parse skills, education, and experience automatically." },
  { icon: Target, title: "Match a JD", desc: "Paste any job description to get a tailored ATS score." },
  { icon: Sparkles, title: "Improve", desc: "Apply AI suggestions and watch your score climb." },
];

function HowItWorks() {
  return (
    <section id="how" className="bg-secondary/40 py-24">
      <div className="mx-auto max-w-7xl px-6">
        <div className="text-center">
          <h2 className="text-4xl font-bold sm:text-5xl">From upload to interview-ready</h2>
          <p className="mx-auto mt-4 max-w-2xl text-muted-foreground">Four steps. Real analysis. No fluff.</p>
        </div>
        <div className="mt-16 grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {STEPS.map((s, i) => (
            <div key={s.title} className="relative rounded-2xl border bg-card p-6">
              <div className="absolute -top-3 left-6 inline-flex h-6 w-6 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">{i + 1}</div>
              <s.icon className="mb-4 h-6 w-6 text-primary" />
              <h3 className="font-semibold">{s.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{s.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function CTA() {
  return (
    <section className="mx-auto max-w-5xl px-6 py-24">
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary to-primary/70 p-12 text-center text-primary-foreground shadow-[var(--shadow-glow)]">
        <h2 className="text-3xl font-bold sm:text-4xl">Your next role is one upload away.</h2>
        <p className="mx-auto mt-3 max-w-xl opacity-90">Free, fast, and brutally honest. Get your ATS score in under 10 seconds.</p>
        <Link to="/login">
          <Button size="lg" variant="secondary" className="mt-8 h-12 px-6">
            Start free <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </Link>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-6 py-8 text-sm text-muted-foreground">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" /> ResumeIQ
        </div>
        <div>© {new Date().getFullYear()} ResumeIQ. Built with AI.</div>
      </div>
    </footer>
  );
}
