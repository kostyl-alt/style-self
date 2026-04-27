-- Sprint 32: 体型・骨格プロファイルカラムを追加
ALTER TABLE users ADD COLUMN IF NOT EXISTS body_profile jsonb;
