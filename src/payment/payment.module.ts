import { Module, forwardRef } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PaymentService } from './payment.service';
import { PaymentController } from './payment.controller';
import { PaymentRedirectController } from './payment-redirect.controller';
import { MidtransService } from './midtrans.service';
import { PrismaService } from '../prisma.service';
import { BookingModule } from '../booking/booking.module';

@Module({
  imports: [ConfigModule, forwardRef(() => BookingModule)],
  controllers: [PaymentController, PaymentRedirectController],
  providers: [PaymentService, MidtransService, PrismaService],
  exports: [PaymentService, MidtransService],
})
export class PaymentModule {}
