import { Injectable } from "@nestjs/common";
import { Server } from "socket.io";

@Injectable()
export class SocketService {
  private ioServer: Server | null = null;

  setServer(server: Server) {
    this.ioServer = server;
    console.log("Socket.IO server instance bound in SocketService");
  }

  broadcast(event: string, data: any) {
    if (this.ioServer) {
      this.ioServer.emit(event, data);
      console.log(`Socket.IO broadcasted event: ${event}`);
    } else {
      console.warn("Socket.IO server not bound yet");
    }
  }
}
