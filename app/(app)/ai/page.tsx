"use client";

// P1-A: チャット主役型 メイン画面 /ai(最小骨格)
//
// 設計: docs/STYLE-SELF_D1_実装設計.md Phase 1 P1-A
//
// 【P1-A スコープ】
// 起動導線変更の土台先行工程。本ファイルは最小骨格のみ
//   ・「STYLE-SELF AI(準備中)」プレースホルダ表示
//   ・既存 BottomNav は (app) layout で表示される
//   ・認証は middleware appRoutes に /ai 追加で守られる
//
// 【ChatPage 構築は P1-C】
// 本格的なチャット UI(D1-2b' 履歴 state + 吹き出し + 5 サブ転用・
// OverlayFab 廃止)は P1-C で実装する。P1-A はあくまで起動導線の
// 動作確認のための空ページ。

export default function AiPage() {
  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-lg mx-auto px-4 py-12 space-y-4">
        <div>
          <p className="text-xs tracking-widest text-gray-400 uppercase mb-1">AI</p>
          <h1 className="text-2xl font-light text-gray-900">STYLE-SELF AI</h1>
        </div>
        <div className="border border-dashed border-gray-200 rounded-2xl p-8 text-center space-y-2">
          <p className="text-sm text-gray-700">準備中</p>
          <p className="text-xs text-gray-400 leading-relaxed">
            チャットメイン画面は次のステップ(P1-C)で実装されます。
            <br />
            P1-A では起動導線(/ai への redirect + 認証ガード)のみ確立しています。
          </p>
        </div>
      </div>
    </div>
  );
}
