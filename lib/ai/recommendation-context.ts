export type RecommendationContext = {
  interests: string[];
  savedCategories: string[];
  goingEventIds: string[];
  city: string | null;
};

type ContextSource = RecommendationContext & Record<string, unknown>;

function boundedUnique(values: string[], maxItems: number, maxLength: number): string[] {
  return [...new Set(values.filter((value) => value.length > 0 && value.length <= maxLength))].slice(0, maxItems);
}

export function buildRecommendationContext(source: ContextSource): RecommendationContext {
  return {
    interests: boundedUnique(source.interests, 20, 40),
    savedCategories: boundedUnique(source.savedCategories, 20, 120),
    goingEventIds: boundedUnique(source.goingEventIds, 20, 128),
    city: source.city && source.city.length <= 100 ? source.city : null,
  };
}
