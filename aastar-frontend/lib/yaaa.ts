import { YAAAClient } from "@yaaa/sdk";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000/api/v1";

export const yaaa = new YAAAClient({
  apiURL: API_BASE_URL,
  tokenProvider: () => {
    if (typeof window === "undefined") return null;
    return localStorage.getItem("token");
  },
  bls: {
    // These should ideally come from backend config or env
    seedNodes: [
      process.env.NEXT_PUBLIC_BLS_SEED_NODE || "https://yetanotheraa-validator.onrender.com"
    ]
  }
});
