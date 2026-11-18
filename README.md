# veronica
A healthy app for analyzing food products.

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.js`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.

## Validation and database deployment

Use Node.js 22 LTS or newer and run:

```bash
npm ci
npm test
npm run lint
npm run build
```

Lint is non-interactive and fails on warnings. The build generates Prisma's
client and compiles the app; it does not run migrations or require DATABASE_URL.
Database-backed runtime features still need a valid DATABASE_URL.

Vercel uses `npm run build:deploy` via vercel.json. That command first runs
`npm run db:deploy` against the configured DATABASE_URL, then builds the app.
For other hosts, run migrations as an explicit release step before serving the
new build. Never point a validation job at a production database just to compile.
