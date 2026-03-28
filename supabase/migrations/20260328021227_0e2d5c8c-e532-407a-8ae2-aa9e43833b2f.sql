DROP POLICY IF EXISTS "Users can complete own payments" ON public.payments;
CREATE POLICY "Users can complete own payments"
ON public.payments
FOR UPDATE
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);