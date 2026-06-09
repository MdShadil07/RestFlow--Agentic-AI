import React, { useEffect, useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { format } from "date-fns";
import { 
  LayoutDashboard, CheckSquare, CalendarDays, BarChart3, 
  Settings, Bell, Search, Menu, X, Plus, 
  BrainCircuit, TrendingUp, Clock, Target, 
  ChevronRight, ChevronDown, PlayCircle, MoreHorizontal, Loader2, Calendar, AlertTriangle,
  ArrowRight, Sparkles, Layers3, BadgeCheck, BookOpen, AlertCircle, HelpCircle, Trash2,
  Folder, FolderOpen, FileText, Square, Download
} from "lucide-react";
// @ts-ignore
import AgentThinkingLoader from "../../components/agentThinkingLoader";

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
  _id: string;
  status: "pending" | "running" | "completed" | "failed";
  progress?: number;
  currentStep?: string;
  company?: string;
  role?: string;
  deadline?: string;
  competency?: string;
  extraContext?: string;
  activityLog?: { stage: string; message: string; details?: string; createdAt?: string }[];
  tasks?: Task[];
  createdAt?: string;
  updatedAt?: string;
  isStandalone?: boolean; // differentiate from sessions
};

const API_BASE = import.meta.env.VITE_API_BASE_URL || "http://localhost:5001";

