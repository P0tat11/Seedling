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

Do not put real credentials in `.env.example` or commit `.env.local`. For deployment, Vercel supplies the configured Production variable to the serverless functions. Apply schema changes to Neon before deploying code that depends on them.

## Configure the Fireworks AI Coach

1. Create a Fireworks account at [app.fireworks.ai](https://app.fireworks.ai/) and create an API key in [API Keys](https://app.fireworks.ai/settings/users/api-keys).
2. In the linked Vercel project's **Settings → Environment Variables**, add `FIREWORKS_API_KEY` and paste the key as its value. Select **Development** for local testing and **Production** for the deployed app. Never add the key to `index.html`, browser code, or a committed file.
3. Optionally add `FIREWORKS_MODEL` with a model ID available to your Fireworks account. If omitted, Seedling uses `accounts/fireworks/models/glm-5p3-flash`.
4. Restart the local app (`npm start`) so Vercel refreshes the Development environment variables. Redeploy after setting Production variables.

The AI Coach sends chat requests from the server to Fireworks' OpenAI-compatible endpoint at `https://api.fireworks.ai/inference/v1/chat/completions`. It does not use Ollama or another provider as a fallback. Fireworks model availability and pricing can change; choose a currently available model in the [Fireworks model catalog](https://fireworks.ai/models).

## Existing browser data

On this browser, Seedling offers a one-time import of data saved by the previous localStorage version. Import requires the contact and password already stored with that data. The import action sends the data to the authenticated API and removes the old browser copy after a successful import. Existing database data is never overwritten by an import.

## Data tables

- `accounts` and `account_sessions`: account credentials and hashed, expiring sessions.
- `onboarding_data` and `account_preferences`: founder profile and app preferences.
- `shops` and `inventory`: family-owned shops and products.
- `transactions` and `transaction_items`: sales receipts and their product-line snapshots.

## AI Coach context

The authenticated AI Coach receives the selected age group, current app settings, all shops and their inventory, sales summaries and recent receipts, and the active register cart. Parent contact details, account credentials, and login contact information are not included. Chat context is sent to Fireworks to generate a reply.
