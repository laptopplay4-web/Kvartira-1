#!/usr/bin/env node
/**
 * Upsert legal_documents only (no user wipe).
 * npm run pb:seed:legal
 */

import { PbClient } from './pbClient';
import { ensureLegalDocuments } from './ensureLegal';

function env(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;
  if (!value) throw new Error(`Missing env: ${name}`);
  return value;
}

async function main(): Promise<void> {
  const baseUrl = env('PB_URL', env('VITE_API_URL', 'http://127.0.0.1:8090'));
  const email = env('PB_ADMIN_EMAIL');
  const password = env('PB_ADMIN_PASSWORD');

  console.log(`[pb:seed:legal] Connecting to ${baseUrl}…`);
  const client = await PbClient.connect(baseUrl, email, password);
  await client.healthCheck();

  const legal = await ensureLegalDocuments(client);
  console.log(
    `[pb:seed:legal] legal_documents: created ${legal.created}, updated ${legal.updated}`,
  );
}

main().catch((err: unknown) => {
  console.error('[pb:seed:legal] Failed:', err instanceof Error ? err.message : err);
  process.exit(1);
});
