# Seedling

Seedling stores family onboarding, shop inventory, and sales transactions in Neon PostgreSQL. Family accounts are authenticated by the server; passwords are hashed and browser sessions use HttpOnly cookies.

## Set up Neon

1. Add `DATABASE_URL` to the Vercel project's Environment Variables. Enable it for **Development** (and Production when deploying); keep it server-side.
2. Sign in to Vercel and link this checkout to the project once:

   ```sh
   npx vercel login
   npx vercel link
   ```

3. Install dependencies, apply the schema to Neon, and start the app:

   ```sh
   npm install
   npm run db:migrate
   npm start
   ```

   `npm run db:migrate` pulls Vercel's Development variables and applies [`db/schema.sql`](./db/schema.sql). The `prestart` script refreshes the ignored `.env.local` before `vercel dev` starts. Open the URL printed by Vercel (normally `http://localhost:3000`).

Keep `.env.local` out of source control. For deployment, Vercel supplies the configured Production variable to the serverless functions. Apply schema changes to Neon before deploying code that depends on them.

## Existing browser data

On this browser, Seedling offers a one-time import of data saved by the previous localStorage version. Import requires the contact and password already stored with that data. The import action sends the data to the authenticated API and removes the old browser copy after a successful import. Existing database data is never overwritten by an import.

## Data tables

- `accounts` and `account_sessions`: account credentials and hashed, expiring sessions.
- `onboarding_data` and `account_preferences`: founder profile and app preferences.
- `shops` and `inventory`: family-owned shops and products.
- `transactions` and `transaction_items`: sales receipts and their product-line snapshots.
- `business_guidelines`: account-owned coaching guidelines, ranked with PostgreSQL full-text search and included with live shop metrics in relevant coach requests.

Open **Guidelines** in Seedling to add, edit, pause, or remove guidance for production, pricing, and sales decisions. Only active matching guidelines are retrieved for a coach question; numeric sales and inventory information continues to come from the shop data.
