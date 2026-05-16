// フェーズB Step 2 確認用の開発専用プレビューページ。
// /dev/diagnosis-preview を開くと analyze-v2 を即時 fire でき、
// DiagnosisDisplay 上で 13項目が表示されることを目視確認できる。
//
// 【撤去について】フェーズC(旧コード削除)時に
//   - app/(app)/dev/diagnosis-preview/page.tsx
//   - app/(app)/dev/diagnosis-preview/PreviewClient.tsx
// をまとめて削除する想定。
// dev ディレクトリ全体を消しても他に影響なし。
//
// 【本番保護】NODE_ENV === "production" のときは notFound() を返す。
// next dev でのみアクセス可能。

import { notFound } from "next/navigation";
import PreviewClient from "./PreviewClient";

export default function DiagnosisPreviewPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return <PreviewClient />;
}
