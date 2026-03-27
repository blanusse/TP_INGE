-- Ejecutar en Supabase Dashboard > SQL Editor

-- DNI del usuario (relevante para camioneros)
alter table users add column dni text;

-- Campos extra del camión
alter table trucks add column año int;
alter table trucks add column vtv_vence date;
alter table trucks add column seguro_poliza text;
alter table trucks add column seguro_vence date;
