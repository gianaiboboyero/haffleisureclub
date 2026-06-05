import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { AppModule } from "./app.module";
import { Server } from "socket.io";
import { SocketService } from "./socket.service";

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.enableCors();
  
  const port = process.env.PORT ?? 3001;
  const httpServer = await app.listen(port);
  console.log(`NestJS application listening on port ${port}`);

  // Retrieve SocketService and instantiate Socket.IO Server
  const socketService = app.get(SocketService);
  const io = new Server(httpServer, {
    cors: {
      origin: "*",
      methods: ["GET", "POST"]
    }
  });

  io.on("connection", (socket) => {
    console.log(`Socket.IO client connected: ${socket.id}`);
    
    socket.on("disconnect", () => {
      console.log(`Socket.IO client disconnected: ${socket.id}`);
    });
  });

  socketService.setServer(io);
}

bootstrap();
