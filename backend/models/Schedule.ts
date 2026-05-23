import mongoose, { Schema, Document, Model } from "mongoose";

export interface ISchedule extends Document {
  userId: string;
  date: Date;
  tasks: string[];
  generatedPlan?: string;
  productivityScore?: number;
  createdAt?: Date;
  updatedAt?: Date;
}

const ScheduleSchema = new Schema<ISchedule>(
  {
    userId: { type: String, required: true, index: true },

    date: { type: Date, required: true },

    tasks: {
      type: [String],
      default: [],
    },

    generatedPlan: { type: String },

    productivityScore: {
      type: Number,
      default: 0,
    },
  },
  { timestamps: true }
);

const ScheduleModel: Model<ISchedule> =
  mongoose.models.Schedule ||
  mongoose.model<ISchedule>("Schedule", ScheduleSchema);

export default ScheduleModel;