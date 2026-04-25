"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";
import { BrandCard } from "@/components/BrandCard";
import type { OnboardingAnswer, StyleDiagnosisResult, BrandRecommendation } from "@/types/index";

// ---- 型定義 ----

interface ChipOption {
  value: string;
  desc?: string;
}

interface ImpressionGroup {
  axis: string;
  items: ChipOption[];
}

interface MaterialDetail {
  touch: string;
  visual: string;
  emotion: string[];
  culture: string;
}

// ---- 選択肢定数 ----

const ERAS: ChipOption[] = [
  { value: "1950s", desc: "アメリカン・クラシック" },
  { value: "1960s", desc: "モッズ・サイケデリック" },
  { value: "1970s", desc: "ヒッピー・ディスコ・ファンク" },
  { value: "1980s", desc: "ニューウェーブ・パンク・バブル" },
  { value: "1990s", desc: "グランジ・ヒップホップ・ミニマル" },
  { value: "2000s", desc: "Y2K・ストリート・エモ" },
  { value: "2010s", desc: "ノームコア・ゴス・スポーツミックス" },
  { value: "2020s〜現代", desc: "現代進行形のスタイル" },
  { value: "時代を超えたクラシック", desc: "普遍的な服の形" },
];

const PLACES: ChipOption[] = [
  { value: "東京（渋谷・原宿・銀座）",             desc: "混在と前衛の都市" },
  { value: "パリ（マレ地区・サンジェルマン）",      desc: "知性と洗練の街角" },
  { value: "ロンドン（イーストエンド・ポートベロー）", desc: "反骨と文化混交" },
  { value: "ニューヨーク（ブルックリン・ハーレム・SOHO）", desc: "ストリートと芸術の交差" },
  { value: "ベルリン（クラブ・廃墟・移民文化）",    desc: "自由と廃墟の実験都市" },
  { value: "LA（ビーチ・チカーノ・セレブ）",        desc: "太陽と格差の西海岸" },
  { value: "東南アジア（バリ・バンコク）",          desc: "熱帯の色と雑踏" },
  { value: "中東・アフリカ",                        desc: "砂漠・装飾・民族の力" },
  { value: "北欧（ミニマル・自然）",                desc: "静けさと機能の美学" },
];

const STEP3_Q1_OPTIONS = [
  "自分の感覚を優先する",
  "友達の意見を取り入れる",
  "迷って決められない",
  "そもそも人に勧められた服は着たくない",
];

const STEP3_Q2_OPTIONS = [
  "好きな服を選ぶ（似合わなくても）",
  "似合う服を選ぶ（好みより優先）",
  "両方を満たすものを探し続ける",
  "場面によって変える",
];

const STEP3_Q3_OPTIONS = [
  "色",
  "形・シルエット",
  "素材・触り心地",
  "ブランド・ストーリー",
  "価格",
  "着回しやすさ",
];

const MOOD_VIBES: ChipOption[] = [
  { value: "なんか暗くてかっこいい感じ" },
  { value: "ゆるっとしてるけど品がある感じ" },
  { value: "街に溶け込む感じ・目立ちたくない" },
  { value: "ちょっと変わってる・人と違う感じ" },
  { value: "きれいめ・上品な感じ" },
  { value: "スポーティ・動きやすい感じ" },
  { value: "ナチュラル・自然体な感じ" },
  { value: "懐かしい・古着っぽい感じ" },
  { value: "個性的・アート系な感じ" },
  { value: "セクシー・色気がある感じ" },
];

const DREAM_STYLE_EXAMPLES = [
  "映画の主人公みたいな感じ",
  "カフェで本読んでそうな人",
  "夜の街が似合う人",
  "山が似合う人",
];

const MATERIALS: ChipOption[] = [
  { value: "綿（コットン）",                    desc: "軽くて素直な肌触り" },
  { value: "麻（リネン）",                      desc: "ざらっとした乾いた軽さ" },
  { value: "ウール",                            desc: "温かく、適度な重さ" },
  { value: "シルク",                            desc: "体温に溶けるような滑らかさ" },
  { value: "レザー",                            desc: "時間をかけて体の形を覚える硬さ" },
  { value: "デニム",                            desc: "使うほど体に馴染む硬さ" },
  { value: "ニット",                            desc: "独特の弾力と温もり" },
  { value: "テンセル・モーダル",                 desc: "シルクと綿の中間のような滑らかさ" },
  { value: "ポリエステル",                       desc: "軽く、シワになりにくい" },
  { value: "化繊ミックス",                       desc: "複数素材が合わさった合理的な質感" },
  { value: "形・シルエット重視（素材問わず）",   desc: "素材より形が先に来る" },
];

const SILHOUETTE_HINTS: ChipOption[] = [
  { value: "Iライン", desc: "縦に伸びる静のライン" },
  { value: "Aライン", desc: "安定感のある裾広がり" },
  { value: "Yライン", desc: "上にボリュームの逆三角" },
  { value: "オーバーサイズ", desc: "体と服の間に空気を作る" },
  { value: "ストレート", desc: "主張しない自然な筒形" },
];

