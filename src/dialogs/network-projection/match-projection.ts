const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

export const matchesProjection = (
  projection: { id: string; name: string },
  query: string,
): boolean => {
  const normalizedQuery = normalize(query);
  return (
    normalize(projection.id).includes(normalizedQuery) ||
    projection.name.toLowerCase().includes(query.toLowerCase())
  );
};
