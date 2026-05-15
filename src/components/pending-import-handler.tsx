"use client";

import { useContext, useEffect, useRef } from "react";
import { useImportInp } from "src/commands/import-inp";
import { FileWithHandle } from "browser-fs-access";
import { MapContext } from "src/map";

const DB_NAME = "epanet-imports";
const STORE = "pending";

type PendingEntry = {
  content: string;
  name: string;
  source?: string;
  createdAt: number;
};

export function PendingImportHandler() {
  const importInp = useImportInp();
  const map = useContext(MapContext);
  const hasRunRef = useRef(false);

  useEffect(() => {
    if (hasRunRef.current) return;
    if (!map) return;
    const params = new URLSearchParams(window.location.search);
    const token = params.get("import");
    if (!token) return;

    hasRunRef.current = true;
    history.replaceState({}, "", window.location.pathname);

    void (async () => {
      const entry = await idbGetAndDelete(token);
      if (!entry) return;
      const file = new File([entry.content], entry.name, {
        type: "text/plain",
      }) as FileWithHandle;
      await importInp([file], entry.source ?? "service-worker");
    })();
  }, [importInp, map]);

  return null;
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function idbGetAndDelete(
  key: string,
): Promise<PendingEntry | undefined> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    const store = tx.objectStore(STORE);
    const getReq = store.get(key);
    let value: PendingEntry | undefined;
    getReq.onsuccess = () => {
      value = getReq.result as PendingEntry | undefined;
      if (value) store.delete(key);
    };
    tx.oncomplete = () => resolve(value);
    tx.onerror = () => reject(tx.error);
  });
}
