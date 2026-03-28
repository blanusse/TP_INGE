import mongoose, { Schema, model, models } from "mongoose";

export interface IOffer {
  _id: mongoose.Types.ObjectId;
  load_id: mongoose.Types.ObjectId;
  driver_id: mongoose.Types.ObjectId;
  price: number;
  note?: string;
  status: "pending" | "accepted" | "rejected";
  created_at: Date;
}

const OfferSchema = new Schema<IOffer>(
  {
    load_id:   { type: Schema.Types.ObjectId, ref: "Load",  required: true },
    driver_id: { type: Schema.Types.ObjectId, ref: "User",  required: true },
    price:     { type: Number, required: true },
    note:      String,
    status:    { type: String, enum: ["pending", "accepted", "rejected"], default: "pending" },
  },
  { timestamps: { createdAt: "created_at", updatedAt: false } }
);

// Un camionero solo puede ofertar una vez por carga
OfferSchema.index({ load_id: 1, driver_id: 1 }, { unique: true });

export const Offer = models.Offer || model<IOffer>("Offer", OfferSchema);
