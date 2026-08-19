export function isInvestmentRecommendationRequest(textValue: string): boolean {
  return /\b(?:invest|investment|allocate|portfolio|recommend|rekomendasi|investasi|alokasi)\b/iu.test(textValue);
}

export function parseInvestmentBudget(textValue: string): number | null {
  if (!isInvestmentRecommendationRequest(textValue)) return null;
  const match = textValue.match(/(?:\$|usd\s*)(\d+(?:\.\d{1,2})?)|(\d+(?:\.\d{1,2})?)\s*(?:usd|dollars?)/iu);
  const value = Number(match?.[1] ?? match?.[2]);
  return Number.isFinite(value) && value >= 1 && value <= 1_000_000 ? value : null;
}
