# 網站套版樣品間（自動產生，請勿手改）

由 套版網站平台 的 `node showcase/build.mjs` 產生。改內容請改 `showcase/` 底下的來源再重產。

- 靜態頁：`index.html`、`t/<slug>/`、`list/`、`inquiry/`、`admin/`
- 示範站：`demo/<slug>/`（取自 dist/）
- 詢問單：`api/inquiry.js` 存進 Vercel Blob（private）；`api/inquiries.js` 需要環境變數 `ADMIN_KEY`
- 需要的環境變數：`BLOB_READ_WRITE_TOKEN`（連結 Blob store 後自動產生）、`ADMIN_KEY`
