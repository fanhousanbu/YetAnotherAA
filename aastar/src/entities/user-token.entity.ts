import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  ManyToOne,
  CreateDateColumn,
  Index,
} from "typeorm";
import { User } from "./user.entity";

@Entity("user_tokens")
@Index(["userId", "address"], { unique: true }) // Prevent duplicate tokens per user
export class UserToken {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column()
  userId: string;

  @Column()
  address: string;

  @Column()
  symbol: string;

  @Column()
  name: string;

  @Column()
  decimals: number;

  @Column({ nullable: true })
  logoUrl: string;

  @Column({ default: false })
  isCustom: boolean;

  @Column({ nullable: true })
  chainId: number;

  @Column({ default: true })
  isActive: boolean; // User can hide/show tokens without deleting

  @Column({ default: 0 })
  sortOrder: number; // Custom sorting order for user

  @CreateDateColumn()
  createdAt: Date | string;

  @ManyToOne(() => User, user => user.userTokens)
  user: User;
}
