import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { format } from "date-fns";
import { 
  CheckCircle2, Loader2, Sparkles, ArrowLeft, BookOpen, 
  BrainCircuit, Layers3, BadgeCheck, ChevronRight, FileText,
  Clock, Target, AlertCircle
} from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";

type Task = {
  title: string;
  description?: string;
  resources?: string[];
  dueDate?: string;
  priority?: number;
  category?: string;
  estimatedMinutes?: number;
  focusArea?: string;
  agent?: string;
  contributors?: string[];
  subtopics?: string[];
  notes?: string[];
  commonMistakes?: string[];
  teachingPrompts?: string[];
  prepStatus?: "idle" | "running" | "completed" | "failed";
  prepSummary?: string;
  prepSteps?: string[];
};

type Session = {
  status: "pending" | "running" | "completed" | "failed";
  progress?: number;
  currentStep?: string;
  activityLog?: { stage: string; message: string; details?: string; createdAt?: string }[];
  tasks?: Task[];
};

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:5001";

export default function TaskSessionPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyIndex, setBusyIndex] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [generatingResearch, setGeneratingResearch] = useState(false);

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
        if (!resp.ok) throw new Error(data.message || "Unable to load tasks");
        if (mounted) {
          setSession(data.data);
          setError(null);
          setLoading(false);
        }
      } catch (e: any) {
        if (mounted) {
          setError(e?.message || "Unable to load tasks");
          setLoading(false);
        }
      }
    };
    load();
    const timer = window.setInterval(load, 4000);
    return () => {
      mounted = false;
      window.clearInterval(timer);
    };
  }, [id]);

  const tasks = session?.tasks ?? [];
  const sortedTasks = [...tasks].sort((left, right) => {
    const leftPriority = typeof left.priority === 'number' ? left.priority : 99;
    const rightPriority = typeof right.priority === 'number' ? right.priority : 99;
    if (leftPriority !== rightPriority) return leftPriority - rightPriority;
    const leftDue = left.dueDate ? new Date(left.dueDate).getTime() : Number.MAX_SAFE_INTEGER;
    const rightDue = right.dueDate ? new Date(right.dueDate).getTime() : Number.MAX_SAFE_INTEGER;
    return leftDue - rightDue;
  });
  
  const progress = session?.progress ?? 100;
  const totalMinutes = tasks.reduce((sum, task) => sum + (task.estimatedMinutes ?? 0), 0);
  
  const agentOneNote = session?.activityLog?.find((entry) => entry.stage === "agent-1-planner") ?? session?.activityLog?.find((entry) => entry.stage === "resume-signals");

  const prepareTask = async (taskIndex: number) => {
    if (!id) return;
    setBusyIndex(taskIndex);
    try {
      const token = localStorage.getItem("taskSchedulerToken");
      const resp = await fetch(`${API_BASE}/api/v1/sessions/${id}/tasks/${taskIndex}/preparation`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.message || "Unable to create task preparation");
      const result = data.data;
      setSession((prev) => {
        if (!prev) return prev;
        const nextTasks = [...(prev.tasks ?? [])];
        const existing = nextTasks[taskIndex];
        if (existing) {
          nextTasks[taskIndex] = {
            ...existing,
            prepStatus: result.prepStatus,
            prepSummary: result.prepSummary,
            prepSteps: result.prepSteps,
            subtopics: result.subtopics,
            notes: result.notes,
            commonMistakes: result.commonMistakes,
            teachingPrompts: result.teachingPrompts,
          };
        }
        return { ...prev, tasks: nextTasks };
      });
    } catch (e: any) {
      setError(e?.message || "Unable to prepare task");
    } finally {
      setBusyIndex(null);
    }
  };

  const startResearch = async () => {
    if (!id) return;
    setGeneratingResearch(true);
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
      
      // Poll the session until researchContext is present
      const checkTimer = setInterval(async () => {
        try {
          const checkResp = await fetch(`${API_BASE}/api/v1/sessions/${id}`, {
            headers: {
              ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
          });
          const checkData = await checkResp.json();
          if (checkResp.ok && checkData.data?.sharedContext?.researchContext) {
            clearInterval(checkTimer);
            setGeneratingResearch(false);
            navigate(`/dashboard/research/${id}`);
          } else if (checkResp.ok && checkData.data?.activityLog?.some((e: any) => e.stage === 'error' || e.stage === 'failed')) {
            clearInterval(checkTimer);
            setGeneratingResearch(false);
            setError("Research Agent failed to compile research. Please try again.");
          }
        } catch (err) {
          clearInterval(checkTimer);
          setGeneratingResearch(false);
        }
      }, 2000);
    } catch (e: any) {
      setError(e?.message || "Unable to start Research Agent");
      setGeneratingResearch(false);
    }
  };

  const handleResearchClick = () => {
    if (session?.sharedContext?.researchContext) {
      navigate(`/dashboard/research/${id}`);
    } else {
      startResearch();
    }
  };

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
            onClick={() => navigate("/dashboard")}
            className="group flex items-center justify-center h-10 w-10 rounded-full bg-white shadow-sm border border-slate-200 hover:border-indigo-300 hover:shadow-indigo-100 transition-all duration-300"
          >
            <ArrowLeft className="h-4 w-4 text-slate-500 group-hover:text-indigo-600 transition-colors" />
          </button>
          <div className="hidden sm:flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-600 to-violet-600 text-white shadow-lg shadow-indigo-500/30">
              <BrainCircuit className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-900 tracking-tight leading-none mb-1">Prep Workspace</h1>
              <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">AI-Curated Roadmap</p>
            </div>
          </div>
        </div>

        <button
          onClick={handleResearchClick}
          disabled={generatingResearch}
          className="group inline-flex items-center gap-2 rounded-full bg-indigo-50/50 backdrop-blur-md border border-indigo-100 px-5 py-2.5 text-sm font-semibold text-indigo-700 hover:bg-indigo-100/50 transition-all duration-300 disabled:opacity-80"
        >
          {generatingResearch ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin text-indigo-600 mr-1" />
              Compiling Insights...
            </>
          ) : (
            <>
              Research Report
              <ChevronRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
            </>
          )}
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
          
          {/* Left Sidebar - Overview & Agents */}
          <div className="w-full lg:w-[380px] shrink-0 flex flex-col gap-6 lg:sticky lg:top-28 lg:self-start">
            <motion.section
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.4 }}
              className="rounded-3xl border border-white/50 bg-white/60 backdrop-blur-xl p-7 shadow-[0_8px_30px_rgb(0,0,0,0.04)]"
            >
              <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200/50 bg-emerald-50/80 px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-emerald-700 mb-4 shadow-sm">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Roadmap Ready
              </div>
              <h2 className="text-2xl font-black tracking-tight text-slate-900 mb-2">Your Mission</h2>
              <p className="text-sm text-slate-500 leading-relaxed mb-6">
                A highly-tailored plan designed specifically for your target role. Expand tasks to dive into technical deep-dives and mock practices.
              </p>

              <div className="space-y-4">
                <div className="p-4 rounded-2xl bg-white/80 border border-slate-100 shadow-sm flex items-center justify-between">
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Total Progress</p>
                    <p className="text-2xl font-black text-indigo-950 mt-0.5">{Math.round(progress)}%</p>
                  </div>
                  <Target className="h-8 w-8 text-indigo-200" />
                </div>
                <Progress value={progress} className="h-2.5 bg-slate-100" />
                
                <div className="grid grid-cols-2 gap-4 mt-2">
                  <div className="p-4 rounded-2xl bg-white/80 border border-slate-100 shadow-sm">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Tasks</p>
                    <p className="text-xl font-bold text-slate-800 mt-1">{tasks.length}</p>
                  </div>
                  <div className="p-4 rounded-2xl bg-white/80 border border-slate-100 shadow-sm">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Est. Time</p>
                    <p className="text-xl font-bold text-slate-800 mt-1">{Math.round(totalMinutes / 60)}h {totalMinutes % 60}m</p>
                  </div>
                </div>
              </div>
            </motion.section>

            {/* AI Agents Panel */}
            <motion.section
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.4, delay: 0.1 }}
              className="rounded-3xl border border-white/50 bg-white/60 backdrop-blur-xl p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)] space-y-4"
            >
              <h3 className="text-sm font-bold uppercase tracking-widest text-slate-400 ml-1 mb-4">Active Agents</h3>
              
              <AgentSummaryRow 
                title="Planner Agent" 
                icon={<BadgeCheck className="h-4 w-4" />} 
                status={session?.status === 'completed' ? "Completed" : session?.status === 'failed' ? "Failed" : "Running"} 
                desc={agentOneNote?.message || "Synthesizing core task checklist."} 
                color="indigo" 
              />
              
              <AgentSummaryRow 
                title="Research Agent" 
                icon={<Sparkles className="h-4 w-4" />} 
                status={generatingResearch ? "Running" : session?.sharedContext?.researchContext ? "Completed" : "Idle"} 
                desc={generatingResearch ? "Analyzing interview patterns & rounds..." : session?.sharedContext?.researchContext ? "Company & role research compiled." : "On-demand company research agent."} 
                color="violet" 
              />
              
              <AgentSummaryRow 
                title="Depth Agent" 
                icon={<Layers3 className="h-4 w-4" />} 
                status={(busyIndex !== null || tasks.some(t => t.prepStatus === 'running')) ? "Running" : tasks.some(t => t.prepStatus === 'completed') ? "Active" : "Idle"} 
                desc={(busyIndex !== null || tasks.some(t => t.prepStatus === 'running')) ? "Expanding task details in real-time..." : tasks.some(t => t.prepStatus === 'completed') ? "Expanded detailed subtopics and notes." : "Real-time task subtopic compiler."} 
                color="emerald" 
              />
            </motion.section>
          </div>

          {/* Right Main Panel - Tasks List */}
          <div className="flex-1 flex flex-col gap-5">
            {loading && (
              <div className="flex flex-col items-center justify-center h-64 rounded-3xl border border-white/50 bg-white/40 backdrop-blur-md">
                <Loader2 className="h-8 w-8 text-indigo-500 animate-spin mb-4" />
                <p className="text-sm font-medium text-slate-500">Synthesizing your custom roadmap...</p>
              </div>
            )}
            
            {!loading && tasks.length === 0 && (
              <div className="flex flex-col items-center justify-center h-64 rounded-3xl border border-dashed border-slate-300 bg-white/40 backdrop-blur-md">
                <Target className="h-10 w-10 text-slate-300 mb-3" />
                <p className="text-sm font-medium text-slate-500">No tasks generated yet. Try creating a new plan.</p>
              </div>
            )}

            <AnimatePresence>
              {sortedTasks.map((task, index) => (
                <motion.div
                  key={`${task.title}-${index}`}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: index * 0.08 }}
                  className="group relative overflow-hidden rounded-3xl border border-white/60 bg-white/70 backdrop-blur-xl p-6 md:p-8 shadow-[0_8px_30px_rgb(0,0,0,0.04)] hover:shadow-[0_8px_40px_rgb(79,70,229,0.08)] transition-all duration-500"
                >
                  <div className="absolute top-0 left-0 w-2 h-full bg-gradient-to-b from-indigo-500 to-violet-500 opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                  
                  <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-6">
                    <div className="space-y-4 flex-1">
                      <div className="flex flex-wrap items-center gap-2.5">
                        <StatusBadge status={task.prepStatus ?? "idle"} />
                        {typeof task.priority === "number" && (
                          <span className="flex items-center gap-1 rounded-full bg-slate-900 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-white shadow-sm">
                            <Target className="h-3 w-3" /> P{task.priority}
                          </span>
                        )}
                        {task.category && (
                          <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-slate-600 shadow-sm">
                            {task.category}
                          </span>
                        )}
                        {task.agent && (
                          <span className="rounded-full bg-indigo-50 border border-indigo-100 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-indigo-700">
                            {task.agent}
                          </span>
                        )}
                      </div>
                      
                      <div>
                        <h3 className="text-xl md:text-2xl font-bold text-slate-900 tracking-tight mb-2">
                          {task.title}
                        </h3>
                        {task.description && (
                          <p className="text-sm leading-relaxed text-slate-600 max-w-3xl">
                            {task.description}
                          </p>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-4 text-xs font-semibold text-slate-500">
                        {typeof task.estimatedMinutes === "number" && (
                          <div className="flex items-center gap-1.5">
                            <Clock className="h-4 w-4 text-slate-400" />
                            {task.estimatedMinutes} mins
                          </div>
                        )}
                        {task.dueDate && (
                          <div className="flex items-center gap-1.5">
                            <div className="w-1.5 h-1.5 rounded-full bg-indigo-400" />
                            Due {format(new Date(task.dueDate), "MMM d, h:mm a")}
                          </div>
                        )}
                        {task.focusArea && (
                          <div className="flex items-center gap-1.5">
                            <div className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                            {task.focusArea}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="shrink-0 flex items-start">
                      <Button
                        onClick={() => prepareTask(index)}
                        disabled={busyIndex === index}
                        className="rounded-full bg-slate-900 px-6 py-5 font-bold text-white shadow-lg hover:bg-indigo-600 hover:shadow-indigo-500/25 transition-all duration-300 w-full lg:w-auto"
                      >
                        {busyIndex === index ? (
                          <>
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Synthesizing...
                          </>
                        ) : (
                          <>
                            <Sparkles className="mr-2 h-4 w-4" /> Deep Dive
                          </>
                        )}
                      </Button>
                    </div>
                  </div>

                  {/* Expanded Content: Prep Summary */}
                  {task.prepSummary && (
                    <motion.div 
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      className="mt-6 overflow-hidden rounded-2xl bg-indigo-50/50 border border-indigo-100 p-5 md:p-6"
                    >
                      <div className="flex items-center gap-2 text-sm font-bold text-indigo-900 mb-3">
                        <BookOpen className="h-4 w-4 text-indigo-600" /> Comprehensive Guide
                      </div>
                      <p className="text-sm leading-relaxed text-indigo-950/80 mb-5">{task.prepSummary}</p>
                      
                      {task.prepSteps?.length ? (
                        <div className="space-y-2.5">
                          {task.prepSteps.map((step, stepIndex) => (
                            <div key={stepIndex} className="flex gap-4 rounded-xl bg-white shadow-sm border border-indigo-50 p-3 items-start">
                              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-indigo-700 text-xs font-bold mt-0.5">
                                {stepIndex + 1}
                              </span>
                              <span className="text-sm text-slate-700 leading-relaxed pt-0.5">{step}</span>
                            </div>
                          ))}
                        </div>
                      ) : null}
                    </motion.div>
                  )}

                  {/* Expanded Content: Subtopics & Notes Grid */}
                  {(task.subtopics?.length || task.notes?.length || task.commonMistakes?.length || task.teachingPrompts?.length) ? (
                    <motion.div 
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="mt-6 grid gap-5 lg:grid-cols-2"
                    >
                      {task.subtopics?.length ? (
                        <div className="rounded-2xl border border-slate-200 bg-slate-50/50 p-5">
                          <div className="mb-4 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-slate-800">
                            <Layers3 className="h-4 w-4 text-indigo-500" /> Subtopics to Master
                          </div>
                          <ul className="space-y-2.5">
                            {task.subtopics.map((subtopic, idx) => (
                              <li key={idx} className="flex items-center gap-3 text-sm font-medium text-slate-600">
                                <div className="h-1.5 w-1.5 rounded-full bg-indigo-400 shrink-0" />
                                {subtopic}
                              </li>
                            ))}
                          </ul>
                        </div>
                      ) : null}

                      <div className="space-y-4">
                        {task.commonMistakes?.length ? (
                          <SupportCard title="Watch out for" icon="Alert" color="rose" items={task.commonMistakes} />
                        ) : null}
                        {task.teachingPrompts?.length ? (
                          <SupportCard title="Live Prep Prompts" icon="Sparkles" color="emerald" items={task.teachingPrompts} />
                        ) : null}
                        {task.notes?.length ? (
                          <SupportCard title="Coach Notes" icon="Book" color="indigo" items={task.notes} />
                        ) : null}
                      </div>
                    </motion.div>
                  ) : null}
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </div>
      </main>
    </div>
  );
}

// Subcomponents

function AgentSummaryRow({ title, icon, status, desc, color }: { title: string, icon: React.ReactNode, status: string, desc: string, color: "indigo"|"emerald"|"violet"|"amber" }) {
  const colorMap = {
    indigo: "bg-indigo-100 text-indigo-700",
    emerald: "bg-emerald-100 text-emerald-700",
    violet: "bg-violet-100 text-violet-700",
    amber: "bg-amber-100 text-amber-700",
  };
  
  return (
    <div className="flex items-start gap-4 p-3 rounded-2xl hover:bg-slate-50 transition-colors">
      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl shadow-sm ${colorMap[color]}`}>
        {icon}
      </div>
      <div>
        <div className="flex items-center gap-2 mb-1">
          <span className="font-bold text-slate-900 text-sm">{title}</span>
          <span className="text-[9px] font-bold uppercase tracking-widest text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">{status}</span>
        </div>
        <p className="text-xs text-slate-500 leading-tight">{desc}</p>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: "idle" | "running" | "completed" | "failed" }) {
  const maps = {
    idle: { bg: "bg-slate-100", text: "text-slate-600", border: "border-slate-200", label: "Pending" },
    running: { bg: "bg-amber-50", text: "text-amber-700", border: "border-amber-200", label: "Generating" },
    completed: { bg: "bg-emerald-50", text: "text-emerald-700", border: "border-emerald-200", label: "Prepared" },
    failed: { bg: "bg-rose-50", text: "text-rose-700", border: "border-rose-200", label: "Failed" },
  };
  const m = maps[status];
  return (
    <span className={`rounded-full border px-3 py-1 text-[10px] font-bold uppercase tracking-widest shadow-sm ${m.bg} ${m.text} ${m.border}`}>
      {m.label}
    </span>
  );
}

function SupportCard({ title, icon, color, items }: { title: string, icon: string, color: "indigo"|"rose"|"emerald", items: string[] }) {
  const colorMap = {
    indigo: "bg-indigo-50/50 border-indigo-100 text-indigo-900",
    rose: "bg-rose-50/50 border-rose-100 text-rose-900",
    emerald: "bg-emerald-50/50 border-emerald-100 text-emerald-900",
  };
  
  return (
    <div className={`rounded-2xl border p-4 shadow-sm ${colorMap[color]}`}>
      <div className="mb-3 text-[10px] font-bold uppercase tracking-widest opacity-80">{title}</div>
      <ul className="space-y-2 text-sm font-medium">
        {items.slice(0, 3).map((item, i) => (
          <li key={i} className="flex gap-2.5 items-start">
            <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-current opacity-50" />
            <span className="leading-snug opacity-90">{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}