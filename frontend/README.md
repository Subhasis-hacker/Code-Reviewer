# CP Dashboard + Code Reviewer (merged frontend)

    npm install
    npm run dev      # http://localhost:5173  (API: http://127.0.0.1:8000/api/v1)

Base: `cp-dashboard` (auth, API client, CP sync, roadmap) — unchanged except `api1.js -> api.js`, `App1.jsx -> App.jsx`.
Added from `frontend`: the Code Reviewer (`src/pages/CodeReviewer.jsx`), restyled to the cp-dashboard theme.

- `POST /review` `{ code, problem_description }` streams plain text (`reviewApi.stream` in `src/api.js`).
- Reviews keep running while you switch pages (state lives in `src/context/ReviewContext.jsx`).
- Token safety: code is split into ~3k-token parts, each its own request; a part that hits a size limit is split further and retried; 429s back off and retry; Stop/Continue resumes from the unfinished part; drafts and the last 8 reviews persist in localStorage.
