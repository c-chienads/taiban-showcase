// POST /api/inquiry — 收詢問單，存進 Vercel Blob（private）。
// JSON 送來 → 回 JSON；一般表單送來（沒開 JS）→ 303 轉到感謝頁或帶錯誤回表單。
// 測試時以 globalThis.__taibanBlob 注入假儲存（showcase/tests/），正式環境用 Vercel Blob
const { put } = globalThis.__taibanBlob || await import('@vercel/blob');
import { normalize, validate, looksLikeSpam, makeRef, toRecord } from './_lib/inquiry-core.mjs';
import { IDS } from './_lib/catalog.mjs';
import { notify } from './_lib/notify.mjs';

export default async function handler(req, res) {
  if (req.method !== 'POST') { res.setHeader('Allow', 'POST'); return res.status(405).json({ ok: false, error: '只接受送出表單（POST）。' }); }
  const isJson = String(req.headers['content-type'] || '').includes('application/json');
  const body = typeof req.body === 'object' && req.body ? req.body : {};
  const back = (status, payload, redirect) => (isJson ? res.status(status).json(payload) : res.redirect(303, redirect));

  const now = new Date();
  const ref = makeRef(now);
  if (looksLikeSpam(body, now.getTime())) return back(200, { ok: true, ref }, `/inquiry/thanks/?no=${ref}`);

  const d = normalize(body, IDS);
  const v = validate(d);
  if (!v.ok) return back(422, { ok: false, errors: v.errors }, `/inquiry/?error=${encodeURIComponent(Object.keys(v.errors).join(','))}`);

  const rec = toRecord(d, { ref, now, page: req.headers.referer || '', ua: req.headers['user-agent'] || '' });
  try {
    await put(`inquiries/${rec.at.slice(0, 7)}/${rec.at}-${ref}.json`, JSON.stringify(rec), { access: 'private', contentType: 'application/json', addRandomSuffix: false });
  } catch (e) {
    console.error('blob put failed', e && e.message);
    return back(503, { ok: false, error: '系統暫時存不進去，請稍後再送一次；內容已保留在你的瀏覽器裡。' }, '/inquiry/?error=store');
  }
  // 寄通知信（失敗只記錄；資料已經存好）
  try { await notify(rec); } catch (e) { console.error('notify failed', e && e.message); }
  return back(200, { ok: true, ref }, `/inquiry/thanks/?no=${ref}`);
}