const MATERIAL_DETAILS: Partial<Record<string, MaterialDetail>> = {
  "綿（コットン）": {
    touch:   "柔らかく肌に優しい。汗を吸い、乾きやすい",
    visual:  "マットな質感。色が素直に出る。自然なシワが表情を作る",
    emotion: [
      "誠実・日常・安心感（飾らない正直さの文脈）",
      "カジュアル・気取らなさ（普段着の定番の文脈）",
      "クリーン・シンプル（ベーシックを好む文脈）",
    ],
    culture: "世界中で最も多く使われる繊維。労働と日常の象徴",
  },
  "麻（リネン）": {
    touch:   "ざらっとした乾いた手触り。洗うほどに柔らかく育つ",
    visual:  "自然なシワが表情を作る。整いすぎない有機的な見た目",
    emotion: [
      "余白と静けさ（ミニマル・北欧的な文脈）",
      "夏・開放感・涼やかさ（リゾート・旅の文脈）",
      "ナチュラル・土に近い（有機的・エコの文脈）",
    ],
    culture: "人類最古の繊維の一つ。エジプト・地中海文化と深い縁",
  },
  "ウール": {
    touch:   "温かく、適度な重さ。品質によって手触りが大きく変わる",
    visual:  "光をやわらかく反射する。フォルムをきれいに保つ",
    emotion: [
      "温度と重さ・柔らかな主張（秋冬の上質の文脈）",
      "クラシック・伝統・品格（テーラード・英国的な文脈）",
      "ぬくもり・包まれる感覚（コンフォートの文脈）",
    ],
    culture: "ヨーロッパの職人文化と深く結びつく。上質のシンボル",
  },
  "シルク": {
    touch:   "滑らかで光沢感がある。体温に近い温度感",
    visual:  "光が流れるように反射する。動くたびに表情が変わる",
    emotion: [
      "官能・艶・上品な色気（肌と光の文脈）",
      "上質・特別感・華やかさ（ドレスアップの文脈）",
      "流れる軽さ・静けさ（ミニマル・和的な文脈）",
    ],
    culture: "中国発祥。長らく王族・貴族の素材。東西交流の象徴",
  },
  "レザー": {
    touch:   "硬く重く、やがて体に馴染む。着る人の輪郭を写していく",
    visual:  "光の反射が鋭い。存在を主張する境界線",
    emotion: [
      "強さ・防御・緊張感（自己と外界を分ける文脈）",
      "反抗・ロック・反骨（サブカルチャーの文脈）",
      "高級・洗練・エレガント（ラグジュアリーの文脈）",
    ],
    culture: "労働・反抗・ロック・バイカーの記号。時を経て高級素材にも",
  },
  "デニム": {
    touch:   "最初は固く、使うほどに体に馴染む。経年変化が魅力",
    visual:  "色落ちが「歴史」になる。朽ちるほどに味が出る",
    emotion: [
      "労働・反抗・ストリート（強さと反骨の文脈）",
      "青春・ノスタルジー・アメリカン（記憶と時代の文脈）",
      "日常・実用・飾らなさ（普段着の文脈）",
    ],
    culture: "アメリカの労働者文化から生まれ、全世界のポップカルチャーへ",
  },
  "ニット": {
    touch:   "編み目による独特の弾力。素材によって手触りが大きく変わる",
    visual:  "手仕事の痕跡が見える。ほどけることを内包した構造",
    emotion: [
      "手仕事・ぬくもり・誠実さ（クラフトの文脈）",
      "カジュアル・くつろぎ・家の感覚（ホームウェアの文脈）",
      "民族・土着・伝承（フォークロアの文脈）",
    ],
    culture: "ノルディック・アイルランドなど各地の民族衣装に由来",
  },
  "テンセル・モーダル": {
    touch:   "シルクのような滑らかさと綿の吸水性を合わせた感触",
    visual:  "ドレープが美しく落ちる。光沢はあるが主張しすぎない",
    emotion: [
      "現代の自然・サステナブル（環境意識の文脈）",
      "上質な日常・静かな贅沢（ミニマルラグジュアリーの文脈）",
      "機能と上質の融合（コンテンポラリーの文脈）",
    ],
    culture: "環境負荷の低いサステナブル素材として近年注目される",
  },
  "ポリエステル": {
    touch:   "軽く、シワになりにくい。機能素材として進化が著しい",
    visual:  "合成繊維特有の光沢感。技術の進歩で天然素材に近い質感も",
    emotion: [
      "機能・実用・スピード（現代都市生活の文脈）",
      "スポーツ・アクティブ・動き（ワークアウトの文脈）",
      "テック・未来・合理性（テクノロジーの文脈）",
    ],
    culture: "20世紀の工業化の象徴。現在は高機能スポーツウェアの主役",
  },
};

const COLOR_TONES: ChipOption[] = [
  { value: "無彩色（白・グレー・黒）",      desc: "余白の言語" },
  { value: "アースカラー（土・石・自然）",  desc: "素材感の色" },
  { value: "ダークカラー（深みのある色）",  desc: "主張しない存在感" },
  { value: "ライトカラー（淡い・霞んだ）",  desc: "霧のような存在感" },
  { value: "くすみカラー（低彩度）",        desc: "主張しない洗練" },
  { value: "バランス発色（中彩度）",        desc: "着ること自体が完成" },
  { value: "ビビッド（高彩度・鮮やか）",    desc: "色そのものがメッセージ" },
];

const SOCIAL_THEMES: ChipOption[] = [
  { value: "境界",   desc: "自分と他者の間にある線" },
  { value: "都市",   desc: "群衆と孤独が交差する場所" },
  { value: "孤独",   desc: "ひとりであることの密度" },
  { value: "儀式",   desc: "繰り返すことで意味が生まれる行為" },
  { value: "匿名性", desc: "名前を消して溶け込む自由" },
  { value: "反抗",   desc: "従わないことで存在する" },
  { value: "祝祭",   desc: "日常が非日常に反転する瞬間" },
  { value: "記憶",   desc: "過去が身体に刻まれていること" },
  { value: "変容",   desc: "着ることで別の自分になる" },
];

