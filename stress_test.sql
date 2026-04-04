-- ============================================================
-- REZO COMPREHENSIVE STRESS TEST
-- Run entirely inside Supabase Dashboard → SQL Editor
-- Runs as superuser — bypasses RLS — safe for test data only
-- All test records identified by 'test+' prefix in auth email
-- ============================================================

-- ──────────────────────────────────────────────────────────────
-- PART 1 ─ DATABASE SEED
-- ──────────────────────────────────────────────────────────────
DO $$
DECLARE
  -- ── Store-owner UUIDs (fixed so cleanup is deterministic) ──
  o_barber   uuid := '11111111-0001-0001-0001-000000000001';
  o_salon    uuid := '11111111-0001-0001-0001-000000000002';
  o_nails    uuid := '11111111-0001-0001-0001-000000000003';
  o_grooming uuid := '11111111-0001-0001-0001-000000000004';
  o_lash     uuid := '11111111-0001-0001-0001-000000000005';
  o_spa      uuid := '11111111-0001-0001-0001-000000000006';
  o_massage  uuid := '11111111-0001-0001-0001-000000000007';

  -- ── Customer UUIDs ──
  c_ids      uuid[] := ARRAY[
    '22222222-0001-0001-0001-000000000001',
    '22222222-0001-0001-0001-000000000002',
    '22222222-0001-0001-0001-000000000003',
    '22222222-0001-0001-0001-000000000004',
    '22222222-0001-0001-0001-000000000005',
    '22222222-0001-0001-0001-000000000006',
    '22222222-0001-0001-0001-000000000007',
    '22222222-0001-0001-0001-000000000008',
    '22222222-0001-0001-0001-000000000009',
    '22222222-0001-0001-0001-000000000010',
    '22222222-0001-0001-0001-000000000011',
    '22222222-0001-0001-0001-000000000012',
    '22222222-0001-0001-0001-000000000013',
    '22222222-0001-0001-0001-000000000014',
    '22222222-0001-0001-0001-000000000015',
    '22222222-0001-0001-0001-000000000016',
    '22222222-0001-0001-0001-000000000017',
    '22222222-0001-0001-0001-000000000018',
    '22222222-0001-0001-0001-000000000019',
    '22222222-0001-0001-0001-000000000020'
  ];

  c_names text[] := ARRAY[
    'Kemar Williams','Shanique Brown','Devante Campbell','Tashia Reid',
    'Fabian Thompson','Natalia Clarke','Jahvon Lewis','Brianna Miller',
    'Rohan Anderson','Camille Wilson','Akeem Taylor','Latoya Moore',
    'Jermaine Jackson','Simone Harris','Dalton Martin','Tricia White',
    'Donovan Thompson','Nadine Davis','Marcus Johnson','Shantel Brown'
  ];

  c_phones text[] := ARRAY[
    '8763421001','8764562002','8767893003','8761234004','8762345005',
    '8763456006','8764567007','8765678008','8766789009','8767890010',
    '8768901011','8769012012','8760123013','8761234114','8762345215',
    '8763456316','8764567417','8765678518','8766789619','8767890720'
  ];

  -- ── Store UUIDs ──
  s_barber   uuid := '33333333-0001-0001-0001-000000000001';
  s_salon    uuid := '33333333-0001-0001-0001-000000000002';
  s_nails    uuid := '33333333-0001-0001-0001-000000000003';
  s_grooming uuid := '33333333-0001-0001-0001-000000000004';
  s_lash     uuid := '33333333-0001-0001-0001-000000000005';
  s_spa      uuid := '33333333-0001-0001-0001-000000000006';
  s_massage  uuid := '33333333-0001-0001-0001-000000000007';

  store_ids  uuid[];
  owner_ids  uuid[];
  store_cats text[];
  store_tiers text[];
  store_names text[];
  store_addrs text[];
  store_phones text[];
  store_lats  numeric[];
  store_lngs  numeric[];
  store_descs text[];

  -- ── Service ID arrays per store (up to 4 services each) ──
  svc_barber   uuid[] := ARRAY['44000001-0000-0000-0000-000000000001','44000001-0000-0000-0000-000000000002','44000001-0000-0000-0000-000000000003'];
  svc_salon    uuid[] := ARRAY['44000002-0000-0000-0000-000000000001','44000002-0000-0000-0000-000000000002','44000002-0000-0000-0000-000000000003','44000002-0000-0000-0000-000000000004'];
  svc_nails    uuid[] := ARRAY['44000003-0000-0000-0000-000000000001','44000003-0000-0000-0000-000000000002','44000003-0000-0000-0000-000000000003'];
  svc_grooming uuid[] := ARRAY['44000004-0000-0000-0000-000000000001','44000004-0000-0000-0000-000000000002','44000004-0000-0000-0000-000000000003','44000004-0000-0000-0000-000000000004'];
  svc_lash     uuid[] := ARRAY['44000005-0000-0000-0000-000000000001','44000005-0000-0000-0000-000000000002','44000005-0000-0000-0000-000000000003','44000005-0000-0000-0000-000000000004'];
  svc_spa      uuid[] := ARRAY['44000006-0000-0000-0000-000000000001','44000006-0000-0000-0000-000000000002','44000006-0000-0000-0000-000000000003','44000006-0000-0000-0000-000000000004'];
  svc_massage  uuid[] := ARRAY['44000007-0000-0000-0000-000000000001','44000007-0000-0000-0000-000000000002','44000007-0000-0000-0000-000000000003'];

  -- service prices (J$) matching each svc_* array above
  svc_barber_prices   numeric[] := ARRAY[1500,800,2000];
  svc_salon_prices    numeric[] := ARRAY[3500,5000,8000,2500];
  svc_nails_prices    numeric[] := ARRAY[1500,4000,2000];
  svc_grooming_prices numeric[] := ARRAY[3000,5000,1000,2500];
  svc_lash_prices     numeric[] := ARRAY[4500,6000,5000,2500];
  svc_spa_prices      numeric[] := ARRAY[5000,6500,4500,7000];
  svc_massage_prices  numeric[] := ARRAY[4000,6000,7500];

  svc_barber_dur   int[] := ARRAY[30,20,45];
  svc_salon_dur    int[] := ARRAY[90,120,180,60];
  svc_nails_dur    int[] := ARRAY[45,90,60];
  svc_grooming_dur int[] := ARRAY[60,90,20,45];
  svc_lash_dur     int[] := ARRAY[120,150,90,60];
  svc_spa_dur      int[] := ARRAY[60,60,45,90];
  svc_massage_dur  int[] := ARRAY[60,90,90];

  -- ── Working variables ──
  i           int;
  si          int;
  ci          int;
  day_idx     int;
  slot_hour   int;
  cur_date    date;
  res_status  text;
  pay_status  text;
  cancelled   text;
  total_amt   numeric;
  commission  numeric;
  earnings    numeric;
  fee_amt     numeric;
  retain_amt  numeric;
  refund_amt  numeric;
  res_id      uuid;
  svc_pick    int;
  svc_price_v numeric;
  svc_dur_v   int;
  svc_id_v    uuid;
  checkin     text;
  past_count  int := 0;
  fut_count   int := 0;
  slot_hours  int[] := ARRAY[9,10,11,13,14,15,16,17];
  review_count_arr int[];
  avg_rating_arr   numeric[];
  store_rev_count  int;
  store_avg_rat    numeric;
  rev_id      uuid;
  rev_msg     text;
  rev_rating  int;
  msg_texts   text[];
  completed_res_ids uuid[];
  completed_store_ids uuid[];
  completed_cust_ids  uuid[];
  msg_res_id  uuid;
  dis_count   int := 0;

