export const describeFileTypes = (names: string[]): string =>
  names.length < 2
    ? names.join("")
    : `${names.slice(0, -1).join(", ")} or ${names[names.length - 1]}`;
