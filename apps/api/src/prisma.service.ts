import { Injectable, OnModuleInit } from "@nestjs/common";
import { PrismaClient } from "@prisma/client";

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit {
  async onModuleInit() {
    try {
      await this.$connect();
      console.log("Connected to Prisma database successfully");
    } catch (e) {
      console.warn("Prisma database connection failed (using fallback/offline mode):", e);
    }
  }
}
