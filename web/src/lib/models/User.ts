import mongoose, { Schema, model, models } from "mongoose";

export interface IUser {
  _id: mongoose.Types.ObjectId;
  email: string;
  name: string;
  password_hash: string;
  role: "transportista" | "shipper";
  phone?: string;
  dni?: string;
  fleet_id?: mongoose.Types.ObjectId;
  created_at: Date;
}

const UserSchema = new Schema<IUser>(
  {
    email:         { type: String, required: true, unique: true, lowercase: true, trim: true },
    name:          { type: String, required: true, trim: true },
    password_hash: { type: String, required: true },
    role:          { type: String, enum: ["transportista", "shipper"], required: true },
    phone:         String,
    dni:           String,
    fleet_id:      { type: Schema.Types.ObjectId, ref: "User" },
  },
  { timestamps: { createdAt: "created_at", updatedAt: false } }
);

export const User = models.User || model<IUser>("User", UserSchema);
