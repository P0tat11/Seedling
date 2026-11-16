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

## Configure the Ollama AI Coach

For Ollama Cloud, create an API key at [ollama.com/settings/keys](https://ollama.com/settings/keys). In the linked Vercel project's **Settings → Environment Variables**, add `OLLAMA_API_KEY` and select **Development** for local app testing and **Production** for the deployed app. Never put the key in browser code or a committed file. Optionally set `OLLAMA_MODEL` to a model available to your Ollama account; the default is `gemma4:31b`. Restart `npm start` after updating Development variables and redeploy after updating Production variables.

The server calls Ollama Cloud at `https://ollama.com/v1/chat/completions`. If Cloud is unavailable or not configured, the coach can try a local Ollama server on the user's own computer. Install and start Ollama there, pull a model such as `llama3.2`, and set the endpoint and model in **AI Coach → Ollama Config**. A local Ollama server is only available to that same device/browser; it is not shared with the hosted app.

## Existing browser data

On this browser, Seedling offers a one-time import of data saved by the previous localStorage version. Import requires the contact and password already stored with that data. The import action sends the data to the authenticated API and removes the old browser copy after a successful import. Existing database data is never overwritten by an import.

## Data tables

- `accounts` and `account_sessions`: account credentials and hashed, expiring sessions.
- `onboarding_data` and `account_preferences`: founder profile and app preferences.
- `shops` and `inventory`: family-owned shops and products.
- `transactions` and `transaction_items`: sales receipts and their product-line snapshots.

## AI Coach context

The authenticated AI Coach receives the selected age group, current app settings, all shops and their inventory, sales summaries and recent receipts, and the active register cart. Parent contact details, account credentials, and login contact information are not included. Chat context is sent to Ollama Cloud or, when configured, the user's local Ollama server to generate a reply.
