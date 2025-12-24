# ConsultaBid V2.0 (Old Version)

Construction cost estimation platform with a React/Vite frontend and an Express/Prisma backend. Users upload inspection PDFs, generate AI-assisted estimates via a Python "Gemini pipeline", and (for non-admins) complete payment verification before estimate generation.

## Repository Layout

- `backend/` Node/Express API, Prisma schema, services, scripts
- `frontend/` React + Vite UI, Tailwind styles, routing, UI components

## Architecture Overview

- **Frontend**: React SPA built with Vite, TailwindCSS, and reusable UI components.
- **Backend**: Express API with JWT cookie auth, Prisma (PostgreSQL/Neon), Cloudflare R2 storage, and a Python-based estimation pipeline.
- **Payments**: GoDaddy PayLinks with a Python verifier that scans emails.
- **File Storage**: Cloudflare R2 for PDFs and generated JSON/PDF outputs.

## Frontend Index

### Entry & Routing

- `frontend/src/index.jsx`: bootstraps React app, loads styles.
- `frontend/src/App.jsx`: wraps the app in `NotificationProvider`.
- `frontend/src/Routes.jsx`: React Router routes.

Routes map to pages:
- `/` and `/landing-page`: `LandingPage`
- `/authentication-hub`: `AuthenticationHub`
- `/dashboard-overview`: `DashboardOverview`
- `/file-upload-management`: `FileUploadManagement`
- `/estimate-generation-results`: `EstimateGenerationResults`
- `/pdf-viewer-modal`: `PDFViewerModal`
- `/account`: `Accounts`
- `*`: `NotFound`

### Core Pages

- `frontend/src/pages/landing-page/index.jsx`
  - Marketing landing page with hero, features, pricing, footer.
  - Smooth-scroll for anchor links, sets page metadata.
- `frontend/src/pages/authentication-hub/index.jsx`
  - Login/Register tabs, password reset modal, privacy card.
  - Uses `/api/auth/me` to detect existing sessions.
- `frontend/src/pages/dashboard-overview/index.jsx`
  - Dashboard metrics, recent uploads, activity feed, usage chart.
  - Pulls file data from `/api/files` and user info from `/api/auth/me`.
- `frontend/src/pages/file-upload-management/index.jsx`
  - Upload PDFs, list files, preview, download, delete, bulk actions.
  - Uses `/api/files` endpoints and shows storage usage (100 MB cap).
- `frontend/src/pages/estimate-generation-results/index.jsx`
  - Estimate generation workflow, payment flow, results tabs.
  - Calls `/api/files/:id/process-estimate`, `/api/payments/start`, `/api/payments/status/:id`.
  - Admin emails bypass payments (see `frontend/src/utils/admin.js`).
- `frontend/src/pages/pdf-viewer-modal/index.jsx`
  - Fullscreen PDF viewer with thumbnails, zoom, downloads.
- `frontend/src/pages/accounts/index.jsx`
  - Profile, security, account details, connected accounts.
  - Calls `/api/auth/me` and `/api/auth/profile` / `/api/auth/change-password`.

### Shared UI / Utilities

- `frontend/src/components/ui/`: Button, Input, Select, Toast, Header, Breadcrumb, etc.
- `frontend/src/components/AuthGuard.jsx`: session check on load via `/api/auth/me` with fallback to cached localStorage.
- `frontend/src/components/ViewPdfModal.jsx`: iframe-based preview via Cloudflare Worker proxy.
- `frontend/src/contexts/NotificationContext.jsx`: localStorage-backed notifications.
- `frontend/src/utils/api.js`: fetch wrapper + `VITE_API_URL` support, JWT token fallback header.
- `frontend/src/utils/logout.js`: clears session + redirects.
- `frontend/src/utils/admin.js`: admin email allowlist (client-side).

### Frontend Config/Styles

- `frontend/vite.config.mjs`: Vite config (port `4028`, host `0.0.0.0`).
- `frontend/tailwind.config.js`: Tailwind theme with CSS variables.
- `frontend/src/styles/tailwind.css`, `frontend/src/styles/index.css`: global styles.

