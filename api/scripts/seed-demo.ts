/**
 * Seed de datos demo para la presentación final.
 *
 * Crea:
 *   - 2 dadores de carga  (demo-dador1@cargaback.com, demo-dador2@cargaback.com)
 *   - 3 transportistas    (demo-trans1..3@cargaback.com)
 *   - 8 cargas (variedad de estados)
 *   - Ofertas y ratings
 *
 * Password para todas las cuentas: Demo1234!
 *
 * Uso:
 *   cd api
 *   npx ts-node scripts/seed-demo.ts
 *
 * Para limpiar datos previos: npx ts-node scripts/seed-demo.ts --reset
 */

import 'dotenv/config';
import { DataSource, In } from 'typeorm';
import * as bcrypt from 'bcryptjs';

import { User } from '../src/entities/user.entity';
import { Shipper } from '../src/entities/shipper.entity';
import { Load } from '../src/entities/load.entity';
import { Offer } from '../src/entities/offer.entity';
import { Rating } from '../src/entities/rating.entity';
import { Truck } from '../src/entities/truck.entity';
import { Payment } from '../src/entities/payment.entity';
import { Message } from '../src/entities/message.entity';
import { Notification } from '../src/entities/notification.entity';
import { TruckerDocument } from '../src/entities/trucker-document.entity';
import { Report } from '../src/entities/report.entity';
import { AuditLog } from '../src/entities/audit-log.entity';
import { LoadAlert } from '../src/entities/load-alert.entity';
import { EmailVerification } from '../src/entities/email-verification.entity';
import { IdentityVerification } from '../src/entities/identity-verification.entity';
import { FleetInvitation } from '../src/entities/fleet-invitation.entity';

const DEMO_PASSWORD = 'Demo1234!';
const DEMO_EMAIL_SUFFIX = '@cargaback-demo.com';

const DEMO_EMAILS = [
  'demo-dador1' + DEMO_EMAIL_SUFFIX,
  'demo-dador2' + DEMO_EMAIL_SUFFIX,
  'demo-trans1' + DEMO_EMAIL_SUFFIX,
  'demo-trans2' + DEMO_EMAIL_SUFFIX,
  'demo-trans3' + DEMO_EMAIL_SUFFIX,
];

