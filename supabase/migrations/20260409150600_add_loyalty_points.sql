ALTER TABLE public.sales ADD COLUMN reward_points_earned NUMERIC DEFAULT 0;
ALTER TABLE public.sales ADD COLUMN reward_points_used NUMERIC DEFAULT 0;

CREATE OR REPLACE FUNCTION update_customer_reward_points( p_customer_id UUID, p_points_used NUMERIC, p_points_earned NUMERIC ) RETURNS void AS $$
BEGIN
    UPDATE public.customers
    SET reward_points = COALESCE(reward_points, 0) - p_points_used + p_points_earned
    WHERE id = p_customer_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
