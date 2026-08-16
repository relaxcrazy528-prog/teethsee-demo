import { ApiError, assert } from './errors.mjs';

export const MAX_IMAGE_BYTES = 8 * 1024 * 1024;
const PNG_SIGNATURE = [137, 80, 78, 71, 13, 10, 26, 10];
const FORBIDDEN_METADATA_CHUNKS = new Set(['eXIf', 'iTXt', 'tEXt', 'zTXt']);
const ALLOWED_PNG_CHUNKS = new Set(['IHDR', 'PLTE', 'IDAT', 'IEND', 'tRNS', 'sRGB', 'gAMA', 'cHRM', 'pHYs']);

function readUint32(bytes, offset) {
  return (((bytes[offset] << 24) >>> 0) + (bytes[offset + 1] << 16) + (bytes[offset + 2] << 8) + bytes[offset + 3]) >>> 0;
}

function chunkName(bytes, offset) {
  return String.fromCharCode(bytes[offset], bytes[offset + 1], bytes[offset + 2], bytes[offset + 3]);
}

export function inspectSafePng(input) {
  const bytes = input instanceof Uint8Array ? input : new Uint8Array(input);
  assert(bytes.byteLength > 32, 400, 'invalid_image', '图片内容不完整');
  assert(bytes.byteLength <= MAX_IMAGE_BYTES, 413, 'image_too_large', '图片不能超过 8MB');

  for (let i = 0; i < PNG_SIGNATURE.length; i += 1) {
    assert(bytes[i] === PNG_SIGNATURE[i], 415, 'unsupported_image', '当前仅接受经过隐私处理的 PNG 图片');
  }

  let offset = 8;
  let width;
  let height;
  let sawIhdr = false;
  let sawIdat = false;
  let sawIend = false;

  while (offset + 12 <= bytes.length) {
    const length = readUint32(bytes, offset);
    const type = chunkName(bytes, offset + 4);
    const dataStart = offset + 8;
    const next = dataStart + length + 4;
    assert(next <= bytes.length, 400, 'invalid_image', 'PNG 数据块不完整');
    assert(!FORBIDDEN_METADATA_CHUNKS.has(type), 400, 'image_metadata_present', '图片仍包含可识别元数据，请重新导出后上传');
    assert(ALLOWED_PNG_CHUNKS.has(type), 400, 'image_metadata_present', '图片包含未允许的附加数据，请重新导出后上传');

    if (type === 'IHDR') {
      assert(!sawIhdr && length === 13, 400, 'invalid_image', 'PNG 头信息不正确');
      width = readUint32(bytes, dataStart);
      height = readUint32(bytes, dataStart + 4);
      assert(width >= 1 && height >= 1 && width <= 6000 && height <= 6000, 400, 'invalid_image_dimensions', '图片尺寸不在允许范围内');
      assert(width * height <= 25_000_000, 400, 'invalid_image_dimensions', '图片像素过大');
      sawIhdr = true;
    } else if (type === 'IDAT') {
      sawIdat = true;
    } else if (type === 'IEND') {
      assert(length === 0, 400, 'invalid_image', 'PNG 结束标记不正确');
      assert(next === bytes.length, 400, 'invalid_image', 'PNG 结束后存在附加数据');
      sawIend = true;
      break;
    }

    offset = next;
  }

  assert(sawIhdr && sawIdat && sawIend, 400, 'invalid_image', 'PNG 缺少必要数据');
  return { width, height, byteSize: bytes.byteLength, mediaType: 'image/png' };
}

export async function readSafePng(request) {
  const contentType = (request.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
  assert(contentType === 'image/png', 415, 'unsupported_image', '上传前请将图片转换为 PNG');
  const contentLength = Number(request.headers.get('content-length') || 0);
  assert(!contentLength || contentLength <= MAX_IMAGE_BYTES, 413, 'image_too_large', '图片不能超过 8MB');
  const buffer = await request.arrayBuffer();
  return { buffer, ...inspectSafePng(buffer) };
}

export async function sha256Hex(input) {
  const digest = await crypto.subtle.digest('SHA-256', input);
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
}

export function imageStorageKey(userId, photoId, now = new Date()) {
  if (!userId || !photoId) throw new ApiError(500, 'storage_key_error', '无法生成图片存储位置');
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, '0');
  return `private/${userId}/${year}/${month}/${photoId}.png`;
}
