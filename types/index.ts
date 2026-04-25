// ---- Worldview ----

export interface Worldview {
  beliefs: string[];           // 信念キーワード（例: ["余白を大切にする", "構造美を信じる"]）
  targetPersona: string;       // 目指したい人物像
  stylePhilosophy: string;     // ファッション哲学（自由記述）
  desiredImpression: string[]; // 与えたい印象
  avoidImpression: string[];   // 避けたい印象
}

// ---- Style Axes ----

export type ColorTone = "warm" | "cool" | "neutral" | "earthy" | "vivid";
export type SpaceFeeling = "minimal" | "layered" | "balanced" | "maximalist";
export type MaterialPreference =
  | "natural"
  | "synthetic"
  | "mixed"
  | "luxury"
  | "casual";

export interface StyleAxis {
  beliefKeywords: string[];      // 例: ["静けさ", "余白", "素材感"]
  colorTone: ColorTone;
  spaceFeeling: SpaceFeeling;
  materialPreference: MaterialPreference;
  summary: string;               // Claude生成のスタイルサマリー
}

// ---- User ----

export type BodyType         = "straight" | "wave" | "natural" | "unknown";
export type BodyTendency     = "upper" | "lower" | "balanced" | "slim" | "solid";
export type WeightCenter     = "upper" | "lower" | "balanced";
export type ShoulderWidth    = "wide" | "normal" | "narrow";
export type UpperBodyThickness = "thin" | "normal" | "thick";
export type MuscleType       = "slim" | "standard" | "muscular" | "solid";
export type LegLength        = "long" | "normal" | "short";
export type PreferredFit     = "tight" | "just" | "relaxed" | "oversized";
export type StyleImpression  = "sharp" | "neutral" | "soft" | "presence";
export type BodyPart         = "shoulder" | "chest" | "waist" | "legs" | "hip";

export interface BodyInfo {
  height: number | null;
  weight: number | null;
  bodyType: BodyType | null;
  bodyTendency: BodyTendency | null;
  weightCenter: WeightCenter | null;
  shoulderWidth: ShoulderWidth | null;
  upperBodyThickness: UpperBodyThickness | null;
  muscleType: MuscleType | null;
  legLength: LegLength | null;
  preferredFit: PreferredFit | null;
  styleImpression: StyleImpression | null;
  emphasizeParts: BodyPart[];
  hideParts: BodyPart[];
  fitRecommendation: string | null;
}

export interface UserProfile {
  id: string;
  email: string;
  displayName: string | null;
  styleAxis: StyleAxis | null;
  onboardingCompleted: boolean;
  bodyInfo: BodyInfo;
  worldview: Worldview | null;
  createdAt: string;
  updatedAt: string;
}

// ---- Wardrobe ----

export type WardrobeCategory =
  | "tops" | "bottoms" | "outerwear" | "shoes"
  | "accessories" | "bags" | "dress" | "setup"
  | "jacket" | "vest" | "inner" | "roomwear"
  | "hat" | "jewelry" | "other";

export type Season = "spring" | "summer" | "autumn" | "winter" | "all";

export type WardrobeStatus = "owned" | "considering" | "wishlist" | "passed";

