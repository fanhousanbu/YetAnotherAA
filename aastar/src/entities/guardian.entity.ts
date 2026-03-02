import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
} from "typeorm";

export type GuardianStatus = "pending" | "active" | "revoked";

@Entity("guardians")
export class Guardian {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column()
  accountAddress: string;

  @Column()
  guardianAddress: string;

  @Column({ default: "pending" })
  status: GuardianStatus;

  @CreateDateColumn()
  createdAt: Date;

  @Column({ nullable: true })
  revokedAt: Date;
}
