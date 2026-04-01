<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/drive/15tMAvdI6RIFNGDi8tA66blhsWqVoiD0H

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`

---

## Live CSV dashboard data

The dashboard values are no longer hardcoded. A small Express server (`server.js`) reads `maternal_data.csv` from `../nyota-api-local` and
serves JSON at `/api/board`. The front end fetches this endpoint on startup (and polls every 30 s), so any edits to the CSV are reflected in
the UI.

**Setup:**
1. Install the new dependencies by rerunning `npm install` (adds `express`, `csv-parser`, `cors`).
2. Start the CSV backend in another terminal with `npm run csv-server` (listens on port 3001).
3. Launch the React dev server (`npm run dev`); Vite proxies `/api/*` to the backend.

Feel free to add additional columns to the CSV and update `server.js`/`types.ts` accordingly.

## Deploy On Render

This repo is now configured to deploy as a single Render Web Service (frontend + API).

1. Push your latest code to GitHub.
2. In Render, click `New +` -> `Blueprint` and select this repo.
3. Render will pick up `render.yaml` automatically.
4. In service environment variables, set:
   - `GEMINI_API_KEY` = your API key
5. Deploy.

Notes:
- Health check endpoint: `/api/health`
- Server uses Render's `PORT` automatically.
- The built Vite app is served by Express in production.

