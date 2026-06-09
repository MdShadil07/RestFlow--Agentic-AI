import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { format } from "date-fns";
import { 
  LayoutDashboard, CheckSquare, CalendarDays, BarChart3, 
  Settings, Bell, Search, Menu, X, Plus, Trash2,
  BrainCircuit, Layers3, BadgeCheck, ChevronRight, BookOpen,
  Clock, Target, AlertCircle, Sparkles, Loader2
} from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:5001";

export default function TasksPage() {
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  
  const [sessions, setSessions] = useState<any[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const [busyIndex, setBusyIndex] = useState<number | null>(null);
  const [generatingResearch, setGeneratingResearch] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem("taskSchedulerToken");
    if (!token) {
      navigate("/login");
      return;
    }
    loadAllSessions();
  }, [navigate]);

  const loadAllSessions = async (selectId?: string) => {
    try {
      const token = localStorage.getItem("taskSchedulerToken");
      const resp = await fetch(`${API_BASE}/api/v1/sessions`, {
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
      const data = await resp.json();
      if (resp.ok) {
        const list = data.data || [];
        setSessions(list);
        if (list.length > 0) {
          setSelectedSessionId(selectId && list.some((s: any) => s._id === selectId) ? selectId : list[0]._id);
        }
      } else {
        throw new Error(data.message || "Failed to retrieve sessions");
      }
    } catch (err: any) {
      setError(err.message || "Something went wrong loading sessions");
    } finally {
      setLoading(false);
    }
  };

  const selectSession = (sid: string) => {
    setSelectedSessionId(sid);
  };

  const handleDeleteSession = async (sid: string) => {
    const confirmDelete = window.confirm("Are you sure you want to delete this session?");
    if (!confirmDelete) return;

    try {
      const token = localStorage.getItem("taskSchedulerToken");
      const resp = await fetch(`${API_BASE}/api/v1/sessions/${sid}`, {
        method: "DELETE",
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.message || "Failed to delete session");
      
      setSessions(prev => {
        const remaining = prev.filter(s => s._id !== sid);
        if (sid === selectedSessionId) {
          setSelectedSessionId(remaining.length > 0 ? remaining[0]._id : null);
        }
        return remaining;
      });
    } catch (err: any) {
      alert(err.message || "Unable to delete session");
    }
  };

  const selectedSession = sessions.find(s => s._id === selectedSessionId) || null;
  const tasks = selectedSession?.tasks ?? [];

  const sortedTasks = [...tasks].sort((left, right) => {
    const leftPriority = typeof left.priority === 'number' ? left.priority : 99;
    const rightPriority = typeof right.priority === 'number' ? right.priority : 99;
    if (leftPriority !== rightPriority) return leftPriority - rightPriority;
    const leftDue = left.dueDate ? new Date(left.dueDate).getTime() : Number.MAX_SAFE_INTEGER;
    const rightDue = right.dueDate ? new Date(right.dueDate).getTime() : Number.MAX_SAFE_INTEGER;
    return leftDue - rightDue;
  });
  
  const progress = selectedSession?.progress ?? 0;
  const totalMinutes = tasks.reduce((sum: number, task: any) => sum + (task.estimatedMinutes ?? 0), 0);
  const agentOneNote = selectedSession?.activityLog?.find((entry: any) => entry.stage === "agent-1-planner") ?? selectedSession?.activityLog?.find((entry: any) => entry.stage === "resume-signals");

  const prepareTask = async (taskIndex: number) => {
    if (!selectedSessionId) return;
    setBusyIndex(taskIndex);
    try {
      const token = localStorage.getItem("taskSchedulerToken");
      const resp = await fetch(`${API_BASE}/api/v1/sessions/${selectedSessionId}/tasks/${taskIndex}/preparation`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.message || "Unable to create task preparation");
      const result = data.data;
      setSessions((prev) => prev.map(s => {
        if (s._id !== selectedSessionId) return s;
        const nextTasks = [...(s.tasks ?? [])];
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
        return { ...s, tasks: nextTasks };
      }));
    } catch (e: any) {
      alert(e?.message || "Unable to prepare task");
    } finally {
      setBusyIndex(null);
    }
  };

  const startResearch = async () => {
    if (!selectedSessionId) return;
    setGeneratingResearch(true);
    try {
      const token = localStorage.getItem("taskSchedulerToken");
      const resp = await fetch(`${API_BASE}/api/v1/sessions/${selectedSessionId}/research`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.message || "Failed to trigger Research Agent");
      
      // Poll
      const checkTimer = setInterval(async () => {
        try {
          const checkResp = await fetch(`${API_BASE}/api/v1/sessions/${selectedSessionId}`, {
            headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
          });
          const checkData = await checkResp.json();
          if (checkResp.ok && checkData.data?.sharedContext?.researchContext) {
            clearInterval(checkTimer);
            setGeneratingResearch(false);
            navigate(`/dashboard/research/${selectedSessionId}`);
          } else if (checkResp.ok && checkData.data?.activityLog?.some((e: any) => e.stage === 'error' || e.stage === 'failed')) {
            clearInterval(checkTimer);
            setGeneratingResearch(false);
            alert("Research Agent failed to compile research. Please try again.");
          }
        } catch (err) {
          clearInterval(checkTimer);
          setGeneratingResearch(false);
        }
      }, 2000);
    } catch (e: any) {
      alert(e?.message || "Unable to start Research Agent");
      setGeneratingResearch(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#f8fafe] text-slate-900 font-sans flex overflow-hidden">
      {/* SIDEBAR */}
      <aside className={`fixed inset-y-0 left-0 z-50 w-64 bg-white border-r border-slate-200 transform transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static lg:block flex flex-col ${sidebarOpen ? "translate-x-0" : "-translate-x-full"}`}>
        <div className="h-20 flex items-center px-6 border-b border-slate-100 justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white shadow-md shadow-indigo-500/20">
              <BrainCircuit className="w-4 h-4" />
            </div>
            <span className="font-extrabold text-xl tracking-tight text-[#0f172a]">AgentFlow</span>
          </div>
          <button className="lg:hidden text-slate-400 hover:text-slate-600" onClick={() => setSidebarOpen(false)}>
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto py-6 px-4 space-y-1">
          <p className="px-4 text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 mt-4">Menu</p>
          <button onClick={() => navigate("/dashboard")} className="w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all text-slate-500 hover:bg-slate-50 hover:text-slate-900 font-semibold">
            <LayoutDashboard className="w-5 h-5 text-slate-400" /> Dashboard
          </button>
          <button className="w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all bg-indigo-50 text-indigo-700 font-bold">
            <CheckSquare className="w-5 h-5 text-indigo-600" /> Tasks
          </button>
          <button onClick={() => navigate("/dashboard/roadmap")} className="w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all text-slate-500 hover:bg-slate-50 hover:text-slate-900 font-semibold">
            <Layers3 className="w-5 h-5 text-slate-400" /> Roadmap
          </button>
          <button className="w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all text-slate-500 hover:bg-slate-50 hover:text-slate-900 font-semibold">
            <CalendarDays className="w-5 h-5 text-slate-400" /> Calendar
          </button>
          <button className="w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all text-slate-500 hover:bg-slate-50 hover:text-slate-900 font-semibold">
            <BarChart3 className="w-5 h-5 text-slate-400" /> Analytics
          </button>
        </div>
      </aside>

      {/* MAIN CONTENT */}
      <main className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden relative">
        <header className="h-20 bg-white/80 backdrop-blur-md border-b border-slate-200/50 flex items-center justify-between px-6 lg:px-10 z-20 sticky top-0 shrink-0">
          <div className="flex items-center gap-4">
            <button className="lg:hidden text-slate-500 hover:text-slate-800" onClick={() => setSidebarOpen(true)}>
              <Menu className="w-6 h-6" />
            </button>
            <h2 className="text-xl font-extrabold text-slate-900 hidden sm:block">Tasks Explorer</h2>
          </div>
          <div className="flex items-center gap-4">
            {selectedSession && (
              <button
                onClick={() => {
                  if (selectedSession?.sharedContext?.researchContext) {
                    navigate(`/dashboard/research/${selectedSessionId}`);
                  } else {
                    startResearch();
                  }
                }}
                disabled={generatingResearch}
                className="group inline-flex items-center gap-2 rounded-full bg-indigo-50/50 backdrop-blur-md border border-indigo-100 px-5 py-2.5 text-sm font-semibold text-indigo-700 hover:bg-indigo-100/50 transition-all duration-300 disabled:opacity-80"
              >
                {generatingResearch ? (
                  <><Loader2 className="h-4 w-4 animate-spin text-indigo-600 mr-1" /> Compiling Insights...</>
                ) : (
                  <>Research Report <ChevronRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" /></>
                )}
              </button>
            )}
          </div>
        </header>

        <div className="flex-1 overflow-hidden flex flex-col md:flex-row relative z-10">
          {/* Left Session Pane */}
          <div className="w-full md:w-80 border-r border-slate-200 bg-white/40 backdrop-blur-md flex flex-col shrink-0">
            <div className="p-5 border-b border-slate-100">
              <h3 className="text-sm font-bold uppercase tracking-widest text-slate-400 mb-3">Your Sessions</h3>
            </div>
            
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {loading ? (
                <div className="flex items-center justify-center py-8 text-slate-400"><Loader2 className="w-6 h-6 animate-spin text-indigo-600 mr-2" /></div>
              ) : sessions.length === 0 ? (
                <div className="text-center py-8 text-slate-400 text-xs font-semibold">No active sessions found.</div>
              ) : (
                sessions.map((s) => {
                  const active = s._id === selectedSessionId;
                  const dateLabel = s.createdAt ? new Date(s.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric" }) : "Recently";
                  return (
                    <button
                      key={s._id}
                      onClick={() => selectSession(s._id)}
                      className={`w-full text-left p-4 rounded-2xl border transition-all duration-300 relative group ${active ? "bg-white border-indigo-300 shadow-md" : "bg-white/70 border-slate-100 hover:bg-white"}`}
                    >
                      <div className={`absolute left-0 top-0 bottom-0 w-1 ${s.status === "completed" ? "bg-emerald-500" : s.status === "failed" ? "bg-rose-500" : "bg-amber-500"}`} />
                      <div className="flex justify-between items-start gap-2 pl-2">
                        <div className="min-w-0 pr-1 flex-1">
                          <h4 className={`text-sm font-extrabold truncate ${active ? "text-indigo-700" : "text-slate-900"}`}>{s.role || "Custom Tasks"}</h4>
                          <p className="text-[11px] font-semibold text-slate-400 truncate mt-0.5">{s.company ? `at ${s.company}` : "Personal Goal"}</p>
                        </div>
                        <div className="flex flex-col items-end gap-1 shrink-0">
                          <span className="text-[9px] font-bold text-slate-400">{dateLabel}</span>
                        </div>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>

          {/* Right Workspace Pane */}
          <div className="flex-1 overflow-auto p-6 flex relative min-h-0 bg-[#f8fafe]/30">
            {!selectedSession ? (
              <div className="flex-1 flex flex-col items-center justify-center text-center p-6">
                <Target className="w-10 h-10 text-slate-300 mb-3" />
                <h3 className="font-extrabold text-lg text-slate-900">Select a Session</h3>
              </div>
            ) : (
              <div className="max-w-5xl mx-auto w-full space-y-6">
                {/* Dashboard Stats */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div className="col-span-1 md:col-span-1 rounded-3xl border border-white/50 bg-white/60 backdrop-blur-xl p-7 shadow-sm">
                    <h2 className="text-xl font-black tracking-tight text-slate-900 mb-2">Mission Progress</h2>
                    <Progress value={progress} className="h-2.5 bg-slate-100 mb-4" />
                    <div className="flex justify-between text-xs font-bold text-slate-500">
                      <span>{tasks.length} Tasks</span>
                      <span>{Math.round(totalMinutes / 60)}h {totalMinutes % 60}m</span>
                    </div>
                  </div>
                  <div className="col-span-1 md:col-span-2 rounded-3xl border border-white/50 bg-white/60 backdrop-blur-xl p-6 shadow-sm">
                    <h3 className="text-sm font-bold uppercase tracking-widest text-slate-400 mb-3">AI Agents</h3>
                    <div className="flex flex-col sm:flex-row gap-4">
                      <AgentSummaryRow title="Planner" status={selectedSession?.status} />
                      <AgentSummaryRow title="Research" status={generatingResearch ? "running" : selectedSession?.sharedContext?.researchContext ? "completed" : "idle"} />
                      <AgentSummaryRow title="Depth" status="active" />
                    </div>
                  </div>
                </div>

                {/* Tasks List */}
                <div className="space-y-5">
                  <AnimatePresence>
                    {sortedTasks.map((task, index) => (
                      <motion.div
                        key={`${task.title}-${index}`}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="group relative overflow-hidden rounded-3xl border border-white/60 bg-white/70 backdrop-blur-xl p-6 shadow-sm hover:shadow-md transition-all"
                      >
                        <div className="flex flex-col lg:flex-row lg:items-start justify-between gap-6">
                          <div className="space-y-3 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <StatusBadge status={task.prepStatus ?? "idle"} />
                              {task.category && <span className="rounded-full border bg-white px-3 py-1 text-[10px] font-bold uppercase tracking-widest">{task.category}</span>}
                            </div>
                            <div>
                              <h3 className="text-lg font-bold text-slate-900">{task.title}</h3>
                              {task.description && <p className="text-sm text-slate-600 mt-1">{task.description}</p>}
                            </div>
                          </div>
                          <div className="shrink-0">
                            <Button onClick={() => prepareTask(index)} disabled={busyIndex === index} className="rounded-full bg-slate-900 px-6 py-5 font-bold text-white shadow-lg hover:bg-indigo-600">
                              {busyIndex === index ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sparkles className="mr-2 h-4 w-4" />} Deep Dive
                            </Button>
                          </div>
                        </div>

                        {task.prepSummary && (
                          <div className="mt-6 rounded-2xl bg-indigo-50/50 border border-indigo-100 p-5">
                            <div className="flex items-center gap-2 text-sm font-bold text-indigo-900 mb-3"><BookOpen className="h-4 w-4" /> Guide</div>
                            <p className="text-sm text-indigo-950/80 mb-4">{task.prepSummary}</p>
                            {task.subtopics?.length ? (
                              <ul className="space-y-2 text-sm text-slate-600">
                                {task.subtopics.map((sub, i) => <li key={i} className="flex gap-2"><div className="h-1.5 w-1.5 rounded-full bg-indigo-400 mt-1.5 shrink-0" />{sub}</li>)}
                              </ul>
                            ) : null}
                          </div>
                        )}
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

function AgentSummaryRow({ title, status }: { title: string, status: string }) {
  return (
    <div className="flex items-center gap-3 p-3 bg-white rounded-xl shadow-sm border border-slate-100 flex-1">
      <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${status === 'completed' ? 'bg-emerald-100 text-emerald-600' : 'bg-indigo-100 text-indigo-600'}`}>
        <BrainCircuit className="h-4 w-4" />
      </div>
      <div>
        <div className="font-bold text-slate-900 text-xs">{title}</div>
        <div className="text-[9px] font-bold uppercase tracking-widest text-slate-400">{status}</div>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const m = status === "completed" ? { bg: "bg-emerald-50", text: "text-emerald-700" } : { bg: "bg-slate-100", text: "text-slate-600" };
  return (
    <span className={`rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-widest ${m.bg} ${m.text}`}>
      {status}
    </span>
  );
}
