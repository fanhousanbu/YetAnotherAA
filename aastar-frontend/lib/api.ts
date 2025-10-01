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

  // Transaction verification
  beginTransactionVerification: () => api.post("/auth/transaction/verify/begin"),

  completeTransactionVerification: (credential: any) =>
    api.post("/auth/transaction/verify/complete", { credential }),
};

// Account API
export const accountAPI = {
  create: (data: {
    deploy?: boolean;
    fundAmount?: string;
    salt?: number;
    entryPointVersion?: string;
  }) => api.post("/account/create", data),

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
    passkeyCredential: any;
  }) => api.post("/transfer/execute", data),

  estimate: (data: {
    to: string;
    amount: string;
    data?: string;
    nodeIndices?: number[];
    usePaymaster?: boolean;
    tokenAddress?: string;
  }) => api.post("/transfer/estimate", data),

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

  sponsor: (data: { paymasterName: string; userOp: any; entryPoint?: string }) =>
    api.post("/paymaster/sponsor", data),

  addCustom: (data: {
    name: string;
    address: string;
    type?: "pimlico" | "stackup" | "alchemy" | "custom";
    apiKey?: string;
    endpoint?: string;
  }) => api.post("/paymaster/add", data),

  remove: (name: string) => api.delete(`/paymaster/${name}`),
};

// Token API
export const tokenAPI = {
  getPresetTokens: () => api.get("/tokens/preset"),

  getTokenInfo: (address: string) => api.get(`/tokens/info/${address}`),

  validateToken: (data: { address: string }) => api.post("/tokens/validate", data),

  getTokenBalance: (address: string) => api.get(`/tokens/balance/${address}`),

  getTokenBalances: (accountAddress?: string) => {
    const params = accountAddress ? { address: accountAddress } : {};
    return api.get("/tokens/balances", { params });
  },

  getAllTokenBalances: (accountAddress?: string) => {
    const params = accountAddress ? { address: accountAddress } : {};
    return api.get("/tokens/balances", { params });
  },

  getNonZeroBalances: () => api.get("/tokens/balances/non-zero"),

  getTokenStats: () => api.get("/tokens/stats"),

  searchTokens: (params: { query?: string; customOnly?: boolean }) =>
    api.get("/tokens/search", { params }),
};

// User Token API
export const userTokenAPI = {
  getUserTokens: (params?: { activeOnly?: boolean; withBalances?: boolean }) =>
    api.get("/user-tokens", { params }),

  addUserToken: (data: {
    address: string;
    symbol?: string;
    name?: string;
    decimals?: number;
    logoUrl?: string;
  }) => api.post("/user-tokens", data),

  updateUserToken: (
    tokenId: string,
    data: {
      isActive?: boolean;
      sortOrder?: number;
      logoUrl?: string;
    }
  ) => api.put(`/user-tokens/${tokenId}`, data),

  removeUserToken: (tokenId: string) => api.delete(`/user-tokens/${tokenId}`),

  deleteUserToken: (tokenId: string) => api.delete(`/user-tokens/${tokenId}/permanent`),

  searchUserTokens: (params: { query?: string; customOnly?: boolean; activeOnly?: boolean }) =>
    api.get("/user-tokens/search", { params }),

  initializeDefaultTokens: () => api.post("/user-tokens/initialize-defaults"),

  updateTokensOrder: (tokenOrders: { tokenId: string; sortOrder: number }[]) =>
    api.put("/user-tokens/reorder", { tokenOrders }),
};

export const addressBookAPI = {
  getAddressBook: () => api.get("/address-book"),
  setAddressName: (address: string, name: string) =>
    api.post("/address-book/name", { address, name }),
  removeAddress: (address: string) => api.delete(`/address-book/${address}`),
  searchAddresses: (query: string) => api.get("/address-book/search", { params: { q: query } }),
};

export default api;
