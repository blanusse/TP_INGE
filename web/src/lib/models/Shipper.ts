import mongoose, { Schema, model, models } from "mongoose";

export interface IShipper {
  _id: mongoose.Types.ObjectId;
  user_id: mongoose.Types.ObjectId;
  tipo: "empresa" | "persona";
  razon_social?: string;
  cuit?: string;
  cuil?: string;
  address?: string;
}

const ShipperSchema = new Schema<IShipper>({
  user_id:      { type: Schema.Types.ObjectId, ref: "User", required: true, unique: true },
  tipo:         { type: String, enum: ["empresa", "persona"], required: true, default: "empresa" },
  razon_social: String,
  cuit:         String,
  cuil:         String,
  address:      String,
});

export const Shipper = models.Shipper || model<IShipper>("Shipper", ShipperSchema);
