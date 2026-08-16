import test from 'node:test';
import assert from 'node:assert/strict';

import { ApiError } from '../src/errors.mjs';
import { imageStorageKey, inspectSafePng } from '../src/image.mjs';

function uint32(value) {
  return Uint8Array.from([
    (value >>> 24) & 255,
    (value >>> 16) & 255,
    (value >>> 8) & 255,
    value & 255
  ]);
}

function chunk(name, data = new Uint8Array()) {
  const type = new TextEncoder().encode(name);
  return Uint8Array.from([...uint32(data.length), ...type, ...data, 0, 0, 0, 0]);
}

function pngWith(extraChunks = []) {
  const signature = Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const header = Uint8Array.from([...uint32(640), ...uint32(480), 8, 2, 0, 0, 0]);
  return Uint8Array.from([
    ...signature,
    ...chunk('IHDR', header),
    ...extraChunks.flatMap((item) => [...item]),
    ...chunk('IDAT', Uint8Array.from([1, 2, 3])),
    ...chunk('IEND')
  ]);
}

test('safe PNG dimensions and size are extracted', () => {
  const info = inspectSafePng(pngWith());
  assert.equal(info.width, 640);
  assert.equal(info.height, 480);
  assert.equal(info.mediaType, 'image/png');
});

test('PNG containing text or EXIF metadata is rejected', () => {
  for (const type of ['eXIf', 'iTXt', 'tEXt', 'zTXt']) {
    assert.throws(() => inspectSafePng(pngWith([chunk(type, Uint8Array.from([1]))])), (error) => {
      assert.ok(error instanceof ApiError);
      assert.equal(error.code, 'image_metadata_present');
      return true;
    });
  }
});

test('unknown chunks and bytes appended after IEND are rejected', () => {
  assert.throws(() => inspectSafePng(pngWith([chunk('aaAa', Uint8Array.from([1]))])), /附加数据/);
  const safe = pngWith();
  const appended = Uint8Array.from([...safe, 1, 2, 3]);
  assert.throws(() => inspectSafePng(appended), /结束后存在附加数据/);
});

test('private storage keys are random-id scoped and do not contain filenames', () => {
  const key = imageStorageKey('user-123', 'photo-456', new Date('2026-08-16T00:00:00Z'));
  assert.equal(key, 'private/user-123/2026/08/photo-456.png');
  assert.ok(!key.includes('IMG_'));
});
