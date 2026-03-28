import mongoose, { Schema, model, models } from "mongoose";

const TruckSchema = new Schema({
  owner_id:      { type: Schema.Types.ObjectId, ref: "User", required: true },
  patente:       { type: String, required: true },
  marca:         String,
  modelo:        String,
  año:           Number,
  truck_type:    String,
  capacity_kg:   Number,
  vtv_vence:     String,
  seguro_poliza: String,
  seguro_vence:  String,
});

export const Truck = models.Truck || model("Truck", TruckSchema);
