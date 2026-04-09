-- Fix RLS for the shifts table to allow 'open' shift inserts

-- Drop potentially problematic existing policies
DROP POLICY IF EXISTS "Enable all operations for users based on tenant_id" ON "public"."shifts";
DROP POLICY IF EXISTS "Public shifts are viewable by everyone." ON "public"."shifts";
DROP POLICY IF EXISTS "shifts_tenant_policy" ON "public"."shifts";

-- Re-enable Row Level Security just to be safe
ALTER TABLE "public"."shifts" ENABLE ROW LEVEL SECURITY;

-- Create comprehensive policy allowing users to insert, view, update shifts from their tenant
CREATE POLICY "shifts_tenant_policy" 
ON "public"."shifts"
AS PERMISSIVE 
FOR ALL
TO public
USING (
  tenant_id IN (
    SELECT tenant_id FROM profiles WHERE user_id = auth.uid()
  )
)
WITH CHECK (
  tenant_id IN (
    SELECT tenant_id FROM profiles WHERE user_id = auth.uid()
  )
);
