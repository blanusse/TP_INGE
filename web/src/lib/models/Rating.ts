import mongoose, { Schema, model, models } from "mongoose";

export interface IRating {
  _id: mongoose.Types.ObjectId;
  load_id: mongoose.Types.ObjectId;
  offer_id: mongoose.Types.ObjectId;
  from_user_id: mongoose.Types.ObjectId;
  to_user_id: mongoose.Types.ObjectId;
  score: number;
  created_at: Date;
}

const RatingSchema = new Schema<IRating>(
  {
    load_id:      { type: Schema.Types.ObjectId, ref: "Load",  required: true },
    offer_id:     { type: Schema.Types.ObjectId, ref: "Offer", required: true },
    from_user_id: { type: Schema.Types.ObjectId, ref: "User",  required: true },
    to_user_id:   { type: Schema.Types.ObjectId, ref: "User",  required: true },
    score:        { type: Number, required: true, min: 1, max: 5 },
  },
  { timestamps: { createdAt: "created_at", updatedAt: false } }
);

// Un usuario solo puede calificar una vez por oferta
RatingSchema.index({ offer_id: 1, from_user_id: 1 }, { unique: true });

export const Rating = models.Rating || model<IRating>("Rating", RatingSchema);
