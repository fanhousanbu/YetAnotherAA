import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from "typeorm";
import { User } from "./user.entity";

@Entity("accounts")
export class Account {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column()
  userId: string;

  @Column()
  address: string;

  @Column()
  ownerAddress: string;

  @Column()
  salt: number;

  @Column({ default: false })
  deployed: boolean;

  @Column({ nullable: true })
  deploymentTxHash: string;

  @Column()
  validatorAddress: string;

  @CreateDateColumn()
  createdAt: Date;

  @ManyToOne(() => User, user => user.accounts)
  @JoinColumn({ name: "userId" })
  user: User;
}
