import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
} from "typeorm";

export type RecoveryStatus = "pending" | "executed" | "cancelled";

@Entity("recovery_requests")
export class RecoveryRequest {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column()
  accountAddress: string;

  @Column()
  newSignerAddress: string;

  @Column()
  initiatedBy: string; // guardian address that initiated

  @Column("simple-array", { default: "" })
  supporters: string[]; // guardian addresses that confirmed

  @Column({ default: "pending" })
  status: RecoveryStatus;

  @Column({ type: "bigint" })
  executeAfter: string; // unix timestamp (ms) after which recovery can be executed

  @CreateDateColumn()
  createdAt: Date;

  @Column({ nullable: true })
  executedAt: Date;
}
