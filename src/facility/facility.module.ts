import { Module } from '@nestjs/common';
import { FacilityController } from './facility.controller';
import { FacilityService } from './facility.service';
import { PrismaService } from '../prisma.service';

@Module({
  controllers: [FacilityController],
  providers: [FacilityService, PrismaService],
  exports: [FacilityService],
})
export class FacilityModule {}
