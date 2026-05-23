import mongoose, { Schema, Document, Model } from "mongoose";

export interface IChatHistory extends Document {
  userId: string;
  role: "user" | "assistant";
  message: string;
  createdAt?: Date;
}

const ChatHistorySchema = new Schema<IChatHistory>(
  {
    userId: { type: String, required: true, index: true },

    role: {
      type: String,
      enum: ["user", "assistant"],
      required: true,
    },

    message: {
      type: String,
      required: true,
    },
  },
  { timestamps: true }
);

const ChatHistoryModel: Model<IChatHistory> =
  mongoose.models.ChatHistory ||
  mongoose.model<IChatHistory>("ChatHistory", ChatHistorySchema);

export default ChatHistoryModel;