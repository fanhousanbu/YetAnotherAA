import { Entity, Column, PrimaryColumn, CreateDateColumn, ManyToOne, JoinColumn } from "typeorm";
import type { User } from "./user.entity";

@Entity("transfers")
export class Transfer {
  @PrimaryColumn()
  id: string;

  @Column()
  userId: string;

  @Column({ type: "jsonb", nullable: true })
  transferData: any;

  @CreateDateColumn()
  createdAt: Date;

  // String ref to break circular import (ox/SWC compat)
  @ManyToOne("User", "transfers")
  @JoinColumn({ name: "userId" })
  user: User;
}
