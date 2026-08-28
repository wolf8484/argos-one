// On Vercel this is the deployed commit, so a stale open tab/PWA can detect a
// newer deploy by polling /api/version. Locally there's no commit-per-request
// signal, so DEV_BUILD_LABEL stands in -- bump it alongside the app.js
// cache-buster whenever a UI change is made, and an already-open local tab
// will flag itself as stale the same way a stale production tab would,
// letting the update-available flow (nav blip + Settings reload) be
// exercised without a real deploy.
const DEV_BUILD_LABEL = "20260828-note-modal-spacing"

export const BUILD_VERSION = process.env.VERCEL_GIT_COMMIT_SHA || DEV_BUILD_LABEL
