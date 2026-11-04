# Veronica: Food Label Intelligence

Veronica is a Next.js 15 food-label analysis app. It scans product barcodes using ZXing and Open Food Facts, analyzes packaged-food photos with a Groq-hosted model, and stores authenticated user data with PostgreSQL and Prisma.

## Features
- Camera barcode scanning and package-label image analysis
- Ingredient explanations, nutrition validation and AI-based food summaries
- Source and verification indicators with evidence beside health ratings
- Healthier product alternatives and side-by-side comparison of saved scans
- Account-based scan history with private images and delete controls
- **Food log:** record portions you actually ate, separate from scans
- Browser caching and a limited service-worker offline shell

## Architecture
React UI -> Next.js API routes -> Open Food Facts / Groq / PostgreSQL via Prisma / private S3-compatible object storage. Clerk authenticates accounts; backend endpoints independently check the signed-in identity. AI requests have database-backed hourly quotas.

## Setup
1. Install Node.js 22+ and PostgreSQL.
2. Add credentials to `.env.local` (never commit secrets):
   - `DATABASE_URL`
   - `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, `CLERK_SECRET_KEY`
   - `GROQ_API_KEY`
   - `AWS_ENDPOINT_URL_S3`, `NEON_STORAGE_BUCKET`, `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, optional `AWS_REGION`
3. Run `npm ci --legacy-peer-deps`.
4. Run `npx prisma migrate deploy` after backing up your database.
5. Run `npm run dev`, then open http://localhost:3000.

## Tests
- `npm test`: nutrition-unit and portion-math tests.
- `npx prisma validate`: schema verification.
- `npx next build`: production compile without DB migration.
- `npm run build` compiles without applying database migrations.
- `npm run db:migrate` applies schema changes only when you explicitly run it, after backing up and testing in staging.

## Pre-release checklist
- Run GitHub Actions and confirm a clean build.
- Test login/signup, barcode scanning, image analysis, failed network calls, rate limits and camera permissions on real mobile devices.
- Verify that account A cannot fetch account B's health profile, scans, consumption entries or private images.
- Compare identical serving bases (per 100 g or per 100 ml); missing nutrients must remain unknown.
- Confirm scans are not included in actual food-consumption totals unless explicitly logged.
- Verify the configured object-storage bucket is **private** and revoke older publicly shared history objects if needed.
- Review health-data privacy, retention and consent obligations before general release.

## Limitations
AI food ratings are informational, not clinical certifications or allergy safety guarantees. Verify important facts directly from the package. The app requires online services for AI, food data and account storage. Real end-to-end and load testing requires a deployed staging environment.
