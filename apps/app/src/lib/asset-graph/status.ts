export const STATUS_OPEN = 1;
export const STATUS_CLOSED = 0;

export const toStatusStep = (code: number) =>
  code > 2 ? STATUS_OPEN : STATUS_CLOSED;
