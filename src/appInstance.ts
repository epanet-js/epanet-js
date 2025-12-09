export const getAppId = () => {
  let id = sessionStorage.getItem("appInstanceId");

  if (id) return id;

  id = crypto.randomUUID();
  sessionStorage.setItem("appInstanceId", id);

  return id;
};
