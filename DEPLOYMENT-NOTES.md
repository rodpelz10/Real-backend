# Updated Food Delivery Backend

## What changed
- CORS now reads `CLIENT_ORIGIN` from the environment and supports multiple comma-separated frontend origins.
- The local Vite origin (`http://localhost:5173`) is allowed automatically only outside production.
- In production, configure `CLIENT_ORIGIN` with the exact deployed frontend origin. Do not include a trailing slash.
- Removed the local `.env` file and Git metadata from this shareable ZIP so private credentials are not distributed.

## Render environment variables
Keep your existing database, JWT, admin, and AI settings in Render. Make sure these are set:

- `NODE_ENV=production`
- `CLIENT_ORIGIN=https://your-deployed-frontend-domain`
- `MONGODB_URI=...` (your MongoDB connection string)
- `JWT_SECRET=...` (a long, random secret)
- `ADMIN_NAME=...`
- `ADMIN_EMAIL=...`
- `ADMIN_PASSWORD=...` (8–72 characters)
- `GEMMA_API_KEY=...` (if using the AI feature)
- `GEMMA_MODEL=...` (if required by your AI configuration)

Render supplies `PORT` automatically; the server uses it.

If you have more than one frontend origin, set `CLIENT_ORIGIN` to a comma-separated list, for example:
`https://app.example.com,https://www.example.com`

## Local development
1. Copy `.env.example` to `.env`.
2. Set `MONGODB_URI`, `JWT_SECRET`, and any required AI/admin values.
3. Run `npm install` and `npm run dev` from this backend folder.

Health check: `/api/health`
