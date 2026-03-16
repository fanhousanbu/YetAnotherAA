import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from "typeorm";
import type { User } from "./user.entity";

@Entity("accounts")
export class Account {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column()
  userId: string;

  @Column()
  address: string;

  @Column()
  signerAddress: string; // Acts as both signer and creator in unified architecture

  @Column()
  salt: number;

  @Column({ default: false })
  deployed: boolean;

  @Column({ nullable: true })
  deploymentTxHash: string;

  @Column({ default: false })
  sponsored: boolean;

  @Column({ nullable: true })
  sponsorTxHash: string;

  @Column()
  validatorAddress: string;

  @Column({ default: "0.6" })
  entryPointVersion: string;

  @Column({ nullable: true })
  factoryAddress: string;

  @CreateDateColumn()
  createdAt: Date;

  // String ref to break circular import (ox/SWC compat)
  @ManyToOne("User", "accounts")
  @JoinColumn({ name: "userId" })
  user: User;
}
