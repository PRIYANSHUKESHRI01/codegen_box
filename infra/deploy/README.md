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
3. `php artisan storage:link && php artisan migrate --force && php artisan optimize`
4. `storage/` and `bootstrap/cache/` writable by the web user (775).
5. Check these all return 403/404 from outside: `/.env`, `/composer.json`, `/vendor/autoload.php`,
   `/storage/logs/laravel.log`, `/artisan`. If any returns content, the web root is wrong — fix that first.

## 4. Frontend on the server

Upload the contents of `frontend-out.zip` to the site's web root (`index.html` at the top). The API address is baked
in at build time; to change it, rebuild with a new `-ApiUrl`.

## 5. If the server still does odd things

The packages above are clean, so look at the server: unknown files in the web root (`*.php` that isn't yours),
unfamiliar cron jobs, high CPU from a process you did not start, spam mail. Then: change the hosting/cPanel/SSH/DB
passwords, rotate every secret that was ever in a `.env` you uploaded or emailed (APP_KEY, DB, Gemini, WhatsApp, AWS,
mail, SUPERADMIN_PASSWORD), update PHP, and restore from a fresh package rather than cleaning in place.
