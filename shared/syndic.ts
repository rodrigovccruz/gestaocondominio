export const SYNDIC_USERNAME = "admin";
export const SYNDIC_LOGIN_PATH = "/sindico";
export type SyndicIdentity = {
  id: number;
  username: string;
  name: string;
  email: null;
};
export type SyndicSession = {
  ownerId: number;
  tokenHash: string;
  expiresAt: Date;
};
