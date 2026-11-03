import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { PrismaModule } from './prisma/prisma.module';
import { UsersModule } from './modules/users/users.module';
import { PaymentModule } from './modules/payment/payment.module';

@Module({
  imports: [PrismaModule, UsersModule, PaymentModule],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
