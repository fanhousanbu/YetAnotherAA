import { Entity, Column, PrimaryColumn, CreateDateColumn, ManyToOne, JoinColumn } from "typeorm";
import { User } from "./user.entity";

@Entity("passkeys")
export class Passkey {
  @PrimaryColumn()
  credentialId: string;

  @Column()
  userId: string;

  @Column({ type: "jsonb", nullable: true })
  passkeyData: any;

  @CreateDateColumn()
  createdAt: Date;

  @ManyToOne(() => User, user => user.passkeys)
  @JoinColumn({ name: "userId" })
  user: User;
}
