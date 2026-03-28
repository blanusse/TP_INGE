import mongoose, { Schema, model, models } from "mongoose";

export interface ILoad {
  _id: mongoose.Types.ObjectId;
  shipper_id: mongoose.Types.ObjectId;
  /** Zona aproximada — barrio/ciudad, sin dirección exacta. Visible a todos. */
  pickup_city: string;
  /** Zona aproximada — barrio/ciudad, sin dirección exacta. Visible a todos. */
  dropoff_city: string;
  /** Dirección exacta de retiro — visible solo al camionero con oferta aceptada. */
  pickup_exact?: string;
  /** Dirección exacta de entrega — visible solo al camionero con oferta aceptada. */
  dropoff_exact?: string;
  pickup_lat?: number;
  pickup_lon?: number;
  dropoff_lat?: number;
  dropoff_lon?: number;
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
    pickup_exact:        String,
    dropoff_exact:       String,
    pickup_lat:          Number,
    pickup_lon:          Number,
    dropoff_lat:         Number,
    dropoff_lon:         Number,
    cargo_type:          String,
    truck_type_required: String,
    weight_kg:           Number,
    price_base:          Number,
    ready_at:            Date,
    description:         String,
    status: {
      type:    String,
      enum:    ["available", "matched", "in_transit", "delivered", "cancelled"],
      default: "available",
    },
  },
  { timestamps: { createdAt: "created_at", updatedAt: false } }
);

export const Load = models.Load || model<ILoad>("Load", LoadSchema);
