import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { GraphQLModule } from '@nestjs/graphql';
import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import { ThrottlerModule } from '@nestjs/throttler';
import { BullModule } from '@nestjs/bull';
import { join } from 'path';
import { PrismaModule } from './common/prisma/prisma.module';
import { AuthModule } from './modules/auth/auth.module';
import { CompaniesModule } from './modules/companies/companies.module';
import { AccountsModule } from './modules/accounts/accounts.module';
import { JournalModule } from './modules/journal/journal.module';
import { LedgerModule } from './modules/ledger/ledger.module';
import { ArModule } from './modules/ar/ar.module';
import { ApModule } from './modules/ap/ap.module';
import { StatementsModule } from './modules/statements/statements.module';
import { ProcurementModule } from './modules/procurement/procurement.module';
import { InventoryModule } from './modules/inventory/inventory.module';
import { AssetsModule } from './modules/assets/assets.module';
import { PayrollModule } from './modules/payroll/payroll.module';
import { ExpensesModule } from './modules/expenses/expenses.module';
import { BankingModule } from './modules/banking/banking.module';
import { ReportingModule } from './modules/reporting/reporting.module';
import { IntegrationsModule } from './modules/integrations/integrations.module';
import { DocumentsModule } from './modules/documents/documents.module';
import { CurrenciesModule } from './modules/currencies/currencies.module';
import { TaxModule } from './modules/tax/tax.module';
import { PeriodsModule } from './modules/periods/periods.module';
import { NotificationsModule } from './modules/notifications/notifications.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, envFilePath: '.env' }),

    GraphQLModule.forRootAsync<ApolloDriverConfig>({
      driver: ApolloDriver,
      useFactory: () => ({
        autoSchemaFile: join(process.cwd(), 'src/schema.gql'),
        sortSchema: true,
        playground: process.env.NODE_ENV !== 'production',
        context: ({ req, res }: { req: unknown; res: unknown }) => ({ req, res }),
      }),
    }),

    ThrottlerModule.forRoot([{ ttl: 60000, limit: 100 }]),

    BullModule.forRootAsync({
      useFactory: (configService: ConfigService) => ({
        redis: configService.get<string>('REDIS_URL', 'redis://localhost:6379'),
      }),
      inject: [ConfigService],
    }),

    PrismaModule,
    AuthModule,
    CompaniesModule,
    AccountsModule,
    JournalModule,
    LedgerModule,
    ArModule,
    ApModule,
    StatementsModule,
    ProcurementModule,
    InventoryModule,
    AssetsModule,
    PayrollModule,
    ExpensesModule,
    BankingModule,
    ReportingModule,
    IntegrationsModule,
    DocumentsModule,
    CurrenciesModule,
    TaxModule,
    PeriodsModule,
    NotificationsModule,
  ],
})
export class AppModule {}
