import type { CondoState } from "./condo";

export type CondoAccess =
  | { role: "syndic"; ownerId: number }
  | { role: "resident"; ownerId: number; unitId: string }
  | { role: "unlinked"; ownerId: null };

export type CondoReadResponse = {
  state: CondoState;
  revision: number;
  access: CondoAccess;
};

export const RESIDENT_INVITE_TOKEN_PATTERN = /^[a-f0-9]{64}$/;
export const RESIDENT_INVITE_VALIDITY_DAYS = 7;
