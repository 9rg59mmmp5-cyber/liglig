# Spor Karabük - League Tracker

## Overview
Turkish football league tracker app for Karabük İdman Yurdu. Displays live standings, fixtures, and scores from TFF (Turkish Football Federation) data. Features AI-powered league analysis via Google Gemini.

## Tech Stack
- **Frontend**: React 19 + TypeScript + Vite + Tailwind CSS (CDN)
- **Backend**: Express.js (production server), Vite dev server middleware (development)
- **API**: TFF data scraping endpoint at `/api/tff-sync`
- **AI**: Google Gemini for league analysis (requires GEMINI_API_KEY)

## Project Structure
- `App.tsx` - Main application component
- `index.tsx` - React entry point with PWA service worker registration
- `index.html` - HTML template with Tailwind CDN
- `components/` - React components (StandingsTable, FixtureList, CombinedStandingsExport)
- `services/` - Service modules (tffService.ts, geminiService.ts)
- `constants.ts` - Static league data and team configurations
- `types.ts` - TypeScript type definitions
- `utils.ts` - Utility functions
- `vite.config.ts` - Vite config with API middleware for dev
- `server.js` - Production Express server serving built files + API
- `public/` - PWA assets (manifest.json, service-worker.js, icon.svg)

## Running
- **Development**: `npm run dev` (Vite dev server on port 5000)
- **Production**: `npm run build` then `node server.js`

## Environment Variables
- `GEMINI_API_KEY` - Optional Google Gemini API key for AI league analysis
