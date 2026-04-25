import type { PurchaseCheckAIResponse, PairingReasons } from "@/types/index";

const VALID_PAIRING_SOURCES = new Set(["owned", "brand", "crossBrand", "external"]);

export function validateAndFixPurchaseCheck(result: PurchaseCheckAIResponse): PurchaseCheckAIResponse {
  if (result.worldviewScore != null) {
    result.worldviewScore = Math.max(1, Math.min(5, result.worldviewScore));
  }

  if (Array.isArray(result.pairingGroups)) {
    result.pairingGroups = result.pairingGroups.map((group) => ({
      ...group,
      source: VALID_PAIRING_SOURCES.has(group.source) ? group.source : "crossBrand" as const,
      candidates: (group.candidates ?? []).map((c) => {
        const raw = c.reasons as Partial<PairingReasons> | undefined | null;
        const reasons: PairingReasons = {
          color:      raw?.color      ?? "",
          material:   raw?.material   ?? "",
          silhouette: raw?.silhouette ?? "",
          taste:      raw?.taste      ?? "",
          worldview:  raw?.worldview  ?? "",
        };
        return { ...c, reasons };
      }),
    }));
  }

  return result;
}
