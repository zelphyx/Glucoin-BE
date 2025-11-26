import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '@glucoin/prisma';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';

@Injectable()
// 👇 Pastikan extends PrismaClient yang dari import di atas
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {

  constructor() {
    const connectionString = process.env.DATABASE_URL!;
    const pool = new Pool({ connectionString });
    // Prisma 7 logic: Adapter di-pass ke super
    const adapter = new PrismaPg(pool);

    super({ adapter });
  }

  async onModuleInit() {
    // Kalau import bener, $connect pasti ada
    await this.$connect();
  }

  async onModuleDestroy() {
    await this.$disconnect();
  }
}