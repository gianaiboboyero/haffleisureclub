import { Body, Controller, Post } from "@nestjs/common";
import { PrismaService } from "./prisma.service";
import { SocketService } from "./socket.service";

@Controller("sync")
export class SyncController {
  constructor(
    private readonly prisma: PrismaService,
    private readonly socketService: SocketService
  ) {}

  @Post()
  async sync(@Body() events: any[]) {
    if (!Array.isArray(events)) {
      return { success: false, error: "Events payload must be an array" };
    }

    const results = [];
    
    for (const event of events) {
      const { id, actionType, entityType, entityId, payload } = event;
      
      try {
        let processed = false;
        
        if (entityType === "Player") {
          if (actionType === "DELETE_PLAYER") {
            await this.prisma.player.delete({ where: { id: entityId } }).catch(() => {});
          } else {
            // CREATE_PLAYER, UPDATE_PLAYER, CHECK_IN_PLAYER, UPDATE_PLAYER_STATUS
            const { displayName, fullName, skillLevel, rating, tags, totalGamesPlayed, totalDaysPlayed, lastPlayedDate } = payload;
            await this.prisma.player.upsert({
              where: { id: entityId },
              create: {
                id: entityId,
                displayName,
                fullName,
                skillLevel,
                rating: rating ?? 2.0,
                tags: tags ?? [],
                totalGamesPlayed: totalGamesPlayed ?? 0,
                totalDaysPlayed: totalDaysPlayed ?? 0,
                lastPlayedDate: lastPlayedDate ? new Date(lastPlayedDate) : null,
              },
              update: {
                displayName,
                fullName,
                skillLevel,
                rating: rating ?? 2.0,
                tags: tags ?? [],
                totalGamesPlayed: totalGamesPlayed ?? 0,
                totalDaysPlayed: totalDaysPlayed ?? 0,
                lastPlayedDate: lastPlayedDate ? new Date(lastPlayedDate) : null,
              }
            });
          }
          processed = true;
        } else if (entityType === "Court") {
          if (actionType === "DELETE_COURT") {
            await this.prisma.court.delete({ where: { id: entityId } }).catch(() => {});
          } else {
            const { name, number, status, currentMatchId } = payload;
            await this.prisma.court.upsert({
              where: { id: entityId },
              create: {
                id: entityId,
                name,
                number: number ?? 0,
                status: status ?? "Available",
                currentMatchId,
              },
              update: {
                name,
                number: number ?? 0,
                status: status ?? "Available",
                currentMatchId,
              }
            });
          }
          processed = true;
        } else if (entityType === "Session") {
          if (actionType === "DELETE_SESSION") {
            await this.prisma.session.delete({ where: { id: entityId } }).catch(() => {});
          } else {
            const { name, date, startTime, endTime, location, mode, status, courtIds, checkedInPlayerIds, settings } = payload;
            await this.prisma.session.upsert({
              where: { id: entityId },
              create: {
                id: entityId,
                name,
                date: new Date(date),
                startTime,
                endTime,
                location,
                mode: mode ?? "Open Play",
                status: status ?? "Draft",
                courtIds: courtIds ?? [],
                checkedInPlayerIds: checkedInPlayerIds ?? [],
                settings: settings ?? {},
              },
              update: {
                name,
                date: new Date(date),
                startTime,
                endTime,
                location,
                mode: mode ?? "Open Play",
                status: status ?? "Draft",
                courtIds: courtIds ?? [],
                checkedInPlayerIds: checkedInPlayerIds ?? [],
                settings: settings ?? {},
              }
            });
          }
          processed = true;
        } else if (entityType === "Match") {
          const { courtId, teamAPlayerIds, teamBPlayerIds, scoreA, scoreB, status, startedAt, endedAt } = payload;
          await this.prisma.match.upsert({
            where: { id: entityId },
            create: {
              id: entityId,
              courtId,
              mode: "Open Play",
              teamAPlayerIds: teamAPlayerIds ?? [],
              teamBPlayerIds: teamBPlayerIds ?? [],
              scoreA: scoreA ?? 0,
              scoreB: scoreB ?? 0,
              status: status ?? "Queued",
              startedAt: startedAt ? new Date(startedAt) : null,
              endedAt: endedAt ? new Date(endedAt) : null,
              syncStatus: "Synced",
            },
            update: {
              courtId,
              teamAPlayerIds: teamAPlayerIds ?? [],
              teamBPlayerIds: teamBPlayerIds ?? [],
              scoreA: scoreA ?? 0,
              scoreB: scoreB ?? 0,
              status: status ?? "Queued",
              startedAt: startedAt ? new Date(startedAt) : null,
              endedAt: endedAt ? new Date(endedAt) : null,
              syncStatus: "Synced",
            }
          });
          processed = true;
        }

        if (processed) {
          results.push({ id, status: "Synced" });
          // Log sync event to DB
          await this.prisma.syncEvent.create({
            data: {
              actionType,
              entityType,
              entityId,
              payload: payload as any,
              status: "Synced",
              syncedAt: new Date(),
            }
          }).catch(() => {});
        } else {
          results.push({ id, status: "Failed", error: "Unhandled entity type" });
        }
      } catch (err: any) {
        console.error(`Sync error on event ${id}:`, err);
        results.push({ id, status: "Failed", error: err.message });
      }
    }

    const processedCount = results.filter((r) => r.status === "Synced").length;
    if (processedCount > 0) {
      this.socketService.broadcast("sync_update", {
        timestamp: new Date().toISOString(),
        processedCount
      });
    }
    
    return {
      success: true,
      processedCount,
      results
    };
  }
}
