# Deploying AptRun

## 1. Build the packages (your PC)

```powershell
./infra/deploy/make-package.ps1 -ApiUrl https://api.yourdomain.com/api
```

Writes `dist/backend-deploy.zip` and `dist/frontend-out.zip` and prints a SHA-256 for each. Backend only:
`-SkipFrontend`. Stop `next dev` first if you build the frontend (both use `frontend/.next`).
Run `composer install --no-dev --optimize-autoloader` in `backend/` beforehand if you ever installed dev packages.

What it leaves out on purpose: `.env*`, `*.sqlite`, `storage/*` data, `bootstrap/cache/*`, `public/storage`,
`tests/`, `Dockerfile`, Windows-only `*.bat`/`*.exe`. It fails instead of zipping if any of those slip in, if a real
secret from `backend/.env` appears in the package, or if the frontend still contains a `localhost:8000` API URL.

## 2. Move them (not Gmail)

Gmail rejects any archive holding `.js`/`.bat`/`.exe`/… files, whatever they contain. The frontend is made of `.js`,
so this will always happen and it is not malware. Use Google Drive (share link), SFTP/cPanel File Manager, or the
pen drive. On the server, `sha256sum backend-deploy.zip` must equal the hash printed on your PC; if it differs,
the file changed in transit (a pen drive can carry malware) — do not deploy it.

## 3. Backend on the server

1. Unzip so the web root points at `backend/public` (never the project folder itself).
2. Create `.env` on the server from `.env.example`, **new** values: `APP_ENV=production`, `APP_DEBUG=false`,
   `APP_URL=https://…`, `FRONTEND_URL=https://…` (the static site), `LOG_LEVEL=warning`, real DB credentials,
   `php artisan key:generate`. Do not copy your local `.env`.
   **`FRONTEND_URL` must be exactly the origin the static site is served from** (e.g. `https://app.example.com`, no path).
   It is also what the API's CORS allow-list is built from: if it is wrong or missing, the browser blocks every API call
   and the site looks dead (login, pricing, checkout). If the site answers on more than one address (`example.com` and
   `www.example.com`, a staging site) list the others, comma-separated, in `CORS_ALLOWED_ORIGINS`.
3. `php artisan storage:link && php artisan migrate --force && php artisan optimize`
4. `storage/` and `bootstrap/cache/` writable by the web user (775).
   **Payments (PayU — the default gateway):** add `PAYU_KEY`, `PAYU_SALT` and `PAYU_MODE=live` (and, recommended,
   `PAYU_WEBHOOK_TOKEN`) to the server `.env` (never the frontend). In the PayU Dashboard → Developers → Webhooks add the
   Successful, Failed, Refund and Dispute webhooks, all pointing at `https://<api-host>/api/webhooks/payu?token=<PAYU_WEBHOOK_TOKEN>`.
   PayU sends the student's browser back to `https://<api-host>/api/payu/return` — PayU caps that address at **50 characters**,
   so a very long API hostname needs `PAYU_RETURN_URL` pointing at a shorter alias. Then
   `php artisan config:cache && php artisan route:cache`. Until the keys exist, paid plans can't be bought. The scheduler cron
   (`* * * * * php artisan schedule:run`) must be running — it runs `payments:reconcile`. Full guide: `docs/payments-payu.md`.
   **Razorpay** is still in the code as the alternative: `PAYMENT_GATEWAY=razorpay` plus `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`,
   `RAZORPAY_WEBHOOK_SECRET` and a webhook at `/api/webhooks/razorpay` (`docs/payments-razorpay.md`).
5. Check these all return 403/404 from outside: `/.env`, `/composer.json`, `/vendor/autoload.php`,
   `/storage/logs/laravel.log`, `/artisan`. If any returns content, the web root is wrong — fix that first.

## 4. Frontend on the server

Upload the contents of `frontend-out.zip` to the site's web root (`index.html` at the top). The API address is baked
in at build time; to change it, rebuild with a new `-ApiUrl`.

The site is a static export: each page is its own file (`pricing.html`, `dashboard/billing.html`) but the app links to
`/pricing`, `/dashboard/billing`. The zip includes an `.htaccess` that maps one to the other, so **Apache / cPanel / LiteSpeed
hosting needs nothing more** (it must be uploaded too — it is a hidden file, so make sure your upload tool shows dotfiles).
On **Nginx** the same thing is:

```nginx
location / { try_files $uri $uri.html $uri/ =404; }
error_page 404 /404.html;
```

Check after uploading: open `https://<site>/pricing` and `https://<site>/dashboard/billing` directly (paste into a new tab), and
refresh `/dashboard` — none should show a server 404. (`/dashboard` and a few other folders answer one redirect to `/dashboard/`
first; that is normal.) If the host serves the site over `https`, the payment pages work as-is — PayU takes the student to its own page (a plain form post), so nothing needs allowing.

## 5. If the server still does odd things

The packages above are clean, so look at the server: unknown files in the web root (`*.php` that isn't yours),
unfamiliar cron jobs, high CPU from a process you did not start, spam mail. Then: change the hosting/cPanel/SSH/DB
passwords, rotate every secret that was ever in a `.env` you uploaded or emailed (APP_KEY, DB, Gemini, WhatsApp, AWS,
mail, SUPERADMIN_PASSWORD), update PHP, and restore from a fresh package rather than cleaning in place.
