import React, { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, BrainCircuit, BookOpen, CalendarDays, ChevronRight, FileText, Sparkles, Target, Users2, ShieldCheck, Loader2, AlertCircle, Layers3 } from "lucide-react";

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
  const [generating, setGenerating] = useState(false);

  const startResearch = async () => {
    if (!id) return;
    setGenerating(true);
    try {
      const token = localStorage.getItem("taskSchedulerToken");
      const resp = await fetch(`${API_BASE}/api/v1/sessions/${id}/research`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.message || "Failed to trigger Research Agent");
    } catch (e: any) {
      setError(e?.message || "Unable to start Research Agent");
      setGenerating(false);
    }
  };

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

  useEffect(() => {
    if (research) {
      setGenerating(false);
    }
  }, [research]);

  return (
    <div className="min-h-screen bg-slate-50 font-sans selection:bg-indigo-500/30">
      {/* Decorative Background Effects */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute top-0 left-0 w-full h-96 bg-gradient-to-b from-indigo-100/40 via-purple-50/20 to-transparent" />
        <div className="absolute -top-40 -right-40 w-96 h-96 bg-purple-400/20 rounded-full mix-blend-multiply filter blur-3xl opacity-70 animate-blob" />
        <div className="absolute top-20 -left-20 w-72 h-72 bg-indigo-400/20 rounded-full mix-blend-multiply filter blur-3xl opacity-70 animate-blob animation-delay-2000" />
      </div>

      {/* Header */}
      <header className="relative z-50 sticky top-0 bg-white/70 backdrop-blur-xl border-b border-white/20 shadow-[0_4px_30px_rgba(0,0,0,0.03)] px-6 lg:px-10 h-20 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate(`/dashboard/tasks/${id}`)}
            className="group flex items-center justify-center h-10 w-10 rounded-full bg-white shadow-sm border border-slate-200 hover:border-indigo-300 hover:shadow-indigo-100 transition-all duration-300"
          >
            <ArrowLeft className="h-4 w-4 text-slate-500 group-hover:text-indigo-600 transition-colors" />
          </button>
          <div className="hidden sm:flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-600 to-violet-600 text-white shadow-lg shadow-indigo-500/30">
              <BrainCircuit className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-900 tracking-tight leading-none mb-1">Research Report</h1>
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">Company + Role Intelligence</p>
            </div>
          </div>
        </div>

        <button
          onClick={() => navigate("/dashboard")}
          className="group inline-flex items-center gap-2 rounded-full bg-indigo-50/50 backdrop-blur-md border border-indigo-100 px-5 py-2.5 text-sm font-semibold text-indigo-700 hover:bg-indigo-100/50 transition-all duration-300"
        >
          Dashboard
          <ChevronRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
        </button>
      </header>

      <main className="relative z-10 p-6 lg:p-10 max-w-[1400px] mx-auto">
        {error && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="mb-8 rounded-2xl border border-red-200 bg-red-50/80 backdrop-blur-sm p-4 flex items-center gap-3 text-red-800 shadow-sm">
            <AlertCircle className="h-5 w-5 shrink-0" />
            <p className="text-sm font-medium">{error}</p>
          </motion.div>
        )}

        <div className="flex flex-col lg:flex-row gap-8">
          
          {/* Left Sidebar - Fixed */}
          <div className="w-full lg:w-[380px] shrink-0 flex flex-col gap-6 lg:sticky lg:top-28 lg:self-start">
            {loading && (
              <div className="rounded-3xl border border-white/50 bg-white/60 backdrop-blur-xl p-10 flex flex-col items-center justify-center h-64 shadow-sm">
                <Loader2 className="h-8 w-8 text-indigo-500 animate-spin mb-4" />
                <p className="text-sm text-slate-500">Loading intelligence...</p>
              </div>
            )}

            {!loading && research && (
              <motion.section
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.4 }}
                className="rounded-3xl border border-indigo-100 bg-gradient-to-br from-indigo-600 via-indigo-600 to-violet-700 p-7 text-white shadow-xl shadow-indigo-500/20"
              >
                <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-xs font-bold uppercase tracking-wider mb-5 shadow-sm">
                  <Sparkles className="h-3.5 w-3.5" />
                  AI Agent Output
                </div>
                
                <h2 className="text-2xl font-black tracking-tight mb-4">
                  {session?.company || "Target company"} <br/>
                  <span className="text-indigo-200 font-bold">as {session?.role || "Target role"}</span>
                </h2>
                
                <p className="text-sm text-indigo-100/90 leading-relaxed mb-4">
                  {research.companySummary}
                </p>
                <p className="text-sm text-indigo-100/90 leading-relaxed mb-6">
                  {research.roleSummary}
                </p>

                <div className="grid grid-cols-2 gap-3 mt-2">
                  <StatChip label="Company profile" value={research.companyProfile} />
                  <StatChip label="Role profile" value={research.roleProfile} />
                  <StatChip label="Topics" value={String(research.priorityTopics.length)} />
                  <StatChip label="Rounds" value={String(research.interviewRounds.length)} />
                </div>
              </motion.section>
            )}
          </div>

          {/* Right Main Panel - Scrollable content */}
          <div className="flex-1 flex flex-col gap-6">
            {!loading && !research && (
               <div className="flex flex-col items-center justify-center h-80 rounded-3xl border border-dashed border-slate-300 bg-white/40 backdrop-blur-md p-6">
                 <Sparkles className="h-12 w-12 text-indigo-400 mb-4 animate-pulse" />
                 <h3 className="text-lg font-bold text-slate-800 mb-2">Generate Company & Role Research</h3>
                 <p className="text-sm text-slate-500 text-center max-w-sm mb-6">
                   Trigger our specialized Research Agent to compile detailed preparation guidelines, interview rounds, and recent experience logs for this role.
                 </p>
                 <button
                   onClick={startResearch}
                   disabled={generating}
                   className="flex items-center gap-2 rounded-full bg-slate-900 px-6 py-3 font-bold text-white shadow-lg hover:bg-indigo-600 hover:shadow-indigo-500/25 transition-all duration-300 disabled:opacity-85"
                 >
                   {generating ? (
                     <>
                       <Loader2 className="h-4 w-4 animate-spin text-white" />
                       Research Agent working...
                     </>
                   ) : (
                     <>
                       <Sparkles className="h-4 w-4" />
                       Analyze Company & Role
                     </>
                   )}
                 </button>
               </div>
            )}

            {research && (
              <AnimatePresence>
                <div className="grid gap-6 lg:grid-cols-2">
                  <SectionCard title="Exact preparation guidelines" icon={<Target className="h-4 w-4" />} delay={0.1}>
                    <div className="space-y-3">
                      {research.prepGuidelines.map((item, idx) => (
                        <div key={idx} className="flex gap-3 rounded-2xl border border-slate-100 bg-slate-50/50 p-4 text-sm leading-relaxed text-slate-700 shadow-sm">
                          <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-indigo-500" />
                          <span>{item}</span>
                        </div>
                      ))}
                    </div>
                  </SectionCard>

                  <SectionCard title="Interview structure" icon={<CalendarDays className="h-4 w-4" />} delay={0.15}>
                    <div className="space-y-3">
                      {research.interviewRounds.map((round, index) => (
                        <div key={index} className="flex items-center gap-4 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
                          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-indigo-50 text-xs font-black text-indigo-600 border border-indigo-100">{index + 1}</span>
                          <span className="text-sm font-bold text-slate-700 capitalize">{round.replace(/-/g, " ")}</span>
                        </div>
                      ))}
                    </div>
                  </SectionCard>
                </div>

                <motion.section 
                  initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4, delay: 0.2 }}
                  className="rounded-3xl border border-white/60 bg-white/70 backdrop-blur-xl p-6 lg:p-8 shadow-[0_8px_30px_rgb(0,0,0,0.04)]"
                >
                  <div className="mb-6 flex items-center gap-2 text-sm font-bold uppercase tracking-widest text-slate-400">
                    <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-50 text-indigo-700 border border-indigo-100 shadow-sm"><BookOpen className="h-5 w-5" /></span>
                    Five month question trend
                  </div>
                  
                  <div className="grid gap-6">
                    {monthCards.map((month, idx) => (
                      <div key={idx} className="rounded-[1.5rem] border border-slate-200/60 bg-white/80 p-6 shadow-sm">
                        <div className="mb-5 flex flex-wrap items-center justify-between gap-4">
                          <div>
                            <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400 mb-1">{month.label}</div>
                            <div className="text-xl font-black text-slate-900 tracking-tight">{month.focus}</div>
                          </div>
                          <div className="rounded-full border border-indigo-100 bg-indigo-50/50 px-4 py-1.5 text-[10px] font-bold uppercase tracking-widest text-indigo-700 shadow-sm">
                            DSA / HR / System / Other
                          </div>
                        </div>

                        <div className="grid gap-4 lg:grid-cols-2">
                          <TopicList title="DSA questions" items={month.dsaQuestions} tone="emerald" />
                          <TopicList title="HR questions" items={month.hrQuestions} tone="indigo" />
                          <TopicList title="System design" items={month.systemDesignQuestions} tone="slate" />
                          <TopicList title="Other questions" items={month.otherQuestions} tone="amber" />
                        </div>

                        <div className="mt-5 rounded-2xl border border-slate-100 bg-slate-50/80 p-5 shadow-inner">
                          <div className="mb-3 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.2em] text-slate-500">
                            <ShieldCheck className="h-4 w-4 text-emerald-600" /> Interview experience notes
                          </div>
                          <ul className="space-y-2.5">
                            {month.interviewExperienceNotes.map((note, noteIdx) => (
                              <li key={noteIdx} className="flex gap-3 text-sm leading-relaxed text-slate-700">
                                <span className="mt-2 h-1 w-1 shrink-0 rounded-full bg-emerald-500" />
                                <span>{note}</span>
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    ))}
                  </div>
                </motion.section>

                <div className="grid gap-6 lg:grid-cols-[0.95fr_1.05fr]">
                  <SectionCard title="Interview experiences" icon={<Users2 className="h-4 w-4" />} delay={0.3}>
                    <div className="space-y-3">
                      {research.interviewExperiences.map((item, idx) => (
                        <div key={idx} className="rounded-2xl border border-slate-100 bg-white p-4 text-sm leading-relaxed text-slate-700 shadow-sm">
                          {item}
                        </div>
                      ))}
                    </div>
                  </SectionCard>

                  <SectionCard title="Source notes" icon={<FileText className="h-4 w-4" />} delay={0.35}>
                    <div className="space-y-3">
                      {research.sourceNotes.map((item, idx) => (
                        <div key={idx} className="rounded-2xl border border-slate-100 bg-slate-50/50 p-4 text-sm leading-relaxed text-slate-600 shadow-sm">
                          {item}
                        </div>
                      ))}
                    </div>
                  </SectionCard>
                </div>
              </AnimatePresence>
            )}
          </div>

        </div>
      </main>
    </div>
  );
}

