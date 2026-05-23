import mongoose, { Schema, Document, Model } from "mongoose";

export interface IAnalytics extends Document {
  userId: string;
  completedTasks: number;
  pendingTasks: number;
  focusHours: number;
  productivityScore: number;
  streakDays: number;
  createdAt?: Date;
  updatedAt?: Date;
}

const AnalyticsSchema = new Schema<IAnalytics>(
  {
    userId: { type: String, required: true, index: true },

    completedTasks: {
      type: Number,
      default: 0,
    },

    pendingTasks: {
      type: Number,
      default: 0,
    },

    focusHours: {
      type: Number,
      default: 0,
    },

    productivityScore: {
      type: Number,
      default: 0,
    },

    streakDays: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

const AnalyticsModel: Model<IAnalytics> =
  mongoose.models.Analytics ||
  mongoose.model<IAnalytics>("Analytics", AnalyticsSchema);

export default AnalyticsModel;