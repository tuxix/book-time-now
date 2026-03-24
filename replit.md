# Booka - Booking App

A mobile-first booking app built with React + Vite + Supabase.

## Architecture

- **Frontend**: React 18 + TypeScript + Vite (pure SPA, no backend)
- **Auth & Database**: Supabase (auth, PostgreSQL via RLS policies)
- **UI**: shadcn/ui + Tailwind CSS
- **Routing**: React Router v6
- **State**: React state (no TanStack Query — all Supabase calls are direct)
- **Map**: Leaflet via CDN (window.L), OpenStreetMap tiles, Nominatim geocoding

## Key Files

- `src/App.tsx` — root; everyone lands on CustomerHome; store owners toggle to StoreDashboard via overlay
- `src/hooks/useAuth.tsx` — Supabase auth context
- `src/lib/categories.ts` — CATEGORIES array, distanceKm, timeAgo, getCategoryEmoji utilities
- `src/pages/CustomerHome.tsx` — full-screen Leaflet map + bottom sheet + 4-tab nav (Explore/Search/Bookings/Profile)
- `src/pages/StoreDashboard.tsx` — dark-header dashboard; Bookings/Slots/Calendar/Profile tabs; two toggles (open/closed + accepting bookings)
- `src/components/StoreProfile.tsx` — Supabase-connected profile with live reviews (realtime) and available hours
- `src/components/CategoryResults.tsx` — filtered store list for a selected category
- `src/components/SearchScreen.tsx` — full-text store search with localStorage recent history
- `src/components/CustomerBooking.tsx` — date picker + slot picker + booking confirmation card with ref #
- `src/components/CustomerReservations.tsx` — live reservations with pull-to-refresh + realtime updates + review trigger; cancelled notice
- `src/components/ReviewDialog.tsx` — star rating + comment form; inserts reviewer_name from user metadata
- `src/components/StoreCalendar.tsx` — store dashboard Calendar tab; monthly view; mark/unmark dates; block date ranges; holiday awareness
- `src/components/CustomerCalendar.tsx` — full-screen date picker modal in CustomerBooking; green/red/grey date status
- `src/lib/holidays.ts` — Jamaican public holiday calculator (Easter algorithm + fixed dates)

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
- `profiles` — user profiles with `role` column (customer/store)
- `stores` — store listings; columns: `is_open`, `buffer_minutes`, `accepting_bookings`, `commitment_fee` (J$, default 750), `cancellation_hours` (default 24), `announcement` (text), `avatar_url` (text)
- `store_time_slots` — available booking slots (`store_id`, `day_of_week`, `start_time`, `end_time`, `is_available`)
- `reservations` — bookings (`customer_id`, `store_id`, `reservation_date`, `start_time`, `end_time`, `status`, `fee`)
- `reviews` — post-visit reviews; includes `reviewer_name`, `store_reply`, `store_reply_at` columns
- `store_closed_dates` — per-date closures; `reason='Open'` = holiday override (store working on holiday)
- `customer_favourites` — UNIQUE(customer_id, store_id); customers save favourite stores
- `store_reports` — customer reports on stores (`store_id`, `customer_id`, `reason`, `created_at`)

**Supabase Storage**: `store-avatars` bucket (must be created as public in Supabase Dashboard > Storage).

Row Level Security (RLS) is enabled on all tables.

## Navigation Flow

**Customer**: CustomerHome explore tab → category tap → CategoryResults overlay → StoreProfile overlay → CustomerBooking overlay → confirmation card
**Store Owner**: CustomerHome → Profile tab → "Switch to Business Dashboard" → StoreDashboard → back to CustomerHome
**Map**: Leaflet fills screen; bottom sheet (57% height) overlays with drag handle, search bar, category grid; tapping a map pin shows a quick-card above the sheet
