# Rezo - Booking App (Jamaica)

A mobile-first booking app built with React + Vite + Supabase. Formerly called "Booka".

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
- `src/lib/categories.ts` — CATEGORIES array, DAILY_LIMITS, distanceKm, timeAgo, getCategoryEmoji, DEFAULT_SERVICES utilities
- `src/pages/CustomerHome.tsx` — full-screen Leaflet map + bottom sheet + 4-tab nav (Explore/Search/Bookings/Profile)
- `src/pages/StoreDashboard.tsx` — dark-header dashboard; hamburger drawer nav; Bookings/Hours/Services/Photos/Reviews/Messages/Calendar tabs; compact 2-col status panel (OPEN/CLOSED + BOOKINGS ON/PAUSED) with contextual hints; corrected 4-step onboarding checklist (photo/service/hours/description); payout history modal with request-payout action; geocoding error toast; walk-in system
- `src/pages/AdminDashboard.tsx` — admin panel with overview stats, store management, customer management, bookings, revenue, disputes, bug reports, content moderation, announcements, financial tab
- `src/components/StoreProfile.tsx` — Supabase-connected profile with live reviews (realtime) and available hours
- `src/components/CategoryResults.tsx` — filtered store list for a selected category
- `src/components/SearchScreen.tsx` — full-text store search with localStorage recent history; filter chips (Open Now, 4★+, Nearest, Top Rated); result count display; improved empty states
- `src/components/CustomerBooking.tsx` — date picker + slot picker + service selection + booking confirmation; duration-aware slot blocking; buffer enforcement; end-of-day slot filtering; post-insert race condition check
- `src/components/CustomerReservations.tsx` — live reservations with pull-to-refresh + realtime updates + review trigger; dispute submission
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
- `profiles` — user profiles with `role` column (customer/store), `is_suspended`, `phone`, `avatar_url`
- `stores` — store listings; columns: `is_open`, `buffer_minutes`, `accepting_bookings`, `cancellation_hours` (default 24), `announcement` (text), `avatar_url`, `subscription_tier` (free/pro/premium), `category`, `categories` (array), `category_locked_until`, `is_suspended`, `is_approved`, `latitude`, `longitude`
- `store_time_slots` — available booking slots (`store_id`, `day_of_week`, `start_time`, `end_time`, `is_available`, `capacity`)
- `store_hours` — operating hours per day-of-week (`store_id`, `day_of_week`, `is_open`, `open_time`, `close_time`)
- `store_breaks` — break periods per day-of-week (`store_id`, `day_of_week`, `break_start`, `break_end`, `label`)
- `store_services` — service menu items (`store_id`, `name`, `base_price`, `duration_minutes`, `is_active`, `is_archived`, `sort_order`)
- `service_option_groups` — option groups per service (`service_id`, `label`, `selection_type`, `required`, `sort_order`)
- `service_option_items` — items in option groups (`group_id`, `label`, `price_modifier`, `sort_order`)
- `reservations` — bookings (`customer_id`, `store_id`, `reservation_date`, `start_time`, `end_time`, `status`, `fee`, `total_amount`, `service_total`, `commitment_fee_amount`, `service_duration_minutes`, `is_walk_in`, `walk_in_name`, `payment_status`, `cancelled_by`, `reschedule_count`, `original_date`, `original_start_time`)
- `reservation_services` — rich service snapshot per booking (`reservation_id`, `service_id`, `service_name`, `base_price`, `selected_options`, `options_total`, `subtotal`)
- `reservation_service_selections` — FK-safe service selection record (`reservation_id`, `service_id`, `selected_item_ids`, `total_price`)
- `reviews` — post-visit reviews; includes `reviewer_name`, `store_reply`, `store_reply_at` columns
- `store_photos` — store gallery (`store_id`, `image_url`, `caption`, `is_cover`, `display_order`)
- `store_closed_dates` — per-date closures; `reason='Open'` = holiday override
- `customer_favourites` — UNIQUE(customer_id, store_id); customers save favourite stores
- `store_reports` — customer reports on stores
- `messages` — chat messages per reservation (`reservation_id`, `sender_role`, `content`, `read`)
- `platform_settings` — key/value platform config
- `admin_store_notes` — admin internal notes on stores
- `flagged_messages` — messages flagged by word blacklist
- `word_blacklist` — blocked words/phrases for content moderation
- `store_strikes` — strikes issued to stores
- `scheduled_notifications` — broadcast notifications sent by admin
- `disputes` — booking dispute records with status/resolution
- `announcements` — platform announcements (title, message, audience)
- `bug_reports` — user-submitted bug reports

**CRITICAL: `is_booka_recommended` and `is_verified` do NOT exist — never query them**

**Supabase Storage**: `store-avatars`, `customer-avatars`, `store-photos`, `bug-report-screenshots` buckets (all public).

Row Level Security (RLS) is enabled on all tables.

## Booking Engine

- **Slot blocking**: Duration-aware — books block `start + service_duration + buffer` minutes
- **Buffer minimum**: 15 minutes enforced in validation
- **End-of-day filter**: Slots where `start + duration + buffer > closing_time` are hidden
- **Race condition mitigation**: Post-insert count check rolls back if slot filled simultaneously
- **Walk-ins**: Store owners create walk-in bookings with status=in_progress, payment_status=waived
- **Daily limits** (free tier): Per-category limits from `DAILY_LIMITS` in `lib/categories.ts`
- **80% capacity warning**: Shown in booking UI when slot is nearing daily limit

## Tier Limits

- **Free**: 1 category, 3 services, 5 photos, capacity=1
- **Pro**: 3 categories, unlimited services, 20 photos, unlimited capacity
- **Premium**: Unlimited everything

## Commitment Fee

Always 25% of service total, minimum J$750. Payment via Fygaro (currently bypassed — payment_status set to "paid" immediately).

## Admin Account

- `howylookgood@icloud.com` — `is_admin=true` in `profiles`

## Navigation Flow

**Customer**: CustomerHome explore tab → category tap → CategoryResults overlay → StoreProfile overlay → CustomerBooking overlay → confirmation card
**Store Owner**: CustomerHome → Profile tab → "Switch to Business Dashboard" → StoreDashboard → back to CustomerHome
**Admin**: Any profile tab → "Switch to Admin" → AdminDashboard
**Map**: Leaflet fills screen; bottom sheet (57% height) overlays with drag handle, search bar, category grid; tapping a map pin shows a quick-card above the sheet

## Category System

`src/lib/categories.ts` exports:
- `CATEGORIES` — array with label, emoji, description
- `DEFAULT_SERVICES` — map of category → default service templates (name, price, duration)
- `DAILY_LIMITS` — map of category → free-tier daily booking limit
- `getCategoryEmoji(cat)` — returns emoji for a category string

`applyDefaultServicesForCategory(storeId, newCategory, tier)` — called when store changes category; hard-deletes unreferenced services, archives FK-referenced ones, inserts new defaults.

## Service Archiving

`is_archived=true` on `store_services` means: hidden from menu but preserved for booking history. Services referenced in `reservation_service_selections` are archived instead of deleted when category changes.
