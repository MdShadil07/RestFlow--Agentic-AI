import mongoose, { Schema, Document, Model } from 'mongoose';

export interface ITask {
  title: string;
  description?: string;
  resources?: string[];
  dueDate?: Date;
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
  prepStatus?: 'idle' | 'running' | 'completed' | 'failed';
  prepSummary?: string;
  prepSteps?: string[];
}

export interface IActivityLogEntry {
  stage: string;
  message: string;
  details?: string;
  createdAt?: Date;
}

export interface ICognitiveEvent {
  agent: string;
  event: string;
  stage: string;
  message: string;
  confidence?: number;
  evidence?: string[];
  timestamp: Date;
}

export interface IUserProfile {
  skills: string[];
  skillConfidence: { [skill: string]: number };
  weaknesses: string[];
  strengths: string[];
  experienceLevel: string;
  resumeQuality: number;
}

export interface ICompanyContext {
  company: string;
  role: string;
  rounds: string[];
  difficulty: number;
  focusAreas: string[];
}

export interface IResearchMonth {
  label: string;
  focus: string;
  dsaQuestions: string[];
  hrQuestions: string[];
  systemDesignQuestions: string[];
  otherQuestions: string[];
  interviewExperienceNotes: string[];
}

export interface IResearchContext {
  companyProfile: string;
  roleProfile: string;
  companySummary: string;
  roleSummary: string;
  prepGuidelines: string[];
  priorityTopics: string[];
  interviewRounds: string[];
  interviewExperiences: string[];
  fiveMonthQuestionTrend: IResearchMonth[];
  sourceNotes: string[];
}

export interface IPlanningState {
  analyzed: boolean;
  gapAnalysis: Map<string, number>;
  priorities: Map<string, number>;
}

export interface IExecutionState {
  completedTasks: string[];
  delayedTasks: string[];
  confidenceScore: number;
  missedDeadlines: number;
}

export interface ISharedSessionContext {
  userProfile?: IUserProfile;
  companyContext?: ICompanyContext;
  researchContext?: IResearchContext;
  planningState?: IPlanningState;
  executionState?: IExecutionState;
  cognitiveEvents: ICognitiveEvent[];
}

export interface ISession extends Document {
  userId: string;
  resumeText?: string;
  extraContext?: string;
  company?: string;
  role?: string;
  deadline?: Date;
  competency?: string;
  agents?: string[];
  status: 'pending' | 'running' | 'completed' | 'failed';
  progress: number;
  currentStep?: string;
  activityLog: IActivityLogEntry[];
  tasks: ITask[];
  sharedContext?: ISharedSessionContext;
  createdAt?: Date;
  updatedAt?: Date;
}

const TaskSchema = new Schema<ITask>({
  title: { type: String, required: true },
  description: { type: String },
  resources: { type: [String], default: [] },
  dueDate: { type: Date },
  priority: { type: Number, default: 0 },
  category: { type: String },
  estimatedMinutes: { type: Number },
  focusArea: { type: String },
  agent: { type: String },
  contributors: { type: [String], default: [] },
  subtopics: { type: [String], default: [] },
  notes: { type: [String], default: [] },
  commonMistakes: { type: [String], default: [] },
  teachingPrompts: { type: [String], default: [] },
  prepStatus: { type: String, default: 'idle' },
  prepSummary: { type: String },
  prepSteps: { type: [String], default: [] },
});

const ActivityLogSchema = new Schema<IActivityLogEntry>({
  stage: { type: String, required: true },
  message: { type: String, required: true },
  details: { type: String },
  createdAt: { type: Date, default: Date.now },
}, { _id: false });

const CognitiveEventSchema = new Schema<ICognitiveEvent>({
  agent: { type: String, required: true },
  event: { type: String, required: true },
  stage: { type: String, required: true },
  message: { type: String, required: true },
  confidence: { type: Number },
  evidence: { type: [String], default: [] },
  timestamp: { type: Date, default: Date.now },
}, { _id: false });

const ResearchMonthSchema = new Schema<IResearchMonth>({
  label: { type: String, required: true },
  focus: { type: String, required: true },
  dsaQuestions: { type: [String], default: [] },
  hrQuestions: { type: [String], default: [] },
  systemDesignQuestions: { type: [String], default: [] },
  otherQuestions: { type: [String], default: [] },
  interviewExperienceNotes: { type: [String], default: [] },
}, { _id: false });

const ResearchContextSchema = new Schema<IResearchContext>({
  companyProfile: { type: String, required: true },
  roleProfile: { type: String, required: true },
  companySummary: { type: String, required: true },
  roleSummary: { type: String, required: true },
  prepGuidelines: { type: [String], default: [] },
  priorityTopics: { type: [String], default: [] },
  interviewRounds: { type: [String], default: [] },
  interviewExperiences: { type: [String], default: [] },
  fiveMonthQuestionTrend: { type: [ResearchMonthSchema], default: [] },
  sourceNotes: { type: [String], default: [] },
}, { _id: false });

const SharedSessionContextSchema = new Schema<ISharedSessionContext>({
  userProfile: {
    skills: { type: [String], default: [] },
    skillConfidence: { type: Map, of: Number, default: new Map() },
    weaknesses: { type: [String], default: [] },
    strengths: { type: [String], default: [] },
    experienceLevel: { type: String },
    resumeQuality: { type: Number },
  },
  companyContext: {
    company: { type: String },
    role: { type: String },
    rounds: { type: [String], default: [] },
    difficulty: { type: Number },
    focusAreas: { type: [String], default: [] },
  },
  researchContext: { type: ResearchContextSchema },
  planningState: {
    analyzed: { type: Boolean, default: false },
    gapAnalysis: { type: Map, of: Number, default: new Map() },
    priorities: { type: Map, of: Number, default: new Map() },
  },
  executionState: {
    completedTasks: { type: [String], default: [] },
    delayedTasks: { type: [String], default: [] },
    confidenceScore: { type: Number, default: 0 },
    missedDeadlines: { type: Number, default: 0 },
  },
  cognitiveEvents: { type: [CognitiveEventSchema], default: [] },
}, { _id: false });

const SessionSchema = new Schema<ISession>(
  {
    userId: { type: String, required: true, index: true },
    resumeText: { type: String },
    extraContext: { type: String },
    company: { type: String },
    role: { type: String },
    deadline: { type: Date },
    competency: { type: String },
    agents: { type: [String], default: [] },
    status: { type: String, default: 'pending' },
    progress: { type: Number, default: 0 },
    currentStep: { type: String, default: 'queued' },
    activityLog: { type: [ActivityLogSchema], default: [] },
    tasks: { type: [TaskSchema], default: [] },
    sharedContext: { type: SharedSessionContextSchema },
  },
  { timestamps: true }
);

const SessionModel: Model<ISession> = mongoose.models.Session || mongoose.model<ISession>('Session', SessionSchema);

export default SessionModel;

export function unsanitizeSkillConfidence(obj?: { [k: string]: number } | Map<string, number> | any) {
  if (!obj) return obj;
  const out: { [k: string]: number } = {};
  // support Map or plain object
  if (obj instanceof Map) {
    for (const [k, v] of obj.entries()) {
      out[k.replace(/__dot__/g, '.')] = v as number;
    }
  } else if (typeof obj === 'object') {
    for (const key of Object.keys(obj)) {
      const val = obj[key];
      out[key.replace(/__dot__/g, '.')] = val as number;
    }
  }
  return out;
}
