// M3-2 前半 検証用の開発専用ページ。
// /dev/exif-test に画像をアップロードし、EXIF が除去されているかを
// オーナーが実機(Mac プレビュー Cmd+I 等)で確認するための一時ページ。
//
// 【撤去について】M3 完結後 or フェーズC で削除予定。
// /dev/diagnosis-preview と同じ扱い(削除しても他に影響なし)。
//
// 【本番保護】NODE_ENV === "production" のとき notFound() を返す。
// next dev でのみアクセス可能(/dev/diagnosis-preview と同じ仕組み)。

import { notFound } from "next/navigation";
import ExifTestClient from "./ExifTestClient";

export default function ExifTestPage() {
  if (process.env.NODE_ENV === "production") notFound();
  return <ExifTestClient />;
}
