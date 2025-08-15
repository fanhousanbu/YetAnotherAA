export interface User {
  id: string;
  email: string;
  passkeyCredentials: PasskeyCredential[];
  createdAt: Date;
  updatedAt: Date;
}

export interface PasskeyCredential {
  id: string;
  publicKey: string;
  counter: number;
  createdAt: Date;
}

export interface UserSession {
  id: string;
  userId: string;
  email: string;
  accessToken: string;
  expiresAt: Date;
  createdAt: Date;
}