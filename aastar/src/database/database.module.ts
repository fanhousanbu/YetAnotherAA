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
    const dbType = process.env.DB_TYPE || "json";
    
    const imports: any[] = [ConfigModule];
    const providers: any[] = [JsonAdapter];
    
    // Only import TypeORM modules when using postgres
    if (dbType === "postgres") {
      imports.push(
        TypeOrmModule.forRootAsync({
          imports: [ConfigModule],
          useFactory: async (configService: ConfigService) => {
            const dbUrl = configService.get<string>("DATABASE_URL");
            
            // Support both DATABASE_URL and individual params for backward compatibility
            if (dbUrl) {
              return {
                type: "postgres",
                url: dbUrl,
                entities: [User, Account, Transfer, Passkey, BlsConfig],
                synchronize: true, // Auto-create tables
                logging: configService.get<string>("NODE_ENV") === "development",
                ssl: dbUrl.includes("sslmode=require") || dbUrl.includes("ssl=true") 
                  ? { rejectUnauthorized: false }
                  : undefined,
              };
            } else {
              // Fallback to individual params
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
                ssl: configService.get<string>("PGSSLMODE") === "true"
                  ? { rejectUnauthorized: false }
                  : undefined,
              };
            }
          },
          inject: [ConfigService],
        }),
        TypeOrmModule.forFeature([User, Account, Transfer, Passkey, BlsConfig])
      );
      providers.push(PostgresAdapter);
    }
    
    return {
      module: DatabaseModule,
      imports,
      providers: [
        ...providers,
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
      ],
      exports: [DatabaseService],
    };
  }
}
