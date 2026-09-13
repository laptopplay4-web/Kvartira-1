#!/usr/bin/env node
/**
 * CLI: npm run pb:seed
 * ROADMAP 1.5 — load demo data from src/mocks/seed.ts into PocketBase.
 */

import { PbClient } from './pbClient';
import { ensureLegalDocuments } from './ensureLegal';
import { runSeed } from './run';

function env(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (!value) throw new Error(`Missing env: ${name}`);
  return value;
}

async function main(): Promise<void> {
  const force = process.argv.includes('--force');
  const baseUrl = env('PB_URL', env('VITE_API_URL', 'http://127.0.0.1:8090'));
  const email = env('PB_ADMIN_EMAIL');
  const password = env('PB_ADMIN_PASSWORD');

  console.log(`[pb:seed] Connecting to ${baseUrl}…`);
  const client = await PbClient.connect(baseUrl, email, password);
  await client.healthCheck();

  const result = await runSeed(client, { force });

  if (result.skipped) {
    console.log('[pb:seed] Demo data already present — skipped full seed (use --force after clearing pb_data).');
  } else {
    console.log('[pb:seed] Done. Records created:');
    for (const [collection, count] of Object.entries(result.counts)) {
      console.log(`  ${collection}: ${count}`);
    }
    console.log('[pb:seed] Demo login: +79001234567 / student123');
  }

  // Always sync legal texts — registration needs them even when seed was skipped.
  const legal = await ensureLegalDocuments(client);
  console.log(
    `[pb:seed] legal_documents: created ${legal.created}, updated ${legal.updated}`,
  );
}

main().catch((err: unknown) => {
  console.error('[pb:seed] Failed:', err instanceof Error ? err.message : err);
  process.exit(1);
});