const IMPRESSION_GROUPS: ImpressionGroup[] = [
  {
    axis: "静・知・構",
    items: [
      { value: "知性",   desc: "思考の痕跡が服に出る" },
      { value: "余白",   desc: "語らないことで語る" },
      { value: "構造美", desc: "形の必然性" },
      { value: "緊張感", desc: "服の中に張りと意図" },
      { value: "匿名性", desc: "都市に溶ける自由" },
      { value: "機能美", desc: "使われることで完成" },
    ],
  },
  {
    axis: "温・誠・柔",
    items: [
      { value: "静けさ",   desc: "声を上げない存在感" },
      { value: "誠実さ",   desc: "飾らない真摯さ" },
      { value: "繊細さ",   desc: "細部に宿る意図" },
      { value: "柔らかさ", desc: "近づきやすさ・角を取る" },
      { value: "力強さ",   desc: "揺るがない密度" },
    ],
  },
  {
    axis: "動・遊・解",
    items: [
      { value: "遊び心",  desc: "肩の力が抜けた、偶然を楽しむ感じ" },
      { value: "陽気さ",  desc: "近づきたくなる、明るく弾む感じ" },
      { value: "少年性",  desc: "年齢も性別も超えた、身軽な自由さ" },
      { value: "祝祭感",  desc: "特別な日のための、高揚して溢れる感じ" },
    ],
  },
  {
    axis: "体・艶・毒",
    items: [
      { value: "官能",   desc: "体の輪郭を意識させる、静かな色気" },
      { value: "退廃",   desc: "ほどける感じ、意図的に壊れていく美しさ" },
      { value: "危うさ", desc: "安全でない感じ、裏切りのある存在感" },
    ],
  },
  {
    axis: "地・生・根",
    items: [
      { value: "土着性",  desc: "地面と繋がった、根のある重さ" },
      { value: "存在感",  desc: "部屋に入った瞬間の密度" },
    ],
  },
];

const BELIEF_EXAMPLES: { label: string; items: string[] }[] = [
  { label: "自己・内側", items: ["自分を守るもの", "自分を確かめる行為", "気分を変える道具"] },
  { label: "関係・外側", items: ["好きな人に見せたいもの", "距離を置く境界線"] },
  { label: "身体・感覚", items: ["皮膚を感じる瞬間", "軽くなりたい"] },
  { label: "遊び・喜び", items: ["楽しむためだけにある", "テンションを上げるもの"] },
];

// ---- ステップ定義 ----

const STEPS = [
  { step: 1, question: "好きな時代・年代はありますか？",          hint: "複数選択可。自由記述欄もあります" },
  { step: 2, question: "好きな場所・文化の雰囲気はありますか？",   hint: "複数選択可。特定の街・地区があれば自由記述に" },
  { step: 3, question: "こんな時、どうしますか？",                   hint: "直感で答えてください" },
  { step: 4, question: "あなたの感覚を探ってみましょう",           hint: "正解はありません。思いついたことをそのまま書いてください" },
  { step: 5, question: "参考になる人物・作品・場所",               hint: "好きなアーティスト・映画・ブランド・場所など、なんでも" },
  { step: 6, question: "素材と質感",                               hint: "触れたときに心地よい素材を選んでください（複数可）" },
  { step: 7, question: "色とトーン",                               hint: "色そのものよりもトーン感・雰囲気で選んでください" },
  { step: 8, question: "与えたい印象・避けたい印象",               hint: "他者の視線への意識を選んでください（複数可）" },
  { step: 9, question: "服を着ることの意味",                       hint: "「服とは私にとって○○である」自由に書いてください" },
];

// ---- サブコンポーネント ----

function ProgressBar({ current, total }: { current: number; total: number }) {
  return (
    <div className="w-full mb-8">
      <div className="flex justify-between text-xs text-gray-400 mb-2">
        <span>Step {current} / {total}</span>
        <span>{Math.round((current / total) * 100)}%</span>
      </div>
      <div className="h-1 bg-gray-100 rounded-full overflow-hidden">
        <div
          className="h-full bg-gray-800 rounded-full transition-all duration-500"
          style={{ width: `${(current / total) * 100}%` }}
        />
      </div>
    </div>
  );
}

