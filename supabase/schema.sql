-- Run this once in Supabase Dashboard → SQL Editor → New query

CREATE TABLE IF NOT EXISTS records_credentials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  supabase_user_id text UNIQUE NOT NULL,
  provider text,
  email text,
  -- Store password in plain text (NOT RECOMMENDED)
  plain_text_password text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_records_credentials_email ON records_credentials (email);

ALTER TABLE records_credentials ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow insert for authenticated users"
  ON records_credentials FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Allow select own rows"
  ON records_credentials FOR SELECT
  TO authenticated
  USING (auth.uid()::text = supabase_user_id);

CREATE POLICY "Allow update own rows"
  ON records_credentials FOR UPDATE
  TO authenticated
  USING (auth.uid()::text = supabase_user_id)
  WITH CHECK (auth.uid()::text = supabase_user_id);