export interface WardrobeItem {
  id: string;
  userId: string;
  name: string;
  category: WardrobeCategory;
  color: string;
  subColor: string | null;
  material: string | null;
  fabricTexture: string | null;
  brand: string | null;
  seasons: Season[];
  status: WardrobeStatus;
  worldviewScore: number | null;
  worldviewTags: string[];
  silhouette: string | null;
  taste: string[];
  imageUrl: string | null;
  tags: string[];
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

export type WardrobeItemCreate = Omit<
  WardrobeItem,
  "id" | "userId" | "createdAt" | "updatedAt"
>;

// ---- Coordinate ----

export interface CoordinateItem {
  wardrobeItemId: string;
  role: "main" | "accent" | "base";
  reason?: string;
}

export interface Coordinate {
  id: string;
  userId: string;
  items: CoordinateItem[];
  colorStory: string;
  beliefAlignment: string;
  trendNote: string | null;
  occasion: string | null;
  savedAt: string;
  createdAt: string;
}

// ---- Abstract Coordinate Types ----

export interface AbstractColorPalette {
  primary: string;
  secondary: string;
  avoid: string[];
}

export interface AbstractTranslation {
  colorPalette: AbstractColorPalette;
  materials: string[];
  silhouetteType: string;
  volumeBalance: string;
  weightCenter: string;
  layering: string;
  exposure: string;
  impressionKeywords: string[];
}

export interface AbstractToDesignResponse {
  translation: AbstractTranslation;
  designRationale: string;
}

export interface AbstractCoordinateRequest {
  abstractWords: string[];
  theme?: string;
}

// ---- AI Response Types ----

export interface CoordinateSilhouette {
  type: string;
  topVolume: string;
  bottomVolume: string;
  lengthBalance: string;
}

export interface CoordinateSizeGuide {
  topsFit?: string;
  topsLength?: string;
  shoulder?: string;
  pantsFit?: string;
  rise?: string;
  hemBreak?: string;
}

// ---- Coordinate Analysis (11-axis) ----

export interface CoordinateRatio {
  topBottom: string;
  volumeBalance: string;
  assessment: string;
}

export interface CoordinateMaterialAnalysis {
  combination: string;
  hierarchy: string;
  tactileStory: string;
}

export interface CoordinateLine {
  direction: "vertical" | "horizontal" | "diagonal" | "curved" | "mixed";
  dominantLine: string;
  effect: string;
}

export interface CoordinateWeight {
  center: "upper" | "lower" | "balanced";
  feeling: string;
  structuralRole: string;
}

export interface CoordinateStructure {
  consistency: "high" | "medium" | "contrast";
  logic: string;
  tension: string;
}

export interface CoordinateWorldviewAlignment {
  score: number;
  alignedTags: string[];
  divergedTags: string[];
  comment: string;
}

export interface CoordinateGaze {
  entry: string;
  flow: string;
  exit: string;
}

export interface CoordinateAnalysis {
  ratio: CoordinateRatio;
  material: CoordinateMaterialAnalysis;
  line: CoordinateLine;
  weight: CoordinateWeight;
  structure: CoordinateStructure;
  worldviewAlignment: CoordinateWorldviewAlignment;
  why: string;
  what: string;
  emotion: string;
  gaze: CoordinateGaze;
}

export interface CoordinateAIResponse {
  items: CoordinateItem[];
  colorStory: string;
  beliefAlignment: string;
  trendNote: string;
  bodyFitNote?: string;
  silhouette?: CoordinateSilhouette;
  sizeGuide?: CoordinateSizeGuide;
  adjustment?: string[];
  avoid?: string[];
  buyingHint?: string[];
  analysis?: CoordinateAnalysis;
}

export interface ResolvedCoordinateItem {
  item: WardrobeItem;
  role: "main" | "accent" | "base";
  reason?: string;
}

export interface CoordinateGenerateResponse {
  coordinate: CoordinateAIResponse;
  resolvedItems: ResolvedCoordinateItem[];
}

export interface StyleStructure {
  color: string;
  line: string;
  material: string;
  density: string;
  silhouette: string;
  gaze: string;
}

export interface InputMappingItem {
  question: string;
  answer: string;
  effect: string;
}

export interface StylePreference {
  likedColors: string[];
  dislikedColors: string[];
  likedMaterials: string[];
  dislikedMaterials: string[];
  likedSilhouettes: string[];
  dislikedSilhouettes: string[];
  likedVibes: string[];
  dislikedVibes: string[];
  culturalReferences: string[];
  targetImpressions: string[];
  avoidImpressions: string[];
  clothingRole: string[];
  ngElements: string[];
}

export interface StyleDiagnosisResult {
  plainSummary: string;
  coreIdentity: string;
  whyThisResult: string;
  styleStructure: StyleStructure;
  inputMapping: InputMappingItem[];
  avoid: string[];
  actionPlan: string[];
  nextBuyingRule: string[];
  styleAxis: StyleAxis;
  // v2 fields (undefined in older results → sections hidden)
  plainType?: string;
  typeExplanation?: string;
  recommendedColors?: string[];
  recommendedMaterials?: string[];
  recommendedSilhouettes?: string[];
  avoidElements?: string[];
  buyingPriority?: string[];
  dailyAdvice?: string[];
  preference?: StylePreference;
}

export type StyleAnalysisAIResponse = StyleDiagnosisResult;

export interface WardrobeCompatibilityAIResponse {
  compatibility: "perfect" | "good" | "neutral" | "caution";
  comment: string;
  worldviewScore: number;
  worldviewTags: string[];
}

export interface ItemAnalysisAIResponse {
  category: WardrobeCategory;
  color: string;
  subColor: string | null;
  material: string | null;
  fabricTexture: string | null;
  silhouette: string | null;
  taste: string[];
  brand: string | null;
  worldviewTags: string[];
}

// ---- Learn ----

export type InspirationCategory = "designer" | "look" | "artwork" | "film" | "book";

export interface Inspiration {
  id: string;
  title: string;
  description: string;
  imageUrl: string | null;
  category: InspirationCategory;
  tags: string[];
  sourceUrl: string | null;
  displayOrder: number;
  createdAt: string;
}

export type LearnInsightTheme = "material" | "silhouette" | "ratio";
export type LearnInsightType  = "insight" | "breakdown" | "action";

export interface LearnInsight {
  theme:      LearnInsightTheme;
  type:       LearnInsightType;
  title:      string;
  conclusion: string;
  example:    string;
  action:     string;
  keyword:    string;
}

export interface PairingReasons {
  color: string;
  material: string;
  silhouette: string;
  taste: string;
  worldview: string;
}

export type PairingSource = "owned" | "brand" | "crossBrand" | "external";

export interface PairingCandidate {
  source: PairingSource;
  itemId: string | null;
  name: string;
  brand: string | null;
  color: string | null;
  reasons: PairingReasons;
}

export interface PairingGroup {
  source: PairingSource;
  label: string;
  candidates: PairingCandidate[];
}

export interface ResolvedPairingCandidate {
  source: PairingSource;
  item: WardrobeItem | null;
  name: string;
  brand: string | null;
  color: string | null;
  reasons: PairingReasons;
}

export interface ResolvedPairingGroup {
  source: PairingSource;
  label: string;
  candidates: ResolvedPairingCandidate[];
}

export interface PurchaseCheckAIResponse {
  similarItems: { itemId: string; reason: string }[];
  pairingGroups: PairingGroup[];
  worldviewScore: number;
  worldviewComment: string;
  buyReason: string;
  passReason: string;
}

export interface PurchaseCheckResponse {
  result: PurchaseCheckAIResponse;
  similarResolved: { item: WardrobeItem; reason: string }[];
  pairingGroupsResolved: ResolvedPairingGroup[];
}

// ---- Brands ----

export interface Brand {
  id: string;
  name: string;
  nameJa: string | null;
  country: string;
  city: string | null;
  description: string;
  worldviewTags: string[];
  tasteTags: string[];
  eraTags: string[];
  sceneTags: string[];
  priceRange: "budget" | "mid" | "high" | "luxury";
  maniacLevel: number;
  officialUrl: string | null;
  instagramUrl: string | null;
}

export interface BrandRecommendation {
  brand: Brand;
  reason: string;
  matchTags: string[];
  matchScore: number;
}

// ---- Trends ----

export type TrendCategory = "silhouette" | "color" | "material" | "detail";
export type TrendCompatibility = "high" | "medium" | "low";
export type TrendAdaptationLevel = "main" | "accent" | "minimal";

export interface Trend {
  id: string;
  season: string;
  year: number;
  keyword: string;
  category: TrendCategory;
  description: string;
  applicableStyles: string[];
  incompatibleStyles: string[];
  adaptationHint: string | null;
  displayOrder: number;
}

export interface TrendTranslationResult {
  trendKeyword: string;
  compatibility: TrendCompatibility;
  compatibilityReason: string;
  howToAdapt: string;
  adaptationLevel: TrendAdaptationLevel;
  specificAdvice: string[];
  avoidPoints: string[];
}

// ---- Onboarding ----

export interface OnboardingAnswer {
  step: number;
  question: string;
  answer: string;
}
