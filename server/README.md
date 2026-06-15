# Flowiix POS — Backend API

Express + Mongoose API for products, billing, and stock control.

## Setup

```bash
cd server
npm install
cp .env.example .env   # fill in MONGODB_URI and API_KEY
npm run seed           # one-time: load the starter product catalog
npm run dev            # starts on http://localhost:4000
```

## Security

- All `/api/*` routes require the header `x-api-key: <API_KEY>`.
- `helmet`, CORS allow-list, rate limiting (120 req/min), and a 256 KB JSON
  body cap are enabled.
- Bill creation runs in a **MongoDB transaction**: prices/costs are read from
  the DB (never trusted from the client), stock is validated and decremented
  atomically, and a guard prevents overselling under concurrent sales.
- **Rotate the database password** — the original was shared in plain text.
- The `x-api-key` is embedded in the mobile bundle, so it is a basic gate, not
  user authentication. Add real user auth before a wide public release.

## Endpoints

| Method | Path                | Notes                                   |
| ------ | ------------------- | --------------------------------------- |
| GET    | `/health`           | No auth. Health check.                  |
| GET    | `/api/products`     | `?page=&limit=&search=&includeInactive` |
| POST   | `/api/products`     | Create product                          |
| PATCH  | `/api/products/:id` | Update product                          |
| DELETE | `/api/products/:id` | Soft delete (sets `active:false`)       |
| POST   | `/api/bills`        | `{ items:[{productId,qty}], cashReceived }` |
| GET    | `/api/bills`        | `?page=&limit=` newest first            |
| GET    | `/api/bills/:id`    | Single bill (reprint)                   |

Paginated responses: `{ data: [...], pagination: { page, limit, total, totalPages, hasMore } }`.

## Deploy

- **Render**: includes `render.yaml`. Set `MONGODB_URI` / `API_KEY` as secret
  env vars in the dashboard.
- **Docker / Railway / Fly**: `Dockerfile` provided. Pass env vars at runtime.
