import { test } from 'node:test';
import assert from 'node:assert/strict';
import { detectImageType } from '../src/middleware/upload.js';

// Firme minime dei formati: bastano i primi byte per il riconoscimento
const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0x0d, 0x49, 0x48, 0x44, 0x52, 0, 0, 0, 1, 0, 0, 0, 1, 8, 2, 0, 0, 0]);
const JPEG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01]);
const PDF = Buffer.from('%PDF-1.7\n%âãÏÓ\n1 0 obj');

test('PNG e JPEG riconosciuti dai byte', async () => {
  assert.equal(await detectImageType(PNG), 'image/png');
  assert.equal(await detectImageType(JPEG), 'image/jpeg');
});

test('testo rinominato .jpg: rifiutato', async () => {
  assert.equal(await detectImageType(Buffer.from('non sono una foto')), null);
});

test('formato reale ma non ammesso (PDF): rifiutato', async () => {
  assert.equal(await detectImageType(PDF), null);
});
