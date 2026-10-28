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

### Updating an already-deployed backend (do this EVERY time you upload new code)

The package leaves `bootstrap/cache/` out on purpose, so the server keeps the route and config caches it built last time.
Laravel serves from those caches: **a route added since then answers 404 until they are rebuilt**, however new the code is.
(Symptom: the browser console shows `404` on `/api/public/branches` or `/api/notifications`, the branch filter lists only
"All Branches", and newer screens look empty.) After uploading the new files:

```
php artisan migrate --force
php artisan optimize:clear     # drops the old route/config/view/event caches
php artisan optimize           # rebuilds them from the new code (or: config:cache && route:cache)
sudo systemctl restart php8.2-fpm   # or your PHP service / `apachectl graceful`: clears opcache so the new code is what runs
```

Then confirm: `php artisan route:list --path=public/branches` and `--path=notifications` must each print a route.

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

## 6. The Guardian (the Windows program students run during proctored exams)

It runs on each **student's own PC**, not on your server. What you deploy is two files that the backend hands out, plus a few `.env` lines.
`guardian/dist-prod/` holds the build for `https://aptrun.com/api` (rebuild with `guardian/build.ps1 -Version x.y.z -Api <your api> -Out dist-prod` if the address changes).

1. Copy the two files to the server (they are not in the deploy zip, and a redeploy that replaces the backend folder removes them):
   ```
   scp guardian/dist-prod/aptrun-guardian.exe guardian/dist-prod/aptrun-guardian.json user@server:/var/www/<site>/backend/storage/app/guardian/
   ```
   The folder must exist and the web user (`www-data`) must be able to read both files: `chown -R www-data:www-data storage/app/guardian`.
2. Add the lines in `guardian/dist-prod/server.env.txt` to the server `.env` (the `GUARDIAN_ALLOWED_BUILDS` hash is the build above), then `php artisan config:cache`.
3. PHP must have the **sodium** extension (Ubuntu: `sudo apt install php-sodium` or it is built in; check `php -m | grep sodium` for BOTH the CLI and PHP-FPM, then `sudo systemctl reload php*-fpm`). Without it the pairing endpoint answers 503.
4. The current backend must be deployed (`php artisan migrate --force` and `php artisan route:cache`) and the scheduler cron must be running.
5. Check it from your PC: `powershell -ExecutionPolicy Bypass -File infra/deploy/verify-guardian.ps1 -Api https://aptrun.com/api`. Every line must say PASS.
6. Tell students to install it **the day before**, not at the exam: open the exam page → *Download for Windows* → double-click once → enter the code. Windows may say
   "Windows protected your PC" (More info → Run anyway) because the program is not code-signed yet; Chrome may ask to *Keep* the download.
   Signing it with a code-signing certificate removes both warnings, and is the one thing worth paying for before a large roll-out.

A new release: build it, add its hash to `GUARDIAN_ALLOWED_BUILDS` (comma-separated) **before** students download it, copy the two files over the old ones.
