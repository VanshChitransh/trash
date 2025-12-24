# Frontend Codebase Index

## Stack & Build
- React 18 + Vite; Tailwind for styling. Dev server on port 4028 with `tsconfigPaths`, component tagger, and React plugins; build outputs to `dist/` (chunk warning 20 MB).
- Entry mounts `App` in `src/index.jsx`; `src/App.jsx` wraps the app with `NotificationProvider` and renders `src/Routes.jsx`.
- `jsconfig.json` sets `baseUrl` to `src` so imports can start from `components/...`, `pages/...`, etc.
- Scripts: `start` (vite), `build` (vite build with sourcemap), `serve` (vite preview).

## Core Infrastructure
- Routing: `src/Routes.jsx` uses `BrowserRouter`, `ErrorBoundary`, `AuthGuard`, and `ScrollToTop`; routes for landing, dashboard, auth hub, PDF viewer, estimate results, file upload, account, and 404.
- AuthGuard: `src/components/AuthGuard.jsx` checks `/api/auth/me` (ignores 401), caches user in localStorage, dispatches `userLoaded`, and shows a loading state while checking.
- Notifications: `src/contexts/NotificationContext.jsx` stores notifications in localStorage (`consultabid_notifications`, max 50) and powers `components/ui/NotificationDropdown.jsx`.
- API helper: `src/utils/api.js` wraps `fetch` with bearer token support (`authToken` or token on `user`), timeouts, and `api.upload` for multipart. Base URL comes from `VITE_API_URL`, else localhost:5050 in dev, else DigitalOcean fallback. Exposes `API_BASE_URL` and `getToken`.
- Logout helper: `src/utils/logout.js` hits `/api/auth/logout` (ignores 401/500), clears local/session storage, and routes to `/authentication-hub`.
- Other utilities: `src/utils/cn.js` (class merge), `src/utils/mockAuth.js` (simple current-user stub).

## Shared UI (`src/components`)
- Core: `AppIcon.jsx` (Lucide wrapper), `AppImage.jsx` (fallback), `ErrorBoundary.jsx`, `ScrollToTop.jsx`, `ViewPdfModal.jsx` (R2 preview via Worker; env `VITE_PREVIEW_BASE_URL`/NEXT_PUBLIC/REACT_APP or default `consultabid` worker; sanitizes keys, handles load/error/download).
- `components/ui`: `Header.jsx` (global nav + profile dropdown fed by stored user + notifications), `NotificationDropdown.jsx`, `Breadcrumb.jsx`, `Button.jsx` (CVA variants, icons, loading, `asChild`), `Input.jsx`, `Select.jsx`, `Checkbox.jsx`, `Toast.jsx`, plus backup `Header.jsx.backup`.

## Pages (routes in `Routes.jsx`)
- `landing-page/`: marketing layout with header/hero/features/pricing/testimonials/CTA/footer; links to auth flow.
- `authentication-hub/`: login/register tabs, forgot-password modal, trust signals, privacy card gate after auth; checks `/api/auth/me`; uses `/api/auth/login`, `/api/auth/register`, `/api/auth/google`, `/api/auth/forgot-password`; stores `isAuthenticated`/`user` before redirecting post-privacy.
- `dashboard-overview/`: loads `/api/auth/me` (refreshes lastLogin) and `/api/files` for stats, recent uploads, activity feed, usage chart, quick actions, welcome card; preview opens `/api/files/:id/preview`.
- `file-upload-management/`: drag/drop upload (`api.upload('/api/files/upload')`), file list with status, bulk delete/download, view via `/api/files/:id/preview` (fallback to PDF viewer), delete `/api/files/:id`, download direct fetch; estimate trigger `/api/files/:id/process-estimate` with pre-check `/api/files/:id/estimate-wait-status`, 2-hour local timers + notifications, storage usage widget, quick actions, processing sidebar; uses `ViewPdfModal` fallback.
- `estimate-generation-results/`: multi-step flow (options → processing → results/wait). Loads user + `/api/files`, enforces wait via `/api/files/:id/estimate-wait-status` and persists timers in `consultabid_estimate_wait`; payment flow with `/api/payments/start` + `/api/payments/status/:id`, storing session in `consultabid_payment_session` and paid files in `consultabid_paid_files`; generation via `/api/files/:id/process-estimate`; preview `/api/files/:id/preview`; export uses `/api/files/:id/generate-estimate-pdf` and `/api/files/:id/download-estimate-pdf` with bearer token. Components: GenerationOptions, ProcessingIndicator, EstimateOverview, DetailedBreakdown, CostCalculator, PriorityRecommendations, ExportOptions, WaitPeriodTimer.
- `pdf-viewer-modal/`: fullscreen viewer with header controls, thumbnail sidebar, action bar (download/share/delete/generate estimate); accepts file via navigation state; delete via `/api/files/:id`; download via fetch of `fileUrl`; returns to origin route.
- `accounts/`: tabbed settings (profile `/api/auth/profile`, security `/api/auth/change-password`, account details, connected accounts refresh `/api/auth/me`); stores user locally; uses Toast feedback.
- `NotFound.jsx`: simple 404 route.

## Styling & Assets
- `src/styles/tailwind.css` defines CSS variables (colors, fonts: Inter/JetBrains Mono) and shared utilities (shadows, transitions); `src/styles/index.css` provides base reset.
- `tailwind.config.js` extends tokens, spacing, z-index, animations, and pulls `tailwindcss-animate`; content globs cover `src`/components/pages.
- Public assets under `public/` (logo, favicon, manifest, robots, placeholder `public/assets/images/no_image.png`).

## Config & Env
- Vite config (`vite.config.mjs`): dev host `0.0.0.0` strict port 4028, allowedHosts for AWS/rocket, plugins react/tsconfigPaths/component-tagger.
- Env vars: `VITE_API_URL` for backend base; preview worker URL via `VITE_PREVIEW_BASE_URL` (or NEXT_PUBLIC/REACT_APP equivalents) with default `https://small-forest-1400.arcinspectiongroup.workers.dev`.

## Storage & API Touchpoints
- LocalStorage: `isAuthenticated`, `user`, `authToken` (read by API helper), `consultabid_notifications`, `consultabid_estimate_wait`, `consultabid_payment_session`, `consultabid_paid_files`.
- API endpoints referenced: `/api/auth/me`, `/api/auth/login`, `/api/auth/register`, `/api/auth/google`, `/api/auth/logout`, `/api/auth/forgot-password`, `/api/auth/profile`, `/api/auth/change-password`; `/api/files`, `/api/files/upload`, `/api/files/:id`, `/api/files/:id/preview`, `/api/files/:id/process-estimate`, `/api/files/:id/estimate-wait-status`, `/api/files/:id/generate-estimate-pdf`, `/api/files/:id/download-estimate-pdf`; `/api/payments/start`, `/api/payments/status/:id` (newsletter API commented in landing footer).
