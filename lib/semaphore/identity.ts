/**
 * Browser-side Semaphore identity helpers. Identity trapdoor/nullifier are persisted
 * in localStorage — if the user clears storage or switches browsers, they need a new
 * identity (and the issuer needs to re-add them). See plan notes on revocation.
 */
"use client";
import { Identity } from "@semaphore-protocol/identity";

const STORAGE_KEY = "zkrwa.identity.v1";

export function loadIdentity(): Identity | null {
  if (typeof window === "undefined") return null;
  const raw = window.localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    return Identity.import(raw);
  } catch {
    window.localStorage.removeItem(STORAGE_KEY);
    return null;
  }
}

export function createIdentity(): Identity {
  const id = new Identity();
  window.localStorage.setItem(STORAGE_KEY, id.export());
  return id;
}

export function clearIdentity(): void {
  window.localStorage.removeItem(STORAGE_KEY);
}

export function loadOrCreateIdentity(): Identity {
  return loadIdentity() ?? createIdentity();
}