function StatChip({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/10 p-3 backdrop-blur-md">
      <div className="text-[9px] font-bold uppercase tracking-widest text-indigo-100/70 mb-1">{label}</div>
      <div className="text-lg font-black text-white capitalize tracking-tight leading-none truncate">{value}</div>
    </div>
  );
}

function SectionCard({ title, icon, delay, children }: { title: string; icon: React.ReactNode; delay: number; children: React.ReactNode }) {
  return (
    <motion.section 
      initial={{ opacity: 0, y: 20 }} 
      animate={{ opacity: 1, y: 0 }} 
      transition={{ duration: 0.4, delay }}
      className="rounded-3xl border border-white/60 bg-white/70 backdrop-blur-xl p-6 lg:p-7 shadow-[0_8px_30px_rgb(0,0,0,0.04)]"
    >
      <div className="mb-5 flex items-center gap-3 text-xs font-bold uppercase tracking-[0.2em] text-slate-400">
        <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-50 text-indigo-700 border border-indigo-100 shadow-sm">{icon}</span>
        {title}
      </div>
      {children}
    </motion.section>
  );
}

function TopicList({ title, items, tone }: { title: string; items: string[]; tone: "emerald" | "indigo" | "slate" | "amber" }) {
  const toneMap = {
    emerald: "border-emerald-100 bg-emerald-50/50 text-emerald-900",
    indigo: "border-indigo-100 bg-indigo-50/50 text-indigo-900",
    slate: "border-slate-200 bg-slate-50/50 text-slate-900",
    amber: "border-amber-100 bg-amber-50/50 text-amber-900",
  };

  return (
    <div className={`rounded-2xl border p-4 shadow-sm ${toneMap[tone]}`}>
      <div className="mb-3 text-[10px] font-bold uppercase tracking-[0.2em] opacity-80">{title}</div>
      <ul className="space-y-2.5 text-sm font-medium">
        {items.map((item, idx) => (
          <li key={idx} className="flex items-start gap-2 rounded-xl bg-white/90 px-3 py-2.5 shadow-sm border border-black/5">
            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-current opacity-40" />
            <span className="leading-snug opacity-90">{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
