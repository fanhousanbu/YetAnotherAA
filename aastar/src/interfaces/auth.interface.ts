export interface ChallengeData {
  id: string;
  challenge: string;
  email: string;
  type: 'registration' | 'authentication';
  expiresAt: Date;
  createdAt: Date;
}

export interface EmailVerification {
  email: string;
  code: string;
  verified: boolean;
  expiresAt: Date;
  createdAt: Date;
}

export interface AuthResponse {
  success: boolean;
  userId?: string;
  accessToken?: string;
  walletAddress?: string;
  message?: string;
}