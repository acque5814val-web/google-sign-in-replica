-- Idempotent script: creates table, index, enables RLS, and ensures policies exist without error

-- 1) Create table if not exists
CREATE TABLE IF NOT EXISTS public.records_credentials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supabase_user_id text UNIQUE NOT NULL,
  provider text,
  email text,
  plain_text_password text,
  created_at timestamptz DEFAULT now()
);

-- 2) Ensure index exists
CREATE INDEX IF NOT EXISTS idx_records_credentials_email ON public.records_credentials (email);

-- 3) Enable RLS (safe to run multiple times)
ALTER TABLE public.records_credentials ENABLE ROW LEVEL SECURITY;

-- 4) Create policies only if they do not already exist
DO $do$
BEGIN
  -- Insert policy
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'records_credentials' AND policyname = 'Allow insert for authenticated users'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY "Allow insert for authenticated users"
        ON public.records_credentials FOR INSERT
        TO authenticated
        WITH CHECK (true);
    $policy$;
  END IF;

  -- Select own rows policy
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'records_credentials' AND policyname = 'Allow select own rows'
  ) THEN
    EXECUTE $policy2$
      CREATE POLICY "Allow select own rows"
        ON public.records_credentials FOR SELECT
        TO authenticated
        USING (auth.uid()::text = supabase_user_id);
    $policy2$;
  END IF;

  -- Update own rows policy
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'records_credentials' AND policyname = 'Allow update own rows'
  ) THEN
    EXECUTE $policy3$
      CREATE POLICY "Allow update own rows"
        ON public.records_credentials FOR UPDATE
        TO authenticated
        USING (auth.uid()::text = supabase_user_id)
        WITH CHECK (auth.uid()::text = supabase_user_id);
    $policy3$;
  END IF;
END
$do$;