import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, BrainCircuit, BookOpen, CalendarDays, ChevronRight, FileText, Sparkles, Target, Users2, ShieldCheck } from "lucide-react";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:5001";

type ResearchMonth = {
  label: string;
  focus: string;
  dsaQuestions: string[];
  hrQuestions: string[];
  systemDesignQuestions: string[];
  otherQuestions: string[];
  interviewExperienceNotes: string[];
};

type ResearchContext = {
  companyProfile: string;
  roleProfile: string;
  companySummary: string;
  roleSummary: string;
  prepGuidelines: string[];
  priorityTopics: string[];
  interviewRounds: string[];
  interviewExperiences: string[];
  fiveMonthQuestionTrend: ResearchMonth[];
  sourceNotes: string[];
};

type Session = {
  company?: string;
  role?: string;
  sharedContext?: {
    researchContext?: ResearchContext;
  };
};

export default function ResearchPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    let mounted = true;
    const load = async () => {
      try {
        const token = localStorage.getItem("taskSchedulerToken");
        const resp = await fetch(`${API_BASE}/api/v1/sessions/${id}`, {
          headers: {
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
        });
        const data = await resp.json();
        if (!resp.ok) throw new Error(data.message || "Unable to load research report");
        if (mounted) {
          setSession(data.data);
          setError(null);
          setLoading(false);
        }
      } catch (e: any) {
        if (mounted) {
          setError(e?.message || "Unable to load research report");
          setLoading(false);
        }
      }
    };
    load();
    const timer = window.setInterval(load, 5000);
    return () => {
      mounted = false;
      window.clearInterval(timer);
    };
  }, [id]);

  const research = session?.sharedContext?.researchContext;
  const monthCards = useMemo(() => research?.fiveMonthQuestionTrend || [], [research]);

  return (
    <div className="min-h-screen bg-[#f7f9ff] text-slate-900">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/85 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-3 px-6 py-4 lg:px-10">
          <button
            onClick={() => navigate(`/dashboard/tasks/${id}`)}
            className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to tasks
          </button>
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-md shadow-indigo-500/20">
              <BrainCircuit className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-lg font-extrabold tracking-tight text-slate-900">Research Report</h1>
              <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-slate-500">Company + role intelligence</p>
            </div>
          </div>
          <button
            onClick={() => navigate("/dashboard")}
            className="inline-flex items-center gap-2 rounded-full border border-indigo-200 bg-indigo-50 px-4 py-2 text-sm font-bold text-indigo-700 hover:bg-indigo-100"
          >
            Dashboard
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-8 lg:px-10 lg:py-10">
        {error && <div className="mb-6 rounded-2xl border border-rose-200 bg-rose-50 p-4 text-rose-700">{error}</div>}

        {loading && <div className="rounded-3xl border border-slate-200 bg-white p-10 text-center text-slate-500">Loading research report…</div>}

        {!loading && research && (
          <div className="space-y-8">
            <motion.section initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} className="overflow-hidden rounded-[2rem] border border-indigo-100 bg-gradient-to-br from-indigo-600 via-indigo-600 to-blue-700 p-8 text-white shadow-xl shadow-indigo-500/20">
              <div className="flex flex-col gap-8 lg:flex-row lg:items-end lg:justify-between">
                <div className="max-w-3xl">
                  <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-bold uppercase tracking-[0.24em]">
                    <Sparkles className="h-4 w-4" /> Research agent output
                  </div>
                  <h2 className="text-3xl font-black tracking-tight md:text-4xl">{session?.company || "Target company"} - {session?.role || "Target role"}</h2>
                  <p className="mt-3 max-w-2xl text-sm leading-6 text-indigo-100 md:text-base">
                    {research.companySummary}
                  </p>
                  <p className="mt-2 max-w-2xl text-sm leading-6 text-indigo-100/90">
                    {research.roleSummary}
                  </p>
                </div>
                <div className="grid gap-3 sm:grid-cols-2 lg:min-w-[320px]">
                  <StatChip label="Company profile" value={research.companyProfile} />
                  <StatChip label="Role profile" value={research.roleProfile} />
                  <StatChip label="Priority topics" value={String(research.priorityTopics.length)} />
                  <StatChip label="Interview rounds" value={String(research.interviewRounds.length)} />
                </div>
              </div>
            </motion.section>

            <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
              <SectionCard title="Exact preparation guidelines" icon={<Target className="h-4 w-4" />}>
                <div className="space-y-3">
                  {research.prepGuidelines.map((item) => (
                    <div key={item} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-700">
                      {item}
                    </div>
                  ))}
                </div>
              </SectionCard>

              <SectionCard title="Interview structure" icon={<CalendarDays className="h-4 w-4" />}>
                <div className="space-y-3">
                  {research.interviewRounds.map((round, index) => (
                    <div key={round} className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-4 py-3">
                      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-indigo-600 text-[10px] font-black text-white">{index + 1}</span>
                      <span className="text-sm font-semibold text-slate-700 capitalize">{round.replace(/-/g, " ")}</span>
                    </div>
                  ))}
                </div>
              </SectionCard>
            </div>

            <SectionCard title="Five month question trend" icon={<BookOpen className="h-4 w-4" />}>
              <div className="grid gap-5">
                {monthCards.map((month) => (
                  <div key={month.label} className="rounded-[1.5rem] border border-slate-200 bg-white p-5 shadow-sm">
                    <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                      <div>
                        <div className="text-xs font-bold uppercase tracking-[0.22em] text-slate-400">{month.label}</div>
                        <div className="mt-1 text-lg font-black text-slate-900">{month.focus}</div>
                      </div>
                      <div className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-bold uppercase tracking-[0.2em] text-indigo-700">DSA / HR / System / Other</div>
                    </div>

                    <div className="grid gap-4 lg:grid-cols-2">
                      <TopicList title="DSA questions" items={month.dsaQuestions} tone="emerald" />
                      <TopicList title="HR questions" items={month.hrQuestions} tone="indigo" />
                      <TopicList title="System design questions" items={month.systemDesignQuestions} tone="slate" />
                      <TopicList title="Other questions" items={month.otherQuestions} tone="amber" />
                    </div>

                    <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <div className="mb-2 text-xs font-bold uppercase tracking-[0.22em] text-slate-400">Interview experience notes</div>
                      <ul className="space-y-2 text-sm leading-6 text-slate-700">
                        {month.interviewExperienceNotes.map((note) => (
                          <li key={note} className="flex gap-3 rounded-xl bg-white px-3 py-2">
                            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                            <span>{note}</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                ))}
              </div>
            </SectionCard>

            <div className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
              <SectionCard title="Interview experiences" icon={<Users2 className="h-4 w-4" />}>
                <div className="space-y-3">
                  {research.interviewExperiences.map((item) => (
                    <div key={item} className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm leading-6 text-slate-700">
                      {item}
                    </div>
                  ))}
                </div>
              </SectionCard>

              <SectionCard title="Source notes" icon={<FileText className="h-4 w-4" />}>
                <div className="space-y-3">
                  {research.sourceNotes.map((item) => (
                    <div key={item} className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm leading-6 text-slate-700">
                      {item}
                    </div>
                  ))}
                </div>
              </SectionCard>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

function StatChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/20 bg-white/10 p-4 backdrop-blur-sm">
      <div className="text-[10px] font-bold uppercase tracking-[0.24em] text-indigo-100/80">{label}</div>
      <div className="mt-1 text-lg font-black capitalize">{value}</div>
    </div>
  );
}

function SectionCard({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <motion.section initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} className="rounded-[2rem] border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-5 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.24em] text-slate-400">
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-50 text-indigo-700">{icon}</span>
        {title}
      </div>
      {children}
    </motion.section>
  );
}

function TopicList({ title, items, tone }: { title: string; items: string[]; tone: "emerald" | "indigo" | "slate" | "amber" }) {
  const toneClasses = {
    emerald: "border-emerald-100 bg-emerald-50 text-emerald-900",
    indigo: "border-indigo-100 bg-indigo-50 text-indigo-900",
    slate: "border-slate-200 bg-slate-50 text-slate-900",
    amber: "border-amber-100 bg-amber-50 text-amber-900",
  }[tone];

  return (
    <div className={`rounded-2xl border p-4 ${toneClasses}`}>
      <div className="mb-3 text-xs font-bold uppercase tracking-[0.22em] opacity-70">{title}</div>
      <ul className="space-y-2 text-sm leading-6">
        {items.map((item) => (
          <li key={item} className="rounded-xl bg-white/80 px-3 py-2 shadow-sm">{item}</li>
        ))}
      </ul>
    </div>
  );
}
