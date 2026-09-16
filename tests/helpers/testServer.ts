// Uç nokta testleri için: bellek içi MongoDB, gerçek Express uygulaması ve sahte dış servisler
// (Gemini, Cloudinary, Open-Meteo, web push). Ağ erişimi gerektirmez.
import crypto from 'crypto';
import type { AddressInfo } from 'net';
import type { Server } from 'http';
import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import type { AiClient } from '../../backend/ai/gemini.js';

export const TEST_JWT_SECRET = 'test-secret-that-is-long-enough-for-hs256-signing';
export const TEST_CLOUD = 'testcloud';

export interface TestContext {
  baseUrl: string;
  api: (method: string, path: string, options?: { token?: string; body?: unknown; headers?: Record<string, string> }) => Promise<{ status: number; body: any }>;
  createUser: (name: string, extra?: Record<string, unknown>) => Promise<{ id: string; token: string; user: any }>;
  models: typeof import('../../backend/db.js');
  stop: () => Promise<void>;
}

/** Deterministik 768 boyutlu sahte embedding: aynı metin aynı vektör, farklı metinler farklı yön. */
export function fakeVector(seed: string): number[] {
  const values: number[] = [];
  let hash = crypto.createHash('sha256').update(seed).digest();
  while (values.length < 768) {
    for (const byte of hash) values.push(byte / 255 - 0.5);
    hash = crypto.createHash('sha256').update(hash).digest();
  }
  const v = values.slice(0, 768);
  const norm = Math.sqrt(v.reduce((s, x) => s + x * x, 0));
  return v.map(x => x / norm);
}

/** Her çağrıda hata veren AI istemcisi: motor yedek yollarını kullanır. */
export const unavailableAi: AiClient = {
  generateContent: async () => { throw Object.assign(new Error('overloaded'), { status: 503 }); },
  embedContent: async () => { throw Object.assign(new Error('overloaded'), { status: 503 }); },
};

/** Şemaya göre yanıt üreten AI istemcisi. responder null dönerse çağrı başarısız olur. */
export function scriptedAi(responder: (params: any) => unknown | null, embedSeed: (params: any) => string = p => JSON.stringify(p.contents)): AiClient {
  return {
    generateContent: async (params) => {
      const data = responder(params);
      if (data === null || data === undefined) throw Object.assign(new Error('overloaded'), { status: 503 });
      return { text: JSON.stringify(data), candidates: [{ finishReason: 'STOP' }], usageMetadata: {} };
    },
    embedContent: async (params) => ({ embeddings: [{ values: fakeVector(embedSeed(params)) }] }),
  };
}

export async function startTestServer(options: { uploadMiddleware?: any } = {}): Promise<TestContext> {
  const mongod = await MongoMemoryServer.create();
  process.env.MONGODB_URI = mongod.getUri();
  process.env.JWT_SECRET = TEST_JWT_SECRET;
  process.env.CLOUDINARY_CLOUD_NAME = TEST_CLOUD;
  delete process.env.GEMINI_API_KEY;

  const [{ createApp }, models, gemini, cloudinary, http] = await Promise.all([
    import('../../backend/app.js'),
    import('../../backend/db.js'),
    import('../../backend/ai/gemini.js'),
    import('../../backend/cloudinary.js'),
    import('../../backend/http.js'),
  ]);
  gemini.setAiClientForTests(unavailableAi);
  cloudinary.setImageDeleterForTests(async () => undefined);
  cloudinary.setImageUploaderForTests(async (_uri, opts) => `https://res.cloudinary.com/${TEST_CLOUD}/image/upload/v2/${opts.folder}/${opts.public_id}.png`);
  cloudinary.setImageFetcherForTests(async () => ({ ok: false, headers: { get: () => null }, arrayBuffer: async () => new ArrayBuffer(0) }));

  await models.connectToDatabase();
  const app = createApp({ logRequests: false, uploadMiddleware: options.uploadMiddleware });
  const server: Server = await new Promise(resolve => {
    const s = app.listen(0, '127.0.0.1', () => resolve(s));
  });
  const baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;

  const api: TestContext['api'] = async (method, path, opts = {}) => {
    const res = await fetch(`${baseUrl}${path}`, {
      method,
      headers: {
        ...(opts.body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(opts.token ? { Authorization: `Bearer ${opts.token}` } : {}),
        ...(opts.headers || {}),
      },
      body: opts.body !== undefined ? JSON.stringify(opts.body) : undefined,
    });
    const text = await res.text();
    let body: any = text;
    try { body = JSON.parse(text); } catch { /* metin yanıt */ }
    return { status: res.status, body };
  };

  let counter = 0;
  const createUser: TestContext['createUser'] = async (name, extra = {}) => {
    counter++;
    const user = await models.UserModel.create({
      email: `${name.toLowerCase()}${counter}@test.local`,
      username: `${name.toLowerCase()}${counter}`,
      passwordHash: 'x',
      name,
      ...extra,
    });
    return { id: user._id.toString(), token: http.signToken(user), user };
  };

  return {
    baseUrl,
    api,
    createUser,
    models,
    stop: async () => {
      gemini.setAiClientForTests(null);
      await new Promise(resolve => server.close(resolve));
      await mongoose.disconnect();
      await mongod.stop();
    },
  };
}

export const GRANTED = (keys: string[]) => ({
  consents: Object.fromEntries(keys.map(k => [k, { granted: true, at: new Date() }])),
});

/** Örnek gardırop parçalarını kullanıcıya ait olacak şekilde kopyalar. */
export function ownedItems(docs: any[], userId: string, prefix = '') {
  return docs.map(d => ({
    ...d,
    id: `${prefix}${d.id}`,
    userId,
    imagePath: `https://res.cloudinary.com/${TEST_CLOUD}/image/upload/v1/digital_wardrobe/${userId}/${prefix}${d.id}.jpg`,
  }));
}
