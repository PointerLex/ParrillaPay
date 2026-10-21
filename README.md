# ParrillaPay
Aplicación web mobile-first para organizar y dividir gastos de juntas.

## Structure
- `frontend/` – Next.js (App Router) + Tailwind + lucide-react. `npm install && npm run dev`
- `backend/` – Express API, PostgreSQL via Prisma, and receipt upload (`POST /api/upload`, field `receipt`).

## Local development
1. Start a PostgreSQL database and copy `backend/.env.example` to `backend/.env`.
2. Set `DATABASE_URL` and replace `JWT_SECRET` with a random value of at least 32 characters. `ANTHROPIC_API_KEY` is optional; without it, receipt data can be entered and reviewed manually.
3. In `backend/`, run `npm install`, `npm run prisma:generate`, `npm run prisma:migrate`, and `npm run dev`.
4. In `frontend/`, run `npm install` and `npm run dev`. Set `NEXT_PUBLIC_API_URL` when the API is not at `http://localhost:4000`.

Users can register, create a junta, share its invite code, add expenses, and upload receipts for extraction. Expense data extracted from a receipt must be reviewed before saving. Transfer receipts are automatically marked paid only when the amount, sender, recipient, destination account, and date match; otherwise, the host or creditor must review them.

## Checks and deployment
- Backend tests: `cd backend && npm test`
- Backend dependency audit: `cd backend && npm audit`
- Prisma validation: `cd backend && npx prisma validate`
- `render.yaml` describes the API, frontend, and PostgreSQL services for Render. Configure `ANTHROPIC_API_KEY` in the Render dashboard to enable Claude receipt extraction.