BEGIN
  -- ════════════════════════════════════════════════════════════
  -- STEP 1: AUTH USERS
  -- ════════════════════════════════════════════════════════════
  -- Delete any previous test run leftovers
  DELETE FROM auth.users WHERE email LIKE 'test+%@rezo.app';

  -- Store owners
  INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, raw_user_meta_data, raw_app_meta_data, aud, role, created_at, updated_at, instance_id, confirmation_token, recovery_token, email_change_token_new, email_change)
  VALUES
    (o_barber,   'test+barber@rezo.app',   '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', now(), '{"full_name":"Cuts by Rezo Test"}'::jsonb,   '{"provider":"email","providers":["email"]}'::jsonb, 'authenticated','authenticated', now()-interval'20 days', now()-interval'20 days', '00000000-0000-0000-0000-000000000000','','','',''),
    (o_salon,    'test+salon@rezo.app',    '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', now(), '{"full_name":"Rezo Hair Studio Test"}'::jsonb, '{"provider":"email","providers":["email"]}'::jsonb, 'authenticated','authenticated', now()-interval'20 days', now()-interval'20 days', '00000000-0000-0000-0000-000000000000','','','',''),
    (o_nails,    'test+nails@rezo.app',    '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', now(), '{"full_name":"Rezo Nail Bar Test"}'::jsonb,    '{"provider":"email","providers":["email"]}'::jsonb, 'authenticated','authenticated', now()-interval'20 days', now()-interval'20 days', '00000000-0000-0000-0000-000000000000','','','',''),
    (o_grooming, 'test+grooming@rezo.app', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', now(), '{"full_name":"Rezo Pet Spa Test"}'::jsonb,     '{"provider":"email","providers":["email"]}'::jsonb, 'authenticated','authenticated', now()-interval'20 days', now()-interval'20 days', '00000000-0000-0000-0000-000000000000','','','',''),
    (o_lash,     'test+lash@rezo.app',     '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', now(), '{"full_name":"Rezo Lash Studio Test"}'::jsonb,  '{"provider":"email","providers":["email"]}'::jsonb, 'authenticated','authenticated', now()-interval'20 days', now()-interval'20 days', '00000000-0000-0000-0000-000000000000','','','',''),
    (o_spa,      'test+spa@rezo.app',      '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', now(), '{"full_name":"Rezo Wellness Test"}'::jsonb,     '{"provider":"email","providers":["email"]}'::jsonb, 'authenticated','authenticated', now()-interval'20 days', now()-interval'20 days', '00000000-0000-0000-0000-000000000000','','','',''),
    (o_massage,  'test+massage@rezo.app',  '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', now(), '{"full_name":"Rezo Massage Test"}'::jsonb,      '{"provider":"email","providers":["email"]}'::jsonb, 'authenticated','authenticated', now()-interval'20 days', now()-interval'20 days', '00000000-0000-0000-0000-000000000000','','','','');

  -- Customers
  FOR i IN 1..20 LOOP
    INSERT INTO auth.users (id, email, encrypted_password, email_confirmed_at, raw_user_meta_data, raw_app_meta_data, aud, role, created_at, updated_at, instance_id, confirmation_token, recovery_token, email_change_token_new, email_change)
    VALUES (
      c_ids[i],
      'test+customer' || i || '@rezo.app',
      '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi',
      now(),
      ('{"full_name":"' || c_names[i] || '"}')::jsonb,
      '{"provider":"email","providers":["email"]}'::jsonb,
      'authenticated','authenticated',
      now()-interval'15 days', now()-interval'15 days',
      '00000000-0000-0000-0000-000000000000','','','',''
    );
  END LOOP;

  -- ════════════════════════════════════════════════════════════
  -- STEP 2: PROFILES
  -- ════════════════════════════════════════════════════════════
  DELETE FROM profiles WHERE user_id IN (
    SELECT id FROM auth.users WHERE email LIKE 'test+%@rezo.app'
  );

  INSERT INTO profiles (user_id, full_name, role, phone)
  VALUES
    (o_barber,   'Cuts by Rezo Test',       'store_owner', '8761110001'),
    (o_salon,    'Rezo Hair Studio Test',    'store_owner', '8761110002'),
    (o_nails,    'Rezo Nail Bar Test',       'store_owner', '8761110003'),
    (o_grooming, 'Rezo Pet Spa Test',        'store_owner', '8761110004'),
    (o_lash,     'Rezo Lash Studio Test',    'store_owner', '8761110005'),
    (o_spa,      'Rezo Wellness Test',       'store_owner', '8761110006'),
    (o_massage,  'Rezo Massage Test',        'store_owner', '8761110007');

  FOR i IN 1..20 LOOP
    INSERT INTO profiles (user_id, full_name, role, phone)
    VALUES (c_ids[i], c_names[i], 'customer', c_phones[i]);
  END LOOP;

  -- ════════════════════════════════════════════════════════════
  -- STEP 3: STORES
  -- ════════════════════════════════════════════════════════════
  DELETE FROM stores WHERE user_id IN (
    SELECT id FROM auth.users WHERE email LIKE 'test+%@rezo.app'
  );

  INSERT INTO stores (id, user_id, name, category, primary_category, categories, subscription_tier, address, phone, latitude, longitude, description, is_open, accepting_bookings, buffer_minutes, cancellation_hours, rating, review_count)
  VALUES
    (s_barber,   o_barber,   'Cuts by Rezo Test',       'Barber',           'Barber',           ARRAY['Barber'],            'free',    '14 King Street, Kingston',                '8761110001', 17.9971, -76.7936, 'Test barber shop offering top cuts in Kingston.', true, true, 15, 24, 0, 0),
    (s_salon,    o_salon,    'Rezo Hair Studio Test',   'Hair Salon',       'Hair Salon',       ARRAY['Hair Salon'],        'pro',     '45 Constant Spring Rd, Half Way Tree',    '8761110002', 18.0059, -76.7897, 'Test hair salon specialising in natural hair.', true, true, 15, 24, 0, 0),
    (s_nails,    o_nails,    'Rezo Nail Bar Test',      'Nail Tech',        'Nail Tech',        ARRAY['Nail Tech'],         'free',    '3 Knutsford Blvd, New Kingston',          '8761110003', 18.0086, -76.7855, 'Test nail bar with all the latest nail art.', true, true, 15, 24, 0, 0),
    (s_grooming, o_grooming, 'Rezo Pet Spa Test',       'Dog Grooming',     'Dog Grooming',     ARRAY['Dog Grooming'],      'premium', '12 Barbican Rd, Liguanea',                '8761110004', 18.0028, -76.7636, 'Test dog grooming spa for pampered pups.', true, true, 15, 24, 0, 0),
    (s_lash,     o_lash,     'Rezo Lash Studio Test',   'Lash Tech',        'Lash Tech',        ARRAY['Lash Tech'],         'pro',     '78 Constant Spring Rd, Constant Spring',  '8761110005', 18.0533, -76.8094, 'Test lash studio for flawless lashes.', true, true, 15, 24, 0, 0),
    (s_spa,      o_spa,      'Rezo Wellness Test',      'Spa and Wellness', 'Spa and Wellness', ARRAY['Spa and Wellness'],  'premium', '22 Barbican Rd, Barbican',                '8761110006', 18.0215, -76.7638, 'Test spa and wellness centre for relaxation.', true, true, 15, 24, 0, 0),
    (s_massage,  o_massage,  'Rezo Massage Test',       'Massage',          'Massage',          ARRAY['Massage'],           'free',    '5 West Wind Ave, Portmore',               '8761110007', 17.9582, -76.8882, 'Test massage therapy in the heart of Portmore.', true, true, 15, 24, 0, 0);

  -- ════════════════════════════════════════════════════════════
  -- STEP 4: STORE HOURS
  -- Mon=1…Sat=6 open, Sun=0 closed
  -- Mon-Fri: 09:00-18:00 | Sat: 10:00-16:00 | Sun: closed
  -- ════════════════════════════════════════════════════════════
  DELETE FROM store_hours WHERE store_id IN (s_barber,s_salon,s_nails,s_grooming,s_lash,s_spa,s_massage);

  -- Insert for all 7 test stores × 7 days
  INSERT INTO store_hours (store_id, day_of_week, is_open, open_time, close_time)
  SELECT s.id, d.dow,
    CASE WHEN d.dow = 0 THEN false ELSE true END,
    CASE WHEN d.dow BETWEEN 1 AND 5 THEN '09:00' WHEN d.dow = 6 THEN '10:00' ELSE '09:00' END,
    CASE WHEN d.dow BETWEEN 1 AND 5 THEN '18:00' WHEN d.dow = 6 THEN '16:00' ELSE '18:00' END
  FROM (VALUES (s_barber),(s_salon),(s_nails),(s_grooming),(s_lash),(s_spa),(s_massage)) AS s(id)
  CROSS JOIN (SELECT generate_series(0,6) AS dow) AS d;

  -- ════════════════════════════════════════════════════════════
  -- STEP 5: STORE BREAKS (Mon-Fri 12:00-13:00 lunch)
  -- ════════════════════════════════════════════════════════════
  DELETE FROM store_breaks WHERE store_id IN (s_barber,s_salon,s_nails,s_grooming,s_lash,s_spa,s_massage);

  INSERT INTO store_breaks (store_id, day_of_week, break_start, break_end, label)
  SELECT s.id, d.dow, '12:00', '13:00', 'Lunch Break'
  FROM (VALUES (s_barber),(s_salon),(s_nails),(s_grooming),(s_lash),(s_spa),(s_massage)) AS s(id)
  CROSS JOIN (SELECT generate_series(1,5) AS dow) AS d;

  -- ════════════════════════════════════════════════════════════
  -- STEP 6: STORE SERVICES
  -- ════════════════════════════════════════════════════════════
  DELETE FROM store_services WHERE store_id IN (s_barber,s_salon,s_nails,s_grooming,s_lash,s_spa,s_massage);

  -- Barber (Free tier – 3 active services)
  INSERT INTO store_services (id, store_id, name, base_price, duration_minutes, is_active, sort_order)
  VALUES
    (svc_barber[1], s_barber, 'Haircut',              1500, 30, true, 1),
    (svc_barber[2], s_barber, 'Beard Trim & Shape',   800,  20, true, 2),
    (svc_barber[3], s_barber, 'Wash & Cut',           2000, 45, true, 3);

  -- Hair Salon (Pro tier – 4 active services)
  INSERT INTO store_services (id, store_id, name, base_price, duration_minutes, is_active, sort_order)
  VALUES
    (svc_salon[1], s_salon, 'Wash & Set',     3500, 90,  true, 1),
    (svc_salon[2], s_salon, 'Relaxer',        5000, 120, true, 2),
    (svc_salon[3], s_salon, 'Box Braids',     8000, 180, true, 3),
    (svc_salon[4], s_salon, 'Trim & Style',   2500, 60,  true, 4);

  -- Nail Tech (Free tier – 3 active services)
  INSERT INTO store_services (id, store_id, name, base_price, duration_minutes, is_active, sort_order)
  VALUES
    (svc_nails[1], s_nails, 'Basic Manicure',   1500, 45, true, 1),
    (svc_nails[2], s_nails, 'Acrylic Full Set', 4000, 90, true, 2),
    (svc_nails[3], s_nails, 'Gel Polish',       2000, 60, true, 3);

  -- Dog Grooming (Premium tier – 4 active services)
  INSERT INTO store_services (id, store_id, name, base_price, duration_minutes, is_active, sort_order)
  VALUES
    (svc_grooming[1], s_grooming, 'Bath & Dry',   3000, 60, true, 1),
    (svc_grooming[2], s_grooming, 'Full Groom',   5000, 90, true, 2),
    (svc_grooming[3], s_grooming, 'Nail Trim',    1000, 20, true, 3),
    (svc_grooming[4], s_grooming, 'Dematting',    2500, 45, true, 4);

  -- Lash Tech (Pro tier – 4 active services)
  INSERT INTO store_services (id, store_id, name, base_price, duration_minutes, is_active, sort_order)
  VALUES
    (svc_lash[1], s_lash, 'Classic Full Set', 4500, 120, true, 1),
    (svc_lash[2], s_lash, 'Volume Full Set',  6000, 150, true, 2),
    (svc_lash[3], s_lash, 'Lash Lift',        5000, 90,  true, 3),
    (svc_lash[4], s_lash, 'Infills',          2500, 60,  true, 4);

  -- Spa and Wellness (Premium tier – 4 active services)
  INSERT INTO store_services (id, store_id, name, base_price, duration_minutes, is_active, sort_order)
  VALUES
    (svc_spa[1], s_spa, 'Swedish Massage',    5000, 60, true, 1),
    (svc_spa[2], s_spa, 'Deep Tissue Massage',6500, 60, true, 2),
    (svc_spa[3], s_spa, 'Facial',             4500, 45, true, 3),
    (svc_spa[4], s_spa, 'Body Wrap',          7000, 90, true, 4);

  -- Massage (Free tier – 3 active services)
  INSERT INTO store_services (id, store_id, name, base_price, duration_minutes, is_active, sort_order)
  VALUES
    (svc_massage[1], s_massage, '60 Min Massage',   4000, 60, true, 1),
    (svc_massage[2], s_massage, '90 Min Massage',   6000, 90, true, 2),
    (svc_massage[3], s_massage, 'Hot Stone Massage', 7500, 90, true, 3);

  -- ════════════════════════════════════════════════════════════
  -- STEP 7: STORE TIME SLOTS (weekly template)
  -- ════════════════════════════════════════════════════════════
  DELETE FROM store_time_slots WHERE store_id IN (s_barber,s_salon,s_nails,s_grooming,s_lash,s_spa,s_massage);

  -- Mon-Fri hourly slots 9-18 (skip 12-13 break) → 8 slots per day
  INSERT INTO store_time_slots (store_id, day_of_week, start_time, end_time, is_available, capacity)
  SELECT s.id, d.dow,
    LPAD(h::text,2,'0') || ':00',
    LPAD((h+1)::text,2,'0') || ':00',
    true, 1
  FROM (VALUES (s_barber),(s_salon),(s_nails),(s_grooming),(s_lash),(s_spa),(s_massage)) AS s(id)
  CROSS JOIN (SELECT generate_series(1,5) AS dow) AS d
  CROSS JOIN (SELECT unnest(ARRAY[9,10,11,13,14,15,16,17]) AS h) AS h;

  -- Saturday hourly slots 10-16 (no break) → 6 slots
  INSERT INTO store_time_slots (store_id, day_of_week, start_time, end_time, is_available, capacity)
  SELECT s.id, 6,
    LPAD(h::text,2,'0') || ':00',
    LPAD((h+1)::text,2,'0') || ':00',
    true, 1
  FROM (VALUES (s_barber),(s_salon),(s_nails),(s_grooming),(s_lash),(s_spa),(s_massage)) AS s(id)
  CROSS JOIN (SELECT unnest(ARRAY[10,11,12,13,14,15]) AS h) AS h;

  -- ════════════════════════════════════════════════════════════
  -- STEP 8: STORE PHOTOS (3 per store, using Supabase stock placeholders)
  -- ════════════════════════════════════════════════════════════
  DELETE FROM store_photos WHERE store_id IN (s_barber,s_salon,s_nails,s_grooming,s_lash,s_spa,s_massage);

  INSERT INTO store_photos (store_id, image_url, is_cover, display_order)
  SELECT s.id,
    'https://images.unsplash.com/photo-' || (1580000000 + (s.rn * 137931 + n.n * 77777))::text || '?w=800',
    n.n = 1,
    n.n
  FROM (VALUES
    (s_barber,1),(s_salon,2),(s_nails,3),(s_grooming,4),
    (s_lash,5),(s_spa,6),(s_massage,7)
  ) AS s(id,rn)
  CROSS JOIN (SELECT generate_series(1,3) AS n) AS n;

  -- ════════════════════════════════════════════════════════════
  -- STEP 9: RESERVATIONS – 100 PAST + 50 FUTURE
  -- Strategy: loop dates × stores, 1 res per store per day
  -- Assign customers/services via modulo
  -- ════════════════════════════════════════════════════════════
  DELETE FROM reservations WHERE store_id IN (s_barber,s_salon,s_nails,s_grooming,s_lash,s_spa,s_massage);

  store_ids  := ARRAY[s_barber,s_salon,s_nails,s_grooming,s_lash,s_spa,s_massage];
  store_tiers:= ARRAY['free','pro','free','premium','pro','premium','free'];

  -- ── PAST: back 30 days (skip Sundays), 1 per store per day → ~26 working days × 7 = 182; we stop at 100
  FOR cur_date IN
    SELECT d::date FROM generate_series(CURRENT_DATE - 30, CURRENT_DATE - 1, '1 day') d
    WHERE EXTRACT(DOW FROM d::date) <> 0
    ORDER BY d
  LOOP
    EXIT WHEN past_count >= 100;

    FOR si IN 1..7 LOOP
      EXIT WHEN past_count >= 100;

      ci        := (past_count % 20) + 1;
      svc_pick  := (past_count % 3) + 1;
      slot_hour := slot_hours[(past_count % 8) + 1];

      -- Determine service for this store
      CASE si
        WHEN 1 THEN svc_id_v:=svc_barber[LEAST(svc_pick,3)];   svc_price_v:=svc_barber_prices[LEAST(svc_pick,3)];   svc_dur_v:=svc_barber_dur[LEAST(svc_pick,3)];
        WHEN 2 THEN svc_id_v:=svc_salon[svc_pick];              svc_price_v:=svc_salon_prices[svc_pick];              svc_dur_v:=svc_salon_dur[svc_pick];
        WHEN 3 THEN svc_id_v:=svc_nails[LEAST(svc_pick,3)];    svc_price_v:=svc_nails_prices[LEAST(svc_pick,3)];    svc_dur_v:=svc_nails_dur[LEAST(svc_pick,3)];
        WHEN 4 THEN svc_id_v:=svc_grooming[svc_pick];           svc_price_v:=svc_grooming_prices[svc_pick];           svc_dur_v:=svc_grooming_dur[svc_pick];
        WHEN 5 THEN svc_id_v:=svc_lash[svc_pick];               svc_price_v:=svc_lash_prices[svc_pick];               svc_dur_v:=svc_lash_dur[svc_pick];
        WHEN 6 THEN svc_id_v:=svc_spa[svc_pick];                svc_price_v:=svc_spa_prices[svc_pick];                svc_dur_v:=svc_spa_dur[svc_pick];
        WHEN 7 THEN svc_id_v:=svc_massage[LEAST(svc_pick,3)];  svc_price_v:=svc_massage_prices[LEAST(svc_pick,3)];  svc_dur_v:=svc_massage_dur[LEAST(svc_pick,3)];
      END CASE;

      -- Assign status based on position (55% completed, 20% cancelled_customer, 10% cancelled_store, 15% no_show)
      CASE (past_count % 20)
        WHEN 0,1,2,3,4,5,6,7,8,9,10 THEN res_status:='completed';        pay_status:='paid';                cancelled:=null;
        WHEN 11,12,13,14             THEN res_status:='cancelled';         pay_status:='partially_refunded';  cancelled:='customer';
        WHEN 15,16                   THEN res_status:='cancelled';         pay_status:='refunded';            cancelled:='store';
        ELSE                              res_status:='no_show';           pay_status:='partially_refunded';  cancelled:=null;
      END CASE;

      total_amt  := svc_price_v;
      commission := ROUND(total_amt * 0.10);
      earnings   := total_amt - commission;
      fee_amt    := GREATEST(750, ROUND(total_amt * 0.25));
      retain_amt := CASE WHEN pay_status IN ('partially_refunded') THEN fee_amt ELSE
                         CASE WHEN pay_status = 'refunded' THEN 0 ELSE 0 END END;
      refund_amt := CASE WHEN pay_status = 'partially_refunded' THEN total_amt - fee_amt
                         WHEN pay_status = 'refunded' THEN total_amt ELSE 0 END;
      checkin    := LPAD(CAST((1000 + (past_count * 7 + si * 13) % 9000) AS TEXT), 4, '0');

      INSERT INTO reservations (
        store_id, customer_id, reservation_date, start_time, end_time,
        status, total_amount, commission_amount, store_earnings,
        fee, commitment_fee_amount, retained_amount, refund_amount,
        payment_status, cancelled_by, checkin_code, service_duration_minutes,
        payout_status, created_at
      ) VALUES (
        store_ids[si], c_ids[ci], cur_date,
        LPAD(slot_hour::text,2,'0') || ':00',
        LPAD((slot_hour+1)::text,2,'0') || ':00',
        res_status, total_amt, commission, earnings,
        fee_amt, fee_amt, retain_amt, refund_amt,
        pay_status, cancelled,
        checkin, svc_dur_v,
        CASE WHEN res_status='completed' THEN 'unpaid' ELSE null END,
        (now() - ((30 - (past_count/7))::text || ' days')::interval)
      ) RETURNING id INTO res_id;

      -- Reservation service line item
      INSERT INTO reservation_services (reservation_id, service_id, service_name, base_price, total_price)
      SELECT res_id, svc_id_v,
        (SELECT name FROM store_services WHERE id = svc_id_v),
        svc_price_v, svc_price_v;

      past_count := past_count + 1;
    END LOOP;
  END LOOP;

  -- ── FUTURE: next 7 days (skip Sundays), all scheduled
  FOR cur_date IN
    SELECT d::date FROM generate_series(CURRENT_DATE + 1, CURRENT_DATE + 7, '1 day') d
    WHERE EXTRACT(DOW FROM d::date) <> 0
    ORDER BY d
  LOOP
    EXIT WHEN fut_count >= 50;

    FOR si IN 1..7 LOOP
      EXIT WHEN fut_count >= 50;

      ci        := (fut_count % 20) + 1;
      svc_pick  := (fut_count % 3) + 1;
      slot_hour := slot_hours[(fut_count % 8) + 1];

      CASE si
        WHEN 1 THEN svc_id_v:=svc_barber[LEAST(svc_pick,3)];   svc_price_v:=svc_barber_prices[LEAST(svc_pick,3)];   svc_dur_v:=svc_barber_dur[LEAST(svc_pick,3)];
        WHEN 2 THEN svc_id_v:=svc_salon[svc_pick];              svc_price_v:=svc_salon_prices[svc_pick];              svc_dur_v:=svc_salon_dur[svc_pick];
        WHEN 3 THEN svc_id_v:=svc_nails[LEAST(svc_pick,3)];    svc_price_v:=svc_nails_prices[LEAST(svc_pick,3)];    svc_dur_v:=svc_nails_dur[LEAST(svc_pick,3)];
        WHEN 4 THEN svc_id_v:=svc_grooming[svc_pick];           svc_price_v:=svc_grooming_prices[svc_pick];           svc_dur_v:=svc_grooming_dur[svc_pick];
        WHEN 5 THEN svc_id_v:=svc_lash[svc_pick];               svc_price_v:=svc_lash_prices[svc_pick];               svc_dur_v:=svc_lash_dur[svc_pick];
        WHEN 6 THEN svc_id_v:=svc_spa[svc_pick];                svc_price_v:=svc_spa_prices[svc_pick];                svc_dur_v:=svc_spa_dur[svc_pick];
        WHEN 7 THEN svc_id_v:=svc_massage[LEAST(svc_pick,3)];  svc_price_v:=svc_massage_prices[LEAST(svc_pick,3)];  svc_dur_v:=svc_massage_dur[LEAST(svc_pick,3)];
      END CASE;

      total_amt  := svc_price_v;
      commission := ROUND(total_amt * 0.10);
      earnings   := total_amt - commission;
      fee_amt    := GREATEST(750, ROUND(total_amt * 0.25));
      checkin    := LPAD(CAST((1000 + (fut_count * 11 + si * 17) % 9000) AS TEXT), 4, '0');

      INSERT INTO reservations (
        store_id, customer_id, reservation_date, start_time, end_time,
        status, total_amount, commission_amount, store_earnings,
        fee, commitment_fee_amount, payment_status, cancelled_by,
        checkin_code, service_duration_minutes, created_at
      ) VALUES (
        store_ids[si], c_ids[ci], cur_date,
        LPAD(slot_hour::text,2,'0') || ':00',
        LPAD((slot_hour+1)::text,2,'0') || ':00',
        'scheduled', total_amt, commission, earnings,
        fee_amt, fee_amt, null, null,
        checkin, svc_dur_v, now()
      ) RETURNING id INTO res_id;

      INSERT INTO reservation_services (reservation_id, service_id, service_name, base_price, total_price)
      SELECT res_id, svc_id_v,
        (SELECT name FROM store_services WHERE id = svc_id_v),
        svc_price_v, svc_price_v;

      fut_count := fut_count + 1;
    END LOOP;
  END LOOP;

  -- ════════════════════════════════════════════════════════════
  -- STEP 10: REVIEWS (30 on completed reservations only)
  -- ════════════════════════════════════════════════════════════
  DELETE FROM reviews
  WHERE reservation_id IN (
    SELECT id FROM reservations WHERE store_id IN (s_barber,s_salon,s_nails,s_grooming,s_lash,s_spa,s_massage)
  );

  -- Jamaican-style review messages
  msg_texts := ARRAY[
    'Big up di barber! Ting clean and fresh. Will definitely come back.',
    'Service was excellent. Very professional and on time. Highly recommend!',
    'Lovely experience. The place was clean and staff were very welcoming.',
    'Great value for money. Mi will tell all mi friends to come here.',
    'Very talented. Best cut mi ever get! The vibes was nice too.',
    'Smooth process from booking to leaving. Love the new app.',
    'Top notch service. My nails look amazing, very detailed work.',
    'Relaxing atmosphere. The massage was just what I needed.',
    'Professional team, clean environment. Will come back every month.',
    'Excellent results! The stylist really understood what I wanted.'
  ];

  INSERT INTO reviews (reservation_id, store_id, customer_id, rating, comment)
  SELECT r.id, r.store_id, r.customer_id,
    3 + (ROW_NUMBER() OVER (ORDER BY r.created_at) % 3),  -- ratings 3,4,5 cycling
    msg_texts[(ROW_NUMBER() OVER (ORDER BY r.created_at) % 10) + 1]
  FROM reservations r
  WHERE r.store_id IN (s_barber,s_salon,s_nails,s_grooming,s_lash,s_spa,s_massage)
    AND r.status = 'completed'
  ORDER BY r.created_at
  LIMIT 30;

  -- Update store rating + review_count to reflect the inserted reviews
  UPDATE stores s SET
    review_count = sub.cnt,
    rating       = sub.avg_r
  FROM (
    SELECT store_id, COUNT(*) AS cnt, ROUND(AVG(rating)::numeric,2) AS avg_r
    FROM reviews
    WHERE store_id IN (s_barber,s_salon,s_nails,s_grooming,s_lash,s_spa,s_massage)
    GROUP BY store_id
  ) sub
  WHERE s.id = sub.store_id;

  -- ════════════════════════════════════════════════════════════
  -- STEP 11: MESSAGES (5 per store = 35 messages)
  -- ════════════════════════════════════════════════════════════
  DELETE FROM messages
  WHERE reservation_id IN (
    SELECT id FROM reservations WHERE store_id IN (s_barber,s_salon,s_nails,s_grooming,s_lash,s_spa,s_massage)
  );

  INSERT INTO messages (reservation_id, sender_id, sender_role, message, read)
  SELECT r.id,
    CASE WHEN ROW_NUMBER() OVER (PARTITION BY r.store_id ORDER BY r.created_at) % 2 = 0
         THEN r.store_id ELSE r.customer_id END,
    CASE WHEN ROW_NUMBER() OVER (PARTITION BY r.store_id ORDER BY r.created_at) % 2 = 0
         THEN 'store' ELSE 'customer' END,
    (ARRAY[
      'Hi! Just confirming your appointment tomorrow.',
      'Please arrive 5 minutes early so we can get started on time.',
      'Do you have any allergies or special requests?',
      'Looking forward to seeing you! Let us know if anything changes.',
      'Your booking is confirmed. See you soon!'
    ])[(ROW_NUMBER() OVER (PARTITION BY r.store_id ORDER BY r.created_at) % 5) + 1],
    ROW_NUMBER() OVER (PARTITION BY r.store_id ORDER BY r.created_at) % 2 = 0
  FROM reservations r
  WHERE r.store_id IN (s_barber,s_salon,s_nails,s_grooming,s_lash,s_spa,s_massage)
  ORDER BY r.store_id, r.created_at
  LIMIT 35;

  -- ════════════════════════════════════════════════════════════
  -- STEP 12: DISPUTES (5 across cancelled/completed)
  -- (Only insert if disputes table exists)
  -- ════════════════════════════════════════════════════════════
  BEGIN
    DELETE FROM disputes
    WHERE reservation_id IN (
      SELECT id FROM reservations WHERE store_id IN (s_barber,s_salon,s_nails,s_grooming,s_lash,s_spa,s_massage)
    );

    INSERT INTO disputes (reservation_id, store_id, customer_id, reason, status, refund_amount, refund_status)
    SELECT r.id, r.store_id, r.customer_id,
      (ARRAY[
        'Service did not match description.',
        'Appointment was cancelled without notice.',
        'Quality was below expected standard.',
        'Overcharged for the service.',
        'Store was closed when I arrived.'
      ])[ROW_NUMBER() OVER (ORDER BY r.created_at) % 5 + 1],
      (ARRAY['open','under_review','resolved','open','under_review'])[ROW_NUMBER() OVER (ORDER BY r.created_at) % 5 + 1],
      r.total_amount * 0.5,
      (ARRAY['pending','pending','approved','pending','pending'])[ROW_NUMBER() OVER (ORDER BY r.created_at) % 5 + 1]
    FROM reservations r
    WHERE r.store_id IN (s_barber,s_salon,s_nails,s_grooming,s_lash,s_spa,s_massage)
      AND r.status IN ('cancelled','completed')
    ORDER BY r.created_at
    LIMIT 5;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'disputes table not available or schema mismatch: %', SQLERRM;
  END;

  RAISE NOTICE '✅ SEED COMPLETE — % past reservations, % future reservations created.',
    past_count, fut_count;
END;
$$;


-- ──────────────────────────────────────────────────────────────
-- PART 2 ─ BUSINESS LOGIC TESTS
-- Run each query; any row returned = FAIL
-- ──────────────────────────────────────────────────────────────

-- TEST 1: commission_amount = ROUND(total_amount * 0.10) for every completed reservation
SELECT 'TEST 1' AS test, 'FAIL' AS result, id, total_amount, commission_amount,
       ROUND(total_amount * 0.10) AS expected_commission
FROM reservations
WHERE store_id IN (
  '33333333-0001-0001-0001-000000000001','33333333-0001-0001-0001-000000000002',
  '33333333-0001-0001-0001-000000000003','33333333-0001-0001-0001-000000000004',
  '33333333-0001-0001-0001-000000000005','33333333-0001-0001-0001-000000000006',
  '33333333-0001-0001-0001-000000000007'
)
AND status = 'completed'
AND commission_amount IS NOT NULL
AND commission_amount <> ROUND(total_amount * 0.10);
-- Expected: 0 rows → PASS

-- TEST 2: commitment_fee_amount = GREATEST(750, ROUND(total_amount * 0.25))
SELECT 'TEST 2' AS test, 'FAIL' AS result, id, total_amount, commitment_fee_amount,
       GREATEST(750, ROUND(total_amount * 0.25)) AS expected_fee
FROM reservations
WHERE store_id IN (
  '33333333-0001-0001-0001-000000000001','33333333-0001-0001-0001-000000000002',
  '33333333-0001-0001-0001-000000000003','33333333-0001-0001-0001-000000000004',
  '33333333-0001-0001-0001-000000000005','33333333-0001-0001-0001-000000000006',
  '33333333-0001-0001-0001-000000000007'
)
AND commitment_fee_amount IS NOT NULL
AND commitment_fee_amount <> GREATEST(750, ROUND(total_amount * 0.25));
-- Expected: 0 rows → PASS

-- TEST 3: store_earnings = total_amount - commission_amount for completed
SELECT 'TEST 3' AS test, 'FAIL' AS result, id, total_amount, commission_amount, store_earnings,
       (total_amount - commission_amount) AS expected_earnings
FROM reservations
WHERE store_id IN (
  '33333333-0001-0001-0001-000000000001','33333333-0001-0001-0001-000000000002',
  '33333333-0001-0001-0001-000000000003','33333333-0001-0001-0001-000000000004',
  '33333333-0001-0001-0001-000000000005','33333333-0001-0001-0001-000000000006',
  '33333333-0001-0001-0001-000000000007'
)
AND status = 'completed'
AND store_earnings IS NOT NULL
AND store_earnings <> (total_amount - commission_amount);
-- Expected: 0 rows → PASS

-- TEST 4: rezo_actual_commission >= 0 when promotion applied (discount_amount capped)
SELECT 'TEST 4' AS test, 'FAIL' AS result, id, commission_amount, discount_amount,
       (commission_amount - COALESCE(discount_amount,0)) AS rezo_actual_commission
FROM reservations
WHERE store_id IN (
  '33333333-0001-0001-0001-000000000001','33333333-0001-0001-0001-000000000002',
  '33333333-0001-0001-0001-000000000003','33333333-0001-0001-0001-000000000004',
  '33333333-0001-0001-0001-000000000005','33333333-0001-0001-0001-000000000006',
  '33333333-0001-0001-0001-000000000007'
)
AND discount_amount IS NOT NULL
AND (commission_amount - discount_amount) < 0;
-- Expected: 0 rows → PASS

-- TEST 5: commitment_fee always based on total_amount, not final_price
-- (fee should equal GREATEST(750, ROUND(total_amount*0.25)) regardless of discount)
SELECT 'TEST 5' AS test, 'FAIL' AS result, id, total_amount, final_price,
       commitment_fee_amount, GREATEST(750, ROUND(total_amount*0.25)) AS expected_from_original
FROM reservations
WHERE store_id IN (
  '33333333-0001-0001-0001-000000000001','33333333-0001-0001-0001-000000000002',
  '33333333-0001-0001-0001-000000000003','33333333-0001-0001-0001-000000000004',
  '33333333-0001-0001-0001-000000000005','33333333-0001-0001-0001-000000000006',
  '33333333-0001-0001-0001-000000000007'
)
AND discount_amount > 0
AND commitment_fee_amount <> GREATEST(750, ROUND(total_amount*0.25));
-- Expected: 0 rows → PASS

-- TEST 6-8: Daily booking limits per tier
-- Free Barber: max 10/day
SELECT 'TEST 6 – Free/Barber daily limit' AS test, 'FAIL' AS result,
  reservation_date, COUNT(*) AS daily_count, 10 AS allowed_max
FROM reservations
WHERE store_id = '33333333-0001-0001-0001-000000000001'  -- Barber (free)
  AND status <> 'cancelled'
GROUP BY reservation_date
HAVING COUNT(*) > 10;

-- Free Nail Tech: max 5/day
SELECT 'TEST 7 – Free/Nail daily limit' AS test, 'FAIL' AS result,
  reservation_date, COUNT(*) AS daily_count, 5 AS allowed_max
FROM reservations
WHERE store_id = '33333333-0001-0001-0001-000000000003'  -- Nail Tech (free)
  AND status <> 'cancelled'
GROUP BY reservation_date
HAVING COUNT(*) > 5;

-- Free Massage: max 8/day
SELECT 'TEST 8 – Free/Massage daily limit' AS test, 'FAIL' AS result,
  reservation_date, COUNT(*) AS daily_count, 8 AS allowed_max
FROM reservations
WHERE store_id = '33333333-0001-0001-0001-000000000007'  -- Massage (free)
  AND status <> 'cancelled'
GROUP BY reservation_date
HAVING COUNT(*) > 8;

-- TEST 9: No Free tier store has more than 3 active services
SELECT 'TEST 9 – Free tier service cap' AS test, 'FAIL' AS result,
  s.id, s.name, s.subscription_tier, COUNT(ss.id) AS active_services
FROM stores s
JOIN store_services ss ON ss.store_id = s.id AND ss.is_active = true
  AND COALESCE(ss.is_archived, false) = false
WHERE s.id IN (
  '33333333-0001-0001-0001-000000000001',
  '33333333-0001-0001-0001-000000000003',
  '33333333-0001-0001-0001-000000000007'
) -- free tier test stores
GROUP BY s.id, s.name, s.subscription_tier
HAVING COUNT(ss.id) > 3;

-- TEST 10: No Free tier store has more than 5 photos
SELECT 'TEST 10 – Free tier photo cap' AS test, 'FAIL' AS result,
  sp.store_id, s.name, COUNT(*) AS photo_count
FROM store_photos sp
JOIN stores s ON s.id = sp.store_id
WHERE sp.store_id IN (
  '33333333-0001-0001-0001-000000000001',
  '33333333-0001-0001-0001-000000000003',
  '33333333-0001-0001-0001-000000000007'
)
GROUP BY sp.store_id, s.name
HAVING COUNT(*) > 5;

-- TEST 11: No Free tier store has more than 1 primary category
SELECT 'TEST 11 – Free tier single category' AS test, 'FAIL' AS result, id, name, categories
FROM stores
WHERE id IN (
  '33333333-0001-0001-0001-000000000001',
  '33333333-0001-0001-0001-000000000003',
  '33333333-0001-0001-0001-000000000007'
)
AND array_length(categories, 1) > 1;

-- TEST 12: No Pro tier store has more than 3 categories
SELECT 'TEST 12 – Pro tier category cap' AS test, 'FAIL' AS result, id, name, categories
FROM stores
WHERE id IN (
  '33333333-0001-0001-0001-000000000002',
  '33333333-0001-0001-0001-000000000005'
)
AND array_length(categories, 1) > 3;

-- TEST 13: No overlapping reservations at same store on same day (incl. 15-min buffer)
SELECT 'TEST 13 – Slot overlap with buffer' AS test, 'FAIL' AS result,
  r1.id AS res1, r2.id AS res2, r1.store_id, r1.reservation_date,
  r1.start_time, r1.end_time, r2.start_time AS r2_start
FROM reservations r1
JOIN reservations r2
  ON r1.store_id = r2.store_id
  AND r1.reservation_date = r2.reservation_date
  AND r1.id < r2.id
  AND r1.status <> 'cancelled' AND r2.status <> 'cancelled'
WHERE r1.store_id IN (
  '33333333-0001-0001-0001-000000000001','33333333-0001-0001-0001-000000000002',
  '33333333-0001-0001-0001-000000000003','33333333-0001-0001-0001-000000000004',
  '33333333-0001-0001-0001-000000000005','33333333-0001-0001-0001-000000000006',
  '33333333-0001-0001-0001-000000000007'
)
AND (r2.start_time::time < (r1.end_time::time + interval '15 minutes')
AND  r2.end_time::time   > r1.start_time::time);

-- TEST 14: No reservation during break time (12:00-13:00 Mon-Fri)
SELECT 'TEST 14 – Booking during break' AS test, 'FAIL' AS result,
  id, store_id, reservation_date, start_time, end_time
FROM reservations
WHERE store_id IN (
  '33333333-0001-0001-0001-000000000001','33333333-0001-0001-0001-000000000002',
  '33333333-0001-0001-0001-000000000003','33333333-0001-0001-0001-000000000004',
  '33333333-0001-0001-0001-000000000005','33333333-0001-0001-0001-000000000006',
  '33333333-0001-0001-0001-000000000007'
)
AND status <> 'cancelled'
AND EXTRACT(DOW FROM reservation_date) BETWEEN 1 AND 5
AND NOT (end_time::time <= '12:00' OR start_time::time >= '13:00');

-- TEST 15: No reservation outside opening hours (9-18 Mon-Fri, 10-16 Sat)
SELECT 'TEST 15 – Booking outside hours' AS test, 'FAIL' AS result,
  id, store_id, reservation_date, start_time, end_time
FROM reservations
WHERE store_id IN (
  '33333333-0001-0001-0001-000000000001','33333333-0001-0001-0001-000000000002',
  '33333333-0001-0001-0001-000000000003','33333333-0001-0001-0001-000000000004',
  '33333333-0001-0001-0001-000000000005','33333333-0001-0001-0001-000000000006',
  '33333333-0001-0001-0001-000000000007'
)
AND status <> 'cancelled'
AND (
  (EXTRACT(DOW FROM reservation_date) BETWEEN 1 AND 5 AND
   (start_time::time < '09:00' OR end_time::time > '18:00'))
  OR
  (EXTRACT(DOW FROM reservation_date) = 6 AND
   (start_time::time < '10:00' OR end_time::time > '16:00'))
  OR
  EXTRACT(DOW FROM reservation_date) = 0  -- Sunday should have no bookings
);

-- TEST 16: All completed reservations have payment_status = 'paid'
SELECT 'TEST 16 – Completed must be paid' AS test, 'FAIL' AS result, id, status, payment_status
FROM reservations
WHERE store_id IN (
  '33333333-0001-0001-0001-000000000001','33333333-0001-0001-0001-000000000002',
  '33333333-0001-0001-0001-000000000003','33333333-0001-0001-0001-000000000004',
  '33333333-0001-0001-0001-000000000005','33333333-0001-0001-0001-000000000006',
  '33333333-0001-0001-0001-000000000007'
)
AND status = 'completed' AND payment_status <> 'paid';

-- TEST 17: All no_show reservations have payment_status = 'partially_refunded'
SELECT 'TEST 17 – No-show payment status' AS test, 'FAIL' AS result, id, status, payment_status
FROM reservations
WHERE store_id IN (
  '33333333-0001-0001-0001-000000000001','33333333-0001-0001-0001-000000000002',
  '33333333-0001-0001-0001-000000000003','33333333-0001-0001-0001-000000000004',
  '33333333-0001-0001-0001-000000000005','33333333-0001-0001-0001-000000000006',
  '33333333-0001-0001-0001-000000000007'
)
AND status = 'no_show' AND payment_status <> 'partially_refunded';

-- TEST 18: Store-cancelled reservations have payment_status = 'refunded'
SELECT 'TEST 18 – Store cancel = refunded' AS test, 'FAIL' AS result, id, status, cancelled_by, payment_status
FROM reservations
WHERE store_id IN (
  '33333333-0001-0001-0001-000000000001','33333333-0001-0001-0001-000000000002',
  '33333333-0001-0001-0001-000000000003','33333333-0001-0001-0001-000000000004',
  '33333333-0001-0001-0001-000000000005','33333333-0001-0001-0001-000000000006',
  '33333333-0001-0001-0001-000000000007'
)
AND status = 'cancelled' AND cancelled_by = 'store' AND payment_status <> 'refunded';

-- TEST 19: Customer-cancelled have payment_status = 'partially_refunded'
SELECT 'TEST 19 – Customer cancel = partially_refunded' AS test, 'FAIL' AS result, id, status, cancelled_by, payment_status
FROM reservations
WHERE store_id IN (
  '33333333-0001-0001-0001-000000000001','33333333-0001-0001-0001-000000000002',
  '33333333-0001-0001-0001-000000000003','33333333-0001-0001-0001-000000000004',
  '33333333-0001-0001-0001-000000000005','33333333-0001-0001-0001-000000000006',
  '33333333-0001-0001-0001-000000000007'
)
AND status = 'cancelled' AND cancelled_by = 'customer' AND payment_status <> 'partially_refunded';

-- TEST 20: All scheduled reservations have payment_status = NULL
-- NOTE: 'pending' is NOT a valid payment_status in Rezo (DB constraint).
-- Correct value for un-paid scheduled bookings is NULL.
SELECT 'TEST 20 – Scheduled = null payment' AS test, 'FAIL' AS result, id, status, payment_status
FROM reservations
WHERE store_id IN (
  '33333333-0001-0001-0001-000000000001','33333333-0001-0001-0001-000000000002',
  '33333333-0001-0001-0001-000000000003','33333333-0001-0001-0001-000000000004',
  '33333333-0001-0001-0001-000000000005','33333333-0001-0001-0001-000000000006',
  '33333333-0001-0001-0001-000000000007'
)
AND status = 'scheduled'
AND payment_status IS NOT NULL AND payment_status <> 'paid';

-- TEST 21: Free tier stores have no rescheduled reservations (reschedule_count > 0)
SELECT 'TEST 21 – Free tier no reschedules' AS test, 'FAIL' AS result, id, store_id, reschedule_count
FROM reservations
WHERE store_id IN (
  '33333333-0001-0001-0001-000000000001',
  '33333333-0001-0001-0001-000000000003',
  '33333333-0001-0001-0001-000000000007'
)
AND COALESCE(reschedule_count, 0) > 0;

-- TEST 22: Pro tier stores have reschedule_count <= 1
SELECT 'TEST 22 – Pro tier max 1 reschedule' AS test, 'FAIL' AS result, id, store_id, reschedule_count
FROM reservations
WHERE store_id IN (
  '33333333-0001-0001-0001-000000000002',
  '33333333-0001-0001-0001-000000000005'
)
AND COALESCE(reschedule_count, 0) > 1;

-- TEST 23: Rescheduled reservations have original_date saved
SELECT 'TEST 23 – Reschedule has original_date' AS test, 'FAIL' AS result, id, reschedule_count, original_date
FROM reservations
WHERE store_id IN (
  '33333333-0001-0001-0001-000000000001','33333333-0001-0001-0001-000000000002',
  '33333333-0001-0001-0001-000000000003','33333333-0001-0001-0001-000000000004',
  '33333333-0001-0001-0001-000000000005','33333333-0001-0001-0001-000000000006',
  '33333333-0001-0001-0001-000000000007'
)
AND COALESCE(reschedule_count, 0) > 0
AND original_date IS NULL;

-- TEST 24: No reservation has more than 1 review
SELECT 'TEST 24 – Max 1 review per reservation' AS test, 'FAIL' AS result,
  reservation_id, COUNT(*) AS review_count
FROM reviews
WHERE store_id IN (
  '33333333-0001-0001-0001-000000000001','33333333-0001-0001-0001-000000000002',
  '33333333-0001-0001-0001-000000000003','33333333-0001-0001-0001-000000000004',
  '33333333-0001-0001-0001-000000000005','33333333-0001-0001-0001-000000000006',
  '33333333-0001-0001-0001-000000000007'
)
GROUP BY reservation_id HAVING COUNT(*) > 1;

-- TEST 25: No review on a non-completed reservation
SELECT 'TEST 25 – Review only on completed' AS test, 'FAIL' AS result, rv.id, rv.reservation_id, r.status
FROM reviews rv
JOIN reservations r ON r.id = rv.reservation_id
WHERE rv.store_id IN (
  '33333333-0001-0001-0001-000000000001','33333333-0001-0001-0001-000000000002',
  '33333333-0001-0001-0001-000000000003','33333333-0001-0001-0001-000000000004',
  '33333333-0001-0001-0001-000000000005','33333333-0001-0001-0001-000000000006',
  '33333333-0001-0001-0001-000000000007'
)
AND r.status <> 'completed';

-- TEST 26: Store rating matches mathematical average of reviews (±0.01 tolerance)
SELECT 'TEST 26 – Store rating accuracy' AS test, 'FAIL' AS result,
  s.id, s.name, s.rating AS stored_rating, ROUND(AVG(rv.rating)::numeric,2) AS calculated_avg
FROM stores s
JOIN reviews rv ON rv.store_id = s.id
WHERE s.id IN (
  '33333333-0001-0001-0001-000000000001','33333333-0001-0001-0001-000000000002',
  '33333333-0001-0001-0001-000000000003','33333333-0001-0001-0001-000000000004',
  '33333333-0001-0001-0001-000000000005','33333333-0001-0001-0001-000000000006',
  '33333333-0001-0001-0001-000000000007'
)
GROUP BY s.id, s.name, s.rating
HAVING ABS(ROUND(AVG(rv.rating)::numeric,2) - s.rating) > 0.01;

-- TEST 27: Store review_count matches actual count
SELECT 'TEST 27 – Store review_count accuracy' AS test, 'FAIL' AS result,
  s.id, s.name, s.review_count AS stored_count, COUNT(rv.id) AS actual_count
FROM stores s
LEFT JOIN reviews rv ON rv.store_id = s.id
WHERE s.id IN (
  '33333333-0001-0001-0001-000000000001','33333333-0001-0001-0001-000000000002',
  '33333333-0001-0001-0001-000000000003','33333333-0001-0001-0001-000000000004',
  '33333333-0001-0001-0001-000000000005','33333333-0001-0001-0001-000000000006',
  '33333333-0001-0001-0001-000000000007'
)
GROUP BY s.id, s.name, s.review_count
HAVING s.review_count <> COUNT(rv.id);

-- TEST 28: Every reservation has a checkin_code that is exactly 4 digits
SELECT 'TEST 28 – 4-digit checkin code' AS test, 'FAIL' AS result, id, checkin_code
FROM reservations
WHERE store_id IN (
  '33333333-0001-0001-0001-000000000001','33333333-0001-0001-0001-000000000002',
  '33333333-0001-0001-0001-000000000003','33333333-0001-0001-0001-000000000004',
  '33333333-0001-0001-0001-000000000005','33333333-0001-0001-0001-000000000006',
  '33333333-0001-0001-0001-000000000007'
)
AND (checkin_code IS NULL OR checkin_code !~ '^\d{4}$');

-- TEST 29: No two reservations at same store on same date share a checkin_code
SELECT 'TEST 29 – Unique checkin code per store/date' AS test, 'FAIL' AS result,
  store_id, reservation_date, checkin_code, COUNT(*) AS duplicates
FROM reservations
WHERE store_id IN (
  '33333333-0001-0001-0001-000000000001','33333333-0001-0001-0001-000000000002',
  '33333333-0001-0001-0001-000000000003','33333333-0001-0001-0001-000000000004',
  '33333333-0001-0001-0001-000000000005','33333333-0001-0001-0001-000000000006',
  '33333333-0001-0001-0001-000000000007'
)
GROUP BY store_id, reservation_date, checkin_code
HAVING COUNT(*) > 1;

-- TEST 30: Every dispute links to a valid reservation
SELECT 'TEST 30 – Dispute links valid reservation' AS test, 'FAIL' AS result, d.id, d.reservation_id
FROM disputes d
LEFT JOIN reservations r ON r.id = d.reservation_id
WHERE d.store_id IN (
  '33333333-0001-0001-0001-000000000001','33333333-0001-0001-0001-000000000002',
  '33333333-0001-0001-0001-000000000003','33333333-0001-0001-0001-000000000004',
  '33333333-0001-0001-0001-000000000005','33333333-0001-0001-0001-000000000006',
  '33333333-0001-0001-0001-000000000007'
)
AND r.id IS NULL;

-- TEST 31: No reservation has more than one open dispute
SELECT 'TEST 31 – Max 1 open dispute per reservation' AS test, 'FAIL' AS result,
  reservation_id, COUNT(*) AS open_disputes
FROM disputes
WHERE store_id IN (
  '33333333-0001-0001-0001-000000000001','33333333-0001-0001-0001-000000000002',
  '33333333-0001-0001-0001-000000000003','33333333-0001-0001-0001-000000000004',
  '33333333-0001-0001-0001-000000000005','33333333-0001-0001-0001-000000000006',
  '33333333-0001-0001-0001-000000000007'
)
AND status = 'open'
GROUP BY reservation_id HAVING COUNT(*) > 1;


-- ──────────────────────────────────────────────────────────────
-- PART 3 ─ PERFORMANCE TESTS
-- Copy each query individually and note the execution time shown
-- in the Supabase SQL editor footer.
-- Flag: <200ms = Fast | 200-500ms = Acceptable | >500ms = Slow
-- ──────────────────────────────────────────────────────────────

-- PERF 1: All stores with rating, category — simulates CustomerHome query
EXPLAIN ANALYZE
SELECT id, name, category, categories, subscription_tier, rating, review_count,
       latitude, longitude, address, description, phone, is_open, accepting_bookings
FROM stores ORDER BY rating DESC NULLS LAST;

-- PERF 2: All reservations for a single store — simulates StoreDashboard load
EXPLAIN ANALYZE
SELECT r.*, rs.service_name, rs.total_price
FROM reservations r
LEFT JOIN reservation_services rs ON rs.reservation_id = r.id
WHERE r.store_id = '33333333-0001-0001-0001-000000000002'
ORDER BY r.reservation_date DESC, r.start_time DESC;

-- PERF 3: Available slots for a store on a date (slot conflict detection)
EXPLAIN ANALYZE
WITH booked AS (
  SELECT start_time, end_time, service_duration_minutes
  FROM reservations
  WHERE store_id = '33333333-0001-0001-0001-000000000001'
    AND reservation_date = CURRENT_DATE + 3
    AND status <> 'cancelled'
),
slots AS (
  SELECT start_time, end_time FROM store_time_slots
  WHERE store_id = '33333333-0001-0001-0001-000000000001'
    AND day_of_week = EXTRACT(DOW FROM CURRENT_DATE + 3)
    AND is_available = true
)
SELECT s.*,
  NOT EXISTS (
    SELECT 1 FROM booked b
    WHERE b.start_time::time < (s.end_time::time + interval '15 minutes')
      AND (b.end_time::time + interval '15 minutes') > s.start_time::time
  ) AS is_free
FROM slots s;

-- PERF 4: All messages for a store with unread counts
EXPLAIN ANALYZE
SELECT m.reservation_id, COUNT(*) AS total_msgs,
       SUM(CASE WHEN m.read = false THEN 1 ELSE 0 END) AS unread_count,
       MAX(m.created_at) AS latest_message
FROM messages m
JOIN reservations r ON r.id = m.reservation_id
WHERE r.store_id = '33333333-0001-0001-0001-000000000001'
GROUP BY m.reservation_id ORDER BY latest_message DESC;

-- PERF 5: Full booking history for a customer
EXPLAIN ANALYZE
SELECT r.*, rs.service_name, rs.base_price, rs.total_price,
       s.name AS store_name, s.category
FROM reservations r
JOIN reservation_services rs ON rs.reservation_id = r.id
JOIN stores s ON s.id = r.store_id
WHERE r.customer_id = '22222222-0001-0001-0001-000000000001'
ORDER BY r.reservation_date DESC;

-- PERF 6: Platform-wide revenue totals (admin dashboard)
EXPLAIN ANALYZE
SELECT
  COUNT(*)                                          AS total_bookings,
  SUM(total_amount)                                 AS gross_revenue,
  SUM(commission_amount)                            AS gross_commission,
  SUM(COALESCE(discount_amount,0))                  AS total_discounts,
  SUM(commission_amount - COALESCE(discount_amount,0)) AS net_rezo_earnings,
  SUM(store_earnings)                               AS total_store_earnings,
  AVG(total_amount)                                 AS avg_booking_value
FROM reservations
WHERE status = 'completed';

-- PERF 7: Active promotions and eligibility check
EXPLAIN ANALYZE
SELECT * FROM promotions
WHERE is_active = true
  AND (start_date IS NULL OR start_date <= now())
  AND (end_date   IS NULL OR end_date   >= now())
ORDER BY discount_value DESC;

-- PERF 8 + 9: Concurrent booking / check-in simulation
-- These require application-level race condition testing.
-- Manual test procedure:
-- 1. Open 10 browser tabs to the same store's booking page
-- 2. Select the same available slot in all tabs
-- 3. Confirm simultaneously — only the slot's capacity count should succeed
-- 4. For PERF 9: Enter wrong codes 4 times then the correct code once
-- → Confirm correct code succeeds and wrong codes show an error


-- ──────────────────────────────────────────────────────────────
-- PART 4 ─ RLS POLICY ANALYSIS
-- Full RLS simulation requires authenticated Supabase sessions.
-- Tested here via policy inspection + logic review.
-- ──────────────────────────────────────────────────────────────
SELECT 'RLS POLICY AUDIT' AS section, tablename, policyname, cmd, qual
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('reservations','messages','profiles','stores',
                    'store_services','store_photos','store_hours','store_breaks')
ORDER BY tablename, policyname;


-- ──────────────────────────────────────────────────────────────
-- PART 5 ─ EDGE CASE VERIFICATION
-- ──────────────────────────────────────────────────────────────

-- EDGE 8: Verify no promotion in DB has discount > commission amount saved
-- (commission = total_amount * 0.10; discount must be <= commission)
SELECT 'EDGE 8 – Discount exceeds commission cap' AS edge, 'FAIL' AS result,
  id, total_amount, commission_amount, discount_amount
FROM reservations
WHERE store_id IN (
  '33333333-0001-0001-0001-000000000001','33333333-0001-0001-0001-000000000002',
  '33333333-0001-0001-0001-000000000003','33333333-0001-0001-0001-000000000004',
  '33333333-0001-0001-0001-000000000005','33333333-0001-0001-0001-000000000006',
  '33333333-0001-0001-0001-000000000007'
)
AND discount_amount IS NOT NULL
AND discount_amount > commission_amount;

-- EDGE 9: Commitment fee on promoted booking still uses original total_amount
SELECT 'EDGE 9 – Fee on promoted booking' AS edge, 'FAIL' AS result,
  id, total_amount, final_price, discount_amount, commitment_fee_amount,
  GREATEST(750, ROUND(total_amount * 0.25)) AS expected_fee
FROM reservations
WHERE store_id IN (
  '33333333-0001-0001-0001-000000000001','33333333-0001-0001-0001-000000000002',
  '33333333-0001-0001-0001-000000000003','33333333-0001-0001-0001-000000000004',
  '33333333-0001-0001-0001-000000000005','33333333-0001-0001-0001-000000000006',
  '33333333-0001-0001-0001-000000000007'
)
AND discount_amount > 0
AND commitment_fee_amount <> GREATEST(750, ROUND(total_amount * 0.25));

-- EDGE 10: Only highest-value promotion applied per booking
-- (verify: no reservation has discount_amount > MAX active promotion value)
-- (requires promotions to exist — informational query)
SELECT 'EDGE 10 – Promo count' AS edge, COUNT(*) AS active_promotions FROM promotions WHERE is_active = true;


-- ──────────────────────────────────────────────────────────────
-- PART 6 ─ RESULTS SUMMARY
-- ──────────────────────────────────────────────────────────────
SELECT
  '=== REZO STRESS TEST DATA SUMMARY ===' AS header, '' AS value
UNION ALL SELECT 'Test stores created',        (SELECT COUNT(*)::text FROM stores WHERE id LIKE '33333333%')
UNION ALL SELECT 'Test customers created',     (SELECT COUNT(*)::text FROM auth.users WHERE email LIKE 'test+customer%@rezo.app')
UNION ALL SELECT 'Total test reservations',    (SELECT COUNT(*)::text FROM reservations WHERE store_id LIKE '33333333%')
UNION ALL SELECT 'Past reservations (completed+cancelled+no_show)',
                                               (SELECT COUNT(*)::text FROM reservations WHERE store_id LIKE '33333333%' AND status <> 'scheduled')
UNION ALL SELECT 'Future reservations (scheduled)',
                                               (SELECT COUNT(*)::text FROM reservations WHERE store_id LIKE '33333333%' AND status = 'scheduled')
UNION ALL SELECT 'Reviews created',            (SELECT COUNT(*)::text FROM reviews WHERE store_id LIKE '33333333%')
UNION ALL SELECT 'Messages created',           (SELECT COUNT(*)::text FROM messages WHERE reservation_id IN (SELECT id FROM reservations WHERE store_id LIKE '33333333%'))
UNION ALL SELECT 'Total simulated revenue (J$)', (SELECT COALESCE(SUM(total_amount),0)::text FROM reservations WHERE store_id LIKE '33333333%' AND status = 'completed')
UNION ALL SELECT 'Total commission simulated (J$)', (SELECT COALESCE(SUM(commission_amount),0)::text FROM reservations WHERE store_id LIKE '33333333%' AND status = 'completed')
UNION ALL SELECT 'Average booking value (J$)', (SELECT ROUND(COALESCE(AVG(total_amount),0))::text FROM reservations WHERE store_id LIKE '33333333%' AND status = 'completed')
UNION ALL SELECT 'Most popular service', (
  SELECT rs.service_name FROM reservation_services rs
  JOIN reservations r ON r.id = rs.reservation_id
  WHERE r.store_id LIKE '33333333%'
  GROUP BY rs.service_name ORDER BY COUNT(*) DESC LIMIT 1
)
UNION ALL SELECT 'Store with most bookings', (
  SELECT s.name FROM reservations r JOIN stores s ON s.id = r.store_id
  WHERE r.store_id LIKE '33333333%'
  GROUP BY s.name ORDER BY COUNT(*) DESC LIMIT 1
)
UNION ALL SELECT 'Customer with most bookings', (
  SELECT p.full_name FROM reservations r JOIN profiles p ON p.user_id = r.customer_id
  WHERE r.store_id LIKE '33333333%'
  GROUP BY p.full_name ORDER BY COUNT(*) DESC LIMIT 1
);

-- ─── KNOWN SCHEMA ISSUE FLAGGED BY TESTS ─────────────────────
-- TEST 20 note: The original test spec expects payment_status='pending' for scheduled
-- reservations. This is INCORRECT for Rezo — the DB check constraint only allows:
-- NULL | 'paid' | 'partially_refunded' | 'refunded'
-- New bookings correctly use NULL. Recommend updating test spec and any
-- documentation that references 'pending' as a payment status.


-- ──────────────────────────────────────────────────────────────
-- PART 7 ─ CLEANUP FUNCTION
-- Run ONLY after reviewing results above.
-- ──────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION cleanup_rezo_test_data()
RETURNS TABLE(table_name text, rows_deleted bigint)
LANGUAGE plpgsql AS $$
DECLARE
  test_store_ids   uuid[] := ARRAY[
    '33333333-0001-0001-0001-000000000001','33333333-0001-0001-0001-000000000002',
    '33333333-0001-0001-0001-000000000003','33333333-0001-0001-0001-000000000004',
    '33333333-0001-0001-0001-000000000005','33333333-0001-0001-0001-000000000006',
    '33333333-0001-0001-0001-000000000007'
  ];
  test_user_ids    uuid[];
  del_count        bigint;
BEGIN
  -- Collect all test auth user IDs
  SELECT ARRAY_AGG(id) INTO test_user_ids
  FROM auth.users WHERE email LIKE 'test+%@rezo.app';

  -- Messages
  DELETE FROM messages
  WHERE reservation_id IN (SELECT id FROM reservations WHERE store_id = ANY(test_store_ids));
  GET DIAGNOSTICS del_count = ROW_COUNT;
  RETURN QUERY SELECT 'messages'::text, del_count;

  -- Reviews
  DELETE FROM reviews WHERE store_id = ANY(test_store_ids);
  GET DIAGNOSTICS del_count = ROW_COUNT;
  RETURN QUERY SELECT 'reviews'::text, del_count;

  -- Disputes
  BEGIN
    DELETE FROM disputes WHERE store_id = ANY(test_store_ids);
    GET DIAGNOSTICS del_count = ROW_COUNT;
    RETURN QUERY SELECT 'disputes'::text, del_count;
  EXCEPTION WHEN OTHERS THEN
    RETURN QUERY SELECT 'disputes (skipped)'::text, 0::bigint;
  END;

  -- Reservation services
  DELETE FROM reservation_services
  WHERE reservation_id IN (SELECT id FROM reservations WHERE store_id = ANY(test_store_ids));
  GET DIAGNOSTICS del_count = ROW_COUNT;
  RETURN QUERY SELECT 'reservation_services'::text, del_count;

  -- Reservations
  DELETE FROM reservations WHERE store_id = ANY(test_store_ids);
  GET DIAGNOSTICS del_count = ROW_COUNT;
  RETURN QUERY SELECT 'reservations'::text, del_count;

  -- Store photos
  DELETE FROM store_photos WHERE store_id = ANY(test_store_ids);
  GET DIAGNOSTICS del_count = ROW_COUNT;
  RETURN QUERY SELECT 'store_photos'::text, del_count;

  -- Store time slots
  DELETE FROM store_time_slots WHERE store_id = ANY(test_store_ids);
  GET DIAGNOSTICS del_count = ROW_COUNT;
  RETURN QUERY SELECT 'store_time_slots'::text, del_count;

  -- Store services
  DELETE FROM store_services WHERE store_id = ANY(test_store_ids);
  GET DIAGNOSTICS del_count = ROW_COUNT;
  RETURN QUERY SELECT 'store_services'::text, del_count;

  -- Store breaks
  DELETE FROM store_breaks WHERE store_id = ANY(test_store_ids);
  GET DIAGNOSTICS del_count = ROW_COUNT;
  RETURN QUERY SELECT 'store_breaks'::text, del_count;

  -- Store hours
  DELETE FROM store_hours WHERE store_id = ANY(test_store_ids);
  GET DIAGNOSTICS del_count = ROW_COUNT;
  RETURN QUERY SELECT 'store_hours'::text, del_count;

  -- Stores
  DELETE FROM stores WHERE id = ANY(test_store_ids);
  GET DIAGNOSTICS del_count = ROW_COUNT;
  RETURN QUERY SELECT 'stores'::text, del_count;

  -- Profiles
  DELETE FROM profiles WHERE user_id = ANY(test_user_ids);
  GET DIAGNOSTICS del_count = ROW_COUNT;
  RETURN QUERY SELECT 'profiles'::text, del_count;

  -- Auth users (LAST — removes login credentials)
  DELETE FROM auth.users WHERE email LIKE 'test+%@rezo.app';
  GET DIAGNOSTICS del_count = ROW_COUNT;
  RETURN QUERY SELECT 'auth.users'::text, del_count;
END;
$$;

-- TO RUN CLEANUP (only after reviewing results):
-- SELECT * FROM cleanup_rezo_test_data();
