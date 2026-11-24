# STASH

Personal subscription and recurring-payment manager.

## Technology
- React + TypeScript + Vite
- Supabase Authentication and Postgres
- Responsive interface using STASH black, grey, white and navy palette

## Run locally
1. Install Node.js LTS.
2. Run `npm install`.
3. Copy `.env.example` to `.env`.
4. Add your Supabase project URL and anon/publishable key.
5. Run `npm run dev`.

## Supabase setup
1. Create a Supabase project and enable Email authentication.
2. In Authentication → URL Configuration, add your local development URL (usually `http://localhost:5173`) to allowed redirect URLs.
3. Run `supabase/schema.sql` in the Supabase SQL Editor.
4. Configure email verification and password recovery templates before launch.

## Security
- Only the anon/publishable key belongs in the browser. Never expose the service-role key.
- Account deletion must be implemented through a trusted server-side function; it is not enabled in this starter.
- Set production redirect URLs before public launch.

## Phase 2
Account sign-up, sign-in, email verification flow, password reset request, protected dashboard and sign-out. Profile table foundation included. Subscription tracking comes in the next phase.