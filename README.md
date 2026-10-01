# Veronica

Veronica helps you understand packaged food labels. Scan a barcode or photograph a label to see nutrition, ingredients, a general AI assessment, and comparable products.

[Live app](https://veronica-steel.vercel.app)

## Features

- Camera barcode scanning, manual barcode entry, and a photo fallback for missing products.
- Nutrition and ingredients from Open Food Facts or a photographed package label.
- Nutrition basis and source information beside the result; missing values remain unknown.
- Personal ingredient warnings using your allergy and dietary preferences.
- Alternatives from the same category, compared on a compatible nutrition basis.
- Saved analyses for signed-in users, with retries saved as one record.
- Scan insights that convert known serving quantities before calculating totals.

## Local setup

Use Node.js 24 and npm. Install dependencies:

```sh
npm ci
```

Copy `.env.example` to `.env.local` and configure the services you want to use. Keep real credentials out of source control.

| Variable | Purpose |
| --- | --- |
| `GROQ_API_KEY` | Barcode commentary and label-photo analysis |
| `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | Clerk sign-in UI |
| `CLERK_SECRET_KEY` | Server authentication |
| `DATABASE_URL` | PostgreSQL connection for profiles and scan history |
| `AWS_ENDPOINT_URL_S3` | S3-compatible object storage endpoint for uploaded history images |
| `NEON_STORAGE_BUCKET` | History image bucket |
| `AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY` | Object storage credentials |
| `AWS_REGION` | Object storage region; defaults to `us-east-2` |

For database commands, make `DATABASE_URL` available in your shell or in a local `.env` file that Prisma can read. Next.js loads `.env.local` for application requests; Prisma's CLI does not automatically load that file.

Apply the existing migrations to your development database:

```sh
npx prisma migrate deploy
npm run dev
```

Open [localhost:3000](http://localhost:3000). Camera access requires localhost or HTTPS and permission from your browser. AI analysis requires Groq configuration; account history requires Clerk and PostgreSQL. Photo history also requires configured object storage with readable image URLs.

## Checks

```sh
npm test
npm run build:check
```

The regression tests use Node's built-in test runner. They cover profile ownership, nutrition units and serving conversion, unknown values, local date boundaries, and idempotent scan saving with mocked service dependencies. They do not call paid AI services or a production database. GitHub Actions runs these tests on pushes and pull requests.

`build:check` compiles the application without applying database migrations. The existing deployment command, `npm run build`, applies migrations before building, so use it only with the intended database configured.

## How the data flows

1. `/api/scanBarcode/[barcode]` retrieves source product facts from Open Food Facts.
2. `/api/analyzeBarcode` retains those facts and adds AI commentary. `/api/analyzeImage` transcribes visible label information and checks its basic consistency.
3. `lib/nutrition.mjs` normalizes field names, keeps missing values as `null`, and converts only an explicit nutrition basis with a known compatible serving quantity.
4. `/api/alternatives` compares compatible mass or volume bases. It never compares a per-100 g label with a per-100 ml label without a supported conversion.
5. The results component saves one analysis ID through `/api/previousSearches/products`. The server scopes the ID to the signed-in user so repeated requests reuse the same record.

The app uses Next.js, React, Tailwind CSS, Clerk, Prisma/PostgreSQL, Groq, and Open Food Facts. The profile form currently stores preferences in this browser; the profile APIs independently enforce authenticated ownership.

## Current limits

- AI transcriptions and assessments can be incorrect. A consistency check is not confirmation that the label was read correctly.
- Unknown nutrition or serving quantities are excluded from calculations that need them; unknown never means zero.
- Scan history records products analyzed, not food eaten. Its totals represent known analyzed servings, not actual daily intake.
- Allergy matching and source product data can be incomplete. Check the package's ingredient and allergen declarations.
- Alternative results depend on category, compatible nutrition data, and database coverage; they do not establish local price or availability.
- A cached barcode lookup still needs a connection for a new AI analysis.

Future work includes guided multi-photo capture, structured allergy preferences, and side-by-side product comparison.
