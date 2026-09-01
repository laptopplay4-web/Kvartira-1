/**
 * PocketBase HTTP client for seed script (superuser auth).
 * ROADMAP 1.5
 */

export interface PbRecord {
  id: string;
  collectionId: string;
  [key: string]: unknown;
}

export class PbClient {
  constructor(
    private readonly baseUrl: string,
    private token: string,
  ) {}

  static async connect(baseUrl: string, email: string, password: string): Promise<PbClient> {
    const res = await fetch(`${baseUrl}/api/collections/_superusers/auth-with-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ identity: email, password }),
    });
    if (!res.ok) {
      throw new Error(`PocketBase admin auth failed (${res.status}): ${await res.text()}`);
    }
    const data = (await res.json()) as { token: string };
    return new PbClient(baseUrl.replace(/\/$/, ''), data.token);
  }

  async healthCheck(): Promise<void> {
    const res = await fetch(`${this.baseUrl}/api/health`);
    if (!res.ok) throw new Error(`PocketBase health check failed (${res.status})`);
  }

  async countRecords(collection: string, filter?: string): Promise<number> {
    const params = new URLSearchParams({ page: '1', perPage: '1' });
    if (filter) params.set('filter', filter);
    const res = await fetch(`${this.baseUrl}/api/collections/${collection}/records?${params}`, {
      headers: { Authorization: this.token },
    });
    if (!res.ok) {
      throw new Error(`List ${collection} failed (${res.status}): ${await res.text()}`);
    }
    const data = (await res.json()) as { totalItems: number };
    return data.totalItems;
  }

  async createRecord(collection: string, body: Record<string, unknown>): Promise<PbRecord> {
    const form = new FormData();
    for (const [key, value] of Object.entries(body)) {
      if (value === null || value === undefined) continue;
      if (typeof value === 'boolean') {
        form.append(key, value ? 'true' : 'false');
      } else if (typeof value === 'object') {
        form.append(key, JSON.stringify(value));
      } else {
        form.append(key, String(value));
      }
    }
    const res = await fetch(`${this.baseUrl}/api/collections/${collection}/records`, {
      method: 'POST',
      headers: { Authorization: this.token },
      body: form,
    });
    if (!res.ok) {
      throw new Error(`Create ${collection} failed (${res.status}): ${await res.text()}`);
    }
    return (await res.json()) as PbRecord;
  }

  async updateRecord(
    collection: string,
    id: string,
    body: Record<string, unknown>,
  ): Promise<PbRecord> {
    const res = await fetch(`${this.baseUrl}/api/collections/${collection}/records/${id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        Authorization: this.token,
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      throw new Error(`Update ${collection}/${id} failed (${res.status}): ${await res.text()}`);
    }
    return (await res.json()) as PbRecord;
  }
}
