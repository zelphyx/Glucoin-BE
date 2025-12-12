import { Module } from '@nestjs/common';
import { MarketplaceController } from './marketplace.controller';
import { MarketplaceService } from './marketplace.service';
import { PrismaService } from '../prisma.service';
import { MidtransService } from '../payment/midtrans.service';

@Module({
  controllers: [MarketplaceController],
  providers: [MarketplaceService, PrismaService, MidtransService],
  exports: [MarketplaceService],
})
export class MarketplaceModule {}
