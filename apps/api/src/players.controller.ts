import { Controller, Get } from "@nestjs/common";
import { PrismaService } from "./prisma.service";

@Controller("players")
export class PlayersController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  async list() {
    try {
      const players = await this.prisma.player.findMany({
        orderBy: { displayName: "asc" }
      });
      return {
        status: "success",
        count: players.length,
        players
      };
    } catch (e: any) {
      return {
        status: "error",
        message: "Failed to fetch players from database",
        error: e.message
      };
    }
  }
}
