export function sortAts<T extends { at: string; id: string }>(
  a: T,
  b: T,
): number {
  if (a.at > b.at) {
    return 1;
  } else if (a.at < b.at) {
    return -1;
  } else if (a.id > b.id) {
    // This should never happen, but fall
    // back to it to get stable sorting.
    return 1;
  } else {
    return -1;
  }
}
