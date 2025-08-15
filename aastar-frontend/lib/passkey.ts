// Passkey 工具函数
export interface PasskeyCredential {
  id: string;
  type: string;
  rawId: ArrayBuffer;
  response: {
    clientDataJSON: ArrayBuffer;
    attestationObject: ArrayBuffer;
  };
}

export interface PasskeyAssertion {
  id: string;
  type: string;
  rawId: ArrayBuffer;
  response: {
    clientDataJSON: ArrayBuffer;
    authenticatorData: ArrayBuffer;
    signature: ArrayBuffer;
    userHandle: ArrayBuffer;
  };
}

import { startAuthentication } from '@simplewebauthn/browser';
import type { PublicKeyCredentialRequestOptionsJSON } from '@simplewebauthn/types';

// 检查浏览器是否支持 Passkey
export function isPasskeySupported(): boolean {
  return window.PublicKeyCredential && 
         window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable &&
         typeof window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable === 'function';
}

// 检查浏览器是否支持 Passkey
export async function isPasskeyAvailable(): Promise<boolean> {
  if (!window.PublicKeyCredential) {
    return false;
  }

  return await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
}

// 检查用户是否可以使用 Passkey
export async function checkPasskeyAvailability(): Promise<boolean> {
  if (!isPasskeySupported()) {
    return false;
  }
  
  try {
    return await window.PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable();
  } catch (error) {
    console.error('检查 Passkey 可用性失败:', error);
    return false;
  }
}

// 生成随机挑战
export function generateChallenge(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return arrayBufferToBase64(array);
}

// ArrayBuffer 转 Base64
export function arrayBufferToBase64(buffer: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buffer)));
}

// Base64 转 ArrayBuffer
export function base64ToArrayBuffer(base64: string): ArrayBuffer {
  const binaryString = atob(base64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes.buffer;
}

// 创建 Passkey 凭证
export async function createPasskeyCredential(email: string, name: string): Promise<PublicKeyCredential> {
  const challenge = generateChallenge();
  
  const publicKeyCredentialCreationOptions: PublicKeyCredentialCreationOptions = {
    challenge: base64ToArrayBuffer(challenge),
    rp: {
      name: 'FrontDoor Demo',
      id: 'localhost'
    },
    user: {
      id: base64ToArrayBuffer(btoa(email)),
      name: email,
      displayName: name
    },
    pubKeyCredParams: [{
      type: 'public-key',
      alg: -7 // ES256
    }],
    timeout: 60000,
    attestation: 'none',
    authenticatorSelection: {
      authenticatorAttachment: 'platform',
      userVerification: 'preferred',
      residentKey: 'required'
    }
  };

  return await navigator.credentials.create({
    publicKey: publicKeyCredentialCreationOptions
  }) as PublicKeyCredential;
}

// 验证 Passkey 凭证
export async function verifyPasskeyCredential(options: PublicKeyCredentialRequestOptionsJSON) {
  return await startAuthentication({
    optionsJSON: options,
  });
} 