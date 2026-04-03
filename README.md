# Inventory Reservation API

> **Deployed URL:** https://inventory-system-three-murex.vercel.app
>
> **Demo Video:** https://drive.google.com/file/d/1LqlU344E8VMHBaF4Kd8i9Cgyu39S_lqn/view?usp=share_link

A concurrency-safe REST API for managing inventory items and temporary reservations, built with Express.js, TypeScript, and Supabase (PostgreSQL). Deployed as serverless functions on Vercel.

## Overview

This API allows a fictitious store to:
- Create inventory items with an initial stock quantity
- Temporarily hold (reserve) inventory for customers
- Confirm reservations to permanently deduct stock
- Cancel reservations to release held stock
- Expire stale reservations that exceed their 10-minute TTL

### Assumptions and Design Decisions

- **No authentication** — All endpoints are publicly accessible (out of scope per requirements)
- **No background job scheduler** — Reservation expiration is triggered on-demand via a maintenance endpoint, not a background cron. An external scheduler (e.g., Vercel Cron) could call this endpoint periodically.
- **Concurrency safety via PostgreSQL row-level locking** — All inventory mutations use `SELECT ... FOR UPDATE` inside PL/pgSQL functions, ensuring serialized access to item rows. This prevents overselling without application-level locks.
- **Denormalized counters** — `reserved_quantity` and `confirmed_quantity` are stored directly on the `items` table to avoid expensive aggregation queries. Consistency is guaranteed by the transactional locking strategy and CHECK constraints.
- **Idempotent confirm/cancel** — Re-confirming an already confirmed reservation returns success without double-deducting. Re-cancelling returns success without double-releasing.
- **Auto-expiry on confirm** — If a PENDING reservation is past its `expires_at` when a confirm is attempted, the system automatically expires it and rejects the confirmation, even if the maintenance endpoint hasn't been called yet.

## API Endpoints

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/v1/items` | Create a new inventory item |
| `GET` | `/v1/items/:id` | Get item status with computed quantities |
| `POST` | `/v1/reservations` | Create a reservation (temporary hold) |
| `POST` | `/v1/reservations/:id/confirm` | Confirm reservation (permanently deduct) |
| `POST` | `/v1/reservations/:id/cancel` | Cancel reservation (release hold) |
| `POST` | `/v1/maintenance/expire-reservations` | Expire stale pending reservations |

### Documentation

- **Swagger UI**: `/docs`
- **OpenAPI JSON**: `/openapi.json`

## Architecture

```
src/
  routes/         # Express route handlers
  services/       # Business logic (state machine, validation)
  repositories/   # Database access (Supabase client + RPC calls)
  middleware/      # Error handler, Zod validation
  config/         # Supabase client, Swagger config
  types/          # TypeScript interfaces, Zod schemas
api/
  index.ts        # Vercel serverless entry point
supabase/
  migration.sql   # Full database schema (run in Supabase SQL Editor)
