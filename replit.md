# Booka - Booking App

A mobile-first booking app built with React + Vite + Supabase.

## Architecture

- **Frontend**: React 18 + TypeScript + Vite (pure SPA)
- **Auth & Database**: Supabase (auth, PostgreSQL via RLS policies)
- **UI**: shadcn/ui + Tailwind CSS
- **Routing**: React Router v6
- **State**: TanStack Query + React state

## Key Files

- `src/App.tsx` — root component, auth routing
- `src/hooks/useAuth.tsx` — auth context (Supabase session)
- `src/integrations/supabase/client.ts` — Supabase client
- `src/integrations/supabase/types.ts` — generated DB types
- `src/pages/AuthPage.tsx` — login/signup (email + Google OAuth)
- `src/pages/CustomerHome.tsx` — customer browse & profile
- `src/pages/StoreDashboard.tsx` — store reservations & settings
- `src/pages/RoleSelectPage.tsx` — first-time role selection
- `src/components/CustomerBooking.tsx` — booking flow
- `src/components/CustomerReservations.tsx` — customer bookings list
- `src/components/ReviewDialog.tsx` — leave a review

## Environment Variables (Secrets)

- `VITE_SUPABASE_URL` — Supabase project URL
- `VITE_SUPABASE_ANON_KEY` — Supabase anon/public key

## Running

```bash
npm run dev   # dev server on port 5000
npm run build # production build
```

## Database

All tables live in Supabase (managed via Supabase dashboard):
- `profiles` — user profiles with roles (customer/store)
- `stores` — store listings
- `store_time_slots` — available booking slots
- `reservations` — bookings
- `reviews` — post-visit reviews

Row Level Security (RLS) is enabled on all tables.
