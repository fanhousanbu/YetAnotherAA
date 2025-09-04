import { Module, DynamicModule, Global } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { ConfigModule, ConfigService } from "@nestjs/config";
import { DatabaseService } from "./database.service";
import { JsonAdapter } from "./adapters/json.adapter";
import { PostgresAdapter } from "./adapters/postgres.adapter";
import { User, Account, Transfer, Passkey, BlsConfig } from "../entities";

@Global()
@Module({})
export class DatabaseModule {
  static forRoot(): DynamicModule {
    return {
      module: DatabaseModule,
      imports: [
        ConfigModule,
        TypeOrmModule.forRootAsync({
          imports: [ConfigModule],
          useFactory: async (configService: ConfigService) => {
            const dbType = configService.get<string>("DB_TYPE", "json");

            if (dbType === "postgres") {
              return {
                type: "postgres",
                host: configService.get<string>("DB_HOST", "localhost"),
                port: configService.get<number>("DB_PORT", 5432),
                username: configService.get<string>("DB_USERNAME", "postgres"),
                password: configService.get<string>("DB_PASSWORD", ""),
                database: configService.get<string>("DB_NAME", "aastar"),
                entities: [User, Account, Transfer, Passkey, BlsConfig],
                synchronize: true, // Auto-create tables
                logging: configService.get<string>("NODE_ENV") === "development",
                ssl: {
                  rejectUnauthorized: false, // For self-signed certificates
                },
                extra: {
                  ssl: configService.get<boolean>("PGSSLMODE", false),
                },
              };
            }

            // Return null for JSON mode - no TypeORM connection needed
            return null;
          },
          inject: [ConfigService],
        }),
        TypeOrmModule.forFeature([User, Account, Transfer, Passkey, BlsConfig]),
      ],
      providers: [
        {
          provide: DatabaseService,
          useFactory: (
            configService: ConfigService,
            jsonAdapter: JsonAdapter,
            postgresAdapter?: PostgresAdapter
          ) => {
            return new DatabaseService(configService, jsonAdapter, postgresAdapter);
          },
          inject: [ConfigService, JsonAdapter, { token: PostgresAdapter, optional: true }],
        },
        JsonAdapter,
        ...(process.env.DB_TYPE === "postgres" ? [PostgresAdapter] : []),
      ],
      exports: [DatabaseService],
    };
  }
}
