import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { format } from "date-fns";
import { CheckCircle2, Circle, Loader2, Sparkles, Target, ArrowLeft, BookOpen, BrainCircuit, Clock3, Layers3, BadgeCheck, ChevronRight, FileText } from "lucide-react";
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
  const agentTwoNote = session?.activityLog?.find((entry) => entry.stage === "agent-2-topic-expansion") ?? session?.activityLog?.find((entry) => entry.stage === "task-blueprint-ready");
  const agentThreeNote = session?.activityLog?.find((entry) => entry.stage === "agent-3-resource-curation");
  const agentFourNote = session?.activityLog?.find((entry) => entry.stage === "agent-4-live-support");

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

  return (
    <div className="min-h-screen bg-[#f8fafe] text-slate-900 font-sans">
      <header className="h-20 bg-white border-b border-slate-200 flex items-center justify-between px-6 lg:px-10 sticky top-0 z-50">
        <button
          onClick={() => navigate("/dashboard")}
          className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-50"
        >
          <ArrowLeft className="h-4 w-4" />
          Dashboard
        </button>
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-md shadow-indigo-500/20">
            <BrainCircuit className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-lg font-extrabold tracking-tight text-slate-900">Generated Tasks</h1>
            <p className="text-[10px] font-bold uppercase tracking-[0.28em] text-slate-500">Full preparation workspace</p>
          </div>
        </div>
        <button
          onClick={() => navigate(`/dashboard/research/${id}`)}
          className="inline-flex items-center gap-2 rounded-full border border-indigo-200 bg-indigo-50 px-4 py-2 text-sm font-bold text-indigo-700 hover:bg-indigo-100"
        >
          Research report
          <ChevronRight className="h-4 w-4" />
        </button>
      </header>

      <main className="relative overflow-hidden p-6 lg:p-10">
        <div className="relative mx-auto max-w-7xl space-y-8">
          {error && <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-rose-700">{error}</div>}

          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.35 }}
            className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"
          >
            <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-bold uppercase tracking-[0.24em] text-emerald-700">
                  <CheckCircle2 className="h-4 w-4" />
                  Agent roadmap ready
                </div>
                <h2 className="mt-3 text-3xl font-black tracking-tight text-slate-900">Your interview study roadmap</h2>
                <p className="mt-2 max-w-2xl text-sm font-medium text-slate-500">
                  Planner, depth, resource, and support agents work together to turn your resume, role, company, deadline, and goal into a precise study plan.
                </p>
              </div>
              <div className="w-full md:w-72">
                <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-slate-400">
                  <span>Overall progress</span>
                  <span>{Math.round(progress)}%</span>
                </div>
                <Progress value={progress} className="mt-2 h-2" />
              </div>
            </div>
          </motion.section>

          <div className="grid gap-4 lg:grid-cols-3">
            <Metric label="Tasks" value={String(tasks.length)} />
            <Metric label="Prepared" value={String(tasks.filter((task) => task.prepStatus === "completed").length)} />
            <Metric label="Total focus time" value={`${Math.round(totalMinutes / 60)}h ${totalMinutes % 60}m`} />
          </div>

          <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-4">
            <AgentSummaryCard
              title="Planner Agent"
              icon={<BadgeCheck className="h-4 w-4" />}
              tone="indigo"
              message={agentOneNote?.message || "This agent ranks the strongest topics from your resume, company, role, and goal."}
              details={agentOneNote?.details || "It produces the priority order and rough time budget for the roadmap."}
            />
            <AgentSummaryCard
              title="Depth Agent"
              icon={<Layers3 className="h-4 w-4" />}
              tone="emerald"
              message={agentTwoNote?.message || "This agent expands each task into subtopics, notes, and learning checkpoints."}
              details={agentTwoNote?.details || "Each topic gets a deeper map so the user knows exactly what to cover."}
            />
            <AgentSummaryCard
              title="Resource Agent"
              icon={<FileText className="h-4 w-4" />}
              tone="indigo"
              message={agentThreeNote?.message || "This agent attaches useful references, examples, and study material to each task."}
              details={agentThreeNote?.details || "It curates resources that match the topic depth and the target role."}
            />
            <AgentSummaryCard
              title="Support Agent"
              icon={<Sparkles className="h-4 w-4" />}
              tone="emerald"
              message={agentFourNote?.message || "This agent creates live teaching prompts for when the user gets stuck."}
              details={agentFourNote?.details || "It keeps the workflow interactive with quick questions and guidance cues."}
            />
          </div>

          <div className="grid gap-4">
            {loading && <div className="rounded-2xl border border-slate-200 bg-white p-10 text-center text-slate-500">Loading tasks…</div>}
            {!loading && tasks.length === 0 && <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-10 text-center text-slate-500">No tasks were generated.</div>}
            {sortedTasks.map((task, index) => (
              <motion.div
                key={`${task.title}-${index}`}
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, delay: index * 0.05 }}
                className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm"
              >
                <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                  <div className="space-y-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-xl font-extrabold text-slate-900">{task.title}</h3>
                      {typeof task.priority === "number" && <span className="rounded-full bg-indigo-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-indigo-700">P{task.priority}</span>}
                      {task.category && <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest text-slate-600">{task.category}</span>}
                      <StatusPill status={task.prepStatus ?? "idle"} />
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-xs font-bold uppercase tracking-[0.22em] text-slate-400">
                      {task.focusArea ? <span className="rounded-full bg-amber-50 px-2.5 py-1 text-amber-700">{task.focusArea}</span> : null}
                      {typeof task.estimatedMinutes === "number" ? <span className="rounded-full bg-cyan-50 px-2.5 py-1 text-cyan-700">{task.estimatedMinutes} min</span> : null}
                      {task.agent ? <span className="rounded-full bg-emerald-50 px-2.5 py-1 text-emerald-700">{task.agent}</span> : null}
                    </div>
                    {task.description && <p className="max-w-3xl text-sm leading-6 text-slate-600">{task.description}</p>}
                    {task.resources?.length ? <p className="text-xs font-medium uppercase tracking-[0.22em] text-slate-400">{task.resources.length} starter resources attached</p> : null}
                    {task.dueDate && <p className="text-xs font-medium text-slate-400">Due {format(new Date(task.dueDate), "EEE, MMM d • h:mm a")}</p>}
                  </div>

                  <Button
                    onClick={() => prepareTask(index)}
                    disabled={busyIndex === index}
                    className="rounded-full bg-slate-900 px-5 py-2 font-bold text-white hover:bg-slate-800"
                  >
                    {busyIndex === index ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Preparing…
                      </>
                    ) : (
                      <>
                        <Sparkles className="mr-2 h-4 w-4" /> Expand this topic
                      </>
                    )}
                  </Button>
                </div>

                {task.prepSummary && (
                  <div className="mt-5 rounded-2xl border border-indigo-100 bg-indigo-50/60 p-4">
                    <div className="mb-2 flex items-center gap-2 text-sm font-bold text-indigo-900">
                      <BookOpen className="h-4 w-4" /> Full preparation
                    </div>
                    <p className="text-sm leading-6 text-indigo-950/80">{task.prepSummary}</p>
                    {task.prepSteps?.length ? (
                      <ol className="mt-4 space-y-2 text-sm text-indigo-950/80">
                        {task.prepSteps.map((step, stepIndex) => (
                          <li key={stepIndex} className="flex gap-3 rounded-xl bg-white/80 px-3 py-2">
                            <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-[10px] font-black text-white">{stepIndex + 1}</span>
                            <span>{step}</span>
                          </li>
                        ))}
                      </ol>
                    ) : null}
                  </div>
                )}

                {task.subtopics?.length ? (
                  <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4">
                    <div className="mb-2 flex items-center gap-2 text-sm font-bold text-slate-900">
                      <Layers3 className="h-4 w-4" /> Deep dive topics
                    </div>
                    <div className="space-y-2">
                      {task.subtopics.map((subtopic, subtopicIndex) => (
                        <div key={subtopic} className="flex items-start gap-3 rounded-xl bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-700">
                          <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-[10px] font-black text-white">{subtopicIndex + 1}</span>
                          <span>{subtopic}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : null}

                {task.notes?.length || task.commonMistakes?.length || task.teachingPrompts?.length ? (
                  <div className="mt-4 grid gap-3 lg:grid-cols-3">
                    {task.notes?.length ? (
                      <SupportCard title="Coach notes" tone="indigo" items={task.notes} />
                    ) : null}
                    {task.commonMistakes?.length ? (
                      <SupportCard title="Common mistakes" tone="rose" items={task.commonMistakes} />
                    ) : null}
                    {task.teachingPrompts?.length ? (
                      <SupportCard title="Live teaching prompts" tone="emerald" items={task.teachingPrompts} />
                    ) : null}
                  </div>
                ) : null}

                {task.contributors?.length ? (
                  <div className="mt-4 flex flex-wrap items-center gap-2 text-xs font-bold uppercase tracking-[0.22em] text-slate-400">
                    <span>Contributors</span>
                    {task.contributors.map((contributor) => (
                      <span key={contributor} className="rounded-full bg-slate-100 px-2.5 py-1 text-slate-600">
                        {contributor}
                      </span>
                    ))}
                  </div>
                ) : null}
              </motion.div>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}

function AgentSummaryCard({
  title,
  icon,
  tone,
  message,
  details,
}: {
  title: string;
  icon: React.ReactNode;
  tone: "indigo" | "emerald";
  message: string;
  details: string;
}) {
  const toneClasses = tone === "indigo"
    ? "border-indigo-200 bg-indigo-50/70 text-indigo-900"
    : "border-emerald-200 bg-emerald-50/70 text-emerald-900";

  return (
    <div className={`rounded-3xl border p-5 shadow-sm ${toneClasses}`}>
      <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.24em]">
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/80">{icon}</span>
        {title}
      </div>
      <p className="mt-3 text-sm font-semibold leading-6">{message}</p>
      <p className="mt-2 text-sm leading-6 opacity-80">{details}</p>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="text-[10px] font-bold uppercase tracking-[0.25em] text-slate-400">{label}</div>
      <div className="mt-2 text-2xl font-black tracking-tight text-slate-900">{value}</div>
    </div>
  );
}

function StatusPill({ status }: { status: "idle" | "running" | "completed" | "failed" }) {
  const classes = {
    idle: "bg-slate-100 text-slate-600",
    running: "bg-amber-50 text-amber-700",
    completed: "bg-emerald-50 text-emerald-700",
    failed: "bg-rose-50 text-rose-700",
  }[status];

  return <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-widest ${classes}`}>{status}</span>;
}

function SupportCard({ title, tone, items }: { title: string; tone: "indigo" | "emerald" | "rose"; items: string[] }) {
  const toneClasses = {
    indigo: "border-indigo-100 bg-indigo-50/60 text-indigo-950",
    emerald: "border-emerald-100 bg-emerald-50/60 text-emerald-950",
    rose: "border-rose-100 bg-rose-50/60 text-rose-950",
  }[tone];

  return (
    <div className={`rounded-2xl border p-4 ${toneClasses}`}>
      <div className="mb-3 text-sm font-bold uppercase tracking-[0.22em]">{title}</div>
      <ul className="space-y-2 text-sm leading-6 opacity-90">
        {items.slice(0, 5).map((item) => (
          <li key={item} className="rounded-xl bg-white/80 px-3 py-2">
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}