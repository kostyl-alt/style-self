// Sprint 41: Admin email allowlist チェックヘルパー
//
// /admin/* ページは middleware で守られているが、
// /api/admin/* は middleware の matcher 対象外なので、
// 各 API ルートで個別に email チェックが必要。

const ADMIN_EMAILS = (process.env.ADMIN_EMAILS ?? "")
  .split(",")
  .map((s) => s.trim().toLowerCase())
  .filter(Boolean);

export function isAdminEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  return ADMIN_EMAILS.includes(email.toLowerCase());
}