export default function RoadmapPage() {
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  
  // Roadmap switching states
  const [sessions, setSessions] = useState<Session[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Custom topic generator states
  const [goalPrompt, setGoalPrompt] = useState("");
  const [company, setCompany] = useState("");
  const [role, setRole] = useState("");
  const [competency, setCompetency] = useState("intermediate");
  const [deadline, setDeadline] = useState("");
  const [isDeploying, setIsDeploying] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [snapshot, setSnapshot] = useState<any | null>(null);
  const [deployError, setDeployError] = useState<string | null>(null);
  const [startedAt, setStartedAt] = useState<number | null>(null);

  // Tab state: "tree" | "list"
  const [activeTab, setActiveTab] = useState<"tree" | "list">("tree");
  // Selected task in detail drawer
  const [selectedTaskIndex, setSelectedTaskIndex] = useState<number | null>(null);
  const [busyIndex, setBusyIndex] = useState<number | null>(null);
  
  // Hover states to light up tree connection lines
  const [hoveredTaskIndex, setHoveredTaskIndex] = useState<number | null>(null);
  const [hoveredCategory, setHoveredCategory] = useState<string | null>(null);

  // Notion-style nested tree toggle states
  const [expandedNodes, setExpandedNodes] = useState<Record<string, boolean>>({});
  const [isAllExpanded, setIsAllExpanded] = useState(false);

  // Search filter query
  const [searchQuery, setSearchQuery] = useState("");
  // Mastery checklist tracked by local storage
  const [checkedSubtopics, setCheckedSubtopics] = useState<Record<string, boolean>>({});

  // Load subtopic checked state on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem("roadmapCheckedSubtopics");
      if (stored) {
        setCheckedSubtopics(JSON.parse(stored));
      }
    } catch (e) {
      console.log("Error loading checked subtopics state:", e);
    }
  }, []);

  // Pre-expand all categories by default when switching roadmaps
  useEffect(() => {
    if (selectedSession && selectedSession.tasks) {
      const initialExpanded: Record<string, boolean> = {};
      selectedSession.tasks.forEach((task) => {
        const cat = task.category || "Core Prep";
        initialExpanded[`cat:${cat}`] = true;
      });
      setExpandedNodes(initialExpanded);
    }
  }, [selectedSessionId, sessions]);

  const toggleSubtopic = (key: string) => {
    setCheckedSubtopics(prev => {
      const next = { ...prev, [key]: !prev[key] };
      localStorage.setItem("roadmapCheckedSubtopics", JSON.stringify(next));
      return next;
    });
  };

  const elapsedMs = startedAt ? Date.now() - startedAt : 0;

  // Load all sessions on mount
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
      const headers = { ...(token ? { Authorization: `Bearer ${token}` } : {}) };
      
      const [sessionsResp, roadmapsResp] = await Promise.all([
        fetch(`${API_BASE}/api/v1/sessions`, { headers }),
        fetch(`${API_BASE}/api/v1/roadmaps`, { headers })
      ]);
      
      let allItems: any[] = [];
      if (sessionsResp.ok) {
        const data = await sessionsResp.json();
        allItems = [...allItems, ...(data.data || []).map((s: any) => ({...s, isStandalone: false}))];
      }
      if (roadmapsResp.ok) {
        const data = await roadmapsResp.json();
        allItems = [...allItems, ...(data.data || []).map((r: any) => ({...r, isStandalone: true, role: r.topic}))];
      }
      
      allItems.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
      
      setSessions(allItems);
      if (allItems.length > 0) {
        const nextSelect = selectId && allItems.some((s: any) => s._id === selectId)
          ? selectId
          : allItems[0]._id;
        setSelectedSessionId(nextSelect);
        setSelectedTaskIndex(null);
      }
    } catch (err: any) {
      setError(err.message || "Something went wrong loading roadmaps");
    } finally {
      setLoading(false);
    }
  };

  const selectSession = (sid: string) => {
    setSelectedSessionId(sid);
    setSelectedTaskIndex(null);
  };

  const selectedSession = sessions.find(s => s._id === selectedSessionId) || null;
  const tasks = selectedSession?.tasks ?? [];

  // Group tasks by category for tree view
  const categoryGroups: Record<string, Task[]> = {};
  tasks.forEach((task) => {
    const cat = task.category || "Core Prep";
    if (!categoryGroups[cat]) {
      categoryGroups[cat] = [];
    }
    categoryGroups[cat].push(task);
  });

  const filteredTasksCount = tasks.filter(t => 
    t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    (t.description && t.description.toLowerCase().includes(searchQuery.toLowerCase()))
  ).length;

  const toggleNode = (key: string) => {
    setExpandedNodes(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const toggleExpandAll = () => {
    const nextVal = !isAllExpanded;
    setIsAllExpanded(nextVal);
    
    const nextExpanded: Record<string, boolean> = {};
    Object.keys(categoryGroups).forEach(cat => {
      nextExpanded[`cat:${cat}`] = nextVal;
    });
    tasks.forEach((_, idx) => {
      nextExpanded[`task:${idx}`] = nextVal;
    });
    setExpandedNodes(nextExpanded);
  };

  const handleGenerateRoadmap = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!goalPrompt.trim()) return;

    setIsDeploying(true);
    setDeployError(null);
    setSnapshot(null);
    setStartedAt(Date.now());

    try {
      const token = localStorage.getItem("taskSchedulerToken");
      
      const payload = {
        topic: goalPrompt.trim(),
        company: company.trim(),
        role: role.trim(),
        competency,
      };

      const resp = await fetch(`${API_BASE}/api/v1/roadmaps`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(payload),
      });

      const data = await resp.json();
      if (!resp.ok) throw new Error(data.message || "Failed to generate standalone roadmap");

      const newId = data.data.id;
      setSessionId(newId);
      startPolling(newId);
    } catch (err: any) {
      setDeployError(err.message || "Unable to deploy custom session");
      setIsDeploying(false);
      setStartedAt(null);
    }
  };

  const startPolling = (sid: string) => {
    const token = localStorage.getItem("taskSchedulerToken");
    const interval = setInterval(async () => {
      try {
        const resp = await fetch(`${API_BASE}/api/v1/roadmaps/${sid}`, {
          headers: {
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
        });
        const data = await resp.json();
        if (!resp.ok) throw new Error(data.message || "Polling status failed");
        
        setSnapshot(data.data);

        if (data.data?.status === "completed") {
          clearInterval(interval);
          setIsDeploying(false);
          setSessionId(null);
          setSnapshot(null);
          setStartedAt(null);
          // clear quick inputs
          setGoalPrompt("");
          setCompany("");
          setRole("");
          setDeadline("");
          loadAllSessions(sid);
        } else if (data.data?.status === "failed") {
          clearInterval(interval);
          setDeployError("The Agent processing pipeline failed. Please try again with a cleaner prompt.");
        }
      } catch (err: any) {
        clearInterval(interval);
        setDeployError(err.message || "Unable to retrieve agent deployment trace");
      }
    }, 1300);
  };

  const handleRetryDeploy = () => {
    setDeployError(null);
    setIsDeploying(false);
    setSessionId(null);
    setSnapshot(null);
    setStartedAt(null);
  };

  const handleDeepDive = async (taskIndex: number) => {
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
      // Refresh current session tasks locally
      setSessions(prev => prev.map(s => {
        if (s._id !== selectedSessionId) return s;
        const updatedTasks = [...(s.tasks || [])];
        if (updatedTasks[taskIndex]) {
          updatedTasks[taskIndex] = {
            ...updatedTasks[taskIndex],
            prepStatus: result.prepStatus,
            prepSummary: result.prepSummary,
            prepSteps: result.prepSteps,
            subtopics: result.subtopics,
            notes: result.notes,
            commonMistakes: result.commonMistakes,
            teachingPrompts: result.teachingPrompts,
          };
        }
        return { ...s, tasks: updatedTasks };
      }));
    } catch (err: any) {
      alert(err.message || "Unable to trigger deep dive");
    } finally {
      setBusyIndex(null);
    }
  };

  const handleDeleteSession = async (sid: string, isStandalone?: boolean) => {
    const confirmDelete = window.confirm("Are you sure you want to delete this roadmap?");
    if (!confirmDelete) return;

    try {
      const token = localStorage.getItem("taskSchedulerToken");
      const endpoint = isStandalone ? `/api/v1/roadmaps/${sid}` : `/api/v1/sessions/${sid}`;
      const resp = await fetch(`${API_BASE}${endpoint}`, {
        method: "DELETE",
        headers: {
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
      });
      const data = await resp.json();
      if (!resp.ok) throw new Error(data.message || "Failed to delete item");
      
      setSessions(prev => {
        const remaining = prev.filter(s => s._id !== sid);
        if (sid === selectedSessionId) {
          if (remaining.length > 0) {
            setSelectedSessionId(remaining[0]._id);
          } else {
            setSelectedSessionId(null);
          }
        }
        return remaining;
      });
    } catch (err: any) {
      alert(err.message || "Unable to delete session");
    }
  };

  return (
    <div className="min-h-screen bg-[#f8fafe] text-slate-900 font-sans flex overflow-hidden">
      <AgentThinkingLoader open={isDeploying} session={snapshot} error={deployError} elapsedMs={elapsedMs} onRetry={handleRetryDeploy} />

      {/* --- SIDEBAR --- */}
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
          <button onClick={() => navigate("/dashboard/tasks")} className="w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all text-slate-500 hover:bg-slate-50 hover:text-slate-900 font-semibold">
            <CheckSquare className="w-5 h-5 text-slate-400" /> Tasks
          </button>
          <button className="w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all bg-indigo-50 text-indigo-700 font-bold">
            <Layers3 className="w-5 h-5 text-indigo-600" /> Roadmap
          </button>
          <button className="w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all text-slate-500 hover:bg-slate-50 hover:text-slate-900 font-semibold">
            <CalendarDays className="w-5 h-5 text-slate-400" /> Calendar
          </button>
          <button className="w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all text-slate-500 hover:bg-slate-50 hover:text-slate-900 font-semibold">
            <BarChart3 className="w-5 h-5 text-slate-400" /> Analytics
          </button>

          <p className="px-4 text-xs font-bold text-slate-400 uppercase tracking-widest mb-2 mt-8">Settings</p>
          <button className="w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all text-slate-500 hover:bg-slate-50 hover:text-slate-900 font-semibold">
            <Settings className="w-5 h-5 text-slate-400" />
            Preferences
          </button>
        </div>

        <div className="p-4 border-t border-slate-100">
          <div className="flex items-center gap-3 p-2 hover:bg-slate-50 rounded-xl cursor-pointer transition-colors">
            <img src="https://i.pravatar.cc/150?img=33" alt="User" className="w-10 h-10 rounded-full border-2 border-white shadow-sm" />
            <div className="flex-1 min-w-0">
              <h4 className="text-sm font-bold text-slate-900 truncate">Alex Developer</h4>
              <p className="text-xs font-medium text-slate-500 truncate">Pro Member</p>
            </div>
          </div>
        </div>
      </aside>

      {/* --- MAIN CONTENT --- */}
      <main className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden relative print:overflow-visible">
        {/* Abstract Backgrounds */}
        <div className="absolute top-[-20%] right-[-10%] w-[600px] h-[600px] bg-[radial-gradient(circle,rgba(99,102,241,0.06)_0%,transparent_60%)] rounded-full pointer-events-none print:hidden" />
        <div className="absolute top-[40%] left-[-10%] w-[500px] h-[500px] bg-[radial-gradient(circle,rgba(139,92,246,0.04)_0%,transparent_60%)] rounded-full pointer-events-none print:hidden" />

        {/* Topbar */}
        <header className="h-20 bg-white/80 backdrop-blur-md border-b border-slate-200/50 flex items-center justify-between px-6 lg:px-10 z-20 sticky top-0 shrink-0 print:hidden">
          <div className="flex items-center gap-4">
            <button className="lg:hidden text-slate-500 hover:text-slate-800" onClick={() => setSidebarOpen(true)}>
              <Menu className="w-6 h-6" />
            </button>
            <h2 className="text-xl font-extrabold text-slate-900 hidden sm:block">Tasks & Roadmap Explorer</h2>
          </div>

          <div className="flex items-center gap-4 sm:gap-6">
            <button className="relative p-2 text-slate-400 hover:text-indigo-600 transition-colors bg-white rounded-full border border-slate-200 shadow-sm">
              <Bell className="w-5 h-5" />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-rose-500 rounded-full border-2 border-white"></span>
            </button>
          </div>
        </header>

        {/* Main Content Area */}
        <div className="flex-1 overflow-hidden flex flex-col md:flex-row relative z-10 print:overflow-visible">
          
          {/* List of sessions sidebar panel */}
          <div className="w-full md:w-80 border-r border-slate-200 bg-white/40 backdrop-blur-md flex flex-col shrink-0 print:hidden">
            <div className="p-5 border-b border-slate-100">
              <h3 className="text-sm font-bold uppercase tracking-widest text-slate-400 mb-3">Your Saved Sessions</h3>
              <p className="text-xs text-slate-500 font-medium leading-relaxed">
                Choose an active preparation block or compile a custom topic below.
              </p>
            </div>
            
            {/* Sessions Selector List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {loading ? (
                <div className="flex items-center justify-center py-8 text-slate-400">
                  <Loader2 className="w-6 h-6 animate-spin text-indigo-600 mr-2" />
                  <span className="text-xs font-semibold">Syncing history...</span>
                </div>
              ) : sessions.length === 0 ? (
                <div className="text-center py-8 text-slate-400 text-xs font-semibold">
                  No active roadmaps found.
                </div>
              ) : (
                sessions.map((s) => {
                  const active = s._id === selectedSessionId;
                  const dateLabel = s.createdAt 
                    ? new Date(s.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric" })
                    : "Recently";

                  return (
                    <button
                      key={s._id}
                      onClick={() => selectSession(s._id)}
                      className={`w-full text-left p-4 rounded-2xl border transition-all duration-300 relative overflow-hidden group ${
                        active 
                          ? "bg-white border-indigo-300 shadow-md shadow-indigo-100" 
                          : "bg-white/70 border-slate-100 hover:border-slate-200 hover:bg-white"
                      }`}
                    >
                      <div className={`absolute left-0 top-0 bottom-0 w-1 ${
                        s.status === "completed" ? "bg-emerald-500" : s.status === "failed" ? "bg-rose-500" : "bg-amber-500"
                      }`} />
                      
                      <div className="flex justify-between items-start gap-2 pl-2">
                        <div className="min-w-0 pr-1 flex-1">
                          <h4 className={`text-sm font-extrabold truncate ${active ? "text-indigo-700" : "text-slate-900"}`}>
                            {s.role || "Custom Roadmap"}
                          </h4>
                          <p className="text-[11px] font-semibold text-slate-400 truncate mt-0.5">
                            {s.company ? `at ${s.company}` : "Personal Goal"}
                          </p>
                        </div>
                        <div className="flex flex-col items-end gap-1 shrink-0">
                          <span className="text-[9px] font-bold text-slate-400">{dateLabel}</span>
                          <button
                            title="Delete Roadmap"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteSession(s._id, s.isStandalone);
                            }}
                            className="p-1 rounded-md text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors opacity-0 group-hover:opacity-100 duration-200"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                      
                      <div className="flex items-center justify-between text-[10px] font-bold text-slate-500 mt-3 pl-2">
                        <span className="capitalize">{s.competency || "intermediate"}</span>
                        <span>{s.progress || 0}%</span>
                      </div>
                    </button>
                  );
                })
              )}
            </div>

            {/* Quick Generator Panel in Sidebar */}
            <div className="p-4 border-t border-slate-100 bg-white/50">
              <form onSubmit={handleGenerateRoadmap} className="space-y-3">
                <h4 className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1">Generate Roadmap for Anything</h4>
                <input
                  required
                  type="text"
                  value={goalPrompt}
                  onChange={(e) => setGoalPrompt(e.target.value)}
                  placeholder="e.g., Learn FastAPI and PostgreSQL"
                  className="w-full px-3 py-2 text-xs font-semibold bg-white border border-slate-200 focus:border-indigo-400 rounded-xl outline-none"
                />
                
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                    placeholder="Role (optional)"
                    className="w-full px-3 py-1.5 text-[11px] font-semibold bg-white border border-slate-200 focus:border-indigo-400 rounded-lg outline-none"
                  />
                  <input
                    type="text"
                    value={company}
                    onChange={(e) => setCompany(e.target.value)}
                    placeholder="Company (optional)"
                    className="w-full px-3 py-1.5 text-[11px] font-semibold bg-white border border-slate-200 focus:border-indigo-400 rounded-lg outline-none"
                  />
                </div>
                
                <button
                  type="submit"
                  disabled={isDeploying || !goalPrompt.trim()}
                  className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-extrabold rounded-xl shadow-md shadow-indigo-600/10 flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50"
                >
                  <Sparkles className="w-3.5 h-3.5" /> Compile Roadmap
                </button>
              </form>
            </div>
          </div>

          {/* Interactive Workspace Area */}
          <div className="flex-1 flex flex-col h-full overflow-hidden print:overflow-visible">
            
            {/* Roadmap detail workspace selector tabs */}
            {selectedSession && (
              <div className="h-16 px-6 border-b border-slate-200/50 bg-white flex items-center justify-between shrink-0 print:hidden">
                <div className="flex items-center gap-4">
                  <div className="flex rounded-xl bg-slate-100/80 p-1">
                    <button
                      onClick={() => setActiveTab("tree")}
                      className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-all ${
                        activeTab === "tree" ? "bg-white text-indigo-700 shadow-sm" : "text-slate-500 hover:text-slate-700"
                      }`}
                    >
                      Tree View
                    </button>
                    <button
                      onClick={() => setActiveTab("list")}
                      className={`px-4 py-1.5 text-xs font-bold rounded-lg transition-all ${
                        activeTab === "list" ? "bg-white text-indigo-700 shadow-sm" : "text-slate-500 hover:text-slate-700"
                      }`}
                    >
                      Timeline Checklist
                    </button>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <button onClick={() => window.print()} className="hidden sm:flex items-center gap-2 px-4 py-1.5 text-xs font-bold text-slate-600 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg transition-colors">
                    <Download className="w-4 h-4" /> Export
                  </button>
                  <span className="text-xs font-bold text-slate-400 bg-slate-100 px-3 py-1 rounded-full uppercase tracking-wider">
                    {selectedSession.status}
                  </span>
                  {selectedSession.deadline && (
                    <span className="text-xs font-bold text-slate-500 flex items-center gap-1">
                      <CalendarDays className="w-4 h-4 text-slate-400" />
                      {new Date(selectedSession.deadline).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* Visualizer Scroll Pane */}
            <div className="flex-1 overflow-auto p-6 md:p-8 flex relative min-h-0 bg-[#f8fafe]/30 print:p-0 print:overflow-visible">
              
              {!selectedSession ? (
                <div className="flex-1 flex flex-col items-center justify-center text-center p-6">
                  <div className="w-16 h-16 rounded-3xl bg-indigo-50 flex items-center justify-center text-indigo-600 mb-4 shadow-inner">
                    <Target className="w-8 h-8" />
                  </div>
                  <h3 className="font-extrabold text-lg text-slate-900">Compile Your Study Roadmap</h3>
                  <p className="text-sm text-slate-500 max-w-sm mt-1 mb-6 leading-relaxed">
                    Type a topic prompt in the sidebar panel to generate an end-to-end learning tree.
                  </p>
                </div>
              ) : activeTab === "tree" ? (
                
                /* Notion-style collapsible Tree view */
                <div className="flex-1 max-w-4xl mx-auto w-full flex flex-col space-y-6 print:block">
                  {/* Control Toolbar */}
                  <div className="flex flex-col sm:flex-row gap-4 justify-between items-stretch sm:items-center bg-white p-4 rounded-2xl border border-slate-200/60 shadow-sm shrink-0 print:hidden">
                    <div className="flex items-center gap-3">
                      <div className="relative flex-1 sm:w-64">
                        <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                        <input
                          type="text"
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          placeholder="Filter topics or categories..."
                          className="w-full pl-9 pr-4 py-2 text-xs font-semibold bg-slate-50 border border-slate-200 rounded-xl outline-none focus:border-indigo-400 focus:bg-white transition-all"
                        />
                        {searchQuery && (
                          <button
                            onClick={() => setSearchQuery("")}
                            className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                      <span className="text-[11px] font-bold text-slate-400 bg-slate-100 px-2 py-1 rounded-md">
                        {filteredTasksCount} / {tasks.length} tasks
                      </span>
                    </div>

                    <div className="flex items-center gap-3">
                      <button
                        onClick={toggleExpandAll}
                        className="px-4 py-2 text-xs font-extrabold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-xl transition-colors flex items-center gap-1.5"
                      >
                        {isAllExpanded ? "Collapse All" : "Expand All"}
                      </button>
                    </div>
                  </div>

                  {/* Root Goal Banner */}
                  <div className="bg-gradient-to-br from-slate-900 to-indigo-950 text-white rounded-3xl p-6 shadow-xl border border-indigo-950/20 relative overflow-hidden shrink-0">
                    <div className="absolute top-0 right-0 w-64 h-64 bg-[radial-gradient(circle,rgba(99,102,241,0.15)_0%,transparent_70%)] rounded-full pointer-events-none" />
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 relative z-10">
                      <div className="space-y-1">
                        <span className="text-[10px] font-extrabold tracking-widest text-indigo-400 uppercase bg-indigo-900/50 border border-indigo-500/20 px-3 py-1 rounded-full">
                          Active Swarm Roadmap
                        </span>
                        <h3 className="text-xl font-black tracking-tight mt-2">{selectedSession.role || "Custom Roadmap"}</h3>
                        <p className="text-xs text-slate-300 font-semibold">
                          Target Goal: {selectedSession.extraContext || selectedSession.role}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-2.5">
                        {selectedSession.company && (
                          <div className="bg-white/10 backdrop-blur-md border border-white/10 px-3 py-1.5 rounded-xl text-xs font-bold text-indigo-200">
                            🏢 {selectedSession.company}
                          </div>
                        )}
                        <div className="bg-white/10 backdrop-blur-md border border-white/10 px-3 py-1.5 rounded-xl text-xs font-bold text-indigo-200">
                          ⚡ {selectedSession.competency || "Intermediate"}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Interactive Tree Body */}
                  <div className="space-y-4 print:space-y-6">
                    {/* Iterate Categories */}
                    {Object.entries(categoryGroups).map(([categoryName, catTasks]) => {
                      const expandedKey = `cat:${categoryName}`;
                      const isCatExpanded = expandedNodes[expandedKey] ?? true;
                      
                      // Filter tasks in category if search is present
                      const filteredCatTasks = catTasks.filter(t => 
                        t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                        (t.description && t.description.toLowerCase().includes(searchQuery.toLowerCase()))
                      );

                      if (filteredCatTasks.length === 0 && searchQuery) {
                        return null;
                      }

                      // Compute completion statistics
                      const totalTasksInCat = catTasks.length;
                      const completedTasksInCat = catTasks.filter(t => t.prepStatus === "completed").length;
                      const catCompletionPercent = totalTasksInCat > 0 ? Math.round((completedTasksInCat / totalTasksInCat) * 100) : 0;

                      return (
                        <div key={categoryName} className="bg-white/60 border border-slate-200/50 rounded-2xl p-4 shadow-sm backdrop-blur-sm transition-all hover:bg-white duration-300 print:shadow-none print:border-slate-300 print:break-inside-avoid print:bg-white print:p-0">
                          
                          {/* Category Header Row (Notion-style collapsible folder) */}
                          <div 
                            onClick={() => toggleNode(expandedKey)}
                            className="flex items-center justify-between cursor-pointer select-none group print:mb-4"
                          >
                            <div className="flex items-center gap-3">
                              <div className="p-1 rounded-md text-slate-400 group-hover:text-indigo-600 transition-colors">
                                {isCatExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                              </div>
                              <div className="p-2 rounded-xl bg-indigo-50 text-indigo-600">
                                {isCatExpanded ? <FolderOpen className="w-4 h-4" /> : <Folder className="w-4 h-4" />}
                              </div>
                              <div>
                                <h4 className="font-extrabold text-sm text-slate-800 tracking-tight capitalize group-hover:text-indigo-600 transition-colors">
                                  {categoryName}
                                </h4>
                                <span className="text-[10px] font-bold text-slate-400 block mt-0.5">
                                  {completedTasksInCat} of {totalTasksInCat} Tasks Prep
                                </span>
                              </div>
                            </div>

                            {/* Category completion stats & progress bar */}
                            <div className="flex items-center gap-4 print:hidden">
                              <div className="hidden sm:flex flex-col items-end gap-1">
                                <span className="text-[10px] font-bold text-slate-500">{catCompletionPercent}% Ready</span>
                                <div className="w-20 h-1.5 bg-slate-100 rounded-full overflow-hidden border border-slate-200/50">
                                  <div 
                                    className="h-full bg-emerald-500 transition-all duration-500" 
                                    style={{ width: `${catCompletionPercent}%` }}
                                  />
                                </div>
                              </div>
                            </div>
                          </div>

                          {/* Nested task cards within category */}
                          {(isCatExpanded || window.matchMedia("print").matches) && (
                            <div className="border-l border-dashed border-indigo-200/70 ml-[23px] pl-5 mt-4 space-y-4 relative print:border-slate-300 print:ml-4">
                              {filteredCatTasks.map((task, localIdx) => {
                                const originalIdx = tasks.findIndex(t => t.title === task.title);
                                const isTaskExpanded = expandedNodes[`task:${originalIdx}`] ?? false;
                                const isCompleted = task.prepStatus === "completed";
                                const isRunning = task.prepStatus === "running";
                                const isFailed = task.prepStatus === "failed";

                                return (
                                  <div key={localIdx} className="relative group/task">
                                    
                                    {/* Line anchor node bullet */}
                                    <div className="absolute -left-[27px] top-4 w-3.5 h-3.5 rounded-full bg-white border-2 border-indigo-300 flex items-center justify-center z-10 print:hidden">
                                      <div className={`w-1.5 h-1.5 rounded-full ${
                                        isCompleted ? "bg-emerald-500" : isRunning ? "bg-amber-500 animate-ping" : "bg-slate-300"
                                      }`} />
                                    </div>

                                    {/* Task Row Card */}
                                    <div 
                                      className={`p-4 rounded-xl border transition-all duration-300 print:shadow-none print:border-slate-200 print:break-inside-avoid print:bg-white ${
                                        isTaskExpanded 
                                          ? "bg-slate-50 border-indigo-300/80 shadow-inner" 
                                          : "bg-white border-slate-200 hover:border-indigo-200 hover:shadow-md hover:shadow-indigo-50/20"
                                      }`}
                                    >
                                      <div className="flex items-start justify-between gap-3">
                                        <div 
                                          onClick={() => toggleNode(`task:${originalIdx}`)}
                                          className="flex-1 min-w-0 flex items-start gap-2.5 cursor-pointer select-none"
                                        >
                                          <div className="mt-0.5 text-slate-400 hover:text-indigo-600 transition-colors">
                                            {isTaskExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                                          </div>
                                          
                                          <div className="min-w-0">
                                            <h5 className={`font-bold text-xs text-slate-800 tracking-tight leading-snug ${isCompleted ? "group-hover/task:text-indigo-600" : ""}`}>
                                              {task.title}
                                            </h5>
                                            
                                            {task.description && (
                                              <p className="text-[11px] text-slate-500 font-medium leading-relaxed mt-1 line-clamp-1">
                                                {task.description}
                                              </p>
                                            )}

                                            <div className="flex flex-wrap items-center gap-2 mt-2">
                                              <span className="text-[9px] font-extrabold text-slate-400 bg-slate-100/80 px-2 py-0.5 rounded flex items-center gap-1 uppercase tracking-wider">
                                                <Clock className="w-3 h-3 text-slate-400" />
                                                {task.estimatedMinutes || 30} mins
                                              </span>
                                              {task.focusArea && (
                                                <span className="text-[9px] font-extrabold text-indigo-600 bg-indigo-50/50 border border-indigo-100/40 px-2 py-0.5 rounded uppercase tracking-wider">
                                                  🎯 {task.focusArea}
                                                </span>
                                              )}
                                              {task.priority !== undefined && (
                                                <span className={`text-[9px] font-extrabold px-2 py-0.5 rounded uppercase tracking-wider ${
                                                  task.priority >= 3 
                                                    ? "bg-rose-50 text-rose-600 border border-rose-100" 
                                                    : "bg-slate-50 text-slate-500 border border-slate-100"
                                                }`}>
                                                  Priority {task.priority}
                                                </span>
                                              )}
                                            </div>
                                          </div>
                                        </div>

                                        {/* Inline Deep Dive triggers & status badges */}
                                        <div className="flex items-start gap-2 shrink-0 print:hidden">
                                          {isCompleted ? (
                                            <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-100 flex items-center gap-1 select-none">
                                              <BadgeCheck className="w-3.5 h-3.5" /> Deep Div-ed
                                            </span>
                                          ) : isRunning ? (
                                            <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-2.5 py-1 rounded-full border border-amber-100 flex items-center gap-1.5 animate-pulse select-none">
                                              <Loader2 className="w-3 h-3 animate-spin" /> Deep Diving...
                                            </span>
                                          ) : isFailed ? (
                                            <button 
                                              onClick={() => handleDeepDive(originalIdx)}
                                              className="text-[10px] font-bold text-rose-600 bg-rose-50 hover:bg-rose-100 px-2.5 py-1 rounded-full border border-rose-100 flex items-center gap-1 transition-colors"
                                            >
                                              <AlertTriangle className="w-3 h-3" /> Retry Deep Dive
                                            </button>
                                          ) : (
                                            <button
                                              onClick={() => handleDeepDive(originalIdx)}
                                              disabled={busyIndex === originalIdx}
                                              className="text-[10px] font-black text-indigo-700 bg-indigo-50 hover:bg-indigo-600 hover:text-white px-3 py-1.5 rounded-xl border border-indigo-100 transition-all shadow-sm flex items-center gap-1"
                                            >
                                              <Sparkles className="w-3 h-3" /> Swarm Deep Dive
                                            </button>
                                          )}

                                          <button
                                            onClick={() => setSelectedTaskIndex(originalIdx)}
                                            title="Open side details drawer"
                                            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition-colors"
                                          >
                                            <MoreHorizontal className="w-4 h-4" />
                                          </button>
                                        </div>
                                      </div>

                                      {/* Expanded Subtopics & Checklist */}
                                      <AnimatePresence>
                                        {(isTaskExpanded || window.matchMedia("print").matches) && (
                                          <motion.div
                                            initial={{ opacity: 0, height: 0 }}
                                            animate={{ opacity: 1, height: "auto" }}
                                            exit={{ opacity: 0, height: 0 }}
                                            className="overflow-hidden print:!h-auto print:!opacity-100"
                                          >
                                            {/* Concept Coaching Summary */}
                                            {isCompleted && task.prepSummary && (
                                              <div className="bg-white rounded-xl border border-slate-200/60 p-4 shadow-sm relative overflow-hidden mt-4">
                                                <div className="absolute top-0 right-0 w-24 h-24 bg-gradient-to-bl from-indigo-50/40 to-transparent pointer-events-none" />
                                                <div className="flex items-center gap-2 border-b border-slate-100 pb-2 mb-2">
                                                  <BookOpen className="w-4 h-4 text-indigo-600" />
                                                  <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Conceptual Study Guide</span>
                                                </div>
                                                <p className="text-xs font-semibold text-slate-600 leading-relaxed whitespace-pre-line">
                                                  {task.prepSummary}
                                                </p>
                                              </div>
                                            )}

                                            {/* Interactive Subtopics Checklist */}
                                            {isCompleted && task.subtopics && task.subtopics.length > 0 && (
                                              <div className="bg-white rounded-xl border border-slate-200/60 p-4 shadow-sm mt-4">
                                                <div className="flex items-center gap-2 border-b border-slate-100 pb-2 mb-3">
                                                  <Layers3 className="w-4 h-4 text-indigo-600" />
                                                  <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Mastery Checklist</span>
                                                  <span className="text-[9px] font-bold text-slate-400 ml-auto print:hidden">Click to mark mastered</span>
                                                </div>
                                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                                  {task.subtopics.map((sub, sidx) => {
                                                    const subKey = `${selectedSessionId}:${originalIdx}:subtopic:${sidx}`;
                                                    const isSubChecked = checkedSubtopics[subKey] || false;
                                                    
                                                    return (
                                                      <div 
                                                        key={sidx}
                                                        onClick={() => toggleSubtopic(subKey)}
                                                        className={`flex items-center gap-2.5 px-3 py-2 rounded-xl border cursor-pointer select-none transition-all duration-200 ${
                                                          isSubChecked 
                                                            ? "bg-emerald-50/40 border-emerald-200 text-emerald-800" 
                                                            : "bg-slate-50 border-slate-200/60 text-slate-600 hover:bg-white hover:border-indigo-300"
                                                        }`}
                                                      >
                                                        {isSubChecked ? (
                                                          <CheckSquare className="w-4 h-4 text-emerald-600 shrink-0" />
                                                        ) : (
                                                          <Square className="w-4 h-4 text-slate-400 shrink-0" />
                                                        )}
                                                        <span className="text-[11px] font-bold tracking-tight truncate">
                                                          {sub}
                                                        </span>
                                                      </div>
                                                    );
                                                  })}
                                                </div>
                                              </div>
                                            )}

                                            {/* Prep Action Steps Checklist */}
                                            {isCompleted && task.prepSteps && task.prepSteps.length > 0 && (
                                              <div className="bg-white rounded-xl border border-slate-200/60 p-4 shadow-sm mt-4">
                                                <div className="flex items-center gap-2 border-b border-slate-100 pb-2 mb-3">
                                                  <CheckSquare className="w-4 h-4 text-indigo-600" />
                                                  <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Action Steps Checklist</span>
                                                </div>
                                                <div className="space-y-2">
                                                  {task.prepSteps.map((step, stepIdx) => {
                                                    const stepKey = `${selectedSessionId}:${originalIdx}:step:${stepIdx}`;
                                                    const isStepChecked = checkedSubtopics[stepKey] || false;

                                                    return (
                                                      <div 
                                                        key={stepIdx}
                                                        onClick={() => toggleSubtopic(stepKey)}
                                                        className="flex items-start gap-2.5 cursor-pointer group/step"
                                                      >
                                                        <div className="mt-0.5 shrink-0">
                                                          {isStepChecked ? (
                                                            <CheckSquare className="w-3.5 h-3.5 text-emerald-600" />
                                                          ) : (
                                                            <Square className="w-3.5 h-3.5 text-slate-400 group-hover/step:text-indigo-400" />
                                                          )}
                                                        </div>
                                                        <span className={`text-[11px] font-semibold leading-relaxed ${
                                                          isStepChecked ? "text-slate-400 line-through" : "text-slate-600"
                                                        }`}>
                                                          {step}
                                                        </span>
                                                      </div>
                                                    );
                                                  })}
                                                </div>
                                              </div>
                                            )}
                                          </motion.div>
                                        )}
                                      </AnimatePresence>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          )}

                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : (
                
                /* Timeline Checklist / List view */
                <div className="flex-1 max-w-3xl mx-auto w-full space-y-4">
                  {tasks.map((task, idx) => {
                    const isSelected = selectedTaskIndex === idx;
                    const isCompleted = task.prepStatus === "completed";
                    const isRunning = task.prepStatus === "running";

                    return (
                      <div
                        key={idx}
                        onClick={() => setSelectedTaskIndex(idx)}
                        className={`w-full bg-white border rounded-2xl p-5 cursor-pointer flex items-center justify-between gap-4 transition-all hover:border-slate-300 ${
                          isSelected ? "border-indigo-400 ring-2 ring-indigo-50 shadow-sm" : "border-slate-200/80"
                        }`}
                      >
                        <div className="flex items-center gap-4 min-w-0">
                          <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 ${
                            isCompleted ? "bg-emerald-50 text-emerald-600" : isRunning ? "bg-amber-50 text-amber-600 animate-pulse" : "bg-slate-50 text-slate-400"
                          }`}>
                            {isCompleted ? <BadgeCheck className="w-5 h-5" /> : <Clock className="w-5 h-5" />}
                          </div>
                          
                          <div className="min-w-0">
                            <h4 className="text-sm font-extrabold text-slate-900 truncate">{task.title}</h4>
                            <div className="flex items-center gap-3 mt-1.5 text-xs text-slate-400 font-semibold">
                              <span>{task.category || "General"}</span>
                              <span className="w-1 h-1 rounded-full bg-slate-200" />
                              <span>{task.estimatedMinutes} mins</span>
                            </div>
                          </div>
                        </div>
                        
                        <ChevronRight className="w-4 h-4 text-slate-400" />
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
            
            {/* Task Detail Pane (Fixed right drawer overlay/panel inside the workspace) */}
            <AnimatePresence>
              {selectedTaskIndex !== null && tasks[selectedTaskIndex] && (() => {
                const task = tasks[selectedTaskIndex];
                const isCompleted = task.prepStatus === "completed";
                const isRunning = task.prepStatus === "running";
                const isFailed = task.prepStatus === "failed";

                return (
                  <motion.div
                    initial={{ x: 380, opacity: 0.9 }}
                    animate={{ x: 0, opacity: 1 }}
                    exit={{ x: 380, opacity: 0.9 }}
                    transition={{ type: "spring", damping: 25, stiffness: 220 }}
                    className="w-full md:w-96 border-l border-slate-200 bg-white h-full flex flex-col shrink-0 relative z-20 shadow-2xl"
                  >
                    {/* Header */}
                    <div className="h-16 px-5 border-b border-slate-100 flex items-center justify-between shrink-0 bg-slate-50/50">
                      <div className="flex items-center gap-2">
                        <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${
                          isCompleted ? "bg-emerald-50 text-emerald-700 border border-emerald-100" : isRunning ? "bg-amber-50 text-amber-700 animate-pulse" : "bg-slate-100 text-slate-600"
                        }`}>
                          {task.prepStatus || "Pending"}
                        </span>
                      </div>
                      <button
                        onClick={() => setSelectedTaskIndex(null)}
                        className="p-1.5 rounded-full hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Content Scroll Area */}
                    <div className="flex-1 overflow-y-auto p-6 space-y-6">
                      
                      <div>
                        <h4 className="text-base font-black text-slate-900 leading-snug">{task.title}</h4>
                        {task.description && (
                          <p className="text-xs font-semibold leading-relaxed text-slate-500 mt-2">{task.description}</p>
                        )}
                      </div>

                      {/* Technical Details Grid */}
                      <div className="grid grid-cols-2 gap-3 bg-slate-50 p-3.5 rounded-2xl border border-slate-100">
                        <div>
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Category</span>
                          <span className="text-xs font-extrabold text-slate-700 capitalize mt-0.5 block">{task.category || "General"}</span>
                        </div>
                        <div>
                          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest block">Estimated Time</span>
                          <span className="text-xs font-extrabold text-slate-700 mt-0.5 block">{task.estimatedMinutes} mins</span>
                        </div>
                      </div>

                      {/* Launch Deep Dive Trigger */}
                      {!isCompleted && (
                        <div className="bg-indigo-50/30 border border-indigo-100/50 rounded-2xl p-5 text-center">
                          <Sparkles className="w-6 h-6 text-indigo-600 mx-auto mb-2" />
                          <h5 className="text-xs font-extrabold text-indigo-950">Unlock Deep-Dive Details</h5>
                          <p className="text-[11px] font-semibold text-slate-500 mt-1 mb-4 leading-relaxed">
                            Deploy our technical expert Depth Agent to generate subtopics, mistakes, guide checklists, and revision prompts.
                          </p>
                          <button
                            onClick={() => handleDeepDive(selectedTaskIndex)}
                            disabled={busyIndex === selectedTaskIndex}
                            className="w-full py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-extrabold rounded-xl shadow-md flex items-center justify-center gap-1.5 transition-colors disabled:opacity-50"
                          >
                            {busyIndex === selectedTaskIndex ? (
                              <>
                                <Loader2 className="w-3.5 h-3.5 animate-spin" /> Compiling details...
                              </>
                            ) : (
                              <>
                                <Layers3 className="w-3.5 h-3.5" /> Initialize Swarm Deep Dive
                              </>
                            )}
                          </button>
                        </div>
                      )}

                      {/* Compiled AI Guide */}
                      {isCompleted && task.prepSummary && (
                        <div className="space-y-4">
                          <div className="border-t border-slate-100 pt-4">
                            <span className="text-[10px] font-bold uppercase tracking-widest text-indigo-700 flex items-center gap-1.5 mb-2">
                              <BookOpen className="w-3.5 h-3.5" /> Study Guide Notes
                            </span>
                            <p className="text-xs font-semibold text-slate-600 leading-relaxed bg-indigo-50/40 p-4 rounded-2xl border border-indigo-100/50">
                              {task.prepSummary}
                            </p>
                          </div>

                          {/* Action steps */}
                          {task.prepSteps && task.prepSteps.length > 0 && (
                            <div>
                              <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 block mb-2">Preparation Steps</span>
                              <div className="space-y-2">
                                {task.prepSteps.map((step, sidx) => (
                                  <div key={sidx} className="flex gap-2.5 bg-slate-50 border border-slate-100 rounded-xl p-2.5 items-start">
                                    <span className="w-5 h-5 bg-white border rounded-full text-[10px] font-bold flex items-center justify-center shrink-0 mt-0.5 text-indigo-700 shadow-sm">
                                      {sidx + 1}
                                    </span>
                                    <span className="text-xs text-slate-600 font-semibold leading-relaxed pt-0.5">{step}</span>
                                  </div>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* Subtopics list */}
                          {task.subtopics && task.subtopics.length > 0 && (
                            <div>
                              <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400 block mb-2">Subtopics to Master</span>
                              <div className="flex flex-wrap gap-2">
                                {task.subtopics.map((sub, subIdx) => (
                                  <span key={subIdx} className="bg-slate-100 border border-slate-200/50 text-slate-700 text-xs font-semibold px-2.5 py-1 rounded-xl">
                                    {sub}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </motion.div>
                );
              })()}
              <style>{`
                @media print {
                  @page { margin: 1cm; }
                  body { -webkit-print-color-adjust: exact; print-color-adjust: exact; background: white !important; }
                  aside, header, .print\\:hidden { display: none !important; }
                  main, .flex-1, .overflow-y-auto { overflow: visible !important; height: auto !important; position: static !important; }
                  .print\\:break-inside-avoid { break-inside: avoid; }
                  .print\\:shadow-none { box-shadow: none !important; }
                }
              `}</style>
            </AnimatePresence>

          </div>
        </div>
      </main>
    </div>
  );
}