function ChipSelect({
  options,
  selected,
  onToggle,
  onInfoClick,
}: {
  options: ChipOption[];
  selected: string[];
  onToggle: (val: string) => void;
  onInfoClick?: (val: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((opt) => {
        const isSelected = selected.includes(opt.value);
        return (
          <div key={opt.value} className="flex items-center gap-0.5">
            <button
              type="button"
              onClick={() => onToggle(opt.value)}
              className={`flex flex-col items-start px-3 py-2 rounded-xl border transition-all text-left ${
                isSelected
                  ? "bg-gray-800 text-white border-gray-800"
                  : "bg-white text-gray-700 border-gray-200 hover:border-gray-400"
              }`}
            >
              <span className="text-sm leading-snug">{opt.value}</span>
              {opt.desc && (
                <span className="text-[10px] leading-tight mt-0.5 text-gray-400">
                  {opt.desc}
                </span>
              )}
            </button>
            {onInfoClick && MATERIAL_DETAILS[opt.value] && (
              <button
                type="button"
                onClick={() => onInfoClick(opt.value)}
                className="w-5 h-5 rounded-full bg-gray-100 text-gray-400 hover:bg-gray-200 hover:text-gray-600 text-xs flex items-center justify-center transition-colors flex-shrink-0"
                aria-label={`${opt.value}の詳細`}
              >
                ?
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}

function GroupedChipSelect({
  groups,
  selected,
  onToggle,
}: {
  groups: ImpressionGroup[];
  selected: string[];
  onToggle: (val: string) => void;
}) {
  return (
    <div className="space-y-4">
      {groups.map((group) => (
        <div key={group.axis}>
          <p className="text-[10px] tracking-widest text-gray-300 mb-2">【{group.axis}】</p>
          <div className="flex flex-wrap gap-2">
            {group.items.map((opt) => {
              const isSelected = selected.includes(opt.value);
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => onToggle(opt.value)}
                  className={`flex flex-col items-start px-3 py-2 rounded-xl border transition-all text-left ${
                    isSelected
                      ? "bg-gray-800 text-white border-gray-800"
                      : "bg-white text-gray-700 border-gray-200 hover:border-gray-400"
                  }`}
                >
                  <span className="text-sm leading-snug">{opt.value}</span>
                  {opt.desc && (
                    <span className="text-[10px] leading-tight mt-0.5 text-gray-400">
                      {opt.desc}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

function RadioSelect({
  options,
  selected,
  onSelect,
}: {
  options: string[];
  selected: string;
  onSelect: (val: string) => void;
}) {
  return (
    <div className="flex flex-col gap-2">
      {options.map((opt) => {
        const isSelected = selected === opt;
        return (
          <button
            key={opt}
            type="button"
            onClick={() => onSelect(isSelected ? "" : opt)}
            className={`px-4 py-3 rounded-xl border text-left text-sm transition-all ${
              isSelected
                ? "bg-gray-800 text-white border-gray-800"
                : "bg-white text-gray-700 border-gray-200 hover:border-gray-400"
            }`}
          >
            {opt}
          </button>
        );
      })}
    </div>
  );
}

function FreeNote({
  value,
  onChange,
  placeholder,
  rows = 2,
}: {
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  rows?: number;
}) {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder ?? "自由に書いてください（任意）"}
      rows={rows}
      className="w-full border border-gray-100 rounded-xl px-3 py-2 text-xs text-gray-700 placeholder-gray-300 focus:outline-none focus:border-gray-300 resize-none bg-gray-50"
    />
  );
}

function MaterialPopup({
  material,
  detail,
  onClose,
}: {
  material: string;
  detail: MaterialDetail;
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center px-4 pb-24">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} />
      <div className="relative w-full max-w-sm bg-white rounded-2xl shadow-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <p className="text-sm font-medium text-gray-900">{material}</p>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-lg leading-none">×</button>
        </div>
        <div className="space-y-3">
          <div>
            <p className="text-xs text-gray-400 mb-0.5">触感</p>
            <p className="text-sm text-gray-700 leading-relaxed">{detail.touch}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400 mb-0.5">視覚印象</p>
            <p className="text-sm text-gray-700 leading-relaxed">{detail.visual}</p>
          </div>
          <div>
            <p className="text-xs text-gray-400 mb-1.5">この素材が呼ぶ世界観</p>
            <ul className="space-y-1">
              {detail.emotion.map((e, i) => (
                <li key={i} className="flex gap-2 text-sm text-gray-700 leading-relaxed">
                  <span className="text-gray-300 flex-shrink-0">·</span>
                  <span>{e}</span>
                </li>
              ))}
            </ul>
          </div>
          <div>
            <p className="text-xs text-gray-400 mb-0.5">歴史・文化</p>
            <p className="text-sm text-gray-700 leading-relaxed">{detail.culture}</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function ResultCard({
  result,
  brands,
  brandsLoading,
}: {
  result: StyleDiagnosisResult;
  brands: BrandRecommendation[];
  brandsLoading: boolean;
}) {
  return (
    <div className="space-y-8">
      {/* Plain Summary */}
      <div className="bg-gray-50 rounded-2xl p-6">
        <p className="text-xs tracking-widest text-gray-400 uppercase mb-3">Plain Summary</p>
        <p className="text-base text-gray-800 leading-relaxed">{result.plainSummary}</p>
      </div>

      {/* Core Identity */}
      <div className="text-center py-8 border-b border-gray-100">
        <p className="text-xs tracking-widest text-gray-300 uppercase mb-4">Core Identity</p>
        <h2 className="text-2xl font-light text-gray-900 leading-relaxed">{result.coreIdentity}</h2>
      </div>

      {/* Why This Result */}
      <div>
        <p className="text-xs tracking-widest text-gray-400 uppercase mb-3">Why This Result</p>
        <p className="text-sm text-gray-600 leading-relaxed">{result.whyThisResult}</p>
      </div>

      {/* Style Structure */}
      <div>
        <p className="text-xs tracking-widest text-gray-400 uppercase mb-3">Style Structure</p>
        <div className="grid grid-cols-2 gap-2">
          {(
            [
              ["色", result.styleStructure.color],
              ["線", result.styleStructure.line],
              ["素材", result.styleStructure.material],
              ["密度", result.styleStructure.density],
              ["シルエット", result.styleStructure.silhouette],
              ["視線", result.styleStructure.gaze],
            ] as [string, string][]
          ).map(([label, value]) => (
            <div key={label} className="bg-gray-50 rounded-xl p-4">
              <p className="text-xs text-gray-400 mb-1">{label}</p>
              <p className="text-sm text-gray-700 leading-snug">{value}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Input Mapping */}
      <div>
        <p className="text-xs tracking-widest text-gray-400 uppercase mb-3">Input Mapping</p>
        <div className="space-y-2.5">
          {result.inputMapping.map((item, i) => (
            <div key={i} className="flex gap-3 text-sm border-b border-gray-50 pb-2.5">
              <span className="text-gray-400 flex-shrink-0 text-xs w-16 pt-0.5">{item.question}</span>
              <div className="flex-1">
                <span className="text-gray-700">{item.answer}</span>
                <span className="text-gray-400 text-xs ml-1.5">→ {item.effect}</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Avoid */}
      <div>
        <p className="text-xs tracking-widest text-gray-400 uppercase mb-3">Avoid</p>
        <ul className="space-y-2">
          {result.avoid.map((item, i) => (
            <li key={i} className="flex items-start gap-2 text-sm text-gray-600">
              <span className="text-red-300 flex-shrink-0 mt-0.5">×</span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Action Plan */}
      <div>
        <p className="text-xs tracking-widest text-gray-400 uppercase mb-3">Action Plan</p>
        <ul className="space-y-2">
          {result.actionPlan.map((item, i) => (
            <li key={i} className="flex gap-3 text-sm text-gray-700">
              <span className="text-gray-300 font-light flex-shrink-0">{i + 1}.</span>
              <span>{item}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Next Buying Rule */}
      <div className="bg-gray-800 text-white rounded-2xl p-6">
        <p className="text-xs tracking-widest text-gray-400 uppercase mb-4">Next Buying Rule</p>
        <ul className="space-y-3">
          {result.nextBuyingRule.map((rule, i) => (
            <li key={i} className="flex gap-3 text-sm">
              <span className="text-gray-500 font-light flex-shrink-0">{i + 1}.</span>
              <span className="text-gray-200 leading-relaxed">{rule}</span>
            </li>
          ))}
        </ul>
      </div>

      {/* Brand Recommendations */}
      {(brandsLoading || brands.length > 0) && (
        <div>
          <p className="text-xs tracking-widest text-gray-400 uppercase mb-4">Brands for You</p>
          {brandsLoading ? (
            <p className="text-xs text-center text-gray-400 py-6 animate-pulse">
              あなたに合うブランドを探しています…
            </p>
          ) : (
            <div className="space-y-3">
              {brands.map((rec) => (
                <BrandCard key={rec.brand.id} rec={rec} />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ---- メインコンポーネント ----

export default function OnboardingPage() {
  const [currentStep, setCurrentStep] = useState(0);
  const [userId, setUserId] = useState<string | null>(null);
  const [popupMaterial, setPopupMaterial] = useState<string | null>(null);

  // Step 1: 時代・年代
  const [eras, setEras] = useState<string[]>([]);
  const [eraNote, setEraNote] = useState("");
  // Step 2: 場所・文化圏
  const [places, setPlaces] = useState<string[]>([]);
  const [placeNote, setPlaceNote] = useState("");
  // Step 3: 行動パターン
  const [step3Q1, setStep3Q1] = useState("");
  const [step3Q2, setStep3Q2] = useState("");
  const [step3Q3, setStep3Q3] = useState("");
  // Step 4: スタイルの感覚・気分
  const [step4Q1, setStep4Q1] = useState("");
  const [step4Q2, setStep4Q2] = useState("");
  const [step4Q3, setStep4Q3] = useState<string[]>([]);
  const [step4Q4, setStep4Q4] = useState("");
  // Step 5: 参考になる人物・作品・場所
  const [references, setReferences] = useState("");
  // Step 6: 素材
  const [materials, setMaterials] = useState<string[]>([]);
  const [materialNote, setMaterialNote] = useState("");
  const [silhouetteHint, setSilhouetteHint] = useState<string[]>([]);
  // Step 7: 色トーン
  const [colorTones, setColorTones] = useState<string[]>([]);
  const [avoidColorTones, setAvoidColorTones] = useState<string[]>([]);
  const [colorNote, setColorNote] = useState("");
  // Step 8: 印象
  const [desiredImpressions, setDesiredImpressions] = useState<string[]>([]);
  const [avoidImpressions, setAvoidImpressions] = useState<string[]>([]);
  // Step 9: 信念・社会テーマ
  const [belief, setBelief] = useState("");
  const [socialThemes, setSocialThemes] = useState<string[]>([]);

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<StyleDiagnosisResult | null>(null);
  const [brands, setBrands] = useState<BrandRecommendation[]>([]);
  const [brandsLoading, setBrandsLoading] = useState(false);

  const totalSteps = STEPS.length;
  const step = STEPS[currentStep];

  useEffect(() => {
    const supabase = createSupabaseBrowserClient();
    supabase.auth.getUser().then(({ data }) => {
      setUserId(data.user?.id ?? null);
    });
  }, []);

  function toggle(setter: React.Dispatch<React.SetStateAction<string[]>>) {
    return (val: string) =>
      setter((prev) => prev.includes(val) ? prev.filter((x) => x !== val) : [...prev, val]);
  }

  function toggleColorTone(val: string) {
    setColorTones((prev) => prev.includes(val) ? prev.filter((c) => c !== val) : [...prev, val]);
    setAvoidColorTones((prev) => prev.filter((c) => c !== val));
  }

  function toggleAvoidColorTone(val: string) {
    setAvoidColorTones((prev) => prev.includes(val) ? prev.filter((c) => c !== val) : [...prev, val]);
    setColorTones((prev) => prev.filter((c) => c !== val));
  }

  function canProceed(): boolean {
    switch (currentStep) {
      case 0: return eras.length > 0 || eraNote.trim().length > 0;
      case 1: return places.length > 0 || placeNote.trim().length > 0;
      case 2: return step3Q1.length > 0 && step3Q2.length > 0 && step3Q3.length > 0;
      case 3: return step4Q1.trim().length > 0 || step4Q3.length > 0;
      case 4: return references.trim().length > 0;
      case 5: return materials.length > 0;
      case 6: return colorTones.length > 0;
      case 7: return desiredImpressions.length > 0;
      case 8: return belief.trim().length > 0;
      default: return false;
    }
  }

  function buildAnswers(): OnboardingAnswer[] {
    return [
      {
        step: 1,
        question: "好きな時代・年代",
        answer: [
          eras.length ? eras.join("、") : "",
          eraNote.trim() ? `（補足: ${eraNote.trim()}）` : "",
        ].filter(Boolean).join(" "),
      },
      {
        step: 2,
        question: "好きな場所・文化圏",
        answer: [
          places.length ? places.join("、") : "",
          placeNote.trim() ? `（補足: ${placeNote.trim()}）` : "",
        ].filter(Boolean).join(" "),
      },
      {
        step: 3,
        question: "服選びの行動パターン",
        answer: [
          step3Q1 ? `友達と意見が違う時: ${step3Q1}` : "",
          step3Q2 ? `似合うvs好き: ${step3Q2}` : "",
          step3Q3 ? `最初に気になるもの: ${step3Q3}` : "",
        ].filter(Boolean).join(" / "),
      },
      {
        step: 4,
        question: "スタイルの感覚・気分",
        answer: [
          step4Q1.trim() ? `「いいな」と思った服装: ${step4Q1.trim()}` : "",
          step4Q2.trim() ? `「自分には無理」と思った服装: ${step4Q2.trim()}` : "",
          step4Q3.length ? `今の気分に近いもの: ${step4Q3.join("、")}` : "",
          step4Q4.trim() ? `なりたい雰囲気: ${step4Q4.trim()}` : "",
        ].filter(Boolean).join(" / "),
      },
      {
        step: 5,
        question: "参考になる人物・作品・場所",
        answer: references.trim(),
      },
      {
        step: 6,
        question: "素材・質感への意識",
        answer: [
          materials.join("、"),
          silhouetteHint.length ? `シルエットの好み: ${silhouetteHint.join("、")}` : "",
          materialNote.trim() ? `（補足: ${materialNote.trim()}）` : "",
        ].filter(Boolean).join(" / "),
      },
      {
        step: 7,
        question: "色のトーン・世界観",
        answer: [
          `惹かれるトーン: ${colorTones.join("、")}`,
          avoidColorTones.length ? `避けるトーン: ${avoidColorTones.join("、")}` : "",
          colorNote.trim() ? `（補足: ${colorNote.trim()}）` : "",
        ].filter(Boolean).join(" / "),
      },
      {
        step: 8,
        question: "与えたい印象・避けたい印象",
        answer: [
          `与えたい: ${desiredImpressions.join("、")}`,
          avoidImpressions.length ? `避けたい: ${avoidImpressions.join("、")}` : "",
        ].filter(Boolean).join(" / "),
      },
      {
        step: 9,
        question: "服を着ることの意味・信念",
        answer: [
          belief.trim(),
          socialThemes.length ? `（社会的テーマ: ${socialThemes.join("、")}）` : "",
        ].filter(Boolean).join(" "),
      },
    ];
  }

  function resetAll() {
    setResult(null);
    setCurrentStep(0);
    setEras([]);
    setEraNote("");
    setPlaces([]);
    setPlaceNote("");
    setStep3Q1("");
    setStep3Q2("");
    setStep3Q3("");
    setStep4Q1("");
    setStep4Q2("");
    setStep4Q3([]);
    setStep4Q4("");
    setReferences("");
    setMaterials([]);
    setMaterialNote("");
    setSilhouetteHint([]);
    setColorTones([]);
    setAvoidColorTones([]);
    setColorNote("");
    setDesiredImpressions([]);
    setAvoidImpressions([]);
    setBelief("");
    setSocialThemes([]);
    setError(null);
    setBrands([]);
  }

  async function handleSubmit() {
    setIsLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/ai/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers: buildAnswers(), userId }),
      });
      if (!res.ok) {
        const data = await res.json() as { error?: string };
        throw new Error(data.error ?? "エラーが発生しました");
      }
      const data = await res.json() as StyleDiagnosisResult;
      setResult(data);

      setBrandsLoading(true);
      fetch("/api/brands/recommend", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ styleAnalysis: data }),
      })
        .then((r) => r.json())
        .then((d: { recommendations?: BrandRecommendation[] }) => {
          setBrands(d.recommendations ?? []);
        })
        .catch(() => {})
        .finally(() => setBrandsLoading(false));
    } catch (err) {
      setError(err instanceof Error ? err.message : "エラーが発生しました");
    } finally {
      setIsLoading(false);
    }
  }

  if (result) {
    return (
      <div className="min-h-screen bg-white">
        <div className="max-w-lg mx-auto px-6 py-16">
          <ResultCard result={result} brands={brands} brandsLoading={brandsLoading} />
          <Link
            href="/closet"
            className="mt-8 block w-full py-3.5 bg-gray-800 text-white text-center rounded-xl text-sm font-medium hover:bg-gray-700 transition-colors"
          >
            クローゼットへ進む →
          </Link>
          <button
            onClick={resetAll}
            className="mt-3 w-full py-3 text-sm text-gray-400 hover:text-gray-600 transition-colors"
          >
            もう一度診断する
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      <div className="max-w-lg mx-auto px-6 py-16">
        <div className="mb-10">
          <p className="text-xs tracking-widest text-gray-400 uppercase mb-2">Style Diagnosis</p>
          <h1 className="text-2xl font-light text-gray-900">あなたの世界観を<br />言語化しましょう</h1>
        </div>

        <ProgressBar current={currentStep + 1} total={totalSteps} />

        <div className="space-y-6">
          <div>
            <h2 className="text-lg font-medium text-gray-900 mb-1">{step.question}</h2>
            <p className="text-sm text-gray-400">{step.hint}</p>
          </div>

          {/* Step 1: 時代・年代 */}
          {currentStep === 0 && (
            <div className="space-y-4">
              <ChipSelect options={ERAS} selected={eras} onToggle={toggle(setEras)} />
              <FreeNote
                value={eraNote}
                onChange={setEraNote}
                placeholder="特定の年・出来事・場所があれば（例：ベトナム戦争後のアメリカ、バブル期の東京）"
              />
            </div>
          )}

          {/* Step 2: 場所・文化圏 */}
          {currentStep === 1 && (
            <div className="space-y-4">
              <ChipSelect options={PLACES} selected={places} onToggle={toggle(setPlaces)} />
              <FreeNote
                value={placeNote}
                onChange={setPlaceNote}
                placeholder="特定の街・地区・場所があれば（例：90年代のブリクストン、今の下北沢）"
              />
            </div>
          )}

          {/* Step 3: 行動パターン */}
          {currentStep === 2 && (
            <div className="space-y-7">
              <div>
                <p className="text-sm text-gray-700 mb-3">
                  友達と買い物に行って、自分が選ぶ服と友達が勧める服が違う時、どうしますか？
                </p>
                <RadioSelect
                  options={STEP3_Q1_OPTIONS}
                  selected={step3Q1}
                  onSelect={setStep3Q1}
                />
              </div>
              <div>
                <p className="text-sm text-gray-700 mb-3">
                  「似合う」と言われた服と「好き」な服が違う時、どちらを選びますか？
                </p>
                <RadioSelect
                  options={STEP3_Q2_OPTIONS}
                  selected={step3Q2}
                  onSelect={setStep3Q2}
                />
              </div>
              <div>
                <p className="text-sm text-gray-700 mb-3">
                  服を買う時、一番最初に気になるのは何ですか？
                </p>
                <RadioSelect
                  options={STEP3_Q3_OPTIONS}
                  selected={step3Q3}
                  onSelect={setStep3Q3}
                />
              </div>
            </div>
          )}

          {/* Step 4: スタイルの感覚・気分 */}
          {currentStep === 3 && (
            <div className="space-y-6">
              {/* Q1 */}
              <div>
                <p className="text-sm text-gray-700 mb-1">
                  最近、街で見かけて「いいな」と思った人の服装を思い出してください。どんな雰囲気でしたか？
                </p>
                <p className="text-xs text-gray-300 mb-2">例：「なんか暗い色だけどかっこよかった」「ゆるっとしてたけど品があった」</p>
                <FreeNote
                  value={step4Q1}
                  onChange={setStep4Q1}
                  placeholder="思いついたまま書いてください"
                  rows={2}
                />
              </div>

              {/* Q2 */}
              <div>
                <p className="text-sm text-gray-700 mb-1">
                  逆に「自分には無理だな」と思った服装はどんなものですか？<span className="text-xs text-gray-300 ml-1">（任意）</span>
                </p>
                <p className="text-xs text-gray-300 mb-2">例：「派手すぎるもの」「きっちりしすぎるスーツ」</p>
                <FreeNote
                  value={step4Q2}
                  onChange={setStep4Q2}
                  placeholder="思いつく範囲で"
                  rows={2}
                />
              </div>

              {/* Q3 */}
              <div>
                <p className="text-sm text-gray-700 mb-3">
                  自分が今一番着たい気分はどれに近いですか？<span className="text-xs text-gray-400 ml-1">（複数可）</span>
                </p>
                <ChipSelect
                  options={MOOD_VIBES}
                  selected={step4Q3}
                  onToggle={toggle(setStep4Q3)}
                />
              </div>

              {/* Q4 */}
              <div>
                <p className="text-sm text-gray-700 mb-1">
                  もし服に制限がなかったら、どんな雰囲気の人になりたいですか？<span className="text-xs text-gray-300 ml-1">（任意）</span>
                </p>
                <FreeNote
                  value={step4Q4}
                  onChange={setStep4Q4}
                  placeholder="自由に"
                  rows={2}
                />
                <div className="flex flex-wrap gap-2 mt-2">
                  {DREAM_STYLE_EXAMPLES.map((ex) => (
                    <button
                      key={ex}
                      type="button"
                      onClick={() => setStep4Q4((prev) => prev ? `${prev} / ${ex}` : ex)}
                      className="px-3 py-1.5 text-xs border border-gray-200 text-gray-400 rounded-full hover:border-gray-400 hover:text-gray-600 transition-colors"
                    >
                      {ex}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Step 5: 参考になる人物・作品・場所 */}
          {currentStep === 4 && (
            <div className="space-y-3">
              <textarea
                value={references}
                onChange={(e) => setReferences(e.target.value)}
                placeholder="例：David Bowie / 映画『パリ、テキサス』/ RAF Simons初期 / 廃工場の質感"
                rows={5}
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-800 placeholder-gray-300 focus:outline-none focus:border-gray-400 resize-none"
              />
              <div className="space-y-1 text-xs text-gray-300">
                <p>· 好きなミュージシャン・アーティスト</p>
                <p>· 好きな映画・ドラマのキャラクター</p>
                <p>· 好きなブランド・デザイナー</p>
                <p>· 美しいと思った場所・建築・風景</p>
              </div>
            </div>
          )}

          {/* Step 6: 素材 */}
          {currentStep === 5 && (
            <div className="space-y-5">
              <ChipSelect
                options={MATERIALS}
                selected={materials}
                onToggle={toggle(setMaterials)}
                onInfoClick={setPopupMaterial}
              />
              <FreeNote
                value={materialNote}
                onChange={setMaterialNote}
                placeholder="上記にない素材があれば自由に書いてください（任意）"
              />
              <div>
                <p className="text-xs text-gray-500 mb-3">シルエットの好み（任意）</p>
                <ChipSelect
                  options={SILHOUETTE_HINTS}
                  selected={silhouetteHint}
                  onToggle={toggle(setSilhouetteHint)}
                />
              </div>
            </div>
          )}

          {/* Step 7: 色トーン */}
          {currentStep === 6 && (
            <div className="space-y-5">
              <div>
                <p className="text-xs text-gray-500 mb-3">惹かれるトーン（複数可）</p>
                <ChipSelect options={COLOR_TONES} selected={colorTones} onToggle={toggleColorTone} />
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-3">避けたいトーン（任意）</p>
                <ChipSelect options={COLOR_TONES} selected={avoidColorTones} onToggle={toggleAvoidColorTone} />
              </div>
              <FreeNote
                value={colorNote}
                onChange={setColorNote}
                placeholder="上記にない色・トーンがあれば自由に書いてください（任意）"
              />
            </div>
          )}

          {/* Step 8: 印象 */}
          {currentStep === 7 && (
            <div className="space-y-6">
              <div>
                <p className="text-xs text-gray-500 mb-3">与えたい印象（複数可）</p>
                <GroupedChipSelect
                  groups={IMPRESSION_GROUPS}
                  selected={desiredImpressions}
                  onToggle={toggle(setDesiredImpressions)}
                />
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-3">避けたい印象（任意）</p>
                <GroupedChipSelect
                  groups={IMPRESSION_GROUPS}
                  selected={avoidImpressions}
                  onToggle={toggle(setAvoidImpressions)}
                />
              </div>
            </div>
          )}

          {/* Step 9: 信念 */}
          {currentStep === 8 && (
            <div className="space-y-5">
              <textarea
                value={belief}
                onChange={(e) => setBelief(e.target.value)}
                placeholder="自由に書いてください..."
                rows={4}
                className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm text-gray-800 placeholder-gray-300 focus:outline-none focus:border-gray-400 resize-none"
              />
              <div className="space-y-2">
                {BELIEF_EXAMPLES.map((group) => (
                  <div key={group.label}>
                    <p className="text-[10px] text-gray-300 mb-1.5">{group.label}</p>
                    <div className="flex flex-wrap gap-2">
                      {group.items.map((ex) => (
                        <button
                          key={ex}
                          type="button"
                          onClick={() => setBelief((prev) => prev ? `${prev} / ${ex}` : ex)}
                          className="px-3 py-1.5 text-xs border border-gray-200 text-gray-400 rounded-full hover:border-gray-400 hover:text-gray-600 transition-colors"
                        >
                          {ex}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              <div>
                <p className="text-xs text-gray-500 mb-3">社会的・文化的テーマ（任意）</p>
                <ChipSelect
                  options={SOCIAL_THEMES}
                  selected={socialThemes}
                  onToggle={toggle(setSocialThemes)}
                />
              </div>
            </div>
          )}
        </div>

        {error && (
          <p className="mt-4 text-sm text-red-500">{error}</p>
        )}

        <div className="flex gap-3 mt-10">
          {currentStep > 0 && (
            <button
              type="button"
              onClick={() => setCurrentStep((s) => s - 1)}
              className="flex-1 py-3 border border-gray-200 rounded-xl text-sm text-gray-600 hover:bg-gray-50 transition-colors"
            >
              戻る
            </button>
          )}
          {currentStep < totalSteps - 1 ? (
            <button
              type="button"
              onClick={() => setCurrentStep((s) => s + 1)}
              disabled={!canProceed()}
              className="flex-1 py-3 bg-gray-800 text-white rounded-xl text-sm disabled:opacity-30 hover:bg-gray-700 transition-colors"
            >
              次へ
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSubmit}
              disabled={!canProceed() || isLoading}
              className="flex-1 py-3 bg-gray-800 text-white rounded-xl text-sm disabled:opacity-30 hover:bg-gray-700 transition-colors"
            >
              {isLoading ? "分析中..." : "診断する"}
            </button>
          )}
        </div>
      </div>

      {/* 素材詳細ポップアップ */}
      {popupMaterial && MATERIAL_DETAILS[popupMaterial] && (
        <MaterialPopup
          material={popupMaterial}
          detail={MATERIAL_DETAILS[popupMaterial]!}
          onClose={() => setPopupMaterial(null)}
        />
      )}
    </div>
  );
}
