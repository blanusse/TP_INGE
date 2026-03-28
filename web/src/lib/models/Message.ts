import mongoose, { Schema, model, models } from "mongoose";

export interface IMessage {
  offer_id:   mongoose.Types.ObjectId;
  sender_id:  mongoose.Types.ObjectId;
  content:    string;
  created_at: Date;
}

const MessageSchema = new Schema<IMessage>(
  {
    offer_id:  { type: Schema.Types.ObjectId, ref: "Offer",  required: true },
    sender_id: { type: Schema.Types.ObjectId, ref: "User",   required: true },
    content:   { type: String, required: true, trim: true },
  },
  { timestamps: { createdAt: "created_at", updatedAt: false } }
);

MessageSchema.index({ offer_id: 1, created_at: 1 });

export const Message = models.Message || model<IMessage>("Message", MessageSchema);
