import mongoose, { Schema, Document, Model } from "mongoose";

export interface INotification extends Document {
  userId: string;
  title: string;
  message: string;
  type: "Reminder" | "Deadline" | "AI Suggestion";
  isRead: boolean;
  createdAt?: Date;
  updatedAt?: Date;
}

const NotificationSchema = new Schema<INotification>(
  {
    userId: { type: String, required: true, index: true },

    title: { type: String, required: true },

    message: { type: String, required: true },

    type: {
      type: String,
      enum: ["Reminder", "Deadline", "AI Suggestion"],
      default: "Reminder",
    },

    isRead: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

const NotificationModel: Model<INotification> =
  mongoose.models.Notification ||
  mongoose.model<INotification>("Notification", NotificationSchema);

export default NotificationModel;