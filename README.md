# ZeroTrash

ZeroTrash is a local college cleanup prototype with separate volunteer and collection-centre admin portals.

## Local setup

Install both sets of dependencies once:

```bash
npm install
npm --prefix backend install
```

Start the frontend and backend together:

```bash
npm run dev:full
```

- Frontend: `http://localhost:5173`
- Backend health check: `http://localhost:5050/health`
- SQLite database: `backend/data/zerotrash.sqlite`
- Uploaded photos: `backend/uploads/`

The database and uploads remain on this laptop and survive restarts. They are excluded from Git.

## Demo accounts

- Volunteer: `volunteer@zerotrash.local` / `volunteer123`
- Admin: `admin@zerotrash.local` / `admin123`

The backend supports registration, separate role sessions, admin-listed cleanup spots, volunteer claiming with before/after photo evidence, admin-only weighing, automatic credits at 30 credits per kilogram, voucher redemption, and protected image access.

Browser location checks are disabled for local development. To enable them later, set `NEXT_PUBLIC_PHOTO_LOCATION_ENABLED=true` in the frontend environment and `REQUIRE_PHOTO_LOCATION=true` in the backend environment, then rebuild and restart both services.

For a free Docker deployment with persistent SQLite data and photo uploads, follow [DEPLOYMENT.md](./DEPLOYMENT.md).
