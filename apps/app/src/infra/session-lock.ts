const lockName = (appId: string): string => `epanet-session-${appId}`;

const getLockManager = (): LockManager | null =>
  typeof navigator !== "undefined" ? (navigator.locks ?? null) : null;

export const holdSessionLock = (appId: string): Promise<void> =>
  new Promise((resolveAcquired) => {
    const locks = getLockManager();
    if (!locks) return resolveAcquired();
    void locks
      .request(lockName(appId), () => {
        resolveAcquired();
        return new Promise(() => {});
      })
      .catch(() => resolveAcquired());
  });

export const isSessionAlive = async (appId: string): Promise<boolean> => {
  const locks = getLockManager();
  if (!locks) return false;
  try {
    return (await locks.request(
      lockName(appId),
      { ifAvailable: true },
      (lock) => lock === null,
    )) as boolean;
  } catch {
    return false;
  }
};
