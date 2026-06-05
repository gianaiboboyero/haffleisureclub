import { Controller, Get } from "@nestjs/common";
import { PrismaService } from "./prisma.service";

@Controller("courts")
export class CourtsController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async list() {
    try {
      const courts = await this.prisma.court.findMany({
        orderBy: { number: "asc" }
      });
      return {
        status: "success",
        count: courts.length,
        courts
      };
    } catch (e: any) {
      return {
        status: "error",
        message: "Failed to fetch courts from database",
        error: e.message
      };
    }
  }
}
