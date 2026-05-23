import mongoose, { Schema, Document, Model } from "mongoose";

export interface IProductivityLog extends Document {
  userId: string;
  date: Date;
  completedTasks: number;
  delayedTasks: number;
  focusTime: number;
  notes?: string;
  createdAt?: Date;
}

const ProductivityLogSchema = new Schema<IProductivityLog>(
  {
    userId: { type: String, required: true, index: true },

    date: {
      type: Date,
      required: true,
    },

    completedTasks: {
      type: Number,
      default: 0,
    },

    delayedTasks: {
      type: Number,
      default: 0,
    },

    focusTime: {
      type: Number,
      default: 0,
    },

    notes: { type: String },
  },
  { timestamps: true }
);

const ProductivityLogModel: Model<IProductivityLog> =
  mongoose.models.ProductivityLog ||
  mongoose.model<IProductivityLog>(
    "ProductivityLog",
    ProductivityLogSchema
  );

export default ProductivityLogModel;