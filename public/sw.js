const DB_NAME = "epanet-imports";
const STORE = "pending";

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (e) => e.waitUntil(self.clients.claim()));

self.addEventListener("fetch", (event) => {
  const url = new URL(event.request.url);
  if (url.pathname === "/import" && event.request.method === "POST") {
    event.respondWith(handleImport(event.request));
  }
});

async function handleImport(request) {
  const formData = await request.formData();
  const file = formData.get("model");
  const name =
    formData.get("name") || (file && file.name) || "Untitled.inp";
  const source = formData.get("source") || "unknown";

  const content = typeof file === "string" ? file : await file.text();
  const token = crypto.randomUUID();

  await idbPut(token, { content, name, source, createdAt: Date.now() });

  const target = `/?import=${token}&name=${encodeURIComponent(
    name,
  )}&source=${encodeURIComponent(source)}`;
  return Response.redirect(target, 303);
}

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idbPut(key, value) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
