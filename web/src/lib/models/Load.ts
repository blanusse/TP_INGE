import mongoose, { Schema, model, models } from "mongoose";

export interface ILoad {
  _id: mongoose.Types.ObjectId;
  shipper_id: mongoose.Types.ObjectId;
  pickup_city: string;
  dropoff_city: string;
  cargo_type?: string;
  truck_type_required?: string;
  weight_kg?: number;
  price_base?: number;
  ready_at?: Date;
  description?: string;
  status: "available" | "matched" | "in_transit" | "delivered" | "cancelled";
  created_at: Date;
}

const LoadSchema = new Schema<ILoad>(
  {
    shipper_id:          { type: Schema.Types.ObjectId, ref: "Shipper", required: true },
    pickup_city:         { type: String, required: true },
    dropoff_city:        { type: String, required: true },
    cargo_type:          String,
    truck_type_required: String,
    weight_kg:           Number,
    price_base:          Number,
    ready_at:            Date,
    description:         String,
    status: {
      type: String,
      enum: ["available", "matched", "in_transit", "delivered", "cancelled"],
      default: "available",
    },
  },
  { timestamps: { createdAt: "created_at", updatedAt: false } }
);

export const Load = models.Load || model<ILoad>("Load", LoadSchema);
