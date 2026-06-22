ALTER TABLE ra_modelos_auto
  ADD COLUMN updated_at TIMESTAMPTZ DEFAULT NOW();

CREATE OR REPLACE FUNCTION ra_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER ra_modelos_auto_updated_at
  BEFORE UPDATE ON ra_modelos_auto
  FOR EACH ROW EXECUTE FUNCTION ra_set_updated_at();
