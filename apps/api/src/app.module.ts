import { Module } from "@nestjs/common";
import { PlayersController } from "./players.controller";
import { CourtsController } from "./courts.controller";
import { SyncController } from "./sync.controller";
import { PrismaService } from "./prisma.service";
import { SocketService } from "./socket.service";

@Module({
  controllers: [PlayersController, CourtsController, SyncController],
  providers: [PrismaService, SocketService]
})
export class AppModule {}
