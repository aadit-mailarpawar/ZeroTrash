# ZeroTrash backend

Local REST API created specifically for the ZeroTrash college cleanup prototype.

Admins publish campus cleanup locations. A volunteer claims a spot with a geotagged before photo, submits a geotagged after photo, and receives credits after collection-centre verification.

## Run

```bash
npm install
npm run dev
```

The API runs at `http://localhost:5050` and stores its SQLite database in `data/zerotrash.sqlite`. Uploaded cleanup photos are stored in `uploads/`.

Demo accounts:

- Volunteer: `volunteer@zerotrash.local` / `volunteer123`
- Admin: `admin@zerotrash.local` / `admin123`
