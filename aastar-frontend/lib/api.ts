import axios from "axios";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000/api/v1";

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

// Request interceptor to add auth token
api.interceptors.request.use(config => {
  const token = localStorage.getItem("token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor for error handling
api.interceptors.response.use(
  response => response,
  error => {
    if (error.response?.status === 401) {
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      window.location.href = "/auth/login";
    }
    return Promise.reject(error);
  }
);

// Auth API
export const authAPI = {
  register: (data: { email: string; password: string; username?: string }) =>
    api.post("/auth/register", data),

  login: (data: { email: string; password: string }) => api.post("/auth/login", data),

  getProfile: () => api.get("/auth/profile"),

  // Passkey registration
  beginPasskeyRegistration: (data: { email: string; username?: string; password: string }) =>
    api.post("/auth/passkey/register/begin", data),

  completePasskeyRegistration: (data: {
    email: string;
    username?: string;
    password: string;
    credential: any;
  }) => api.post("/auth/passkey/register/complete", data),

  // Passkey login
  beginPasskeyLogin: () => api.post("/auth/passkey/login/begin"),

  completePasskeyLogin: (data: { credential: any }) =>
    api.post("/auth/passkey/login/complete", data),

  // Device passkey registration
  beginDevicePasskeyRegistration: (data: { email: string; password: string }) =>
    api.post("/auth/device/passkey/begin", data),

  completeDevicePasskeyRegistration: (data: { email: string; password: string; credential: any }) =>
    api.post("/auth/device/passkey/complete", data),
};

// Account API
export const accountAPI = {
  create: (data: { deploy?: boolean; fundAmount?: string; salt?: number }) =>
    api.post("/account/create", data),

  getAccount: () => api.get("/account"),

  getBalance: () => api.get("/account/balance"),

  getNonce: () => api.get("/account/nonce"),

  fundAccount: (data: { amount: string }) => api.post("/account/fund", data),

  sponsorAccount: () => api.post("/account/sponsor"),
};

// Transfer API
export const transferAPI = {
  execute: (data: { 
    to: string; 
    amount: string; 
    data?: string; 
    nodeIndices?: number[];
    usePaymaster?: boolean;
    paymasterAddress?: string;
    paymasterData?: string;
    tokenAddress?: string;
  }) =>
    api.post("/transfer/execute", data),

  estimate: (data: { 
    to: string; 
    amount: string; 
    data?: string; 
    nodeIndices?: number[];
    usePaymaster?: boolean;
    tokenAddress?: string;
  }) =>
    api.post("/transfer/estimate", data),

  getStatus: (id: string) => api.get(`/transfer/status/${id}`),

  getHistory: (page: number = 1, limit: number = 10) =>
    api.get(`/transfer/history?page=${page}&limit=${limit}`),
};

// BLS API
export const blsAPI = {
  getNodes: () => api.get("/bls/nodes"),

  generateSignature: (data: { userOpHash: string; nodeIndices?: number[] }) =>
    api.post("/bls/sign", data),
};

// Paymaster API
export const paymasterAPI = {
  getAvailable: () => api.get("/paymaster/available"),

  sponsor: (data: { 
    paymasterName: string; 
    userOp: any; 
    entryPoint?: string;
  }) =>
    api.post("/paymaster/sponsor", data),
};

// Token API
export const tokenAPI = {
  getPresetTokens: () => api.get("/tokens/preset"),
  
  getTokenInfo: (address: string) => api.get(`/tokens/info/${address}`),
  
  validateToken: (data: { address: string }) =>
    api.post("/tokens/validate", data),
  
  getTokenBalance: (address: string) => api.get(`/tokens/balance/${address}`),
  
  getAllTokenBalances: (accountAddress?: string) => {
    const params = accountAddress ? { address: accountAddress } : {};
    return api.get("/tokens/balances", { params });
  },
};

export default api;
