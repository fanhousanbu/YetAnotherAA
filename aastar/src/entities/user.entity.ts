import { Entity, Column, PrimaryColumn, CreateDateColumn, OneToMany } from "typeorm";
import { Account } from "./account.entity";
import { Transfer } from "./transfer.entity";
import { Passkey } from "./passkey.entity";
import { UserToken } from "./user-token.entity";
import { UserNFT } from "./user-nft.entity";

@Entity("users")
export class User {
  @PrimaryColumn()
  id: string;

  @Column({ unique: true })
  email: string;

  @Column()
  username: string;

  @Column()
  password: string;

  @Column()
  walletAddress: string;

  @Column({ nullable: true })
  encryptedPrivateKey?: string;

  @Column({ nullable: true })
  mnemonic?: string;

  @Column({ nullable: true })
  kmsKeyId?: string;

  @Column({ default: false })
  useKms: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @OneToMany(() => Account, account => account.user)
  accounts: Account[];

  @OneToMany(() => Transfer, transfer => transfer.user)
  transfers: Transfer[];

  @OneToMany(() => Passkey, passkey => passkey.user)
  passkeys: Passkey[];

  @OneToMany(() => UserToken, userToken => userToken.user)
  userTokens: UserToken[];

  @OneToMany(() => UserNFT, userNFT => userNFT.user)
  userNFTs: UserNFT[];
}
