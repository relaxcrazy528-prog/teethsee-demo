import { ApiError, assert } from './errors.mjs';

const FDI_CODES = new Set([
  '11','12','13','14','15','16','17','18',
  '21','22','23','24','25','26','27','28',
  '31','32','33','34','35','36','37','38',
  '41','42','43','44','45','46','47','48',
  '51','52','53','54','55','61','62','63','64','65',
  '71','72','73','74','75','81','82','83','84','85'
]);

export const EVENT_TYPES = new Set([
  'capture','cleaning','consultation','visit','treatment','follow_up','note','hospital_import'
]);

export const EVENT_SOURCES = new Set(['user','device','dentist','hospital','system']);

export function cleanString(value, field, { min = 0, max = 200, optional = false } = {}) {
  if (optional && (value === undefined || value === null)) return undefined;
  assert(typeof value === 'string', 400, 'invalid_field', `${field} 必须是文本`);
  const result = value.trim();
  assert(result.length >= min && result.length <= max, 400, 'invalid_field', `${field} 长度不正确`);
  return result;
}

export function cleanInteger(value, field, { min, max, optional = false } = {}) {
  if (optional && (value === undefined || value === null || value === '')) return undefined;
  assert(Number.isInteger(value), 400, 'invalid_field', `${field} 必须是整数`);
  assert(value >= min && value <= max, 400, 'invalid_field', `${field} 超出允许范围`);
  return value;
}

export function cleanTimestamp(value, field = '时间', optional = false) {
  if (optional && (value === undefined || value === null || value === '')) return undefined;
  assert(typeof value === 'string', 400, 'invalid_field', `${field} 格式不正确`);
  const date = new Date(value);
  assert(!Number.isNaN(date.getTime()), 400, 'invalid_field', `${field} 格式不正确`);
  return date.toISOString();
}

export function cleanFdiCode(value, optional = false) {
  if (optional && (value === undefined || value === null || value === '')) return undefined;
  const code = String(value);
  assert(FDI_CODES.has(code), 400, 'invalid_tooth', '牙位必须使用有效的 FDI 编号');
  return code;
}

export async function readJson(request, maxBytes = 65536) {
  const contentType = request.headers.get('content-type') || '';
  assert(contentType.toLowerCase().startsWith('application/json'), 415, 'unsupported_media_type', '请求必须使用 JSON');
  const contentLength = Number(request.headers.get('content-length') || 0);
  assert(!contentLength || contentLength <= maxBytes, 413, 'payload_too_large', '请求内容过大');
  const text = await request.text();
  assert(new TextEncoder().encode(text).byteLength <= maxBytes, 413, 'payload_too_large', '请求内容过大');
  try {
    const parsed = JSON.parse(text);
    assert(parsed && typeof parsed === 'object' && !Array.isArray(parsed), 400, 'invalid_json', '请求内容必须是对象');
    return parsed;
  } catch (error) {
    if (error instanceof ApiError) throw error;
    throw new ApiError(400, 'invalid_json', 'JSON 格式不正确');
  }
}

export function isFdiCode(value) {
  return FDI_CODES.has(String(value));
}

export function allPermanentFdiCodes() {
  return [...FDI_CODES].filter((code) => Number(code[0]) <= 4);
}
