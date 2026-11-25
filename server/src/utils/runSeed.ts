/**
 * ============================================================================
 * File: server/src/utils/runSeed.ts
 * Purpose: Standalone CLI script to initialize/seed the active database.
 * Responsibilities:
 *   - In `local` mode: initializes `server/data/railyatra.db` and runs seed.
 *   - In `supabase` mode: populates `stations`, `trains`, `train_schedules`,
 *     and `train_classes` in Supabase PostgreSQL via Service Role key.
 * Used by: `npm run seed` (`npm --prefix server run seed`).
 * ============================================================================
 */

import { env } from '../config/env.js';
import { getSqliteDb } from '../db/sqliteClient.js';
import { getSupabaseAdmin } from '../db/supabaseClient.js';
import { SEED_STATIONS, SEED_TRAINS } from './seedData.js';

async function seedSupabaseCatalog() {
  const supabase = getSupabaseAdmin();
  console.log('[RailYatra Seed] Seeding Supabase PostgreSQL catalog...');

  const { error: stationError } = await supabase
    .from('stations')
    .upsert(SEED_STATIONS, { onConflict: 'code' });
  if (stationError) throw stationError;

  for (const t of SEED_TRAINS) {
    const { data: trainRow, error: trainErr } = await supabase
      .from('trains')
      .upsert(
        {
          train_number: t.train_number,
          train_name: t.train_name,
          train_type: t.train_type,
          source_station_code: t.source_station_code,
          destination_station_code: t.destination_station_code,
          running_days: t.running_days,
          total_distance_km: t.total_distance_km,
          duration_minutes: t.duration_minutes,
          is_active: true,
        },
        { onConflict: 'train_number' }
      )
      .select('id')
      .single();

    if (trainErr || !trainRow) throw trainErr || new Error('Failed to upsert train');

    const stopsPayload = t.stops.map((stop) => ({
      train_id: trainRow.id,
      ...stop,
    }));
    const { error: stopErr } = await supabase
      .from('train_schedules')
      .upsert(stopsPayload, { onConflict: 'train_id,station_code' });
    if (stopErr) throw stopErr;

    const classesPayload = t.classes.map((cls) => ({
      train_id: trainRow.id,
      class_code: cls.class_code,
      class_name: cls.class_name,
      base_fare: cls.base_fare,
      total_seats: cls.total_seats,
      coaches: JSON.stringify(cls.coaches),
    }));
    const { error: clsErr } = await supabase
      .from('train_classes')
      .upsert(classesPayload, { onConflict: 'train_id,class_code' });
    if (clsErr) throw clsErr;
  }

  console.log('[RailYatra Seed] Supabase catalog seed completed successfully!');
}

async function main() {
  if (env.provider === 'supabase') {
    await seedSupabaseCatalog();
  } else {
    getSqliteDb();
    console.log('[RailYatra Seed] Local SQLite database ready.');
  }
}

main().catch((err) => {
  console.error('[RailYatra Seed] Failed:', err);
  process.exit(1);
});
