import { YAAAClient } from "@yaaa/sdk";
import { KmsClient } from "./kms-client";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000/api/v1";
// In the browser, KMS calls are proxied through Next.js to avoid CORS issues.
// The proxy is configured in next.config.ts: /kms-api/* → KMS_PROXY_URL/*
const KMS_URL =
  typeof window !== "undefined"
    ? "/kms-api" // browser: use Next.js proxy
    : process.env.NEXT_PUBLIC_KMS_URL || "https://kms1.aastar.io";
const KMS_API_KEY = process.env.NEXT_PUBLIC_KMS_API_KEY || undefined;

export const yaaa = new YAAAClient({
  apiURL: API_BASE_URL,
  tokenProvider: () => {
    if (typeof window === "undefined") return null;
    return localStorage.getItem("token");
  },
  bls: {
    // These should ideally come from backend config or env
    seedNodes: [
      process.env.NEXT_PUBLIC_BLS_SEED_NODE || "https://yetanotheraa-validator.onrender.com",
    ],
  },
});

export const kmsClient = new KmsClient(KMS_URL, KMS_API_KEY);
