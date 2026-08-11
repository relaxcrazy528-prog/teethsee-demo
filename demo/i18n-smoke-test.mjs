import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const html = await readFile(new URL("./index.html", import.meta.url), "utf8");
const scriptStart = html.indexOf("<script>");
assert.ok(scriptStart > 0, "页面必须包含内联脚本");

const i18nStart = html.indexOf("const EN_TEXT = new Map([");
const i18nEnd = html.indexOf("function shouldSkipI18n", i18nStart);
assert.ok(i18nStart > scriptStart && i18nEnd > i18nStart, "必须能读取 i18n 翻译核心");

const i18nSource = html.slice(i18nStart, i18nEnd);
const { translateToEnglish } = new Function(
  `${i18nSource}; return { translateToEnglish };`,
)();

const hanPattern = /[\u3400-\u9fff]/u;
const visibleStrings = new Set();
const markup = html
  .slice(0, scriptStart)
  .replace(/<style>[\s\S]*?<\/style>/, "");

for (const match of markup.matchAll(/>([^<>]*[\u3400-\u9fff][^<>]*)</gu)) {
  const value = match[1].replace(/\s+/g, " ").trim();
  if (value) {
    visibleStrings.add(value);
  }
}

for (const match of markup.matchAll(
  /(?:aria-label|placeholder|title|alt)="([^"]*[\u3400-\u9fff][^"]*)"/gu,
)) {
  visibleStrings.add(match[1]);
}

const applicationScript = html.slice(html.indexOf("const VIEW_TITLES"));
for (const match of applicationScript.matchAll(
  /(["'`])((?:\\.|(?!\1)[\s\S])*?[\u3400-\u9fff](?:\\.|(?!\1)[\s\S])*?)\1/gu,
)) {
  const value = match[2].replace(/\s+/g, " ").trim();
  if (value.length > 0 && value.length < 500) {
    visibleStrings.add(value);
  }
}

const internalOnly = new Set([
  "zh-CN",
  "中文",
  "Language / 语言",
  "下前牙",
  "右上后牙",
  "左下后牙",
  "牙冠",
  "修复",
  "teethsee｜智能可视冲牙器",
  "teethsee 智能可视冲牙器：冲牙扫描、AI 报告、牙齿档案、日历历史与医师咨询。",
]);

const untranslated = [...visibleStrings]
  .filter((value) => !internalOnly.has(value))
  .map((value) => ({ source: value, translated: translateToEnglish(value) }))
  .filter(({ translated }) => hanPattern.test(translated));

assert.deepEqual(
  untranslated,
  [],
  `英文界面仍有 ${untranslated.length} 条中文文案：\n${untranslated
    .slice(0, 40)
    .map(({ source, translated }) => `- ${source} => ${translated}`)
    .join("\n")}`,
);

assert.match(html, /data-language="zh-CN"/, "必须提供中文选择");
assert.match(html, /data-language="en"/, "必须提供英文选择");
assert.match(html, /document\.documentElement\.lang = language/, "必须同步页面语言标记");
assert.match(html, /LANGUAGE_STORAGE_KEY/, "必须记住非敏感语言偏好");

console.log(`i18n smoke test: PASS (${visibleStrings.size} strings covered)`);
