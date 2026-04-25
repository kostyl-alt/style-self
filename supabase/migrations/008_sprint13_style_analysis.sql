alter table public.users
  add column if not exists style_analysis jsonb;

comment on column public.users.style_analysis is
  '診断結果の構造化データ（Sprint 13）。構造: { coreIdentity, whyThisResult, styleStructure, inputMapping, avoid, actionPlan, nextBuyingRule, styleAxis }';
