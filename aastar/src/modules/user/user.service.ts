import { Injectable, NotFoundException } from '@nestjs/common';
import { StorageService } from '../storage/storage.service';
import { User } from '../../interfaces/user.interface';
import { UserInfoDto } from './dto/user.dto';

@Injectable()
export class UserService {
  constructor(private storageService: StorageService) {}

  async getUserInfo(userId: string): Promise<UserInfoDto> {
    const user = await this.storageService.getUserById(userId);
    
    if (!user) {
      throw new NotFoundException('User not found');
    }

    return {
      id: user.id,
      email: user.email,
      credentialCount: user.passkeyCredentials?.length || 0,
      createdAt: user.createdAt,
    };
  }

  async updateUser(userId: string, updateData: Partial<User>): Promise<void> {
    const user = await this.storageService.getUserById(userId);
    
    if (!user) {
      throw new NotFoundException('User not found');
    }

    await this.storageService.updateUser(userId, updateData);
  }

  async addPasskeyCredential(userId: string, credential: any): Promise<void> {
    const user = await this.storageService.getUserById(userId);
    
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const updatedCredentials = [...(user.passkeyCredentials || []), credential];
    await this.storageService.updateUser(userId, {
      passkeyCredentials: updatedCredentials,
    });
  }

  async removePasskeyCredential(userId: string, credentialId: string): Promise<void> {
    const user = await this.storageService.getUserById(userId);
    
    if (!user) {
      throw new NotFoundException('User not found');
    }

    const updatedCredentials = user.passkeyCredentials?.filter(
      cred => cred.id !== credentialId
    ) || [];

    await this.storageService.updateUser(userId, {
      passkeyCredentials: updatedCredentials,
    });
  }
}