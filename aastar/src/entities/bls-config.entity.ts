import { Entity, Column, PrimaryGeneratedColumn, UpdateDateColumn } from "typeorm";

@Entity("bls_config")
export class BlsConfig {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ type: "jsonb" })
  signerNodes: {
    nodes: any[];
    totalNodes: number;
    activeNodes: number;
    lastUpdated?: string;
  };

  @Column({ type: "jsonb", nullable: true })
  discovery: {
    seedNodes: any[];
    fallbackEndpoints: any[];
  };

  @UpdateDateColumn()
  lastUpdated: Date;
}
