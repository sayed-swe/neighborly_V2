import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';
import request from 'supertest';
import { app, startDB, stopDB, clearDB, createVerifiedUser } from './setup.js';
import env from '../src/config/env.js';
import { isImageUrl, saveImage, signParams } from '../src/modules/uploads/storage.js';

const ID = 'a'.repeat(32);
const CLOUD_URL = `https://res.cloudinary.com/demo-cloud/image/upload/v1732400000/neighborly/${ID}.jpg`;

function useCloudinary() {
  const saved = { ...env };
  Object.assign(env, {
    CLOUDINARY_CLOUD_NAME: 'demo-cloud', CLOUDINARY_API_KEY: 'key123', CLOUDINARY_API_SECRET: 'secret456',
    CLOUDINARY_FOLDER: 'neighborly', cloudinaryEnabled: true,
  });
  return () => { for (const k of Object.keys(env)) if (!(k in saved)) delete env[k]; Object.assign(env, saved); };
}

describe('image storage', () => {
  let restore = () => {};
  afterEach(() => { restore(); vi.unstubAllGlobals(); });

  it('signs requests the way Cloudinary documents', () => {
    // Example from Cloudinary's "Generating authentication signatures" guide
    const sig = signParams({ eager: 'w_400,h_300,c_pad|w_260,h_200,c_crop', public_id: 'sample_image', timestamp: 1315060510 }, 'abcd');
    expect(sig).toBe('bfd09f95f331f558cbd1320e67aa8d488770583e');
  });

  it('accepts only photo URLs this server issued', () => {
    const opts = { cloud: 'demo-cloud', folder: 'neighborly' };
    expect(isImageUrl(`/api/uploads/${ID}.png`, opts)).toBe(true);
    expect(isImageUrl(CLOUD_URL, opts)).toBe(true);
    expect(isImageUrl(CLOUD_URL.replace('demo-cloud', 'someone-else'), opts)).toBe(false);
    expect(isImageUrl(CLOUD_URL.replace('/neighborly/', '/other/'), opts)).toBe(false);
    expect(isImageUrl('https://evil.example/x.jpg', opts)).toBe(false);
    expect(isImageUrl(CLOUD_URL, { cloud: undefined, folder: 'neighborly' })).toBe(false); // cloud not configured
  });

  it('uploads to Cloudinary with a signed request when configured', async () => {
    restore = useCloudinary();
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ secure_url: CLOUD_URL })));
    vi.stubGlobal('fetch', fetchMock);

    const url = await saveImage({ ext: 'jpg', data: Buffer.from([0xff, 0xd8, 0xff]) });
    expect(url).toBe(CLOUD_URL);
    const [endpoint, init] = fetchMock.mock.calls[0];
    expect(endpoint).toBe('https://api.cloudinary.com/v1_1/demo-cloud/image/upload');
    const form = init.body;
    const params = { folder: form.get('folder'), public_id: form.get('public_id'), timestamp: form.get('timestamp') };
    expect(params.public_id).toMatch(/^[a-f0-9]{32}$/);
    expect(form.get('api_key')).toBe('key123');
    expect(form.get('signature')).toBe(signParams(params, 'secret456'));
    expect(form.has('api_secret')).toBe(false); // the secret itself is never sent
  });

  it('fails cleanly when Cloudinary rejects the upload', async () => {
    restore = useCloudinary();
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ error: { message: 'Invalid signature' } }), { status: 401 })));
    await expect(saveImage({ ext: 'png', data: Buffer.from('x') })).rejects.toThrow(/Invalid signature/);
  });
});

describe('posts with cloud photos', () => {
  let restore = () => {};
  beforeAll(startDB);
  afterAll(stopDB);
  beforeEach(clearDB);
  afterEach(() => restore());

  it('stores a Cloudinary photo URL on a post', async () => {
    restore = useCloudinary();
    const u = await createVerifiedUser({ email: 'mim@example.com' });
    const auth = { Authorization: `Bearer ${u.accessToken}` };
    await request(app).put('/api/users/me/location').set(auth).send({ lat: 23.7561, lng: 90.3742, areaName: 'Dhanmondi', radiusKm: 3 }).expect(200);
    const res = await request(app).post('/api/posts').set(auth).send({ text: 'Found this cat near the lake', images: [CLOUD_URL] });
    expect(res.status).toBe(201);
    expect(res.body.post.images).toEqual([CLOUD_URL]);

    const foreign = await request(app).post('/api/posts').set(auth).send({ text: 'x', images: ['https://evil.example/x.jpg'] });
    expect(foreign.status).toBe(422);
  });
});
