# Validation and dependency review — 18 November 2026

## Scoring contract

The numerical scorer added conservative bounds for missing negative nutrients
in version 0.3.0. The older adapter test still required a null beverage grade
for every unknown sweetener status, contradicting that implementation and its
existing bounds tests. The corrected integration test checks both invariant E
and uncertain grades. Unknown sweeteners remain null, appear in missingFields,
and never become an exact score. No scoring thresholds were changed.

## Build and lint

`npm run lint` uses a committed ESLint flat configuration, with JavaScript,
React hooks and Next.js rules. It fails on warnings without prompting. The
image optimization recommendation is disabled because catalogue images and
local blob previews are intentionally displayed directly. Unused imports and
helpers and unnecessary regex escapes were removed.

`npm run build` generates Prisma and compiles without DATABASE_URL. Migrations
are a separate `npm run db:deploy` command. Vercel uses `build:deploy`, preserving
migration execution for deployments. Database-backed runtime features still
require credentials; no live database migration was performed in validation.

## Dependencies

Removed unused tailwind (an unrelated event/CQS library, not tailwindcss),
postgresql (a server-install wrapper), bcrypt, bcryptjs, mysql2, pg, jsonwebtoken,
dotenv and react-barcode-reader. Source inspection found no imports of them;
Prisma, the actual Tailwind CSS package and ZXing remain.

Updated Next.js from 15.5.26 to 15.5.29 and applied compatible npm audit fixes,
including Clerk. Next.js uses a scoped override to PostCSS ^8.5.33, within
the same major API, to replace its vulnerable 8.4.31 pin. No force/major-version
audit upgrade was used.

The initial audit reported 50 vulnerable packages, including 6 critical.
The final lockfile audit reports 11 findings: 8 high, 3 moderate, 0 critical.
They remain in glob/minimatch and picomatch dependency chains through Tailwind
CSS, Sucrase and the Next.js lint plugin. npm recommends breaking upgrades for
part of this chain; compatible audit fixes have already been applied.
Remaining findings and deprecations must not be presented as a clean audit.
ESLint 9 is retained for compatibility with eslint-plugin-react's peer range;
Clerk 6 also has deprecated transitive packages. Their replacements need a
separate tooling/auth migration. The production build and automated tests do
not establish live authentication, OCR service or physical-camera behavior.
