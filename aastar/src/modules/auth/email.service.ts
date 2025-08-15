import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import { StorageService } from '../storage/storage.service';
import { CryptoUtil } from '../../utils/crypto.util';

@Injectable()
export class EmailService {
  private transporter: nodemailer.Transporter;

  constructor(
    private configService: ConfigService,
    private storageService: StorageService,
  ) {
    const emailConfig = this.configService.get('email');
    
    // For development, use ethereal email (fake SMTP)
    // In production, configure with real SMTP settings
    this.transporter = nodemailer.createTransport({
      host: emailConfig?.smtp?.host || 'smtp.gmail.com',
      port: emailConfig?.smtp?.port || 587,
      secure: emailConfig?.smtp?.secure || false,
      auth: emailConfig?.smtp?.auth?.user ? {
        user: emailConfig.smtp.auth.user,
        pass: emailConfig.smtp.auth.pass,
      } : undefined,
    } as any);
  }

  async sendVerificationCode(email: string): Promise<{ success: boolean; message: string }> {
    try {
      // Generate 6-digit code
      const code = CryptoUtil.generateRandomCode(6);
      const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

      // Save verification data
      await this.storageService.saveEmailVerification(email, {
        code,
        verified: false,
        expiresAt,
      });

      // Send email
      const mailOptions = {
        from: this.configService.get('email.from'),
        to: email,
        subject: 'AA Wallet - Email Verification Code',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2 style="color: #333;">Email Verification</h2>
            <p>Your verification code is:</p>
            <div style="background: #f5f5f5; padding: 20px; text-align: center; margin: 20px 0;">
              <span style="font-size: 32px; font-weight: bold; letter-spacing: 5px; color: #007bff;">${code}</span>
            </div>
            <p>This code will expire in 10 minutes.</p>
            <p style="color: #666; font-size: 14px;">If you didn't request this code, please ignore this email.</p>
          </div>
        `,
      };

      // In development, just log the code instead of sending email
      if (process.env.NODE_ENV === 'development') {
        console.log(`📧 Verification code for ${email}: ${code}`);
        return { success: true, message: 'Verification code sent (check console in development)' };
      }

      await this.transporter.sendMail(mailOptions);
      return { success: true, message: 'Verification code sent successfully' };

    } catch (error) {
      console.error('Failed to send verification code:', error);
      return { success: false, message: 'Failed to send verification code' };
    }
  }

  async verifyCode(email: string, code: string): Promise<{ success: boolean; message: string }> {
    try {
      const verification = await this.storageService.getEmailVerification(email);
      
      if (!verification) {
        return { success: false, message: 'No verification code found for this email' };
      }

      if (verification.verified) {
        return { success: false, message: 'This code has already been used' };
      }

      if (new Date() > new Date(verification.expiresAt)) {
        await this.storageService.deleteEmailVerification(email);
        return { success: false, message: 'Verification code has expired' };
      }

      if (verification.code !== code) {
        return { success: false, message: 'Invalid verification code' };
      }

      // Mark as verified
      await this.storageService.saveEmailVerification(email, {
        ...verification,
        verified: true,
      });

      return { success: true, message: 'Email verified successfully' };

    } catch (error) {
      console.error('Failed to verify code:', error);
      return { success: false, message: 'Failed to verify code' };
    }
  }

  async isEmailVerified(email: string): Promise<boolean> {
    try {
      const verification = await this.storageService.getEmailVerification(email);
      return verification && verification.verified && new Date() <= new Date(verification.expiresAt);
    } catch {
      return false;
    }
  }

  async cleanupExpiredVerifications(): Promise<void> {
    // This would be implemented to clean up expired verifications
    // For now, we rely on manual cleanup or file-based expiration
  }
}