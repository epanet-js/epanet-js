let enabled = false;
let fullOfflineSupport = false;

export const configureLongLivedWorkers = (value: boolean): void => {
  enabled = value;
};

export const areLongLivedWorkersEnabled = (): boolean => enabled;

export const configureFullOfflineSupport = (value: boolean): void => {
  fullOfflineSupport = value;
};

export const isFullOfflineSupportEnabled = (): boolean => fullOfflineSupport;

export const resetLongLivedWorkersForTest = (): void => {
  enabled = false;
  fullOfflineSupport = false;
};
