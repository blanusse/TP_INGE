-- ============================================================
-- Routix — Schema completo
-- Ejecutar en: Supabase Dashboard > SQL Editor
-- ============================================================

-- Enums
create type user_role        as enum ('driver', 'shipper', 'admin');
create type truck_type       as enum ('camion', 'semi', 'acoplado', 'frigorifico', 'cisterna', 'otros');
create type cert_type        as enum ('licencia', 'rto', 'seguro', 'habilitacion_carga', 'otros');
create type trip_status      as enum ('planned', 'in_progress', 'completed', 'cancelled');
create type load_status      as enum ('available', 'matched', 'in_transit', 'delivered', 'cancelled');
create type match_status     as enum ('suggested', 'accepted', 'rejected', 'completed');
create type waybill_status   as enum ('draft', 'issued', 'in_transit', 'delivered', 'cancelled');

-- ============================================================
-- users
-- ============================================================
create table users (
  id          uuid primary key default gen_random_uuid(),
  email       text not null unique,
  name        text not null,
  phone       text,
  role        user_role not null default 'driver',
  avatar_url  text,
  rating      float default 0,
  created_at  timestamptz not null default now()
);

-- ============================================================
-- companies
-- ============================================================
create table companies (
  id              uuid primary key default gen_random_uuid(),
  razon_social    text not null,
  cuit            text not null unique,
  address         text,
  contact_name    text,
  contact_email   text,
  contact_phone   text,
  created_at      timestamptz not null default now()
);

-- ============================================================
-- company_drivers  (empresa ↔ chofer)
-- ============================================================
create table company_drivers (
  id          uuid primary key default gen_random_uuid(),
  company_id  uuid not null references companies(id) on delete cascade,
  driver_id   uuid not null references users(id) on delete cascade,
  joined_at   timestamptz not null default now(),
  unique (company_id, driver_id)
);

-- ============================================================
-- trucks
-- ============================================================
create table trucks (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null references users(id) on delete cascade,
  patente     text not null unique,
  marca       text,
  modelo      text,
  truck_type  truck_type not null,
  capacity_kg float,
  photo_url   text,
  created_at  timestamptz not null default now()
);

-- ============================================================
-- driver_certifications
-- ============================================================
create table driver_certifications (
  id          uuid primary key default gen_random_uuid(),
  driver_id   uuid not null references users(id) on delete cascade,
  cert_type   cert_type not null,
  number      text,
  issued_at   date,
  expires_at  date,
  verified    boolean not null default false
);

-- ============================================================
-- shippers  (dadores de carga)
-- ============================================================
create table shippers (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references users(id) on delete cascade,
  cuit          text not null unique,
  razon_social  text not null,
  address       text,
  cargo_types   text[] default '{}'
);

-- ============================================================
-- trips  (viajes publicados por choferes)
-- ============================================================
create table trips (
  id           uuid primary key default gen_random_uuid(),
  driver_id    uuid not null references users(id) on delete cascade,
  truck_id     uuid not null references trucks(id) on delete set null,
  company_id   uuid references companies(id) on delete set null,
  origin_lat   float,
  origin_lng   float,
  origin_city  text not null,
  dest_lat     float,
  dest_lng     float,
  dest_city    text not null,
  depart_at    timestamptz not null,
  total_km     float,
  empty_km     float,
  loaded_km    float,
  status       trip_status not null default 'planned'
);

-- ============================================================
-- loads  (cargas publicadas por dadores)
-- ============================================================
create table loads (
  id                      uuid primary key default gen_random_uuid(),
  shipper_id              uuid not null references shippers(id) on delete cascade,
  pickup_lat              float,
  pickup_lng              float,
  pickup_city             text not null,
  dropoff_lat             float,
  dropoff_lng             float,
  dropoff_city            text not null,
  cargo_type              text,
  truck_type_required     truck_type,
  weight_kg               float,
  certifications_required text[] default '{}',
  ready_at                timestamptz,
  status                  load_status not null default 'available'
);

-- ============================================================
-- matches  (sugerencias de matcheo viaje ↔ carga)
-- ============================================================
create table matches (
  id            uuid primary key default gen_random_uuid(),
  trip_id       uuid not null references trips(id) on delete cascade,
  load_id       uuid not null references loads(id) on delete cascade,
  accepted_by   uuid references users(id) on delete set null,
  km_saved      float,
  score         float,
  status        match_status not null default 'suggested',
  suggested_at  timestamptz not null default now(),
  resolved_at   timestamptz
);

-- ============================================================
-- waybills  (remitos / carta de porte)
-- ============================================================
create table waybills (
  id                uuid primary key default gen_random_uuid(),
  match_id          uuid not null references matches(id) on delete cascade,
  siac_number       text,
  cargo_description text,
  weight_kg         float,
  precinto          text,
  issued_at         timestamptz,
  status            waybill_status not null default 'draft'
);

-- ============================================================
-- reviews
-- ============================================================
create table reviews (
  id           uuid primary key default gen_random_uuid(),
  reviewer_id  uuid not null references users(id) on delete cascade,
  reviewed_id  uuid not null references users(id) on delete cascade,
  match_id     uuid not null references matches(id) on delete cascade,
  score        float not null check (score >= 1 and score <= 5),
  comment      text,
  created_at   timestamptz not null default now(),
  unique (reviewer_id, match_id)
);

-- ============================================================
-- Indexes útiles
-- ============================================================
create index on trips(driver_id);
create index on trips(status);
create index on loads(shipper_id);
create index on loads(status);
create index on matches(trip_id);
create index on matches(load_id);
create index on matches(status);
