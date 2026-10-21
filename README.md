# ParrillaPay
Aplicación web para pagos

## Structure
- `frontend/` – Next.js (App Router) + Tailwind + lucide-react. `npm install && npm run dev`
- `backend/` – Express API with multer upload (`POST /api/upload`, field `receipt`) and Prisma schema (PostgreSQL). Copy `.env.example` to `.env`, then `npm install && npm start`
