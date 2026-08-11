import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { Script } from "node:vm";

const html = await readFile(new URL("./index.html", import.meta.url), "utf8");
const scriptMatch = html.match(/<script>([\s\S]*?)<\/script>/);
const styleMatch = html.match(/<style>([\s\S]*?)<\/style>/);

assert.ok(scriptMatch, "页面必须包含内联交互脚本");
assert.ok(styleMatch, "页面必须包含内联响应式样式");
assert.doesNotThrow(() => new Script(scriptMatch[1]), "内联脚本必须通过语法检查");
assert.equal(
  (styleMatch[1].match(/\{/g) ?? []).length,
  (styleMatch[1].match(/\}/g) ?? []).length,
  "CSS 花括号必须完整配对",
);

const ids = [...html.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1]);
assert.equal(new Set(ids).size, ids.length, "页面不能包含重复 id");

assert.match(html, /qualityAssessment\.status === "fail"/, "低质量照片必须停止疾病分类");
assert.match(html, /saveDraftToArchive/, "报告保存必须同步档案");
assert.match(html, /contextConfirmed/, "保存与咨询前必须确认牙齿和区域");
assert.match(html, /prepareConsultDraft/, "新事件必须重置咨询草稿");
assert.match(html, /openCalendarEvent/, "日历记录必须返回相关事件或牙齿时间线");
assert.match(html, /mediaDevices\.getUserMedia/, "USB 摄像头必须使用真实媒体流");
assert.match(html, /mediaDevices\.enumerateDevices/, "必须允许选择系统识别的 USB 摄像头");
assert.match(html, /id="camera-connection-diagnostic"/, "摄像头连接必须提供常驻诊断状态");
assert.match(html, /connectPreferredUsbCamera/, "连接时必须优先选择外接 USB 摄像头");
assert.match(html, /requestUsbCameraStream/, "摄像头打开失败时必须支持约束降级");
assert.match(html, /makeVideoConstraints\(deviceId, true\)/, "USB 摄像头必须支持宽松格式回退");
assert.match(html, /captureUsbFrame/, "USB 实时画面必须能够拍摄成照片");
assert.match(html, /track\.stop\(\)/, "断开页面时必须释放摄像头");
assert.match(html, /wifiDemoConnected/, "Wi-Fi 连接演示入口必须继续保留");
assert.match(html, /class="tooth-logo"/, "品牌标识必须使用牙齿 Logo");
assert.match(html, /<title>teethsee｜智能可视冲牙器<\/title>/, "系统品牌必须统一为 teethsee");
assert.doesNotMatch(html, /Arc · 齿见 AI/, "页面不应继续显示旧系统名称");
assert.match(html, /Emma（本人）/, "当前用户名称必须与移动原型保持一致");
assert.match(html, /个人档案 · 演示样张库/, "牙齿档案必须包含演示样张库");
assert.match(html, /analyzeArchivePhoto/, "档案照片必须可直接进入分析流程");
assert.match(html, /calculus:\s*\{/, "模拟分析必须包含牙结石报告类型");
assert.match(html, /demoAssetPaths/, "演示素材路径必须使用本地白名单");
assert.match(html, /id="upload-picker"/, "上传入口必须打开个人档案库选择窗口");
assert.match(html, /id="upload-archive-photo"/, "用户必须明确点击上传给 AI");
assert.match(html, /selectArchiveUploadOption/, "档案照片必须先选择再上传");
assert.match(html, /openUploadPicker\(button\)/, "所有上传入口必须进入个人档案库");
assert.match(html, /id="archive-viewer"/, "档案照片必须支持大图查看");
assert.match(html, /deleteArchivePhoto/, "档案照片必须支持删除");
assert.match(html, /window\.confirm/, "删除照片前必须明确确认");
assert.match(html, /saveCurrentPhotoToArchive/, "保存报告时必须同步保存当前照片");
assert.match(html, /createArchiveThumbnail/, "保存照片前必须重新编码为安全缩略图");
assert.match(html, /renderArchivePhotos/, "档案与上传选择器必须使用同一照片状态");
assert.match(html, /id="mirror-mode"/, "必须提供极简 Mirror 自动建档演示");
assert.match(html, /class="nav-button is-primary-nav"[^>]+data-view="observe"/, "跨端导航必须把扫描作为中心主操作");
assert.match(html, /<span>档案<\/span>/, "桌面与移动导航必须使用一致的档案命名");
assert.match(
  html,
  /<nav class="mobile-nav"[\s\S]*data-view="home"[\s\S]*data-view="teeth"[\s\S]*data-view="observe"[\s\S]*data-view="calendar"[\s\S]*data-view="profile"[\s\S]*<\/nav>/,
  "桌面与移动端必须共用首页、档案、扫描、日历、我的顺序",
);
assert.match(html, /data-view-panel="profile"/, "必须提供与移动原型一致的家庭档案页面");
assert.match(html, /陈医生 · 河畔牙科诊所/, "咨询角色必须与移动原型保持一致");
assert.match(html, /safe-area-inset-bottom/, "移动导航必须适配底部安全区");
assert.match(html, /class="home-smile-arch"/, "首页必须保留移动原型的牙齿地图概览");
assert.doesNotMatch(
  html,
  /\.context-confirmation\s*\{[^}]*display:\s*none/s,
  "移动端不得隐藏保存和咨询前的牙位确认",
);
assert.match(html, /function revealAnalysisPanel/, "移动端分析流程必须自动聚焦当前阶段");
assert.match(html, /switchView\("teeth"\);\s*}\s*showToast\("照片与 AI 报告/, "保存后必须直接进入相同的牙齿档案流程");
assert.match(html, /startEnrollmentDemo/, "自动建档必须有可运行的确定性流程");
assert.match(html, /captureBatch = uncovered\.slice\(0, 6\)/, "单次建档演示最多补充 6 个牙位");
assert.match(html, /const enrolledTeeth = new Set/, "牙位覆盖必须使用稳定身份集合");
assert.match(html, /const memberMatch = \{/, "自动建档必须保留本机成员匹配结果");
assert.match(html, /memberMatch\.confidence >= 0\.82/, "低置信度成员匹配不得直接写入档案");
assert.match(html, /toothComparisonRecords/, "必须提供同牙同区域跨期对比数据");
assert.match(html, /已扣除设备漂移/, "对比界面必须显示漂移校正状态");
assert.match(html, /CORR-36-202608/, "必须包含漂移假变化被判稳定的演示案例");
assert.match(html, /id="evidence-list"/, "AI 报告必须展示证据链");
assert.match(html, /createEvidenceRecords/, "AI 报告必须为证据生成稳定 ID");
assert.match(html, /currentDraft\.evidenceRecords/, "报告、咨询和归档必须复用同一证据集合");
assert.match(html, /id="archive-query-form"/, "牙齿档案必须支持模板化问答");
assert.match(html, /answerArchiveQuery/, "档案问答必须使用确定性证据路径");
assert.match(html, /archiveQueryInput\.value = question/, "档案问答切换牙位后必须保留用户问题");
assert.match(html, /证据缺口 GAP-/, "证据不足的用户可见回答也必须携带证据缺口 ID");
assert.match(html, /DEMO DATA · 模拟结果/, "页面必须始终标识演示数据与模拟结果");
assert.match(html, /疑似蛀牙/, "按已确认方案保留基础疾病候选类别");
assert.doesNotMatch(
  html,
  /await startUsbCamera\(preferredExternal\.deviceId,\s*false\)/,
  "不能通过递归关闭并重开外接摄像头",
);

assert.doesNotMatch(html, /\bfetch\s*\(/, "离线 Demo 不应发起网络请求");
assert.doesNotMatch(html, /\beval\s*\(|new\s+Function\s*\(/, "页面不应执行动态代码");
assert.doesNotMatch(html, /innerHTML|insertAdjacentHTML/, "用户内容不得通过不安全 HTML 注入");
assert.doesNotMatch(html, /sessionStorage/, "口腔照片和报告不得写入会话存储");
assert.match(
  html,
  /const LANGUAGE_STORAGE_KEY = "teethsee\.language"/,
  "语言偏好必须使用独立且固定的非敏感存储键",
);
const localStorageCalls = [
  ...html.matchAll(/localStorage\.(getItem|setItem)\(([^)]*)\)/g),
];
assert.equal(localStorageCalls.length, 2, "浏览器存储只能用于读取和保存语言偏好");
for (const [, method, argumentsText] of localStorageCalls) {
  assert.match(
    argumentsText,
    /^LANGUAGE_STORAGE_KEY(?:,\s*language)?$/,
    `${method} 不得用于保存照片、报告、聊天或用户档案`,
  );
}
assert.doesNotMatch(
  html,
  /\b(?:api[_-]?key|authorization)\b\s*[:=]|\bsk-[A-Za-z0-9_-]{12,}/i,
  "页面不得包含 API 密钥或授权凭据",
);
assert.doesNotMatch(
  html,
  /<(script|link)[^>]+(src|href)="https?:/i,
  "离线 Demo 不应依赖外部脚本或样式",
);

const demoImageFiles = [
  "牙结石演示-下前牙-明显.png",
  "牙结石演示-右上后牙-中度.png",
  "牙结石演示-左下后牙-局部.png",
];
for (const fileName of demoImageFiles) {
  const image = await readFile(
    new URL(`./assets/demo-oral/${fileName}`, import.meta.url),
  );
  assert.ok(image.length < 10 * 1024 * 1024, `${fileName} 必须小于上传大小上限`);
  assert.deepEqual(
    [...image.subarray(0, 8)],
    [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a],
    `${fileName} 必须是有效 PNG`,
  );
}

console.log("Demo smoke test: PASS");
