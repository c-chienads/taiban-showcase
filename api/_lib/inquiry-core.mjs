// inquiry-core.mjs — 詢問單的驗證與正規化（純函式；Vercel 函式與測試共用，不碰儲存）。
// 原則：只收表單上有的欄位、全部截長度、不信任任何輸入；錯誤訊息寫給填表的人看（哪一格、怎麼改）。

export const ROLES = ['品牌方／店家', '行銷或廣告人員', '代理商／接案者', '其他'];
export const PURPOSES = ['品牌形象', '產品或線上商店', '活動或檔期', '預約或報名', '其他'];
export const TIMELINES = ['一個月內', '一到三個月', '三個月以上', '還不確定'];
export const BUDGETS = ['還不確定', '5 萬以下', '5–15 萬', '15–30 萬', '30 萬以上'];

const LIMIT = { name: 40, company: 80, email: 120, contact: 60, message: 2000 };
const clip = (v, n) => String(v ?? '').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').trim().slice(0, n);
const pick = (v, list) => (list.includes(v) ? v : '');
const EMAIL_RE = /^[^\s@<>()"',;]+@[^\s@<>()"',;]+\.[^\s@<>()"',;]{2,}$/;

/** 表單送來的值 → 正規化；templates 可以是陣列或逗號字串（無 JS 時是重複的同名欄位） */
export function normalize(body = {}, validIds = []) {
  const raw = body.templates ?? body['templates[]'] ?? [];
  const list = (Array.isArray(raw) ? raw : String(raw).split(',')).map(s => String(s).trim().toUpperCase()).filter(Boolean);
  const templates = [...new Set(list)].filter(id => !validIds.length || validIds.includes(id)).slice(0, 12);
  return {
    role: pick(body.role, ROLES),
    name: clip(body.name, LIMIT.name),
    company: clip(body.company, LIMIT.company),
    email: clip(body.email, LIMIT.email).toLowerCase(),
    contact: clip(body.contact, LIMIT.contact),
    templates,
    purpose: pick(body.purpose, PURPOSES),
    timeline: pick(body.timeline, TIMELINES),
    budget: pick(body.budget, BUDGETS),
    message: clip(body.message, LIMIT.message),
    consent: body.consent === true || body.consent === 'on' || body.consent === 'yes' || body.consent === '1',
  };
}

/** 回傳 { ok, errors:{欄位:訊息} }；訊息直接顯示在該欄位下方 */
export function validate(d) {
  const errors = {};
  if (!d.name) errors.name = '請留一個稱呼，我們回覆時才知道怎麼稱呼你。';
  if (!d.email && !d.contact) errors.email = 'Email 和電話／LINE 至少留一個，不然我們聯絡不到你。';
  if (d.email && !EMAIL_RE.test(d.email)) errors.email = '這個 Email 格式看起來不完整，請檢查 @ 後面的網域。';
  if (!d.consent) errors.consent = '需要勾選同意，我們才能用這些資料聯絡你。';
  return { ok: Object.keys(errors).length === 0, errors };
}

/** 垃圾訊息判斷：蜜罐欄位有值、或表單打開不到 3 秒就送出 → 不存，但回應看起來一樣（不教機器人怎麼繞） */
export function looksLikeSpam(body = {}, nowMs = Date.now()) {
  if (clip(body.website, 200)) return 'honeypot';
  const t = Number(body.t);
  if (Number.isFinite(t) && t > 0 && nowMs - t < 3000) return 'too-fast';
  return '';
}

const B32 = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
/** 詢問編號：Q-YYYYMMDD-XXXXX（台北時間日期；給客人對帳用，不是秘密） */
export function makeRef(now = new Date(), rand = Math.random) {
  const tpe = new Date(now.getTime() + 8 * 3600e3).toISOString().slice(0, 10).replace(/-/g, '');
  let s = ''; for (let i = 0; i < 5; i++) s += B32[Math.floor(rand() * B32.length)];
  return `Q-${tpe}-${s}`;
}

/** 存檔的那一份：加上編號、時間與來源頁；不存 IP（不需要就不收） */
export function toRecord(d, { ref, now = new Date(), page = '', ua = '' } = {}) {
  return { ref, at: now.toISOString(), status: '新進', ...d, page: clip(page, 200), ua: clip(ua, 160) };
}

/** 後台匯出 CSV（Excel 開得了：UTF-8 BOM、CRLF、雙引號跳脫、開頭是 = + - @ 的儲存格加 ' 防公式注入） */
export function toCsv(records, nameOf = id => id) {
  const cols = [['ref', '編號'], ['at', '時間'], ['role', '身分'], ['name', '稱呼'], ['company', '公司／品牌'], ['email', 'Email'], ['contact', '電話／LINE'], ['templates', '想用的套版'], ['purpose', '用途'], ['timeline', '上線時間'], ['budget', '預算'], ['message', '想說的事']];
  const cell = v => { let s = Array.isArray(v) ? v.map(nameOf).join('、') : String(v ?? ''); if (/^[=+\-@]/.test(s)) s = "'" + s; return '"' + s.replace(/"/g, '""') + '"'; };
  return '﻿' + [cols.map(c => cell(c[1])).join(','), ...records.map(r => cols.map(([k]) => cell(k === 'at' ? new Date(new Date(r.at).getTime() + 8 * 3600e3).toISOString().slice(0, 16).replace('T', ' ') : r[k])).join(','))].join('\r\n');
}

/** 管理金鑰比對：長度不同也走完整迴圈，避免以時間差猜長度 */
export function keyMatches(given, expected) {
  const a = String(given || ''), b = String(expected || '');
  if (!b || b.length < 16) return false;
  let diff = a.length ^ b.length;
  for (let i = 0; i < b.length; i++) diff |= (a.charCodeAt(i % (a.length || 1)) || 0) ^ b.charCodeAt(i);
  return diff === 0;
}
