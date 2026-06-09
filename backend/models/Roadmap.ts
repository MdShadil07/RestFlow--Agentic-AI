import mongoose, { Schema, Document, Model } from 'mongoose';

export interface IRoadmapTask {
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

export interface IRoadmap extends Document {
  userId: string;
  topic: string;
  role?: string;
  company?: string;
  competency?: string;
  status: 'pending' | 'running' | 'completed' | 'failed';
  progress: number;
  tasks: IRoadmapTask[];
  createdAt?: Date;
  updatedAt?: Date;
}

const RoadmapTaskSchema = new Schema<IRoadmapTask>({
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

const RoadmapSchema = new Schema<IRoadmap>(
  {
    userId: { type: String, required: true, index: true },
    topic: { type: String, required: true },
    role: { type: String },
    company: { type: String },
    competency: { type: String },
    status: { type: String, default: 'pending' },
    progress: { type: Number, default: 0 },
    tasks: { type: [RoadmapTaskSchema], default: [] },
  },
  { timestamps: true }
);

const RoadmapModel: Model<IRoadmap> = mongoose.models.Roadmap || mongoose.model<IRoadmap>('Roadmap', RoadmapSchema);

export default RoadmapModel;
