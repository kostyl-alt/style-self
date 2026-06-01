// フィーチャーフラグ
//
// PRODUCTS_ENABLED: 商品候補・商品マッチング・ZOZO/楽天導線などの「商品UI」を
//   メイン導線に出すかどうか。既定 false（コア体験を診断→世界観→コーデ→投稿→
//   マッチングに絞る）。商品まわりのコード・型・API・DB は土台として保持し、
//   表示のみをこのフラグで一括制御する。L2（multi-source product catalog）で
//   NEXT_PUBLIC_PRODUCTS_ENABLED=true に戻すだけで復活できる。
//
// クライアントコンポーネントからも参照するため NEXT_PUBLIC_* を読む。
export const PRODUCTS_ENABLED =
  process.env.NEXT_PUBLIC_PRODUCTS_ENABLED === "true";
