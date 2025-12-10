const APP_ID_KEY = "app-id";

export const getAppId = (): string => {
  let id = sessionStorage.getItem(APP_ID_KEY);
  if (!id) {
    id = crypto.randomUUID();
    sessionStorage.setItem(APP_ID_KEY, id);
  }
  return id;
};
