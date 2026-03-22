
-- Allow store owners to read customer profiles for their reservations
CREATE POLICY "Store owners can read customer profiles" ON public.profiles
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.reservations r
      JOIN public.stores s ON s.id = r.store_id
      WHERE r.customer_id = profiles.user_id AND s.user_id = auth.uid()
    )
  );
