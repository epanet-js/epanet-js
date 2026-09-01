let enabled = false;

export const configureLongLivedWorkers = (value: boolean): void => {
  enabled = value;
};

export const areLongLivedWorkersEnabled = (): boolean => enabled;

export const resetLongLivedWorkersForTest = (): void => {
  enabled = false;
};
