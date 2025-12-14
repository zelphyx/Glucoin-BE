// src/app.module.ts
import { Module } from '@nestjs/common';
// @ts-ignore
import { ConfigModule } from '@nestjs/config';
import { ScheduleModule } from '@nestjs/schedule';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthModule } from './auth/auth.module';
import { DoctorsModule } from './doctors/doctors.module';
import { BookingModule } from './booking/booking.module';
import { PaymentModule } from './payment/payment.module';
import { MarketplaceModule } from './marketplace/marketplace.module';
import { FacilityModule } from './facility/facility.module';
import { ReminderModule } from './reminder/reminder.module';
import { ChatModule } from './chat/chat.module';
import { DetectionModule } from './detection/detection.module';
import { LabResultModule } from './lab-result/lab-result.module';
import { DailyTaskModule } from './daily-task/daily-task.module';
import { PrismaService } from './prisma.service';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    ScheduleModule.forRoot(),
    AuthModule,
    DoctorsModule,
    BookingModule,
    PaymentModule,
    MarketplaceModule,
    FacilityModule,
    ReminderModule,
    ChatModule,
    DetectionModule,
    LabResultModule,
    DailyTaskModule,
  ],
  controllers: [AppController],
  providers: [AppService, PrismaService],
})
export class AppModule {}
