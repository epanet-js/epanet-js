const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

export const matchesProjection = (
  projection: { id: string; name: string },
  query: string,
): boolean => {
  const normalizedQuery = normalize(query);
  return (
    normalize(projection.id).includes(normalizedQuery) ||
    normalize(projection.name).includes(normalizedQuery) ||
    projection.name.toLowerCase().includes(query.toLowerCase())
  );
};

export const projectionMatchRank = (
  projection: { id: string; name: string },
  query: string,
): number => {
  const normalizedQuery = normalize(query);
  const normalizedId = normalize(projection.id);
  const normalizedName = normalize(projection.name);

  if (normalizedId === normalizedQuery || normalizedName === normalizedQuery)
    return 0;
  if (
    normalizedId.startsWith(normalizedQuery) ||
    normalizedName.startsWith(normalizedQuery)
  )
    return 1;
  return 2;
};

const MIN_EXACT_MATCH_LENGTH = 5;

export const hasExactProjectionMatch = (
  projections: { id: string; name: string }[],
  query: string,
): boolean => {
  const normalizedQuery = normalize(query);
  if (normalizedQuery.length < MIN_EXACT_MATCH_LENGTH) return false;
  return projections.some(
    (p) =>
      normalize(p.id) === normalizedQuery ||
      normalize(p.name) === normalizedQuery,
  );
};
