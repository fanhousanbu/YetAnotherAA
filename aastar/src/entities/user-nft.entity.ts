import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  ManyToOne,
  CreateDateColumn,
  Index,
} from "typeorm";
import { User } from "./user.entity";

export enum NFTStandard {
  ERC721 = "ERC721",
  ERC1155 = "ERC1155",
}

@Entity("user_nfts")
@Index(["userId", "contractAddress", "tokenId"], { unique: true })
export class UserNFT {
  @PrimaryGeneratedColumn("uuid")
  id: string;

  @Column()
  userId: string;

  @Column()
  contractAddress: string;

  @Column()
  tokenId: string;

  @Column()
  name: string;

  @Column({ nullable: true })
  description: string;

  @Column({ nullable: true })
  imageUrl: string;

  @Column({ nullable: true })
  collectionName: string;

  @Column({
    type: "enum",
    enum: NFTStandard,
    default: NFTStandard.ERC721,
  })
  standard: NFTStandard;

  @Column({ nullable: true })
  amount: number; // For ERC1155

  @Column({ nullable: true })
  chainId: number;

  @Column({ default: true })
  isActive: boolean;

  @Column({ nullable: true, type: "jsonb" })
  metadata: Record<string, any>; // Store raw metadata

  @CreateDateColumn()
  createdAt: Date | string;

  @ManyToOne(() => User, user => user.userNFTs)
  user: User;
}
