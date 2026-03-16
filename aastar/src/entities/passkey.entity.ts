import { Entity, Column, PrimaryColumn, CreateDateColumn, ManyToOne, JoinColumn } from "typeorm";
import type { User } from "./user.entity";

/**
 * @deprecated Passkey credentials are now stored in KMS.
 * This entity is kept for backward compatibility with existing data.
 * No new records should be written to this table.
 */
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

  // String ref to break circular import (ox/SWC compat)
  @ManyToOne("User", "passkeys")
  @JoinColumn({ name: "userId" })
  user: User;
}
