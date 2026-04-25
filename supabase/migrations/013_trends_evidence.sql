ALTER TABLE trends
  ADD COLUMN IF NOT EXISTS source_label   text,
  ADD COLUMN IF NOT EXISTS source_type    text DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS observed_items text[] DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS fetched_at     timestamptz,
  ADD COLUMN IF NOT EXISTS evidence_note  text;
