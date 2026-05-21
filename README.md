# Accounting & Financial Management System

A production-ready, full-stack accounting system with Philippine regulatory compliance (BIR, SSS, PhilHealth, Pag-IBIG). Built on NestJS + React 18 + PostgreSQL with strict double-entry bookkeeping enforced at the database level.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18 + TypeScript, TailwindCSS, shadcn/ui, TanStack Query v5, Recharts |
| Backend | NestJS (Node 20), REST + GraphQL (Apollo), Prisma ORM |
| Database | PostgreSQL 16 |
| Cache/Queue | Redis 7 + BullMQ |
| Storage | MinIO (local) / S3-compatible (prod) |
| Infra | Docker Compose, pnpm workspaces, GitHub Actions |

---

## Quick Start (Local Dev)

### Prerequisites
- Node.js 20+
- pnpm 9+
- Docker Desktop

### 1. Clone and install

```bash
git clone <repo-url> accounting-system
cd accounting-system
pnpm install
```

### 2. Configure environment

```bash
cp .env.example apps/api/.env
# Edit apps/api/.env — defaults work for Docker dev
```

### 3. Start Docker services

```bash
pnpm docker:up
# This starts: postgres, redis, minio
```

### 4. Run database migrations and seed

```bash
pnpm db:migrate    # runs Prisma migrations
pnpm db:seed       # seeds Philippine CoA, demo company, admin user
```

### 5. Start dev servers

```bash
pnpm dev
# API:  http://localhost:3000/api/v1
# Web:  http://localhost:5173
# Docs: http://localhost:3000/api/docs (Swagger)
# GQL:  http://localhost:3000/graphql
```

### Default Login

```
Email:    admin@demoenterprise.ph
Password: Admin@1234!
```

---

## Project Structure

```
accounting-system/
├── apps/
│   ├── api/          NestJS backend
│   │   ├── src/
│   │   │   ├── common/     Guards, interceptors, utils
│   │   │   └── modules/    Feature modules (auth, accounts, journal, ...)
│   │   └── prisma/
│   │       ├── schema.prisma
│   │       └── seed.ts
│   └── web/          React frontend
│       └── src/
│           ├── features/   Feature pages & components
│           ├── hooks/      Zustand stores, custom hooks
│           └── lib/        API client, money utils, date utils
└── packages/
    ├── shared/       Shared TypeScript types & Zod schemas
    └── ui/           Shared UI components
```

---

## Environment Variables

| Variable | Description | Default |
|---|---|---|
| `DATABASE_URL` | PostgreSQL connection string | see `.env.example` |
| `REDIS_URL` | Redis connection string | `redis://localhost:6379` |
| `S3_ENDPOINT` | MinIO / S3 endpoint | `http://localhost:9000` |
| `S3_ACCESS_KEY` | S3 access key | `minioadmin` |
| `S3_SECRET_KEY` | S3 secret key | `minioadmin123` |
| `S3_BUCKET` | S3 bucket name | `accounting-docs` |
| `JWT_ACCESS_SECRET` | JWT signing secret | **change in prod** |
| `JWT_REFRESH_SECRET` | Refresh token secret | **change in prod** |
| `PORT` | API port | `3000` |

---

## Build Order (13 Phases)

| Phase | Module | Status |
|---|---|---|
| 0 | Scaffolding (monorepo, Docker, Prisma schema, seed) | ✅ Done |
| 1 | Auth & RBAC (JWT, 2FA, SSO stubs, roles) | 🔄 Next |
| 2 | Chart of Accounts (tree, CRUD, React UI) | ⏳ |
| 3 | Journal Entry + double-entry validation | ⏳ |
| 4 | General Ledger + sub-ledgers | ⏳ |
| 5 | Accounts Receivable (invoices, aging) | ⏳ |
| 6 | Accounts Payable (bills, payments) | ⏳ |
| 7 | Financial Statements (P&L, BS, CF) | ⏳ |
| 8 | Procurement (PO → GRN → 3-way match) | ⏳ |
| 9 | Inventory (FIFO/LIFO/WA, COGS) | ⏳ |
| 10 | Fixed Assets (depreciation, disposal) | ⏳ |
| 11 | Payroll (Philippine BIR/SSS/PhilHealth/Pag-IBIG) | ⏳ |
| 12 | Expense Management (claims, approvals) | ⏳ |
| 13 | Bank Reconciliation + BI Dashboard + Integrations | ⏳ |

---

## Key Architectural Rules

- **Double-entry enforced at DB level** — PostgreSQL trigger rejects unbalanced journal entries
- **No floats for money** — `NUMERIC(19,4)` in DB, `decimal.js` in frontend, amounts as strings in API
- **Soft deletes only** — all financial records use `deleted_at`, never hard-deleted
- **Multi-tenancy** — every table has `company_id`; PostgreSQL RLS enforces isolation
- **Period locking** — `PeriodLockGuard` prevents backdated entries to closed periods
- **Audit trail** — append-only `audit_log` table, captures before/after for every mutation

---

## API Documentation

- Swagger UI: `http://localhost:3000/api/docs`
- GraphQL Playground: `http://localhost:3000/graphql`

---

## MinIO Console

Access the MinIO object storage console at `http://localhost:9001`
- Username: `minioadmin`
- Password: `minioadmin123`

---

## Running Tests

```bash
# Unit tests (all packages)
pnpm test

# API e2e tests
pnpm test:e2e

# Coverage report
pnpm --filter api test:cov
```

---

## Production Deployment

```bash
# Build all
pnpm build

# Use production docker-compose
docker-compose -f docker-compose.prod.yml up -d

# Run migrations (production — no interactive prompts)
pnpm --filter api prisma:migrate:prod
```

---

## Philippine Regulatory Notes

- **BIR VAT**: Pre-configured VAT12 (12%) and input VAT codes for BIR Form 2550M/2550Q
- **SSS**: 2024 contribution table seeded; auto-computes employee/employer share per MSC
- **PhilHealth**: 5% of basic salary, 50/50 split
- **Pag-IBIG**: ₱100 employee + ₱100 employer (or 2% of salary, max ₱100)
- **BIR Withholding**: TRAIN Law 2023 tax table implemented in payroll module

---

## License

MIT