## Backend Index

### Entry & Middleware

- `backend/src/app.js`
  - Express app setup with `helmet`, `cors`, `cookie-parser`, rate limiting.
  - CORS allows `FRONTEND_URLS`, `FRONTEND_URL`, and local defaults.
  - Routes: `/api/auth`, `/api/files`, `/api/payments`, `/api/health`.
  - Global error handler and graceful shutdown.
- `backend/src/middlewares/auth.js`
  - JWT cookie/bearer auth (`protect`), optional auth, and simple rate limiters.
  - Admin is determined by `backend/src/config/admin.js`.

### Routes & Controllers

- `backend/src/routes/auth.js` -> `backend/src/controllers/authController.js`
  - Register/login, current user, logout, Google auth, profile update, password change.
  - Forgot/reset/verify email are placeholders (not implemented).
- `backend/src/routes/files.js` -> `backend/src/controllers/fileController.js`
  - Upload PDFs, list files, file details, delete, preview/download URLs.
  - Estimate processing with a 2-hour cooldown per file.
  - Download estimate PDF with optional query `token`.
- `backend/src/routes/payments.js` -> `backend/src/controllers/paymentController.js`
  - Start payment and poll payment status.

### Services

- `backend/src/services/estimateService.js`
  - Locates `Gemini-pipeline` directory (env or multiple fallback paths).
  - Runs Python scripts: extraction and estimation.
  - Uploads JSON to R2 and optionally generates estimate PDF.
  - Temp files stored under `backend/temp/{userId}/{fileId}`; kept for 1 hour by default.
- `backend/src/services/paymentService.js`
  - Creates payment records with GoDaddy paylinks and TTL (2 minutes).
  - Status updates and stale payment expiration.
- `backend/src/services/pythonPaymentVerifier.js`
  - Runs `rough.py` at repo root to parse payment emails and mark payments PAID.

### Config & DB

- `backend/src/config/database.js`
  - Prisma connection check and health status.
- `backend/src/lib/prisma.js`
  - Prisma client wrapper with `ensureConnection` for long-running jobs.
- `backend/prisma/schema.prisma`
  - PostgreSQL schema for users, accounts, pdf uploads, estimates, payments.
- `backend/src/config/r2.js`
  - Cloudflare R2 client (S3-compatible).
- `backend/src/config/admin.js`
  - Admin email allowlist used by auth middleware.

### Scripts and Docs

- `backend/scripts/start.sh`: boot + prisma migrate + start server.
- `backend/scripts/godaddyEmailExport.js`: exports payment emails to markdown.
- `backend/scripts/migrate-files-by-email.js`: migrate files between users.
- `backend/DEPLOY_GEMINI_PIPELINE.md`: pipeline deployment guidance.
- `backend/TEMP_FILES_AND_DB_FIX.md`: temp file retention + DB reconnect details.
- `backend/godaddy_payments_summary.md`: sample email summary output.

### Legacy/Unused

- `backend/src/models/User.js`: Mongoose schema (legacy; Prisma is now used).

## API Surface (Backend)

### Health

- `GET /api/health`: server + database health.

### Auth

- `POST /api/auth/register`: create account, returns JWT cookie + user.
- `POST /api/auth/login`: login, returns JWT cookie + user.
- `GET /api/auth/me`: current user (JWT).
- `POST /api/auth/logout`: clears cookie.
- `POST /api/auth/forgot-password`: placeholder (returns token in dev).
- `PUT /api/auth/reset-password/:resettoken`: not implemented (501).
- `GET /api/auth/verify-email/:token`: not implemented (501).
- `POST /api/auth/google`: Google OAuth login/register.
- `PUT /api/auth/profile`: update profile (name only).
- `PUT /api/auth/change-password`: change password.
- `GET /api/auth/check`: auth check for frontend.

### Files