```

## Setup

### Prerequisites

- Node.js 18+
- A [Supabase](https://supabase.com) project (free tier works)

### 1. Clone and install

```bash
git clone <repo-url>
cd inventory-system
npm install
```

### 2. Configure environment variables

```bash
cp .env.example .env
```

Edit `.env` with your Supabase credentials:

```
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-supabase-anon-key
PORT=3000
```

You can find these values in your Supabase dashboard under **Settings > API**. Use the **anon/public** key (not the service role key). The migration grants the necessary RLS policies and function permissions to the anon role.

### 3. Run the SQL migration

1. Open the [Supabase SQL Editor](https://supabase.com/dashboard/project/_/sql)
2. Copy the entire contents of `supabase/migration.sql`
3. Paste into the SQL Editor and click **Run**

This creates all tables, constraints, indexes, triggers, and PostgreSQL functions in one step.

### 4. Start the dev server

```bash
npm run dev
```

The API will be available at `http://localhost:3000`.
- Swagger UI: [http://localhost:3000/docs](http://localhost:3000/docs)
- OpenAPI JSON: [http://localhost:3000/openapi.json](http://localhost:3000/openapi.json)

## Deployment (Vercel)

### 1. Install Vercel CLI and deploy

```bash
npm i -g vercel
vercel
```

Follow the prompts to link/create a Vercel project.

### 2. Set environment variables

In the [Vercel dashboard](https://vercel.com) under your project's **Settings > Environment Variables**, add:

- `SUPABASE_URL`
- `SUPABASE_ANON_KEY`

### 3. Deploy to production

```bash
vercel --prod
```

### 4. Verify

Visit `https://<your-app>.vercel.app/docs` to confirm Swagger UI loads with all 6 endpoints.

## Reproducing Concurrency Scenarios

### Setup: Create an item with limited stock

```bash
curl -X POST https://<your-url>/v1/items \
  -H "Content-Type: application/json" \
  -d '{"name": "Limited Edition Sneakers", "initial_quantity": 5}'
```

Save the `id` from the response.

### Test 1: Parallel reservations (proves overselling prevention)

Send 10 concurrent requests each trying to reserve 3 of the 5 available units:

```bash
# Using GNU parallel (brew install parallel)
ITEM_ID="<paste-item-id>"
seq 1 10 | parallel -j10 "curl -s -X POST https://<your-url>/v1/reservations \
  -H 'Content-Type: application/json' \
  -d '{\"item_id\": \"$ITEM_ID\", \"customer_id\": \"customer-{}\", \"quantity\": 3}'"
```

**Expected**: Exactly 1 succeeds (201), the remaining 9 fail (409). Check the item status to verify `reserved_quantity` never exceeds `total_quantity`.

### Test 2: Idempotent confirm

```bash
RESERVATION_ID="<paste-reservation-id>"

# Confirm once
curl -X POST https://<your-url>/v1/reservations/$RESERVATION_ID/confirm

# Confirm again — should return same result, no double-deduct
curl -X POST https://<your-url>/v1/reservations/$RESERVATION_ID/confirm
```

### Test 3: Idempotent cancel

```bash
# Cancel once
curl -X POST https://<your-url>/v1/reservations/$RESERVATION_ID/cancel

# Cancel again — should return same result, no double-release
curl -X POST https://<your-url>/v1/reservations/$RESERVATION_ID/cancel
```

### Test 4: Expiration flow

1. Create a reservation
2. Wait 10 minutes (or modify `expires_at` in Supabase Table Editor to a past time)
3. Call the maintenance endpoint:

```bash
curl -X POST https://<your-url>/v1/maintenance/expire-reservations
```

4. Check the item status — available quantity should be restored

## Reservation State Machine

```
PENDING ──► CONFIRMED  (confirm: reserved → confirmed)
   │
   ├──► CANCELLED     (cancel: reserved released)
   │
   └──► EXPIRED       (maintenance OR auto-expire on confirm attempt)
```

## Architecture Decisions

### Why PostgreSQL row-level locking instead of optimistic locking?

Optimistic locking (version column + retry loop) requires the application to handle retries, adding complexity. `SELECT ... FOR UPDATE` serializes concurrent access at the database level — simpler, correct by construction, and no retry logic needed. The trade-off is slightly higher latency under contention, which is acceptable for this use case.

### Why denormalized counters on the items table?

Storing `reserved_quantity` and `confirmed_quantity` directly on items avoids a `SUM()` aggregation across the reservations table on every status check. The counters are safe because all mutations happen inside locked transactions. The `CHECK (reserved_quantity + confirmed_quantity <= total_quantity)` constraint acts as a database-level backstop — even a bug in the application code cannot violate inventory integrity.

### Why PL/pgSQL functions instead of multi-statement transactions?

Supabase's JS client uses PostgREST (HTTP/REST), which doesn't support multi-statement transactions. Each `.from()` call is an independent HTTP request. By placing the lock-check-update logic inside PostgreSQL functions and calling them via `supabase.rpc()`, each call executes as a single atomic transaction. This is the canonical pattern for concurrency-safe operations with Supabase.

### Why auto-expire on confirm?

If a reservation's TTL has passed but the maintenance endpoint hasn't been called, the reservation is still PENDING in the database. Without the auto-expire check, a confirm call would succeed — permanently deducting inventory that should have been released. The `confirm_reservation` function checks `expires_at < NOW()` and atomically expires the reservation if it's stale, preventing this edge case.

### Why TEXT + CHECK instead of ENUM for status?

PostgreSQL ENUMs require an `ALTER TYPE` migration to add new values, which can be problematic in production. A TEXT column with a CHECK constraint is equally type-safe at the database level but simpler to evolve.

## Limitations

- **No authentication** — Any caller can access all endpoints (out of scope)
- **No background expiration** — Expired reservations are only released when the maintenance endpoint is called, or when a stale reservation is confirmed (auto-expire). An external cron could automate this.
- **No restocking** — Item `total_quantity` is set at creation and cannot be updated. Once all units are confirmed, the item is permanently exhausted
- **No pagination** — Item/reservation listing endpoints not implemented
- **No rate limiting** — Could be added as middleware if needed
- **Vercel cold starts** — First request after inactivity may be slower due to serverless cold start
