import mongoose, { Schema, Document, Model } from "mongoose";

export interface ITask extends Document {
  userId: string;
  title: string;
  description?: string;
  priority: "High" | "Medium" | "Low";
  status: "Pending" | "Completed" | "In Progress";
  deadline?: Date;
  estimatedMinutes?: number;
  subtasks?: string[];
  aiGenerated?: boolean;
  category?: string;
  createdAt?: Date;
  updatedAt?: Date;
}

const TaskSchema = new Schema<ITask>(
  {
    userId: { type: String, required: true, index: true },

    title: { type: String, required: true },

    description: { type: String },

    priority: {
      type: String,
      enum: ["High", "Medium", "Low"],
      default: "Medium",
    },

    status: {
      type: String,
      enum: ["Pending", "Completed", "In Progress"],
      default: "Pending",
    },

    deadline: { type: Date },

    estimatedMinutes: { type: Number },

    subtasks: {
      type: [String],
      default: [],
    },

    aiGenerated: {
      type: Boolean,
      default: false,
    },

    category: { type: String },
  },
  { timestamps: true }
);

const TaskModel: Model<ITask> =
  mongoose.models.Task || mongoose.model<ITask>("Task", TaskSchema);

export default TaskModel;