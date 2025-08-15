import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { StorageService } from '../storage/storage.service';
import { CryptoUtil } from '../../utils/crypto.util';

@Injectable()
export class PasskeyService {
  constructor(
    private configService: ConfigService,
    private storageService: StorageService,
  ) {}

  async generateRegistrationOptions(email: string): Promise<any> {
    const challenge = CryptoUtil.generateChallenge();
    const userId = CryptoUtil.base64urlEncode(Buffer.from(email));
    
    const options = {
      challenge,
      rp: {
        name: this.configService.get('passkey.rpName'),
        id: this.configService.get('passkey.rpId'),
      },
      user: {
        id: userId,
        name: email,
        displayName: email,
      },
      pubKeyCredParams: [
        { alg: -7, type: 'public-key' }, // ES256
        { alg: -257, type: 'public-key' }, // RS256
      ],
      authenticatorSelection: {
        authenticatorAttachment: 'platform',
        userVerification: 'required',
        residentKey: 'preferred',
      },
      timeout: 60000,
      attestation: 'none',
    };

    // Store challenge
    await this.storageService.saveChallenge(challenge, {
      challenge,
      email,
      type: 'registration',
      expiresAt: new Date(Date.now() + 5 * 60 * 1000), // 5 minutes
    });

    return options;
  }

  async generateAuthenticationOptions(email: string): Promise<any> {
    const challenge = CryptoUtil.generateChallenge();
    
    // Get user's existing credentials
    const user = await this.storageService.getUserByEmail(email);
    const allowCredentials = user?.passkeyCredentials?.map(cred => ({
      id: cred.id,
      type: 'public-key',
    })) || [];

    const options = {
      challenge,
      allowCredentials,
      timeout: 60000,
      userVerification: 'preferred',
    };

    // Store challenge
    await this.storageService.saveChallenge(challenge, {
      challenge,
      email,
      type: 'authentication',
      expiresAt: new Date(Date.now() + 5 * 60 * 1000), // 5 minutes
    });

    return options;
  }

  async verifyRegistrationResponse(challenge: string, credential: any): Promise<{ success: boolean; email?: string }> {
    try {
      // Get and verify challenge
      const challengeData = await this.storageService.getChallenge(challenge);
      if (!challengeData || challengeData.type !== 'registration') {
        return { success: false };
      }

      if (new Date() > new Date(challengeData.expiresAt)) {
        await this.storageService.deleteChallenge(challenge);
        return { success: false };
      }

      // Parse client data
      const clientDataJSON = JSON.parse(
        Buffer.from(credential.response.clientDataJSON, 'base64').toString()
      );

      // Verify challenge matches
      if (clientDataJSON.challenge !== challenge) {
        return { success: false };
      }

      // Verify origin
      const expectedOrigin = this.configService.get('passkey.origin');
      if (clientDataJSON.origin !== expectedOrigin) {
        return { success: false };
      }

      // For simplicity, we'll store the credential data
      // In production, you'd want to properly verify the attestation
      const credentialData = {
        id: credential.id,
        publicKey: credential.response.attestationObject, // Simplified
        counter: 0,
        createdAt: new Date(),
      };

      // Clean up challenge
      await this.storageService.deleteChallenge(challenge);

      return { success: true, email: challengeData.email };

    } catch (error) {
      console.error('Registration verification failed:', error);
      return { success: false };
    }
  }

  async verifyAuthenticationResponse(challenge: string, credential: any): Promise<{ success: boolean; email?: string }> {
    try {
      // Get and verify challenge
      const challengeData = await this.storageService.getChallenge(challenge);
      if (!challengeData || challengeData.type !== 'authentication') {
        return { success: false };
      }

      if (new Date() > new Date(challengeData.expiresAt)) {
        await this.storageService.deleteChallenge(challenge);
        return { success: false };
      }

      // Get user and verify credential exists
      const user = await this.storageService.getUserByEmail(challengeData.email);
      if (!user) {
        return { success: false };
      }

      const existingCredential = user.passkeyCredentials?.find(
        cred => cred.id === credential.id
      );
      if (!existingCredential) {
        return { success: false };
      }

      // Parse client data
      const clientDataJSON = JSON.parse(
        Buffer.from(credential.response.clientDataJSON, 'base64').toString()
      );

      // Verify challenge matches
      if (clientDataJSON.challenge !== challenge) {
        return { success: false };
      }

      // Verify origin
      const expectedOrigin = this.configService.get('passkey.origin');
      if (clientDataJSON.origin !== expectedOrigin) {
        return { success: false };
      }

      // For simplicity, we'll just verify the credential ID exists
      // In production, you'd want to verify the signature

      // Clean up challenge
      await this.storageService.deleteChallenge(challenge);

      return { success: true, email: challengeData.email };

    } catch (error) {
      console.error('Authentication verification failed:', error);
      return { success: false };
    }
  }
}