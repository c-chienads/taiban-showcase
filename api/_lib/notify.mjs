// notify.mjs — 新詢問寄信通知（Resend HTTP API，不裝套件）。
// 需要環境變數 RESEND_API_KEY；收件人 = NOTIFY_TO 環境變數，沒設就用建置時寫進 catalog.mjs 的 NOTIFY_TO。
// 寄信失敗不影響詢問單：資料已先存進 Blob，這裡只記錄錯誤。
import { NAMES, NOTIFY_TO as BUILD_TO, SITE_URL } from './catalog.mjs';

const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const tpe = iso => new Date(new Date(iso).getTime() + 8 * 3600e3).toISOString().slice(0, 16).replace('T', ' ');

export function buildMail(rec, { to, from, site = '' }) {
  const rows = [
    ['編號', rec.ref], ['時間（台北）', tpe(rec.at)], ['身分', rec.role], ['稱呼', rec.name], ['公司／品牌', rec.company],
    ['Email', rec.email], ['電話／LINE', rec.contact],
    ['想用的套版', (rec.templates || []).map(id => `${id} ${NAMES[id] || ''}`.trim()).join('、')],
    ['用途', rec.purpose], ['上線時間', rec.timeline], ['預算', rec.budget], ['想說的事', rec.message],
  ];
  const shown = rows.filter(([, v]) => v);
  const subject = `新詢問 ${rec.ref}｜${rec.name}${rec.company ? `（${rec.company}）` : ''}`.slice(0, 180);
  const text = shown.map(([k, v]) => `${k}：${v}`).join('\n') + (site ? `\n\n後台：${site}/admin/` : '');
  const html = `<table style="border-collapse:collapse;font:15px/1.6 sans-serif">${shown.map(([k, v]) => `<tr><th style="text-align:left;padding:6px 16px 6px 0;color:#555;vertical-align:top;white-space:nowrap">${esc(k)}</th><td style="padding:6px 0;white-space:pre-wrap">${esc(v)}</td></tr>`).join('')}</table>${site ? `<p style="font:14px sans-serif"><a href="${esc(site)}/admin/">打開詢問單後台</a></p>` : ''}`;
  const mail = { from, to: [to], subject, text, html };
  if (rec.email) mail.reply_to = rec.email; // 直接按回覆就是回給客人
  return mail;
}

export async function notify(rec, { env = process.env, fetchImpl = globalThis.__taibanFetch || fetch } = {}) {
  const key = env.RESEND_API_KEY, to = env.NOTIFY_TO || BUILD_TO;
  if (!key || !to) return { sent: false, reason: !key ? 'no-key' : 'no-recipient' };
  const mail = buildMail(rec, { to, from: env.NOTIFY_FROM || '套版樣品間 <onboarding@resend.dev>', site: env.SITE_URL || SITE_URL || '' });
  const r = await fetchImpl('https://api.resend.com/emails', {
    method: 'POST', headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(mail), signal: AbortSignal.timeout(6000),
  });
  if (!r.ok) throw new Error(`Resend ${r.status}: ${(await r.text()).slice(0, 200)}`);
  return { sent: true };
}
