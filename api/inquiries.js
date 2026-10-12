// GET /api/inquiries — 後台讀詢問單（需要 ADMIN_KEY，放在 x-admin-key 標頭）。?format=csv 匯出。
// 測試時以 globalThis.__taibanBlob 注入假儲存（showcase/tests/），正式環境用 Vercel Blob
const { list, get } = globalThis.__taibanBlob || await import('@vercel/blob');
import { keyMatches, toCsv } from './_lib/inquiry-core.mjs';
import { NAMES } from './_lib/catalog.mjs';

const readJson = async url => {
  const r = await get(url, { access: 'private', useCache: false });
  if (!r || r.statusCode !== 200) return null;
  return JSON.parse(await new Response(r.stream).text());
};

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Robots-Tag', 'noindex');
  if (req.method !== 'GET') { res.setHeader('Allow', 'GET'); return res.status(405).json({ ok: false }); }
  if (!keyMatches(req.headers['x-admin-key'], process.env.ADMIN_KEY)) return res.status(401).json({ ok: false, error: '管理金鑰不對。' });

  const blobs = [];
  let cursor;
  do {
    const page = await list({ prefix: 'inquiries/', cursor, limit: 1000 });
    blobs.push(...page.blobs); cursor = page.hasMore ? page.cursor : undefined;
  } while (cursor && blobs.length < 5000);
  blobs.sort((a, b) => (a.pathname < b.pathname ? 1 : -1));
  const take = blobs.slice(0, Math.min(Number(req.query.limit) || 300, 1000));
  const records = [];
  for (let i = 0; i < take.length; i += 12) {
    const chunk = await Promise.all(take.slice(i, i + 12).map(b => readJson(b.url).catch(() => null)));
    records.push(...chunk.filter(Boolean));
  }
  if (req.query.format === 'csv') {
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="inquiries-${new Date().toISOString().slice(0, 10)}.csv"`);
    return res.status(200).send(toCsv(records, id => NAMES[id] ? `${id} ${NAMES[id]}` : id));
  }
  return res.status(200).json({ ok: true, total: blobs.length, shown: records.length, records });
}
