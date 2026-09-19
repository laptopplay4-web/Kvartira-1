import { isPocketBaseMode } from '@/services/api/pocketbase/client';
import { pocketbaseYclientsApi } from '@/services/api/pocketbase/yclients';
import { mockYclientsApi } from '@/services/api/mock/yclients';

/** YCLIENTS BFF client: PocketBase routes in pb mode, in-memory stub in mock. */
export function getYclientsApi() {
  return isPocketBaseMode() ? pocketbaseYclientsApi : mockYclientsApi;
}
