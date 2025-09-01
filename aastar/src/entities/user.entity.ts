import { Entity, Column, PrimaryColumn, CreateDateColumn, OneToMany } from "typeorm";
import { Account } from "./account.entity";
import { Transfer } from "./transfer.entity";
import { Passkey } from "./passkey.entity";

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

  @Column()
  encryptedPrivateKey: string;

  @Column()
  mnemonic: string;

  @CreateDateColumn()
  createdAt: Date;

  @OneToMany(() => Account, account => account.user)
  accounts: Account[];

  @OneToMany(() => Transfer, transfer => transfer.user)
  transfers: Transfer[];

  @OneToMany(() => Passkey, passkey => passkey.user)
  passkeys: Passkey[];
}
