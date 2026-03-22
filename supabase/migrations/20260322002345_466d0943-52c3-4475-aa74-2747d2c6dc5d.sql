
-- Profiles table
CREATE TABLE public.profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  role text NOT NULL CHECK (role IN ('customer', 'store')),
  full_name text NOT NULL DEFAULT '',
  avatar_url text,
  phone text,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own profile" ON public.profiles
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own profile" ON public.profiles
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);

-- Stores table
CREATE TABLE public.stores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL UNIQUE,
  name text NOT NULL,
  description text DEFAULT '',
  address text DEFAULT '',
  phone text DEFAULT '',
  category text DEFAULT '',
  image text DEFAULT '',
  rating numeric(2,1) DEFAULT 0,
  review_count int DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.stores ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can read stores" ON public.stores
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Store owner can insert own store" ON public.stores
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Store owner can update own store" ON public.stores
  FOR UPDATE TO authenticated USING (auth.uid() = user_id);

-- Time slots for stores
CREATE TABLE public.store_time_slots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  store_id uuid REFERENCES public.stores(id) ON DELETE CASCADE NOT NULL,
  day_of_week int NOT NULL CHECK (day_of_week BETWEEN 0 AND 6),
  start_time time NOT NULL,
  end_time time NOT NULL,
  is_available boolean DEFAULT true
);

ALTER TABLE public.store_time_slots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can read time slots" ON public.store_time_slots
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Store owner can manage time slots" ON public.store_time_slots
  FOR ALL TO authenticated USING (
    EXISTS (SELECT 1 FROM public.stores WHERE id = store_id AND user_id = auth.uid())
  );

-- Reservations table
CREATE TABLE public.reservations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  store_id uuid REFERENCES public.stores(id) ON DELETE CASCADE NOT NULL,
  reservation_date date NOT NULL,
  start_time time NOT NULL,
  end_time time NOT NULL,
  status text NOT NULL DEFAULT 'scheduled' CHECK (status IN ('scheduled', 'in_progress', 'completed', 'cancelled')),
  fee numeric(10,2) DEFAULT 750,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.reservations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Customers can read own reservations" ON public.reservations
  FOR SELECT TO authenticated USING (auth.uid() = customer_id);

CREATE POLICY "Store owners can read their reservations" ON public.reservations
  FOR SELECT TO authenticated USING (
    EXISTS (SELECT 1 FROM public.stores WHERE id = store_id AND user_id = auth.uid())
  );

CREATE POLICY "Customers can insert reservations" ON public.reservations
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = customer_id);

CREATE POLICY "Store owners can update reservation status" ON public.reservations
  FOR UPDATE TO authenticated USING (
    EXISTS (SELECT 1 FROM public.stores WHERE id = store_id AND user_id = auth.uid())
  );

-- Reviews table
CREATE TABLE public.reviews (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reservation_id uuid REFERENCES public.reservations(id) ON DELETE CASCADE NOT NULL UNIQUE,
  customer_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  store_id uuid REFERENCES public.stores(id) ON DELETE CASCADE NOT NULL,
  rating int NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment text DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone authenticated can read reviews" ON public.reviews
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Customers can insert own review" ON public.reviews
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = customer_id);

-- Function to update store rating on review insert
CREATE OR REPLACE FUNCTION public.update_store_rating()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.stores SET
    rating = (SELECT ROUND(AVG(rating)::numeric, 1) FROM public.reviews WHERE store_id = NEW.store_id),
    review_count = (SELECT COUNT(*) FROM public.reviews WHERE store_id = NEW.store_id)
  WHERE id = NEW.store_id;
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_review_insert
  AFTER INSERT ON public.reviews
  FOR EACH ROW EXECUTE FUNCTION public.update_store_rating();

-- Function to get user role without recursion
CREATE OR REPLACE FUNCTION public.get_user_role(_user_id uuid)
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM public.profiles WHERE user_id = _user_id LIMIT 1;
$$;
