export function confirmedAccountDeletion(value: unknown): boolean {
  return typeof value === "object" && value !== null
    && !Array.isArray(value)
    && Object.keys(value).length === 1
    && "confirmation" in value && value.confirmation === "DELETE";
}
