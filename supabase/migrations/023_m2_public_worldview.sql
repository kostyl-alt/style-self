-- ビジョンマップ MVP M2-1: worldview_profiles を「人に見せられる」形にする DB 基盤
--
-- 【背景】
-- M1(診断本番化)で全ユーザーが固有世界観を持つようになった。
-- 次の節目 M2 で「自分の世界観プロフィールを他者に見せる」を実現する。
-- M3(投稿)・M4(世界観マッチング)の土台となる最重要 migration。
--
-- 【設計の確定事項(設計ドキュメント参照)】
-- - 判断1: 公開プロフィールは未ログインでも閲覧可能(anon ロールにも開く)
-- - 判断3: 公開対象は最新の世界観1つ(worldview_profiles の該当行)。履歴は公開しない
-- - オプトイン公開: 全ユーザーがデフォルト非公開、明示的に opt-in した行だけ公開
--
-- 【変更内容】
-- 1. worldview_profiles.is_public boolean default false 追加(オプトイン公開フラグ)
-- 2. SELECT ポリシー追加: is_public=true 行は誰でも(anon+authenticated)読める
-- 3. public_users view 新設(厳格版): worldview_profiles と INNER JOIN し、
--    is_public=true のユーザーの id + display_name だけを露出。
--    世界観非公開のユーザーは名前も漏れない設計。
--
-- 【安全性 — 重要】
-- (a) 既存の "users own worldview_profile" FOR ALL ポリシーは温存。
--     新ポリシーは追加のみ。本人は従来通り全行操作可、他者は is_public=true 行だけ SELECT 可。
--     RLS は複数ポリシーの OR で評価されるので、本人 + 公開行 の両方が並立する。
-- (b) anon ロールへの公開: ポリシーの `to` 句省略 = `public` ロール = anon + authenticated 両方に効く。
--     Supabase のデフォルトで anon/authenticated に SELECT GRANT が付いているため追加 GRANT 不要。
-- (c) public_users view の SECURITY DEFINER 性: Postgres view は default で
--     security_invoker=off(= view owner 権限で実行 = RLS バイパス)。
--     本ケースでは意図的にこれを利用して「世界観公開者の id と display_name だけは
--     公開してよい」という明示的な公開面を作る。SELECT 列を厳密に id, display_name のみ、
--     さらに JOIN+WHERE で is_public=true ユーザーに行レベルでも絞ることで、
--     身体情報・診断データ・email 等の他カラムは絶対に漏れない(view 定義に存在しないため
--     SELECT 不可能)、かつ世界観非公開ユーザーの display_name も漏れない。
--     Supabase Database Linter は security_definer view を警告するが、本ケースは
--     **意図的な公開面の作り方**であり妥当(オーナー確定方針)。
-- (d) view 内の JOIN について: view 自体が view owner 権限で実行されるため、
--     view 内の worldview_profiles 参照は RLS をバイパスする(つまり anon が直接
--     worldview_profiles を読めなくても、view 経由なら is_public=true 行を辿れる)。
--     これは意図通り。anon が view から SELECT する権限は明示 GRANT で許可済み。
--     また、worldview_profiles 自体に追加した新 SELECT ポリシーは「anon が直接
--     worldview_profiles の result jsonb を読む」用途(M2-3 の公開ページで使用)で、
--     view とは独立の経路。
--
-- 【冪等性】
-- - alter ... add column if not exists
-- - create or replace view
-- - create policy は再実行不可(既存だとエラー)。再実行する場合は事前 drop policy が必要。
--
-- 【ロールバック手順】
--   drop policy if exists "public worldview profiles readable by anyone" on public.worldview_profiles;
--   revoke select on public.public_users from authenticated, anon;
--   drop view if exists public.public_users;
--   alter table public.worldview_profiles drop column if exists is_public;
--
-- 適用時の確認:
-- - 既存全行が is_public=false で入る(default false なので誰も公開されない)
-- - 本人は従来通り自分の行を読める(既存ポリシーが効く)
-- - 他者・anon は is_public=true 行だけ読める(新ポリシー)
-- - public_users で「is_public=true のユーザーの」id + display_name のみ読める(M2-3 公開ページ用)
-- - 適用直後は public_users が 0 件返る(まだ誰も公開していない)

-- ---- 1. 公開フラグ ----

alter table public.worldview_profiles
  add column if not exists is_public boolean not null default false;

comment on column public.worldview_profiles.is_public is
  'true なら /u/[userId] で誰でも(未ログイン含む)閲覧可能。デフォルト false (非公開・オプトイン公開)。';

-- ---- 2. 公開行への SELECT ポリシー(anon + authenticated 両方) ----
-- `to` 句省略 → default public ロール = anon + authenticated 両方に適用される。
-- 既存の "users own worldview_profile" は本人限定 FOR ALL のまま温存。複数ポリシーは OR 評価。

create policy "public worldview profiles readable by anyone"
  on public.worldview_profiles for select
  using (is_public = true);

-- ---- 3. users の公開列だけ露出する view(厳格版) ----
-- SECURITY DEFINER 相当(Postgres default の security_invoker=off)で実行されるため
-- users / worldview_profiles テーブル両方の RLS をバイパスする(意図的)。
-- SELECT 列を id, display_name のみに厳密に絞り、さらに INNER JOIN + WHERE is_public=true で
-- 「世界観を公開しているユーザー」だけに行レベルでも絞る。
-- → 身体情報・診断データ等の他列は構造的に漏れず、世界観非公開者の display_name も出ない。

create or replace view public.public_users as
  select u.id, u.display_name
  from public.users u
  inner join public.worldview_profiles wp on wp.user_id = u.id
  where wp.is_public = true;

grant select on public.public_users to authenticated, anon;
