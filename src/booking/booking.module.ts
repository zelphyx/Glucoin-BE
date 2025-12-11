import { Module, forwardRef } from '@nestjs/common';
import { BookingService } from './booking.service';
import { BookingController } from './booking.controller';
import { PrismaService } from '../prisma.service';
import { PaymentModule } from '../payment/payment.module';

@Module({
  imports: [forwardRef(() => PaymentModule)],
  controllers: [BookingController],
  providers: [BookingService, PrismaService],
  exports: [BookingService],
})
export class BookingModule {}
