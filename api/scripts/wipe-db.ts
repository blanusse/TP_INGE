/**
 * Borra TODOS los datos de la base y conserva únicamente las cuentas admin.
 *
 * Conserva:
 *   - users con role = 'admin'
 *
 * Uso:
 *   cd api
 *   DATABASE_URL="postgresql://..." npx ts-node scripts/wipe-db.ts            → dry-run (solo muestra qué borraría)
 *   DATABASE_URL="postgresql://..." npx ts-node scripts/wipe-db.ts --confirm  → borra de verdad
 */

import 'dotenv/config';
import { DataSource } from 'typeorm';

const TABLAS_A_VACIAR = [
  'trip_locations',
  'audit_logs',
  'ratings',
  'reports',
  'payments',
  'messages',
  'notifications',
  'insurance_policies',
  'insurance_products',
  'load_alerts',
  'offers',
  'loads',
  'trucker_documents',
  'identity_verifications',
  'email_verifications',
  'fleet_invitations',
  'trucks',
  'shippers',
];

async function main() {
  const confirm = process.argv.includes('--confirm');

  const dbUrl = process.env.DATABASE_URL ?? '';
  if (!dbUrl || dbUrl.includes('${{')) {
    console.error('');
    console.error('❌  DATABASE_URL no está configurada correctamente.');
    console.error('');
    console.error('   Obtenerla en: Railway → proyecto → Postgres → Connect → DATABASE_URL');
    console.error('');
    console.error('   Luego corré:');
    console.error('   DATABASE_URL="postgresql://..." npx ts-node scripts/wipe-db.ts --confirm');
    console.error('');
    process.exit(1);
  }

  const ds = new DataSource({ type: 'postgres', url: dbUrl, synchronize: false });
  await ds.initialize();
  console.log('✓ Conectado a la base de datos');

  const admins: { id: string; email: string }[] = await ds.query(
    `SELECT id, email FROM users WHERE role = 'admin'`,
  );
  if (admins.length === 0) {
    console.error('❌  No hay ningún usuario con role = admin. Abortando: quedaría la base sin cuentas.');
    await ds.destroy();
    process.exit(1);
  }
  console.log(`✓ Cuentas admin que se conservan: ${admins.map((a) => a.email).join(', ')}`);

  console.log('');
  console.log('Filas por tabla:');
  for (const tabla of [...TABLAS_A_VACIAR, 'users']) {
    const [{ count }] = await ds.query(`SELECT COUNT(*)::int AS count FROM ${tabla}`);
    console.log(`  ${tabla.padEnd(24)} ${count}`);
  }

  if (!confirm) {
    console.log('');
    console.log('Dry-run: no se borró nada. Para ejecutar el borrado agregá --confirm');
    await ds.destroy();
    return;
  }

  console.log('');
  console.log('⚠  Borrando datos...');
  await ds.transaction(async (tx) => {
    await tx.query(
      `TRUNCATE TABLE ${TABLAS_A_VACIAR.join(', ')} RESTART IDENTITY CASCADE`,
    );
    await tx.query(`DELETE FROM users WHERE role <> 'admin'`);
  });

  const [{ count: usuariosRestantes }] = await ds.query(
    `SELECT COUNT(*)::int AS count FROM users`,
  );
  console.log(`✓ Listo. Usuarios restantes: ${usuariosRestantes} (solo admin).`);
  await ds.destroy();
}

main().catch((err) => {
  console.error('❌  Error:', err.message ?? err);
  process.exit(1);
});