async function main() {
  const reset = process.argv.includes('--reset');

  const dbUrl = process.env.DATABASE_URL ?? '';
  if (!dbUrl || dbUrl.includes('${{')) {
    console.error('');
    console.error('❌  DATABASE_URL no está configurada correctamente.');
    console.error('');
    console.error('   Para correr el seed localmente, necesitás la URL real de Railway.');
    console.error('   Obtenerla en: Railway → proyecto → Postgres → Connect → DATABASE_URL');
    console.error('');
    console.error('   Luego corré:');
    console.error('   DATABASE_URL="postgresql://..." npx ts-node scripts/seed-demo.ts');
    console.error('');
    process.exit(1);
  }

  const ds = new DataSource({
    type: 'postgres',
    url: process.env.DATABASE_URL,
    synchronize: false,
    entities: [
      User, Shipper, Load, Offer, Rating, Truck, Payment, Message,
      Notification, TruckerDocument, Report, AuditLog, LoadAlert,
      EmailVerification, IdentityVerification, FleetInvitation,
    ],
  });

  await ds.initialize();
  console.log('✓ Conectado a la base de datos');

  const usersRepo    = ds.getRepository(User);
  const shippersRepo = ds.getRepository(Shipper);
  const loadsRepo    = ds.getRepository(Load);
  const offersRepo   = ds.getRepository(Offer);
  const ratingsRepo  = ds.getRepository(Rating);
  const trucksRepo   = ds.getRepository(Truck);

  if (reset) {
    console.log('⚠  Eliminando datos demo previos...');
    const existingUsers = await usersRepo.find({
      where: { email: In(DEMO_EMAILS) },
    });
    if (existingUsers.length > 0) {
      const ids = existingUsers.map((u) => u.id);
      const shippers = await shippersRepo.find({ where: { user_id: In(ids) } });
      const shipperIds = shippers.map((s) => s.id);
      const loads = shipperIds.length
        ? await loadsRepo.find({ where: { shipper_id: In(shipperIds) } })
        : [];
      const loadIds = loads.map((l) => l.id);
      if (loadIds.length) {
        const offers = await offersRepo.find({ where: { load_id: In(loadIds) } });
        const offerIds = offers.map((o) => o.id);
        if (offerIds.length) {
          await ratingsRepo.delete({ offer_id: In(offerIds) });
          await offersRepo.delete({ id: In(offerIds) });
        }
        await loadsRepo.delete({ id: In(loadIds) });
      }
      await shippersRepo.delete({ user_id: In(ids) });
      await trucksRepo.delete({ owner_id: In(ids) });
      await usersRepo.delete({ id: In(ids) });
      console.log('✓ Datos previos eliminados');
    }
  }

  // ── Verificar si ya existe ────────────────────────────────────────────────
  const existing = await usersRepo.findOne({
    where: { email: DEMO_EMAILS[0] },
  });
  if (existing) {
    console.log('ℹ  Los datos demo ya existen. Usá --reset para recrearlos.');
    await ds.destroy();
    return;
  }

  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);

  // ── 1. Crear usuarios ─────────────────────────────────────────────────────
  console.log('Creando usuarios...');

  const dador1 = usersRepo.create({
    email: 'demo-dador1' + DEMO_EMAIL_SUFFIX,
    name: 'María López',
    password_hash: passwordHash,
    role: 'shipper',
    phone: '+54 11 4523-7890',
    dni: '28456123',
    is_verified: true,
    identity_verified: true,
    dni_verified: true,
  });

  const dador2 = usersRepo.create({
    email: 'demo-dador2' + DEMO_EMAIL_SUFFIX,
    name: 'Carlos Mendez',
    password_hash: passwordHash,
    role: 'shipper',
    phone: '+54 11 3312-5678',
    dni: '31789456',
    is_verified: true,
    identity_verified: true,
    dni_verified: true,
  });

  const trans1 = usersRepo.create({
    email: 'demo-trans1' + DEMO_EMAIL_SUFFIX,
    name: 'Juan Pérez',
    password_hash: passwordHash,
    role: 'transportista',
    phone: '+54 341 456-7890',
    dni: '25678901',
    is_verified: true,
    identity_verified: true,
    dni_verified: true,
    license_verified: true,
  });

  const trans2 = usersRepo.create({
    email: 'demo-trans2' + DEMO_EMAIL_SUFFIX,
    name: 'Roberto Sosa',
    password_hash: passwordHash,
    role: 'transportista',
    phone: '+54 261 567-8901',
    dni: '22345678',
    is_verified: true,
    identity_verified: true,
    dni_verified: true,
    license_verified: true,
  });

  const trans3 = usersRepo.create({
    email: 'demo-trans3' + DEMO_EMAIL_SUFFIX,
    name: 'Ana Martínez',
    password_hash: passwordHash,
    role: 'transportista',
    phone: '+54 351 678-9012',
    dni: '33456789',
    is_verified: true,
    identity_verified: true,
    dni_verified: true,
    license_verified: true,
  });

  await usersRepo.save([dador1, dador2, trans1, trans2, trans3]);
  console.log('✓ Usuarios creados');

  // ── 2. Shippers ───────────────────────────────────────────────────────────
  const shipper1 = shippersRepo.create({
    user_id: dador1.id,
    tipo: 'empresa',
    razon_social: 'Agroexport SRL',
    cuit: '30-71234567-8',
    address: 'Av. Corrientes 1234, CABA',
  });

  const shipper2 = shippersRepo.create({
    user_id: dador2.id,
    tipo: 'empresa',
    razon_social: 'Distribuidora Nacional SA',
    cuit: '30-98765432-1',
    address: 'Ruta 9 km 45, Córdoba',
  });

  await shippersRepo.save([shipper1, shipper2]);
  console.log('✓ Shippers creados');

  // ── 3. Camiones ───────────────────────────────────────────────────────────
  const truck1 = trucksRepo.create({
    owner_id: trans1.id,
    patente: 'AC 456 GH',
    marca: 'Mercedes-Benz',
    modelo: 'Actros 2651',
    año: 2019,
    truck_type: 'semi',
    capacity_kg: 28000,
    vtv_verified: true,
    seguro_verified: true,
    cedula_verde_verified: true,
  });

  const truck2 = trucksRepo.create({
    owner_id: trans2.id,
    patente: 'BK 123 DF',
    marca: 'Scania',
    modelo: 'R 450',
    año: 2021,
    truck_type: 'semi',
    capacity_kg: 25000,
    vtv_verified: true,
    seguro_verified: true,
    cedula_verde_verified: true,
  });

  const truck3 = trucksRepo.create({
    owner_id: trans3.id,
    patente: 'GH 789 JK',
    marca: 'Volvo',
    modelo: 'FH 500',
    año: 2020,
    truck_type: 'frigorifico',
    capacity_kg: 22000,
    vtv_verified: true,
    seguro_verified: true,
    cedula_verde_verified: true,
  });

  await trucksRepo.save([truck1, truck2, truck3]);
  console.log('✓ Camiones creados');

  // ── 4. Cargas ─────────────────────────────────────────────────────────────
  const now = new Date();
  const daysAgo = (n: number) => new Date(now.getTime() - n * 86_400_000);
  const daysFromNow = (n: number) => new Date(now.getTime() + n * 86_400_000);

  const loads = loadsRepo.create([
    // Disponibles (para ofertar en demo)
    {
      shipper_id: shipper1.id,
      pickup_city: 'Rosario',
      dropoff_city: 'Buenos Aires',
      pickup_exact: 'Av. Pellegrini 1200, Rosario',
      dropoff_exact: 'Av. Directorio 3400, CABA',
      pickup_lat: -32.9468,
      pickup_lon: -60.6393,
      dropoff_lat: -34.6037,
      dropoff_lon: -58.3816,
      cargo_type: 'Soja',
      truck_type_required: 'acoplado',
      weight_kg: 22000,
      price_base: 180000,
      distance_km: 305,
      ready_at: daysFromNow(2),
      description: 'Carga de soja en bolsas de 50kg, bien embalada. Carga y descarga a cargo del remitente.',
      status: 'available',
    },
    {
      shipper_id: shipper1.id,
      pickup_city: 'Buenos Aires',
      dropoff_city: 'Córdoba',
      pickup_exact: 'Parque Industrial Pilar, Ruta 8 km 62',
      dropoff_exact: 'Av. Colón 4500, Córdoba Capital',
      pickup_lat: -34.4587,
      pickup_lon: -58.9138,
      dropoff_lat: -31.4135,
      dropoff_lon: -64.1811,
      cargo_type: 'Electrodomésticos',
      truck_type_required: 'camion',
      weight_kg: 8500,
      price_base: 95000,
      distance_km: 710,
      ready_at: daysFromNow(1),
      description: 'Electrodomésticos embalados en cajas. Requiere cuidado en la manipulación.',
      status: 'available',
    },
    {
      shipper_id: shipper2.id,
      pickup_city: 'Mendoza',
      dropoff_city: 'Buenos Aires',
      pickup_exact: 'Ruta Nacional 7 km 1050, Mendoza',
      dropoff_exact: 'Dock Sud, Avellaneda',
      pickup_lat: -32.8908,
      pickup_lon: -68.8272,
      dropoff_lat: -34.6636,
      dropoff_lon: -58.3422,
      cargo_type: 'Vino en caja',
      truck_type_required: 'camion',
      weight_kg: 12000,
      price_base: 220000,
      distance_km: 1040,
      ready_at: daysFromNow(3),
      description: 'Cajas de vino fino. Temperatura ambiente controlada. Prohibido apilar más de 4 capas.',
      status: 'available',
    },
    {
      shipper_id: shipper2.id,
      pickup_city: 'Tucumán',
      dropoff_city: 'Buenos Aires',
      pickup_exact: 'Ruta 9 km 1200, San Miguel de Tucumán',
      dropoff_exact: 'Mercado Central, La Matanza',
      pickup_lat: -26.8083,
      pickup_lon: -65.2176,
      dropoff_lat: -34.6722,
      dropoff_lon: -58.5611,
      cargo_type: 'Frutas',
      truck_type_required: 'frigorifico',
      weight_kg: 14000,
      price_base: 145000,
      distance_km: 1310,
      ready_at: daysFromNow(1),
      description: 'Limones y naranjas. Temperatura de transporte: 6-8°C.',
      status: 'available',
    },
    {
      shipper_id: shipper1.id,
      pickup_city: 'Córdoba',
      dropoff_city: 'Rosario',
      pickup_exact: 'Parque Industrial Ferreyra, Córdoba',
      dropoff_exact: 'Puerto de Rosario, Santa Fe',
      pickup_lat: -31.4135,
      pickup_lon: -64.1811,
      dropoff_lat: -32.9468,
      dropoff_lon: -60.6393,
      cargo_type: 'Autopartes',
      truck_type_required: 'camion',
      weight_kg: 5000,
      price_base: 75000,
      distance_km: 390,
      ready_at: daysFromNow(4),
      description: 'Autopartes en pallets. Carga con autoelevador disponible.',
      status: 'available',
    },
    // En tránsito (oferta aceptada)
    {
      shipper_id: shipper1.id,
      pickup_city: 'Mar del Plata',
      dropoff_city: 'Buenos Aires',
      pickup_exact: 'Puerto de Mar del Plata, Buenos Aires',
      dropoff_exact: 'Av. Independencia 1560, CABA',
      pickup_lat: -38.0055,
      pickup_lon: -57.5426,
      dropoff_lat: -34.6154,
      dropoff_lon: -58.3958,
      cargo_type: 'Pescado fresco',
      truck_type_required: 'frigorifico',
      weight_kg: 18000,
      price_base: 130000,
      distance_km: 404,
      ready_at: daysAgo(1),
      description: 'Pescado fresco en cajones de hielo. Entrega urgente.',
      status: 'in_transit',
    },
    // Entregada (hace 5 días, con rating)
    {
      shipper_id: shipper2.id,
      pickup_city: 'Buenos Aires',
      dropoff_city: 'Mendoza',
      pickup_exact: 'Parque Industrial Morón, Buenos Aires',
      dropoff_exact: 'Depósito Central, Godoy Cruz, Mendoza',
      pickup_lat: -34.6503,
      pickup_lon: -58.6195,
      dropoff_lat: -32.9268,
      dropoff_lon: -68.8603,
      cargo_type: 'Bebidas',
      truck_type_required: 'camion',
      weight_kg: 16000,
      price_base: 195000,
      distance_km: 1042,
      ready_at: daysAgo(8),
      description: 'Bebidas en latas y botellas. Pallets plastificados.',
      status: 'delivered',
    },
    // Entregada (hace 20 días, con rating)
    {
      shipper_id: shipper1.id,
      pickup_city: 'Rosario',
      dropoff_city: 'Córdoba',
      pickup_exact: 'Zona Franca Rosario',
      dropoff_exact: 'Barrio Industrias, Córdoba Capital',
      pickup_lat: -32.9468,
      pickup_lon: -60.6393,
      dropoff_lat: -31.4135,
      dropoff_lon: -64.1811,
      cargo_type: 'Materiales de construcción',
      truck_type_required: 'semi',
      weight_kg: 20000,
      price_base: 85000,
      distance_km: 320,
      ready_at: daysAgo(22),
      description: 'Bolsas de cemento y materiales varios.',
      status: 'delivered',
    },
  ]);

  await loadsRepo.save(loads);
  const [
    loadSoja, loadElectro, loadVino, loadFrutas, loadAuto,
    loadPescado, loadBebidas, loadCemento,
  ] = loads;
  console.log('✓ Cargas creadas');

  // ── 5. Ofertas ────────────────────────────────────────────────────────────

  // Ofertas pendientes sobre cargas disponibles
  const offersPending = offersRepo.create([
    {
      load_id: loadSoja.id,
      driver_id: trans1.id,
      truck_id: truck1.id,
      price: 172000,
      note: 'Disponible desde mañana. Tengo camión acoplado en zona.',
      status: 'pending',
    },
    {
      load_id: loadSoja.id,
      driver_id: trans2.id,
      truck_id: truck2.id,
      price: 168000,
      note: 'Paso por Rosario la semana que viene.',
      status: 'pending',
    },
    {
      load_id: loadElectro.id,
      driver_id: trans1.id,
      truck_id: truck1.id,
      price: 90000,
      status: 'pending',
    },
    {
      load_id: loadVino.id,
      driver_id: trans3.id,
      truck_id: truck3.id,
      price: 210000,
      note: 'Tengo flete disponible hacia BsAs. Ofrezco seguro adicional.',
      status: 'pending',
    },
    {
      load_id: loadFrutas.id,
      driver_id: trans3.id,
      truck_id: truck3.id,
      price: 138000,
      note: 'Camión frigorífico en perfectas condiciones.',
      status: 'pending',
    },
    {
      load_id: loadAuto.id,
      driver_id: trans2.id,
      truck_id: truck2.id,
      price: 71000,
      status: 'pending',
    },
    // Contraoferta del dador en carga de electro
    {
      load_id: loadElectro.id,
      driver_id: trans2.id,
      truck_id: truck2.id,
      price: 88000,
      counter_price: 93000,
      note: 'Contraoferta: $93.000 incluye seguro.',
      status: 'countered',
    },
  ]);

  await offersRepo.save(offersPending);

  // Oferta aceptada para carga en tránsito (pescado)
  const offerTransito = offersRepo.create({
    load_id: loadPescado.id,
    driver_id: trans1.id,
    truck_id: truck1.id,
    price: 125000,
    status: 'accepted',
  });
  await offersRepo.save(offerTransito);

  // Oferta aceptada para carga entregada (bebidas) — 5 días atrás
  const offerBebidas = offersRepo.create({
    load_id: loadBebidas.id,
    driver_id: trans2.id,
    truck_id: truck2.id,
    price: 188000,
    status: 'accepted',
  });
  await offersRepo.save(offerBebidas);

  // Oferta aceptada para carga entregada (cemento) — 20 días atrás
  const offerCemento = offersRepo.create({
    load_id: loadCemento.id,
    driver_id: trans1.id,
    truck_id: truck1.id,
    price: 82000,
    status: 'accepted',
  });
  await offersRepo.save(offerCemento);

  console.log('✓ Ofertas creadas');

  // ── 6. Ratings ────────────────────────────────────────────────────────────
  const ratings = ratingsRepo.create([
    // Bebidas: dador → transportista
    {
      load_id: loadBebidas.id,
      offer_id: offerBebidas.id,
      from_user_id: dador2.id,
      to_user_id: trans2.id,
      score: 5,
      comment: 'Excelente servicio. Entrega puntual y mercadería en perfecto estado.',
    },
    // Bebidas: transportista → dador
    {
      load_id: loadBebidas.id,
      offer_id: offerBebidas.id,
      from_user_id: trans2.id,
      to_user_id: dador2.id,
      score: 5,
      comment: 'Buena carga, bien embalada. Carga y descarga rápidas.',
    },
    // Cemento: dador → transportista
    {
      load_id: loadCemento.id,
      offer_id: offerCemento.id,
      from_user_id: dador1.id,
      to_user_id: trans1.id,
      score: 4,
      comment: 'Llegó un poco tarde pero el trato fue muy bueno.',
    },
    // Cemento: transportista → dador
    {
      load_id: loadCemento.id,
      offer_id: offerCemento.id,
      from_user_id: trans1.id,
      to_user_id: dador1.id,
      score: 5,
      comment: 'Todo en orden. Buena logística de carga.',
    },
  ]);

  await ratingsRepo.save(ratings);
  console.log('✓ Ratings creados');

  await ds.destroy();

  console.log('\n✅ Seed completado exitosamente!');
  console.log('──────────────────────────────────────────────');
  console.log('Cuentas de demo (password: Demo1234!):');
  console.log('');
  console.log('  DADORES DE CARGA:');
  console.log('  demo-dador1@cargaback-demo.com  → María López (Agroexport SRL)');
  console.log('  demo-dador2@cargaback-demo.com  → Carlos Mendez (Distribuidora Nacional SA)');
  console.log('');
  console.log('  TRANSPORTISTAS:');
  console.log('  demo-trans1@cargaback-demo.com  → Juan Pérez');
  console.log('  demo-trans2@cargaback-demo.com  → Roberto Sosa');
  console.log('  demo-trans3@cargaback-demo.com  → Ana Martínez');
  console.log('──────────────────────────────────────────────');
}

main().catch((err) => {
  console.error('Error en seed:', err);
  process.exit(1);
});
