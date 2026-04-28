import { atom } from "jotai";
import { unwrap } from "jotai/utils";
import { isOPFSAvailable } from "src/infra/storage";

const opfsAvailableAsyncAtom = atom(isOPFSAvailable);
export const opfsAvailableAtom = unwrap(opfsAvailableAsyncAtom, () => true);