- `POST /api/files/upload`: upload PDF to R2; 10 MB max; 100 MB per user limit.
- `GET /api/files`: list files (pagination params `page`, `limit`, `status`).
- `GET /api/files/storage-info`: storage usage summary.
- `GET /api/files/:id`: file detail + estimate info.
- `DELETE /api/files/:id`: delete file (R2 + DB).
- `GET /api/files/:id/preview`: preview URL (public R2 URL).
- `GET /api/files/:id/download`: download URL (public R2 URL).
- `POST /api/files/:id/process-estimate`: run Gemini pipeline or return cached estimate.
- `GET /api/files/:id/estimate-wait-status`: check 2-hour cooldown.
- `POST /api/files/:id/generate-estimate-pdf`: generate estimate PDF and upload to R2.
- `GET /api/files/:id/download-estimate-pdf`: download estimate PDF (supports `?token=`).

### Payments

- `POST /api/payments/start`: create payment session for tier.
- `GET /api/payments/status/:id`: poll payment status.

## Data Model (Prisma)

- **User**
  - Email/password or Google OAuth user.
  - `subscriptionStatus`, `authProvider`, `emailVerified`.
- **Account**
  - OAuth provider linkage (Google).
- **PdfUpload**
  - Upload metadata, R2 URL, page count, `isProcessed`.
- **Estimate**
  - Output JSON + metadata + total amount, linked to a PDF.
  - `processingStartedAt` enforces 2-hour re-run wait.
- **Payment**
  - Amount tier, status, paylink URL, correlation token, TTL.

## Key Flows

1. **Auth**
   - Login/register sets JWT cookie, frontend caches user in localStorage.
2. **Upload**
   - PDF file uploaded to R2, metadata stored in DB.
3. **Estimate**
   - Pipeline processes PDF, writes JSON to R2, updates DB.
   - Re-run blocked for 2 hours per file.
4. **Payment**
   - Non-admins initiate GoDaddy paylink payment.
   - Python verifier parses emails and marks payment as PAID.
5. **PDF Preview**
   - Public R2 URL used for preview, with optional Worker proxy (ViewPdfModal).

## Environment Variables

### Backend

- `DATABASE_URL`: PostgreSQL connection string (Neon).
- `JWT_SECRET`, `JWT_EXPIRE`, `JWT_COOKIE_EXPIRE`: auth config.
- `NODE_ENV`, `PORT`: server config.
- `FRONTEND_URL`, `FRONTEND_URLS`: CORS allowlist.
- `R2_ACCOUNT_ID`, `R2_ACCESS_KEY_ID`, `R2_SECRET_ACCESS_KEY`, `R2_BUCKET_NAME`, `R2_ENDPOINT`, `R2_PUBLIC_URL`: Cloudflare R2 config.
- `GEMINI_PIPELINE_DIR`: path to Gemini pipeline directory.
- `KEEP_TEMP_FILES`: keep temp files (`true` to preserve).
- `PAYLINK_39`, `PAYLINK_89`, `PAYLINK_39_TRIAL`: GoDaddy paylinks.
- `GMAIL_USER`, `GMAIL_APP_PASSWORD`, `GMAIL_IMAP_HOST`, `GMAIL_IMAP_PORT`: IMAP email export.
- `PAYMENT_EMAIL_SENDERS`, `GODADDY_PAYMENTS_WINDOW_HOURS`, `PAYMENT_EMAIL_DISABLE_TIME_FILTER`, `GODADDY_PAYMENTS_MAX`, `PAYMENT_EMAIL_MAX`: email export filters.

### Frontend

- `VITE_API_URL`: backend base URL (defaults to `http://localhost:5050` in dev).
- `VITE_PREVIEW_BASE_URL`: PDF preview proxy base URL (ViewPdfModal).

## Local Development

### Backend

```
cd backend
yarn install
yarn dev
```

### Frontend

```
cd frontend
yarn install
yarn start
```

## Notes and Constraints

- File uploads are limited to PDFs only and 10 MB per file.
- Total per-user storage limit is 100 MB.
- Estimate generation enforces a 2-hour cooldown per file.
- Payments expire after 2 minutes if not confirmed.
- Admin users (allowlist) bypass payment requirements.
- Public R2 URLs are normalized to a fixed public base URL in multiple places.
