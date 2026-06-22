import React from "react";
import ReactDOM from "react-dom/client";
import { AnimatePresence, motion } from "framer-motion";
import { 
  Activity, 
  CalendarDays, 
  CheckCircle2, 
  Clock, 
  Flame, 
  GripVertical, 
  ListChecks, 
  Lock, 
  Monitor, 
  ShieldCheck, 
  Sparkles, 
  Smartphone, 
  UserRound, 
  Users, 
  Wifi, 
  WifiOff, 
  Plus, 
  Edit2, 
  Trash2, 
  Save, 
  Search, 
  Settings, 
  Download, 
  Upload, 
  ImagePlus,
  QrCode, 
  X, 
  Calendar, 
  MapPin, 
  Megaphone,
  Database,
  Menu,
  Volume2,
  VolumeX,
  ChevronDown,
  Home,
  Sliders,
  DollarSign,
  LogOut,
  Eye,
  EyeOff,
  UserPlus,
  LogIn,
  Bell,
  Zap,
  BarChart2,
  Ban,
  ArrowLeft,
  RotateCcw,
  Share2
} from "lucide-react";
import { Button, Card, Badge } from "./components/ui";
import { Chip } from "./components/ui/heroui-chip";
import { AiLoader } from "./components/ui/ai-loader";
import { ProfilePhotoCropper } from "./components/ProfilePhotoCropper";
import { readProfileImageFile } from "./lib/profilePhoto";
import { useSupabaseData } from "./lib/dataSource";
import { serverAuthoritativeLiveState, saveStackOrder, liveDb } from "./lib/liveStateCache";
import { notifyTvDisplayRefresh, openTvDisplayWindow, shouldManageTvDisplayWindow, closeManagedTvDisplayWindow } from "./lib/tvDisplayWindow";
import { COURT_HOURLY_FEE, CHECK_IN_FEE, formatPeso } from "./lib/pricing";
import {
  countPendingTransactions,
  filterTransactionsByRange,
  formatTransactionType,
  getOutstandingCheckIns,
  normalizePaymentMethod,
  PAYMENT_METHODS,
  revenueByPaymentMethod,
  sumSuccessfulRevenue,
  type LedgerRange,
  type PaymentMethod
} from "./lib/finance";
import { manilaDateTimeIso, reservationDateKey } from "./lib/reservationTime";
import { subscribeToClubState, subscribeSupabasePlayers } from "./lib/realtime";
import {
  clubPollIntervalMs,
  isIdleView,
  isClubPushHealthy,
  rosterSyncFresh,
  PUBLISH_DEBOUNCE_MS,
  REALTIME_REFRESH_DEBOUNCE_MS
} from "./lib/syncPolicy";
import { useClubStore, subscribeClubStateBroadcast } from "./store/useClubStore";
import { db } from "./lib/db";
import { sortCourts, getPlayerAvatar, getActiveCourtMatch, getTvStackGroups, getStackDisplayGroups, getStackLabel, stackGroupKey, reconcileStackOrder, createTvVacantSlot, resolveMatchTeamPlayers, resolvePlayerById, getPlayerStatusNote, getPlayerDisplayLabel, AVATAR_PRESETS, tapbackAvatar, isUsableAvatarUrl, MAX_STACKS } from "./lib/utils";
import { formatEstimatedPlayTime, getPlayerWaitStatus, getRemainingMilliseconds } from "./lib/playerWait";
import { getCourtSetting, getCourtSettings, saveCourtSettings, type CourtSettings } from "./lib/courtSettings";
import { getMatchOpponentIds } from "./lib/playerKudos";
import { computePlayerStats, formatMinutesPlayed } from "./lib/playerStats";
import { StoryShareModal } from "./components/StoryShareModal";
import { TvPickleballCourt } from "./components/TvPickleballCourt";
import { TvStackQueue, PlayerStackPreview } from "./components/TvStackQueue";
import { CALENDAR_PAGE_ENABLED } from "./lib/featureFlags";
import { CheckedInStack } from "./components/CheckedInStack";
import { getVoiceStyle, isSoundEnabled, playSound, setSoundEnabled, setVoiceStyle, speakAnnouncement, unlockAudio } from "./lib/sound";
import type { VoiceStyle } from "./lib/sound";
import type { Court, Match, Player, TvBroadcast } from "./lib/types";
import "./styles/globals.css";
import { Analytics } from "@vercel/analytics/react";
import { SKIP_ADMIN_LOGIN } from "./lib/devFlags";
import { apiFetch, apiJson, parseResponseJson } from "./lib/api";

const LandingView = React.lazy(() =>
  import("./components/LandingView").then((module) => ({ default: module.LandingView }))
);
const ReservationCalendar = React.lazy(() =>
  import("./components/ReservationCalendar").then((module) => ({ default: module.ReservationCalendar }))
);
const AdminReservationCalendar = React.lazy(() =>
  import("./components/ReservationCalendar").then((module) => ({ default: module.AdminReservationCalendar }))
);
type SessionMember = {
  id: string;
  email: string;
  role: "ADMIN" | "MEMBER";
  displayName: string;
  playerId?: string | null;
  avatarUrl?: string | null;
  skillLevel?: string | null;
};

// Vercel runs the production API as serverless functions, so live refreshes use
// the existing lightweight polling path instead of opening a dead WebSocket.
const socket: any = null;

function App() {
  const { hydrate, hydrated, view, setView, online, setOnline, pendingSyncCount, refreshPendingSyncCount, setAdminWriteToken } = useClubStore();
  const [socketConnected, setSocketConnected] = React.useState(false);
  const [sessionMember, setSessionMember] = React.useState<SessionMember | null>(null);
  const [sessionReady, setSessionReady] = React.useState(false);

  const refreshSession = React.useCallback(() => {
    return fetch(`/api/auth?action=me`, { credentials: "include" })
      .then(async (response) => {
        const text = await response.text();
        return text && response.headers.get("content-type")?.includes("application/json") ? JSON.parse(text) : { user: null };
      })
      .then((data) => {
        setSessionMember(data.user);
        setAdminWriteToken(data.user?.adminWriteToken ?? null);
      })
      .catch(() => {
        setSessionMember(null);
        setAdminWriteToken(null);
      })
      .finally(() => setSessionReady(true));
  }, [setAdminWriteToken]);

  React.useEffect(() => {
    void refreshSession();
    window.addEventListener("haff-auth-change", refreshSession);
    return () => {
      window.removeEventListener("haff-auth-change", refreshSession);
    };
  }, [refreshSession]);

  React.useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    const refreshForUpdate = () => {
      const refreshKey = "haff-pwa-update-refresh";
      if (sessionStorage.getItem(refreshKey)) return;
      sessionStorage.setItem(refreshKey, "1");
      window.location.reload();
    };

    navigator.serviceWorker.addEventListener("controllerchange", refreshForUpdate);
    void navigator.serviceWorker.ready.then((registration) => registration.update());

    return () => navigator.serviceWorker.removeEventListener("controllerchange", refreshForUpdate);
  }, []);

  React.useEffect(() => {
    const fallback = window.setTimeout(() => {
      if (!useClubStore.getState().hydrated) {
        useClubStore.setState({ hydrated: true });
      }
    }, 2000);
    void hydrate()
      .catch((error) => {
        console.warn("Startup storage failed; opening with available data.", error);
        useClubStore.setState({ hydrated: true });
      })
      .finally(() => window.clearTimeout(fallback));
    return () => window.clearTimeout(fallback);
  }, [hydrate]);

  React.useEffect(() => {
    const syncClubStatus = (event: Event) => {
      const next = event instanceof CustomEvent
        ? String(event.detail ?? "")
        : localStorage.getItem("haff-club-status") ?? "";
      useClubStore.setState({ clubStatus: next });
    };
    window.addEventListener("storage", syncClubStatus);
    window.addEventListener("haff-club-status", syncClubStatus);
    return () => {
      window.removeEventListener("storage", syncClubStatus);
      window.removeEventListener("haff-club-status", syncClubStatus);
    };
  }, []);

  // Synchronize router via pathname / history API and hashes
  React.useEffect(() => {
    const handleOnline = () => setOnline(true);
    const handleOffline = () => setOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    const syncRoute = () => {
      const path = window.location.pathname.replace(/^\//, "");
      const hash = window.location.hash.replace(/^#\/?/, "");
      
      let targetView: ViewMode = "landing";
      if (path === "home" || hash === "home") {
        targetView = "landing";
      } else if (path === "landing" || hash === "landing") {
        window.history.replaceState(null, "", "/home");
        targetView = "landing";
      } else if (path === "play" || hash === "play") {
        targetView = "player";
      } else if (path === "parking" || hash === "parking") {
        window.history.replaceState(null, "", "/player");
        targetView = "player";
      } else if (path === "calendar" || hash === "calendar") {
        if (CALENDAR_PAGE_ENABLED) {
          targetView = "calendar";
        } else {
          window.history.replaceState(null, "", "/home");
          targetView = "landing";
        }
      } else if (["admin", "player", "tv", "finance"].includes(path)) {
        targetView = path as ViewMode;
      } else if (["admin", "player", "tv", "finance"].includes(hash)) {
        targetView = hash as ViewMode;
      } else if (path === "display" || hash === "display") {
        targetView = "tv";
      } else if (path === "payments" || hash === "payments" || path === "revenue" || hash === "revenue") {
        targetView = "finance";
      } else if (path === "schedule" || hash === "schedule" || path === "reservation" || hash === "reservation") {
        if (CALENDAR_PAGE_ENABLED) {
          targetView = "calendar";
        } else {
          window.history.replaceState(null, "", "/home");
          targetView = "landing";
        }
      } else {
        if (window.location.pathname === "/" && !window.location.hash) {
          window.history.replaceState(null, "", "/home");
          targetView = "landing";
        }
      }
      
      if (useClubStore.getState().view !== targetView) {
        useClubStore.setState({ view: targetView });
      }
    };

    window.addEventListener("popstate", syncRoute);
    window.addEventListener("hashchange", syncRoute);
    
    syncRoute();

    let prevCourts = useClubStore.getState().courts;
    let prevMatches = useClubStore.getState().matches;
    let prevPlayers = useClubStore.getState().players;
    let prevStackOrder = useClubStore.getState().stackOrder;
    let prevReservations = useClubStore.getState().reservations;
    let sharedStateInitialized = useClubStore.getState().hydrated;
    let sharedPublishTimer: number | undefined;

    const unsubscribe = useClubStore.subscribe((state) => {
      const operationalStateChanged =
        state.courts !== prevCourts ||
        state.matches !== prevMatches ||
        state.players !== prevPlayers ||
        state.stackOrder !== prevStackOrder ||
        state.reservations !== prevReservations;
      if (operationalStateChanged) {
        prevCourts = state.courts;
        prevMatches = state.matches;
        prevPlayers = state.players;
        prevStackOrder = state.stackOrder;
        prevReservations = state.reservations;
        if (state.isApplyingRemoteBroadcast()) return;
        if (!sharedStateInitialized) {
          if (state.hydrated) {
            sharedStateInitialized = true;
            void state.refreshSharedState();
          }
          return;
        }
        state.suppressRefresh();
        window.clearTimeout(sharedPublishTimer);
        sharedPublishTimer = window.setTimeout(() => {
          void state.publishSharedState().then(() => {
            notifyTvDisplayRefresh();
            if (socket?.connected) socket.emit("state_changed");
          });
        }, PUBLISH_DEBOUNCE_MS);
      }
    });

    const syncQueuePollMs = useSupabaseData() ? 10 * 60_000 : 120_000;
    const timer = window.setInterval(refreshPendingSyncCount, syncQueuePollMs);

    let pollTimer: number | undefined;
    const scheduleClubPoll = () => {
      const view = useClubStore.getState().view;
      const delayMs = clubPollIntervalMs(view);
      pollTimer = window.setTimeout(() => {
        const supabaseLive = useSupabaseData();
        const needsHttpPoll =
          (view === "tv" || !document.hidden) &&
          (!supabaseLive || !isClubPushHealthy()) &&
          (!socket || !socket.connected);
        if (needsHttpPoll) {
          const context =
            view === "tv" ? "tv" : view === "player" ? "player" : "default";
          void useClubStore.getState().pingSharedState({ context });
        }
        scheduleClubPoll();
      }, delayMs);
    };
    scheduleClubPoll();

    let realtimeRefreshTimer: number | undefined;
    const scheduleRealtimeRefresh = () => {
      const view = useClubStore.getState().view;
      if (isIdleView(view) || (document.hidden && view !== "tv")) return;
      window.clearTimeout(realtimeRefreshTimer);
      realtimeRefreshTimer = window.setTimeout(() => {
        const currentView = useClubStore.getState().view;
        if (isIdleView(currentView) || (document.hidden && currentView !== "tv")) return;
        const context =
          currentView === "tv" ? "tv" : currentView === "player" ? "player" : "default";
        void useClubStore.getState().refreshSharedState({ force: true, context });
      }, REALTIME_REFRESH_DEBOUNCE_MS);
    };

    const unsubscribeClubRealtime = subscribeToClubState(() => {
      scheduleRealtimeRefresh();
    });

    const unsubscribePlayerRoster = useSupabaseData()
      ? subscribeSupabasePlayers(() => {
          // A Player row changed — refresh the shared session state (picks up
          // profile changes embedded in the session payload). Only do a full
          // hydrate when the roster cache has expired (> 4 hr old), avoiding
          // a complete DB re-fetch on every admin check-in action.
          // Skip entirely for background/hidden tabs — they will catch up on focus.
          if (document.hidden && useClubStore.getState().view !== "tv") return;
          const store = useClubStore.getState();
          if (!rosterSyncFresh()) {
            void store.hydrate();
          } else {
            void store.refreshSharedState({ force: true });
          }
        })
      : () => undefined;

    const applyIncomingStackOrder = (incoming: string[]) => {
      if (serverAuthoritativeLiveState()) return;
      useClubStore.getState().runAsRemoteBroadcast(() => {
        const state = useClubStore.getState();
        const stackOrder = reconcileStackOrder(incoming, state.players, state.matches, state.courts, {
          autoAppendMissing: false
        });
        if (stackOrder.join("|") !== state.stackOrder.join("|")) {
          saveStackOrder(stackOrder);
          useClubStore.setState({ stackOrder });
        }
      });
    };

    const unsubscribeClubBroadcast = subscribeClubStateBroadcast(
      () => {
        const view = useClubStore.getState().view;
        if (isIdleView(view) || (document.hidden && view !== "tv")) return;
        void useClubStore.getState().refreshSharedState({ force: true });
      },
      (stackOrder) => {
        applyIncomingStackOrder(stackOrder);
      },
      undefined,
      (broadcast) => {
        useClubStore.setState({ tvBroadcast: broadcast });
      }
    );

    const onStackStorage = (event: StorageEvent) => {
      if (serverAuthoritativeLiveState()) return;
      if (event.key !== "haff-stack-order" || !event.newValue) return;
      try {
        const parsed = JSON.parse(event.newValue);
        if (!Array.isArray(parsed)) return;
        applyIncomingStackOrder(parsed.map(String));
      } catch {
        // Ignore malformed stack snapshots.
      }
    };
    window.addEventListener("storage", onStackStorage);

    const onWindowFocus = () => {
      const view = useClubStore.getState().view;
      if (view === "admin" || view === "tv" || view === "player") {
        void useClubStore.getState().refreshSharedState({ force: true, context: view === "tv" ? "tv" : view === "player" ? "player" : "default" });
      }
    };
    window.addEventListener("focus", onWindowFocus);

    // Socket.IO Connection Event Handlers
    if (socket) {
      const onConnect = () => setSocketConnected(true);
      const onDisconnect = () => setSocketConnected(false);
      const onSyncUpdate = () => {
        console.log("Received broadcast event, syncing local state...");
        hydrate();
      };
      const onStateChanged = () => {
        void useClubStore.getState().refreshSharedState();
      };

      socket.on("connect", onConnect);
      socket.on("disconnect", onDisconnect);
      socket.on("sync_update", onSyncUpdate);
      socket.on("state_changed", onStateChanged);

      return () => {
        window.removeEventListener("online", handleOnline);
        window.removeEventListener("offline", handleOffline);
        window.removeEventListener("popstate", syncRoute);
        window.removeEventListener("hashchange", syncRoute);
        window.clearInterval(timer);
        if (pollTimer !== undefined) window.clearTimeout(pollTimer);
        if (realtimeRefreshTimer !== undefined) window.clearTimeout(realtimeRefreshTimer);
        window.clearTimeout(sharedPublishTimer);
        unsubscribe();
        unsubscribeClubBroadcast();
        unsubscribeClubRealtime();
        unsubscribePlayerRoster();
        window.removeEventListener("storage", onStackStorage);
        window.removeEventListener("focus", onWindowFocus);
        socket.off("connect", onConnect);
        socket.off("disconnect", onDisconnect);
        socket.off("sync_update", onSyncUpdate);
        socket.off("state_changed", onStateChanged);
      };
    }

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("popstate", syncRoute);
      window.removeEventListener("hashchange", syncRoute);
      window.clearInterval(timer);
      if (pollTimer !== undefined) window.clearTimeout(pollTimer);
      if (realtimeRefreshTimer !== undefined) window.clearTimeout(realtimeRefreshTimer);
      window.clearTimeout(sharedPublishTimer);
      unsubscribe();
      unsubscribeClubBroadcast();
      unsubscribeClubRealtime();
      unsubscribePlayerRoster();
      window.removeEventListener("storage", onStackStorage);
      window.removeEventListener("focus", onWindowFocus);
    };
  }, [refreshPendingSyncCount, setOnline, hydrate]);

  if (!hydrated) return <LoadingScreen />;

  return (
    <main className="min-h-screen bg-forest text-ivory">
      <div className="fixed inset-0 z-0 texture pointer-events-none" />
      {/* Global Background aesthetics */}
      <div className="fixed inset-0 z-0 bg-[linear-gradient(to_right,#fff8ea0c_1px,transparent_1px),linear-gradient(to_bottom,#fff8ea0c_1px,transparent_1px)] bg-[size:4rem_4rem] pointer-events-none" />
      <div className="fixed inset-0 z-0 bg-[radial-gradient(circle_at_50%_0%,rgba(244,201,93,0.18),transparent_50%),radial-gradient(circle_at_100%_40%,rgba(127,182,154,0.15),transparent_40%),linear-gradient(180deg,rgba(14,90,67,0.1),rgba(6,36,27,0.9))] pointer-events-none" />
      {view === "landing" && (
        <AccountMenu member={sessionMember} setView={setView} onSignedOut={() => setSessionMember(null)} />
      )}
      {view !== "landing" && view !== "tv" && (
        <TopBar 
          view={view} 
          setView={setView} 
          online={online} 
          pendingSyncCount={pendingSyncCount} 
          socketConnected={socketConnected}
          member={sessionMember}
          sessionReady={sessionReady}
          onSignedOut={() => setSessionMember(null)}
        />
      )}
      <div className="relative z-10">
        <AnimatePresence>
          {view === "landing" && (
            <React.Suspense fallback={<LoadingScreen />}>
              <LandingView
                key="landing"
                setView={setView}
                signedIn={sessionReady && Boolean(sessionMember)}
                isAdmin={sessionMember?.role === "ADMIN"}
              />
            </React.Suspense>
          )}
          {view === "admin" && (
            <AdminView key="admin" sessionMember={sessionMember} sessionReady={sessionReady} refreshSession={refreshSession} />
          )}
          {view === "player" && (
            <PlayerView key="player" sessionMember={sessionMember} sessionReady={sessionReady} />
          )}
          {view === "tv" && <DisplayView key="tv" setView={setView} />}
          {view === "calendar" && CALENDAR_PAGE_ENABLED && (
            <React.Suspense fallback={<LoadingScreen />}>
              <ReservationCalendar key="calendar" />
            </React.Suspense>
          )}
          {view === "finance" && <FinanceView key="finance" />}
        </AnimatePresence>
      </div>
      {view !== "tv" && <FloatingDock view={view} setView={setView} isAdmin={SKIP_ADMIN_LOGIN || sessionMember?.role === "ADMIN"} />}
      <Toasts />
    </main>
  );
}

function AccountMenu({
  member,
  setView,
  onSignedOut
}: {
  member: SessionMember | null;
  setView: (view: ViewMode) => void;
  onSignedOut: () => void;
}) {
  const [open, setOpen] = React.useState(false);
  if (!member) return null;
  const avatar = isUsableAvatarUrl(member.avatarUrl) ? member.avatarUrl : tapbackAvatar(member.displayName);
  return (
    <div
      className="fixed"
      style={{
        right: "max(0.75rem, env(safe-area-inset-right))",
        top: "max(0.75rem, env(safe-area-inset-top))",
        zIndex: 9999
      }}
    >
      <button className="flex h-10 items-center gap-2 rounded-full border border-ivory/10 bg-forest/80 p-1.5 pr-2 text-ivory backdrop-blur-xl transition hover:bg-ivory/10 sm:pr-3" onClick={() => setOpen(!open)} aria-expanded={open} type="button">
        <img className="h-7 w-7 rounded-full object-cover" src={avatar} alt="" />
        <span className="hidden max-w-28 truncate text-xs font-bold sm:block">{member.displayName}</span>
        <ChevronDown className={`hidden h-3.5 w-3.5 text-ivory/55 transition sm:block ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="absolute right-0 mt-2 w-48 overflow-hidden rounded-2xl border border-ivory/10 bg-[#082d23]/98 p-1.5 text-ivory shadow-2xl backdrop-blur-xl">
          <div className="border-b border-ivory/10 px-3 py-2">
            <p className="truncate text-xs font-black">{member.displayName}</p>
            <p className="text-[10px] text-ivory/45">HAFF member account</p>
          </div>
          <button className="mt-1 flex min-h-10 w-full items-center gap-2 rounded-xl px-3 text-left text-xs font-bold text-ivory/75 hover:bg-ivory/10 hover:text-ivory" onClick={async () => {
            await apiFetch("/api/auth?action=logout", { method: "POST" });
            localStorage.removeItem("haff-player-account-id");
            onSignedOut();
            setOpen(false);
            window.dispatchEvent(new Event("haff-auth-change"));
            setView("landing");
          }} type="button"><LogOut size={15} /> Sign out</button>
        </div>
      )}
    </div>
  );
}

function LoadingScreen() {
  return <AiLoader />;
}

function PasswordField({
  value,
  onChange,
  className
}: {
  value: string;
  onChange: (value: string) => void;
  className: string;
}) {
  const [visible, setVisible] = React.useState(false);
  return (
    <div className="relative">
      <input
        className={`${className} pr-12`}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Enter password"
        required
        type={visible ? "text" : "password"}
        value={value}
      />
      <button
        aria-label={visible ? "Hide password" : "Show password"}
        className="absolute inset-y-0 right-0 grid w-12 place-items-center text-forest/50 hover:text-forest"
        onClick={() => setVisible((current) => !current)}
        type="button"
      >
        {visible ? <EyeOff size={18} /> : <Eye size={18} />}
      </button>
    </div>
  );
}

function useNow() {
  const [now, setNow] = React.useState(() => Date.now());
  React.useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);
  return now;
}

/** requestAnimationFrame clock for live countdowns; pauses when enabled is false. */
function useSmoothNow(enabled = true) {
  const [now, setNow] = React.useState(() => Date.now());
  React.useEffect(() => {
    if (!enabled) return;
    let frame = 0;
    let lastCentisecond = -1;
    const tick = () => {
      const t = Date.now();
      const centisecond = Math.floor(t / 10);
      if (centisecond !== lastCentisecond) {
        lastCentisecond = centisecond;
        setNow(t);
      }
      frame = window.requestAnimationFrame(tick);
    };
    frame = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(frame);
  }, [enabled]);
  return now;
}

type ViewMode = "landing" | "admin" | "player" | "tv" | "calendar" | "finance";

function TopBar({ 
  view, 
  setView, 
  online, 
  pendingSyncCount,
  socketConnected,
  member,
  sessionReady,
  onSignedOut
}: { 
  view: string; 
  setView: (view: ViewMode) => void; 
  online: boolean; 
  pendingSyncCount: number;
  socketConnected: boolean;
  member: SessionMember | null;
  sessionReady: boolean;
  onSignedOut: () => void;
}) {
  const [soundOn, setSoundOn] = React.useState(isSoundEnabled);
  const [adminMenuOpen, setAdminMenuOpen] = React.useState(false);

  React.useEffect(() => {
    const unlock = () => void unlockAudio();
    const syncSound = (event: Event) => setSoundOn((event as CustomEvent<boolean>).detail);
    window.addEventListener("pointerdown", unlock, { once: true });
    window.addEventListener("keydown", unlock, { once: true });
    window.addEventListener("haff-sound-change", syncSound);
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
      window.removeEventListener("haff-sound-change", syncSound);
    };
  }, []);

  return (
    <header className="sticky top-0 z-40 bg-forest/88 px-4 py-3 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl items-center justify-between gap-3">
        <div className="relative flex items-center gap-1">
          <button className="flex items-center gap-3 text-left" onClick={() => setView("landing")}>
            <LogoMark />
            <span className="hidden items-baseline gap-2 sm:flex" aria-label="HAFF Leisure Club, Cadiz City">
              <span className="font-display text-lg font-bold leading-none text-ivory lg:text-xl">HAFF LEISURE CLUB</span>
              <span className="h-px w-5 bg-ivory/35" aria-hidden="true" />
              <span className="text-[11px] font-black uppercase tracking-[0.16em] text-brass">CADIZ CITY</span>
            </span>
          </button>
        </div>
        <div className="flex min-w-0 items-center justify-end gap-2">
          <button
            aria-label={soundOn ? "Mute sound effects" : "Enable sound effects"}
            aria-pressed={soundOn}
            className={`grid h-10 w-10 shrink-0 place-items-center rounded-full transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brass ${
              soundOn ? "bg-brass text-forest hover:bg-[#d7bd82]" : "bg-ivory/10 text-ivory/70 hover:bg-ivory/18"
            }`}
            onClick={() => void setSoundEnabled(!soundOn)}
            title={soundOn ? "Sound effects on. Tap to mute." : "Sound effects muted. Tap to enable and test."}
            type="button"
          >
            {soundOn ? <Volume2 size={17} /> : <VolumeX size={17} />}
          </button>
          {/* TV Display Sync Indicator */}
          {view === "tv" && (
            <div 
              className={`flex h-10 items-center gap-1.5 rounded-full px-3 text-xs font-semibold shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] ${socketConnected ? "bg-emerald-500/10 text-emerald-300" : "bg-clay/10 text-clay"}`}
              title={socketConnected ? "Live TV Display Broadcast Connected" : "TV Broadcast Disconnected - polling backup"}
            >
              <span className={`h-2 w-2 rounded-full ${socketConnected ? "bg-emerald-400 animate-pulse" : "bg-clay"}`} />
              <span className="hidden md:inline">{socketConnected ? "TV Live" : "TV Offline"}</span>
            </div>
          )}
          
          <div
            aria-label={online ? `Online. ${pendingSyncCount} local changes pending sync.` : `Offline. ${pendingSyncCount} local changes saved locally.`}
            className="flex h-10 min-w-10 items-center justify-center gap-2 rounded-full bg-ivory/10 px-3 text-xs font-semibold text-ivory shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]"
            title="Offline-first save status. All actions save on this device first, then sync later."
          >
            {online ? <Wifi size={16} /> : <WifiOff size={16} />}
            <span className="hidden lg:inline">{online ? "Online" : "Offline"} - {pendingSyncCount ? `${pendingSyncCount} pending` : "all saved"}</span>
          </div>
          <InlineAccountMenu member={member} setView={setView} onSignedOut={onSignedOut} sessionReady={sessionReady} />
        </div>
      </div>
    </header>
  );
}

function InlineAccountMenu({
  member,
  setView,
  onSignedOut,
  sessionReady
}: {
  member: SessionMember | null;
  setView: (view: ViewMode) => void;
  onSignedOut: () => void;
  sessionReady: boolean;
}) {
  const [open, setOpen] = React.useState(false);
  if (!sessionReady) return null;
  if (!member) {
    return (
      <div className="flex shrink-0 items-center gap-2">
        <button
          className="hidden min-h-10 items-center gap-2 rounded-full bg-ivory/10 px-4 text-xs font-black text-ivory transition hover:bg-ivory/15 sm:flex"
          onClick={() => {
            sessionStorage.setItem("haff-auth-mode", "login");
            setView("player");
          }}
          type="button"
        >
          <LogIn size={15} /> Sign in
        </button>
        <button
          className="flex min-h-10 items-center gap-2 rounded-full bg-brass px-4 text-xs font-black text-forest transition hover:bg-linen"
          onClick={() => {
            sessionStorage.setItem("haff-auth-mode", "register");
            setView("player");
          }}
          type="button"
        >
          <UserPlus size={15} /> Register
        </button>
      </div>
    );
  }
  const avatar = isUsableAvatarUrl(member.avatarUrl) ? member.avatarUrl : tapbackAvatar(member.displayName);
  const signOut = async () => {
    await apiFetch("/api/auth?action=logout", { method: "POST" });
    localStorage.removeItem("haff-player-account-id");
    onSignedOut();
    setOpen(false);
    window.dispatchEvent(new Event("haff-auth-change"));
    setView("landing");
  };
  return (
    <div className="relative shrink-0">
      <button
        className="flex h-10 max-w-44 items-center gap-2 rounded-full border border-ivory/10 bg-ivory/[0.07] p-1.5 text-ivory transition hover:bg-ivory/12 sm:pr-3"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        aria-label={`${member.displayName} account menu`}
        type="button"
      >
        <img className="h-7 w-7 shrink-0 rounded-full object-cover" src={avatar} alt="" />
        <span className="hidden truncate text-xs font-bold sm:block">{member.displayName}</span>
        <ChevronDown className={`hidden h-3.5 w-3.5 shrink-0 text-ivory/55 transition sm:block ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="absolute right-0 top-full mt-2 w-52 overflow-hidden rounded-2xl border border-ivory/10 bg-[#082d23]/98 p-1.5 text-ivory shadow-2xl backdrop-blur-xl">
          <div className="border-b border-ivory/10 px-3 py-2">
            <p className="truncate text-xs font-black">{member.displayName}</p>
            <p className="text-[10px] text-ivory/45">HAFF member account</p>
          </div>
          <button className="mt-1 flex min-h-11 w-full items-center gap-2 rounded-xl px-3 text-left text-xs font-bold text-ivory/75 hover:bg-ivory/10 hover:text-ivory" onClick={signOut} type="button">
            <LogOut size={15} /> Sign out
          </button>
        </div>
      )}
    </div>
  );
}

function FloatingDock({ view, setView, isAdmin }: { view: string; setView: (view: ViewMode) => void; isAdmin: boolean }) {
  const publicItems = [
    { key: "landing", label: "Home", icon: Home },
    { key: "player", label: "Players", icon: UserRound },
    ...(CALENDAR_PAGE_ENABLED ? [{ key: "calendar", label: "Reserve", icon: Calendar }] : []),
    { key: "tv", label: "TV", icon: Monitor },
  ];
  const adminItems = [
    { key: "landing", label: "Home", icon: Home },
    { key: "admin", label: "Admin", icon: Sliders },
    { key: "player", label: "Players", icon: UserRound },
    ...(CALENDAR_PAGE_ENABLED ? [{ key: "calendar", label: "Calendar", icon: Calendar }] : []),
    { key: "finance", label: "Finance", icon: DollarSign },
    { key: "tv", label: "TV Display", icon: Monitor },
  ];
  const navItems = isAdmin ? adminItems : publicItems;

  return (
    <nav className="fixed bottom-6 left-1/2 z-50 flex max-w-[calc(100vw-1rem)] -translate-x-1/2 items-center gap-1.5 overflow-x-auto rounded-full border border-white/10 bg-[#0B251C]/90 p-2 shadow-[0_24px_60px_rgba(0,0,0,0.5)] backdrop-blur-xl">
      {navItems.map((item) => {
        const Icon = item.icon;
        const isActive = view === item.key;
        return (
          <button
            key={item.key}
            onClick={() => setView(item.key as ViewMode)}
            className={`relative flex h-11 items-center gap-2 rounded-full px-4 text-xs font-extrabold uppercase tracking-wider transition-all duration-300 ${
              isActive
                ? "bg-brass text-forest shadow-[0_4px_20px_rgba(203,239,67,0.25)] font-black"
                : "text-ivory/70 hover:bg-white/5 hover:text-ivory"
            }`}
            title={item.label}
          >
            <Icon size={16} className="shrink-0" />
            <span className="hidden md:inline">{item.label}</span>
          </button>
        );
      })}
    </nav>
  );
}

function LogoMark({ size = "small" }: { size?: "small" | "large" }) {
  const large = size === "large";
  const [failed, setFailed] = React.useState(false);
  const className = `shrink-0 overflow-hidden rounded-md bg-forest object-cover shadow-inner ${large ? "h-36 w-36" : "h-12 w-12"}`;
  if (failed) {
    return (
      <div className={`${className} grid place-items-center border border-ivory/15 text-center text-ivory`}>
        <span className={`${large ? "text-sm" : "text-[8px]"} px-1 font-semibold uppercase tracking-wide`}>Logo missing</span>
      </div>
    );
  }
  return (
    <img
      alt="HAFF Leisure Club logo"
      className={className}
      height={large ? 144 : 48}
      onError={() => setFailed(true)}
      src="/haff-logo.jpg"
      width={large ? 144 : 48}
    />
  );
}

function PlayerProfileSheet({
  player,
  onClose
}: {
  player: ReturnType<typeof useClubStore.getState>["players"][number];
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[120] flex items-end justify-center bg-black/70 p-4 backdrop-blur-sm sm:items-center" onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md rounded-3xl border border-white/10 bg-[#0f2e24] p-6 text-ivory shadow-2xl max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start gap-4">
          <img src={getPlayerAvatar(player)} alt="" className="h-20 w-20 rounded-2xl object-cover bg-white/10" />
          <div className="min-w-0 flex-1">
            <p className="text-xs font-black uppercase tracking-[0.2em] text-brass">Player profile</p>
            <h2 className="font-display text-3xl font-black">{player.displayName}</h2>
            <RankBadge skillLevel={player.skillLevel} compact />
          </div>
          <button type="button" onClick={onClose} className="rounded-full bg-white/10 p-2 text-ivory/70 hover:text-ivory"><X size={18} /></button>
        </div>

        {player.statusNote && (
          <div className="mt-4 rounded-2xl border border-brass/30 bg-brass/10 p-4">
            <p className="text-[10px] font-black uppercase tracking-wider text-brass">Status note</p>
            <p className="mt-1 text-sm font-semibold leading-relaxed">{player.statusNote}</p>
          </div>
        )}

        <PlayerHistoryPanel player={player} className="mt-4" />
      </motion.div>
    </div>
  );
}

type AdminTab = "control" | "players" | "reservations" | "history" | "settings";

function AdminView({
  sessionMember,
  sessionReady,
  refreshSession
}: {
  sessionMember: SessionMember | null;
  sessionReady: boolean;
  refreshSession: () => Promise<void>;
}) {
  const { sessions, currentSessionId, reservations } = useClubStore();
  const [activeTab, setActiveTab] = React.useState<AdminTab>("control");
  const [isQrOpen, setIsQrOpen] = React.useState(false);

  React.useEffect(() => {
    const openAdminTab = (event: Event) => {
      const tab = (event as CustomEvent<AdminTab>).detail;
      if (["control", "players", "reservations", "history", "settings"].includes(tab)) {
        if (!CALENDAR_PAGE_ENABLED && tab === "reservations") return;
        setActiveTab(tab);
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    };
    window.addEventListener("haff-admin-tab", openAdminTab);
    return () => window.removeEventListener("haff-admin-tab", openAdminTab);
  }, []);

  const isAdmin = SKIP_ADMIN_LOGIN || sessionMember?.role === "ADMIN";

  React.useEffect(() => {
    if (!isAdmin || !shouldManageTvDisplayWindow()) return;
    openTvDisplayWindow();
  }, [isAdmin]);

  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [authError, setAuthError] = React.useState("");
  const [loggingIn, setLoggingIn] = React.useState(false);

  const activeSession = sessions.find((s) => s.id === currentSessionId);
  const pendingReservations = reservations.filter((r) => r.status === "Requested").length;

  if (!sessionReady || loggingIn) return <LoadingScreen />;

  if (!isAdmin) {
    const handleLogin = async (e: React.FormEvent) => {
      e.preventDefault();
      setAuthError("");
      setLoggingIn(true);
      try {
        const response = await apiFetch("/api/auth?action=login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password })
        });
        const data = await parseResponseJson<{ user?: { role?: string }; error?: string }>(response);
        if (response.ok && data.user?.role === "ADMIN") {
          await refreshSession();
          window.dispatchEvent(new Event("haff-auth-change"));
          if (shouldManageTvDisplayWindow()) {
            openTvDisplayWindow();
          }
          playSound("checkin");
          return;
        }
        setAuthError(data.user ? "This account is not an administrator." : (data.error ?? "Invalid email or password"));
        playSound("complete");
      } finally {
        setLoggingIn(false);
      }
    };

    return (
      <div className="min-h-[calc(100vh-120px)] flex items-center justify-center px-4 py-12">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: "spring", stiffness: 300, damping: 24 }}
          className="max-w-md w-full bg-ivory border border-white/10 rounded-[2.5rem] shadow-[0_24px_80px_rgba(0,0,0,0.3)] p-8 text-forest relative overflow-hidden"
        >
          <div className="absolute -right-12 -top-12 opacity-[0.03] pointer-events-none text-forest">
            <LogoMark size="large" />
          </div>

          <div className="flex flex-col items-center text-center">
            <div className="h-16 w-16 rounded-2xl bg-forest flex items-center justify-center border border-white/10 shadow-inner">
              <LogoMark />
            </div>
            <h2 className="font-display text-3xl font-black mt-5 leading-none tracking-tight">HAFF Leisure Club - Cadiz City</h2>
            <p className="text-xs font-bold uppercase tracking-[0.24em] text-clay mt-2">Admin Portal</p>
          </div>

          {sessionMember && sessionMember.role !== "ADMIN" ? (
            <div className="mt-8 space-y-4">
              <div className="rounded-2xl bg-amber-500/10 border border-amber-500/25 px-4 py-3 text-sm font-semibold text-amber-900 text-center">
                You&apos;re signed in as <span className="font-black">{sessionMember.displayName}</span>, which is not an administrator account.
              </div>
              <p className="text-center text-xs text-forest/60">
                Sign in below with an admin account, or use the player page with your current account.
              </p>
            </div>
          ) : (
            <p className="mt-6 text-center text-xs text-forest/60 leading-relaxed px-2">
              One login for player and admin — if you&apos;re already signed in on the player page, you&apos;ll go straight through.
            </p>
          )}

          <form onSubmit={handleLogin} className="mt-6 space-y-4">
            {authError && (
              <div className="p-3.5 bg-red-500/10 border border-red-500/20 text-red-300 rounded-2xl text-xs font-semibold text-center">
                {authError}
              </div>
            )}

            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-wider text-forest/70">Administrator Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="email@example.com"
                className="w-full rounded-2xl bg-forest/5 text-forest border-none px-4 py-3.5 focus:outline-none focus:ring-2 focus:ring-forest text-sm shadow-inner transition placeholder:text-forest/30"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-wider text-forest/70">Password</label>
              <PasswordField
                value={password}
                onChange={setPassword}
                className="w-full rounded-2xl bg-forest/5 text-forest border-none px-4 py-3.5 focus:outline-none focus:ring-2 focus:ring-forest text-sm shadow-inner transition placeholder:text-forest/30"
              />
            </div>

            <Button
              type="submit"
              className="w-full bg-brass text-forest hover:bg-linen font-black py-4 rounded-2xl shadow-xl transition-all hover:scale-[1.01] active:scale-95 border-none mt-6 flex items-center justify-center gap-2"
            >
              <Lock size={16} /> Sign In
            </Button>
          </form>

          <p className="text-[10px] text-center text-linen/40 mt-8 leading-relaxed px-4">
            Unauthorized access is restricted. Data transactions are logged and encrypted.
          </p>
        </motion.div>
      </div>
    );
  }

  return (
    <section className="mx-auto max-w-7xl px-4 py-4">
      {/* Tab Navigation */}
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-1 overflow-x-auto rounded-xl bg-black/10 p-1 scrollbar-none sm:flex-1">
          {[
            { id: "control", label: "Play Rotation" },
            { id: "players", label: "Manage Players" },
            ...(CALENDAR_PAGE_ENABLED
              ? [{ id: "reservations", label: pendingReservations > 0 ? `Reservations (${pendingReservations})` : "Reservations" }]
              : []),
            { id: "history", label: "History" },
            { id: "settings", label: "Backup & Settings" }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as AdminTab)}
              className={`min-h-11 whitespace-nowrap rounded-lg px-4 py-2 text-sm font-bold transition-colors ${
                activeTab === tab.id 
                  ? "bg-ivory text-forest shadow-sm"
                  : "text-ivory/75 hover:bg-ivory/10 hover:text-ivory"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <Button
            onClick={() => openTvDisplayWindow()}
            className="min-h-10 gap-2 bg-brass px-4 text-xs font-black text-forest hover:bg-linen"
          >
            <Monitor size={14} /> TV Display
          </Button>
          <Button
            onClick={() => setIsQrOpen(true)}
            className="min-h-10 gap-2 bg-ivory/15 px-4 text-xs font-bold text-ivory hover:bg-ivory/25"
          >
            <QrCode size={14} /> Player QR
          </Button>
          <Button
            onClick={async () => {
              closeManagedTvDisplayWindow();
              await apiFetch("/api/auth?action=logout", { method: "POST" });
              await refreshSession();
              window.dispatchEvent(new Event("haff-auth-change"));
              playSound("complete");
            }}
            className="min-h-10 gap-2 bg-ivory/15 px-4 text-xs font-bold text-ivory hover:bg-ivory/25"
          >
            Sign Out
          </Button>
          {activeSession && (
            <Button
              onClick={async () => {
                const res = await useClubStore.getState().endSession();
                if (res?.hasActiveCourts) {
                  if (confirm("There are still active/reserved courts in progress. Force ending the session will finish all matches and clear the courts. Proceed?")) {
                    await useClubStore.getState().endSession(true);
                  }
                }
              }}
              className="min-h-10 bg-clay px-4 text-xs font-bold text-ivory hover:bg-clay/90"
            >
              End Session
            </Button>
          )}
        </div>
      </div>

      {/* Tab Contents */}
      <div key={activeTab}>
        {activeTab === "control" && <PlayRotationTab />}
        {activeTab === "players" && <PlayersCrudTab />}
        {activeTab === "reservations" && CALENDAR_PAGE_ENABLED && <AdminReservationsTab />}
        {activeTab === "history" && <HistoryTab />}
        {activeTab === "settings" && <SettingsTab />}
      </div>

      {/* Player QR Modal */}
      {isQrOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="bg-ivory text-forest rounded-3xl p-6 max-w-sm w-full shadow-2xl relative border border-forest/10">
            <button 
              onClick={() => setIsQrOpen(false)}
              className="absolute right-4 top-4 text-forest/50 hover:text-forest"
            >
              <X size={20} />
            </button>
            <div className="text-center">
              <h3 className="font-display text-2xl mb-2">Player Portal QR</h3>
              <p className="text-xs text-forest/70 mb-6">
                Scan this QR code with your phone to check in, park/resume play, and view your queue estimate.
              </p>
              <div className="flex justify-center bg-white p-4 rounded-2xl shadow-inner border border-forest/5 mb-6">
                <img
                  alt="Player Portal QR Code"
                  src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(window.location.origin + "/player")}`}
                  className="w-48 h-48"
                />
              </div>
              <p className="text-xs font-mono select-all text-forest/60 break-all bg-forest/5 p-2 rounded-lg">
                {window.location.origin + "/player"}
              </p>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

function AdminCourtCard({
  court,
  match,
  matches,
  matchDurationMinutes,
  assignPlayerToCourt,
  startReservedCourt,
  returnReservedToQueue,
  clearCourt,
  reserveCourt,
}: {
  court: Court;
  match: Match | undefined;
  matches: Match[];
  matchDurationMinutes: number;
  assignPlayerToCourt: (playerId: string, courtId: string) => Promise<void>;
  startReservedCourt: (courtId: string) => Promise<void>;
  returnReservedToQueue: (courtId: string) => Promise<void>;
  clearCourt: (courtId: string) => Promise<void>;
  reserveCourt: (courtId: string) => Promise<void>;
}) {
  const now = useNow();
  const finishCourt = useClubStore((state) => state.finishCourt);
  const players = useClubStore((state) => state.players);
  const activeMatch = match ?? getActiveCourtMatch(court, matches);

  const announceCourtPlayers = () => {
    const participantIds = activeMatch
      ? [...activeMatch.teamAPlayerIds, ...activeMatch.teamBPlayerIds]
      : court.reservedPlayerIds ?? [];
    void useClubStore.getState().broadcastTvAnnouncement({
      kind: "court",
      courtId: court.id,
      courtName: court.name,
      participantIds,
      variant: court.status === "Reserved" ? "reserved" : "active"
    });
  };

  const canAnnounce = Boolean(
    activeMatch ||
    (court.status === "Reserved" && (court.reservedPlayerIds?.length ?? 0) > 0)
  );

  const startedTime = match?.startedAt ? new Date(match.startedAt).getTime() : 0;
  const effectiveNow = match?.timerPausedAt ? new Date(match.timerPausedAt).getTime() : now;
  const elapsedSeconds = startedTime ? Math.floor((effectiveNow - startedTime) / 1000) : 0;
  const isOvertime = court.status === "InUse" && elapsedSeconds >= matchDurationMinutes * 60;
  const isTimerPaused = Boolean(match?.timerPausedAt);

  const persistMatch = async (updatedMatch: Match, options?: { force?: boolean }) => {
    await liveDb.matchesPut(updatedMatch);
    useClubStore.setState({
      matches: useClubStore.getState().matches.map((item) => (item.id === updatedMatch.id ? updatedMatch : item)),
    });
    await useClubStore.getState().publishSharedState({ force: options?.force });
  };

  const toggleReservedStatus = async () => {
    const isReserved = court.status === "Reserved";
    if (isReserved) {
      await useClubStore.getState().updateCourt({
        ...court,
        status: "Available",
        reservedFor: undefined,
        reservedPlayerIds: undefined
      });
      return;
    }

    const heldNames = (court.reservedPlayerIds ?? [])
      .map((id) => players.find((player) => player.id === id)?.displayName.split(" ")[0])
      .filter(Boolean)
      .join(" / ");

    await useClubStore.getState().updateCourt({
      ...court,
      status: "Reserved",
      reservedFor: court.reservedFor ?? (heldNames || "Reserved game"),
      reservedPlayerIds: court.reservedPlayerIds ?? []
    });
  };

  const handleStartReservedCourt = () => {
    const count = court.reservedPlayerIds?.length ?? 0;
    if (count === 0) {
      window.alert("Add players first — drag from the queue or tap Assign stack.");
      return;
    }
    void startReservedCourt(court.id);
  };

  const toggleCourtPause = async () => {
    const nextStatus: Court["status"] = court.status === "Paused" ? "Available" : "Paused";
    await useClubStore.getState().updateCourt({ ...court, status: nextStatus });
  };

  const adjustCourtTime = async (seconds: number) => {
    if (!match?.startedAt) return;
    const currentStart = new Date(match.startedAt).getTime();
    const newStart = new Date(currentStart + seconds * 1000).toISOString();
    await persistMatch({ ...match, startedAt: newStart, timerPausedAt: undefined }, { force: true });
  };

  const resetWarmUp = async () => {
    if (!match) return;
    await persistMatch({ ...match, startedAt: new Date().toISOString(), timerPausedAt: undefined }, { force: true });
  };

  const toggleTimerPause = async () => {
    if (!match?.startedAt) return;
    if (match.timerPausedAt) {
      const pauseDuration = Date.now() - new Date(match.timerPausedAt).getTime();
      const newStart = new Date(new Date(match.startedAt).getTime() + pauseDuration).toISOString();
      await persistMatch({ ...match, startedAt: newStart, timerPausedAt: undefined }, { force: true });
      return;
    }
    await persistMatch({ ...match, timerPausedAt: new Date().toISOString() }, { force: true });
  };

  return (
    <Card
      className={`admin-court min-h-48 transition-all duration-300 relative overflow-hidden p-4 border flex flex-col justify-between border-l-[4px] ${
        court.status === "InUse"
          ? "bg-white/[0.04] backdrop-blur-xl text-ivory border-l-amber-400"
          : court.status === "Reserved"
            ? "bg-purple-900/20 backdrop-blur-xl text-ivory border-l-purple-500 shadow-[0_4px_30px_rgba(168,85,247,0.15)] border-white/5"
            : court.status === "Maintenance"
              ? "bg-red-900/20 backdrop-blur-xl text-ivory border-l-red-500 border-white/5"
              : court.status === "Paused"
                ? "bg-amber-900/20 backdrop-blur-xl text-ivory border-l-amber-600 border-white/5"
                : "bg-white/[0.02] backdrop-blur-xl text-ivory border-l-emerald-600 hover:border-l-emerald-400 border-white/5"
      } ${isOvertime ? "animate-overtime" : ""}`}
      onDragOver={(event) => {
        const activeMatch = matches.find((item) => item.id === court.currentMatchId && item.status === "InProgress");
        const hasVacant = activeMatch && [...activeMatch.teamAPlayerIds, ...activeMatch.teamBPlayerIds].some((id) => id.startsWith("vacant"));
        if (court.status !== "Maintenance" && court.status !== "Paused" && (court.status !== "InUse" || hasVacant)) {
          event.preventDefault();
        }
      }}
      onDrop={async (event) => {
        event.preventDefault();
        const playerId = event.dataTransfer.getData("text/plain") || event.dataTransfer.getData("text/player-id");
        if (!playerId) return;

        if (court.status === "InUse") {
          await useClubStore.getState().joinActiveMatch(playerId, court.id);
        } else if (court.status !== "Maintenance" && court.status !== "Paused") {
          await assignPlayerToCourt(playerId, court.id);
        }
      }}
    >
      <div>
        <div className="flex items-center justify-between border-b border-white/5 pb-2.5 mb-3">
          <div className="flex items-center gap-2">
            <h2 className="font-display text-xl text-brass font-black uppercase tracking-wide">{court.name}</h2>
            {(court.status === "Available" || court.status === "Reserved") && (
              <button
                type="button"
                onClick={toggleReservedStatus}
                className={`h-5 min-h-0 px-2 text-[8px] font-black uppercase tracking-wider rounded transition border ${
                  court.status === "Reserved"
                    ? "bg-purple-500/20 border-purple-500/40 text-purple-200"
                    : "bg-white/5 border-white/10 text-ivory/60 hover:bg-white/10"
                }`}
                title="Mark court as reserved game (you can still assign players and start)"
              >
                {court.status === "Reserved" ? "★ Reserved" : "☆ Reserve"}
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Chip
              color={
                court.status === "InUse" ? "warning" :
                court.status === "Reserved" ? "accent" :
                court.status === "Maintenance" ? "danger" : "success"
              }
              variant="soft"
              className="font-black text-[11px] px-3 py-1.5 uppercase tracking-wider rounded-lg"
            >
              {court.status === "InUse" ? "IN USE" : court.status}
            </Chip>
          </div>
        </div>

        <div className="min-h-12">
          {court.status === "InUse" && isTimerPaused && (
            <div className="flex items-center gap-1.5 rounded-lg bg-amber-500/10 border border-amber-500/20 px-2.5 py-1.5 mb-2.5">
              <span className="text-[10px] font-black uppercase text-amber-300">⏸ Timer paused</span>
            </div>
          )}

          {match ? (
            <MatchLine matchId={match.id} />
          ) : court.status === "Reserved" ? (
            <ReservedStack courtId={court.id} />
          ) : court.status === "Maintenance" ? (
            <p className="mt-2 text-[10px] text-red-400 font-bold uppercase tracking-wider">Under Maintenance.</p>
          ) : court.status === "Paused" ? (
            <p className="mt-2 text-[10px] text-amber-400 font-bold uppercase tracking-wider">Temporarily paused.</p>
          ) : (
            <p className="mt-2 rounded-lg bg-forest/20 border border-forest/10 px-3 py-1.5 text-[10px] font-semibold text-ivory/80">
              Available for play rotation.
            </p>
          )}
        </div>
      </div>

      <div className="mt-4 pt-3 border-t border-white/5 space-y-3">
        {court.status === "InUse" && match?.startedAt && (
          <div className="flex flex-col gap-1.5 bg-black/20 p-1.5 rounded-xl border border-white/5">
            <div className="flex items-center justify-between gap-1.5">
              <span className="text-[9px] font-black uppercase text-linen/60 ml-1">Adjust time</span>
              <button
                type="button"
                onClick={toggleTimerPause}
                className={`h-6 px-2 rounded text-[9px] font-black uppercase transition ${
                  isTimerPaused
                    ? "bg-emerald-500/20 text-emerald-200 border border-emerald-500/40"
                    : "bg-amber-500/20 text-amber-200 border border-amber-500/40"
                }`}
              >
                {isTimerPaused ? "Resume" : "Pause"}
              </button>
            </div>
            <div className="flex flex-wrap items-center gap-1">
              <button type="button" onClick={() => adjustCourtTime(-600)} className="h-6 px-1.5 rounded bg-white/5 hover:bg-white/10 text-[9px] font-bold text-ivory transition" title="Subtract 10 minutes">-10m</button>
              <button type="button" onClick={() => adjustCourtTime(-60)} className="h-6 px-1.5 rounded bg-white/5 hover:bg-white/10 text-[9px] font-bold text-ivory transition" title="Subtract 1 minute">-1m</button>
              <button type="button" onClick={() => adjustCourtTime(-10)} className="h-6 px-1.5 rounded bg-white/5 hover:bg-white/10 text-[9px] font-bold text-ivory transition" title="Subtract 10 seconds">-10s</button>
              <button type="button" onClick={() => adjustCourtTime(10)} className="h-6 px-1.5 rounded bg-white/5 hover:bg-white/10 text-[9px] font-bold text-ivory transition" title="Add 10 seconds">+10s</button>
              <button type="button" onClick={() => adjustCourtTime(60)} className="h-6 px-1.5 rounded bg-white/5 hover:bg-white/10 text-[9px] font-bold text-ivory transition" title="Add 1 minute">+1m</button>
              <button type="button" onClick={() => adjustCourtTime(600)} className="h-6 px-1.5 rounded bg-white/5 hover:bg-white/10 text-[9px] font-bold text-ivory transition" title="Add 10 minutes">+10m</button>
              <button type="button" onClick={resetWarmUp} className="h-6 px-2 rounded bg-brass text-forest hover:bg-linen text-[9px] font-black uppercase transition flex items-center gap-0.5 ml-1" title="Reset timer to 0">
                Reset
              </button>
            </div>
          </div>
        )}

        <div className="flex flex-wrap gap-1.5">
          {canAnnounce && (
            <Button
              onClick={announceCourtPlayers}
              className="h-8 min-h-0 bg-emerald-500/20 hover:bg-emerald-500/35 px-3 text-[10px] text-emerald-100 font-black uppercase tracking-wider rounded-lg border border-emerald-500/35 flex items-center gap-1 shadow-sm"
              title="Replay walk-up announcement for these players"
            >
              <Megaphone size={12} /> Announce
            </Button>
          )}
          {activeMatch ? (
            <Button type="button" onClick={() => { void finishCourt(court.id); }} className="h-8 min-h-0 bg-brass hover:bg-brass/90 px-3 text-[10px] text-forest font-black uppercase tracking-wider rounded-lg flex items-center gap-1 shadow-sm">
              <CheckCircle2 size={12} /> Finish
            </Button>
          ) : court.status === "Reserved" || court.status === "Assigned" ? (
            <>
              <Button
                onClick={handleStartReservedCourt}
                className="h-8 min-h-0 bg-brass hover:bg-brass/90 px-3 text-[10px] text-forest font-black uppercase tracking-wider rounded-lg shadow-sm"
              >
                Start Match
              </Button>
              <Button
                onClick={() => reserveCourt(court.id)}
                className="h-8 min-h-0 bg-ivory/15 hover:bg-ivory/25 px-3 text-[10px] font-black text-ivory uppercase tracking-wider rounded-lg border border-white/10"
              >
                Assign stack
              </Button>
              <Button onClick={() => returnReservedToQueue(court.id)} className="h-8 min-h-0 bg-white/10 hover:bg-white/20 px-2.5 text-[10px] text-white rounded-lg">
                Return
              </Button>
              <Button onClick={() => clearCourt(court.id)} className="h-8 min-h-0 bg-white/5 hover:bg-white/10 px-2.5 text-[10px] text-white/70 rounded-lg">
                Clear
              </Button>
            </>
          ) : court.status === "Available" ? (
            <>
              <Button
                onClick={toggleReservedStatus}
                className="h-8 min-h-0 bg-purple-500/20 hover:bg-purple-500/30 px-3 text-[10px] font-black text-purple-100 uppercase tracking-wider rounded-lg border border-purple-500/30"
              >
                Mark reserved
              </Button>
              <Button onClick={() => reserveCourt(court.id)} className="h-8 min-h-0 bg-brass hover:bg-brass/90 px-3 text-[10px] font-black text-forest uppercase tracking-wider rounded-lg flex items-center gap-1 shadow-sm">
                <Lock size={11} /> Hold court
              </Button>
              <Button onClick={toggleCourtPause} className="h-8 min-h-0 bg-amber-500/20 hover:bg-amber-500/30 px-2.5 text-[10px] text-amber-100 rounded-lg border border-amber-500/30">
                Pause court
              </Button>
            </>
          ) : court.status === "Paused" ? (
            <Button onClick={toggleCourtPause} className="h-8 min-h-0 bg-emerald-500/20 hover:bg-emerald-500/30 px-2.5 text-[10px] text-emerald-100 rounded-lg border border-emerald-500/30">
              Resume court
            </Button>
          ) : null}
        </div>
      </div>
    </Card>
  );
}

// ----------------------------------------------------
// PLAY ROTATION TAB
// ----------------------------------------------------
function PlayRotationTab() {
  const { 
    players, 
    courts, 
    matches, 
    stackOrder, 
    checkIn, 
    checkOut,
    checkOutAll,
    appendPlayersToQueue,
    generateMatches, 
    reserveCourt, 
    startReservedCourt, 
    finishCourt, 
    matchDurationMinutes, 
    setMatchDurationMinutes,
    currentSessionId,
    startNewSession,
    returnReservedToQueue,
    assignPlayerToCourt,
    removePlayerFromCourt,
    clearCourt,
  } = useClubStore();
  const [sessionName, setSessionName] = React.useState("");
  const [announcementMessage, setAnnouncementMessage] = React.useState("");
  const [loungeSearch, setLoungeSearch] = React.useState("");
  const [autoLogPayment, setAutoLogPayment] = React.useState(true);
  const clubStatus = useClubStore((state) => state.clubStatus);
  const setClubStatus = useClubStore((state) => state.setClubStatus);
  const [clubStatusDraft, setClubStatusDraft] = React.useState(clubStatus);
  const [selectedVoiceStyle, setSelectedVoiceStyle] = React.useState<VoiceStyle>(getVoiceStyle);
  const [testAnnouncement, setTestAnnouncement] = React.useState(
    "Court 1 overtime. Court 1 players: Juan, Maria, Alex, and Kim. Please finish your game."
  );

  const activePlayers = players.filter((p) => p.isActive !== false);
  const checkedInCount = activePlayers.filter((p) => p.checkedIn).length;
  const rosterPlayers = activePlayers.filter((player) => {
    if (player.checkedIn) return false;
    const query = loungeSearch.trim().toLowerCase();
    if (!query) return true;
    return [
      player.displayName,
      player.fullName,
      player.skillLevel,
      ...(player.tags ?? [])
    ].some((value) => value?.toLowerCase().includes(query));
  }).sort((a, b) => a.displayName.localeCompare(b.displayName));
  const changeVoiceStyle = (style: VoiceStyle) => {
    setSelectedVoiceStyle(style);
    setVoiceStyle(style);
  };

  return (
    <div className="space-y-4">
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes overtimeJiggle {
          0% { transform: translate(0, 0) scale(1); }
          25% { transform: translate(-1.5px, 1px) rotate(-0.3deg); }
          50% { transform: translate(1.5px, -1px) scale(1.01) rotate(0.3deg); }
          75% { transform: translate(-1.5px, -1px) rotate(-0.3deg); }
          100% { transform: translate(0, 0) scale(1); }
        }
        .animate-overtime {
          animation: overtimeJiggle 0.8s ease-in-out infinite;
          box-shadow: 0 0 25px rgba(239, 68, 68, 0.45) !important;
          border: 1.5px solid rgba(239, 68, 68, 0.6) !important;
        }
      `}} />

      <div className="rounded-2xl border border-white/10 bg-[#0a1f18]/80 px-3 py-2.5 sm:px-4 flex items-center justify-between">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-brass">Live courts</p>
          <p className="text-xs text-linen/60 mt-0.5">Courts up top · checked-in stack · queue stacks · roster on the right</p>
        </div>
        <Button
          onClick={() => {
            void useClubStore.getState().refreshSharedState({ force: true });
            void useClubStore.getState().broadcastTvAnnouncement({
              kind: "message",
              message: "Syncing displays..."
            });
          }}
          className="bg-brass/10 hover:bg-brass/20 text-brass text-[11px] h-8 px-3 font-bold"
        >
          <RotateCcw size={14} className="mr-1.5" />
          Refresh TV
        </Button>
      </div>

      <div className={`grid min-w-0 gap-3 sm:gap-4 ${
        courts.length === 3 ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3" : "sm:grid-cols-2 xl:grid-cols-3"
      }`}>
        {sortCourts(courts).map((court) => {
          const match = getActiveCourtMatch(court, matches);
          return (
            <AdminCourtCard
              key={court.id}
              court={court}
              match={match}
              matches={matches}
              matchDurationMinutes={matchDurationMinutes}
              assignPlayerToCourt={assignPlayerToCourt}
              startReservedCourt={startReservedCourt}
              returnReservedToQueue={returnReservedToQueue}
              clearCourt={clearCourt}
              reserveCourt={reserveCourt}
            />
          );
        })}
      </div>

      <div className="rounded-2xl border border-white/10 bg-[#0a1f18]/95 px-4 py-3 backdrop-blur-xl shadow-[0_8px_32px_rgba(0,0,0,0.3)]">
        <div className="flex flex-wrap items-center gap-2">
          <span className="mr-2 text-[10px] font-black uppercase tracking-[0.2em] text-brass">Quick Actions</span>
          <Button
            onClick={() => generateMatches()}
            className="min-h-10 gap-2 bg-brass px-4 text-xs font-black text-forest hover:bg-linen"
          >
            <Zap size={14} /> Assign Courts
          </Button>
          <Button
            onClick={() => {
              const name = window.prompt("Check in player by name (partial match):");
              if (!name) return;
              const match = players.find(p =>
                p.isActive !== false && !p.checkedIn &&
                p.displayName.toLowerCase().includes(name.toLowerCase())
              );
              if (match) {
                checkIn(match.id, autoLogPayment, true);
              } else {
                alert(`No unchecked player found matching "${name}". Try a different name.`);
              }
            }}
            className="min-h-10 gap-2 bg-ivory/15 px-4 text-xs font-bold text-ivory hover:bg-ivory/25"
          >
            <Plus size={14} /> Quick Check-In
          </Button>
          <Button
            onClick={() => {
              const msg = window.prompt("Broadcast a live club status message:", clubStatusDraft || "");
              if (msg !== null) {
                setClubStatusDraft(msg);
                setClubStatus(msg);
              }
            }}
            className="min-h-10 gap-2 bg-ivory/15 px-4 text-xs font-bold text-ivory hover:bg-ivory/25"
          >
            <Bell size={14} /> Broadcast
          </Button>
        </div>
      </div>

      <CheckedInStack
        players={players}
        matches={matches}
        courts={courts}
        stackOrder={stackOrder}
        onCheckOut={(playerId) => checkOut(playerId)}
        onCheckOutAll={() => {
          if (confirm("Check out all players tonight? This clears the rotation queue.")) {
            checkOutAll();
          }
        }}
        onAppendToQueue={(playerIds) => appendPlayersToQueue(playerIds)}
      />

      <div className="grid min-w-0 gap-4 xl:grid-cols-[minmax(0,1fr)_min(20rem,24vw)]">
        <StackBuilder players={players} courts={courts} matches={matches} stackOrder={stackOrder} />
        <aside className="hidden min-w-0 space-y-5 xl:block">
        <Card className="work-surface">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-clay">Quick action</p>
              <h2 className="font-display text-3xl text-ivory">Open play rotation</h2>
            </div>
            <Button onClick={() => { playSound("complete"); generateMatches(); }} className="bg-forest text-ivory hover:bg-forest/90">Assign Courts</Button>
          </div>
        </Card>
        {CALENDAR_PAGE_ENABLED && (
        <Card className="work-surface">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-clay">Bookings</p>
              <h2 className="font-display text-3xl text-ivory">Court Reservations</h2>
              {CALENDAR_PAGE_ENABLED && useClubStore.getState().reservations.filter((r) => r.status === "Requested").length > 0 && (
                <div className="mt-2 flex items-center gap-2">
                  <span className="flex h-2 w-2 rounded-full bg-amber-400 animate-pulse" />
                  <span className="text-xs font-bold text-amber-400">
                    {useClubStore.getState().reservations.filter((r) => r.status === "Requested").length} pending approval
                  </span>
                </div>
              )}
            </div>
            {CALENDAR_PAGE_ENABLED && (
              <Button 
                onClick={() => {
                  playSound("complete");
                  window.dispatchEvent(new CustomEvent("haff-admin-tab", { detail: "reservations" }));
                }} 
                className="bg-brass text-forest hover:bg-linen font-black"
              >
                <Calendar size={14} /> View Calendar
              </Button>
            )}
          </div>
        </Card>
        )}
        <Card className="bg-white/5 backdrop-blur-xl border border-white/10 text-ivory shadow-[0_12px_40px_rgba(0,0,0,0.25)] rounded-[2rem] p-5">
          <div className="flex flex-col gap-4">
            {/* Top row: Duration adjustment & Voice Toggle */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-white/10">
              <div>
                <p className="text-[10px] font-black uppercase tracking-[0.2em] text-brass">Game Duration</p>
                <h3 className="text-xl font-bold tracking-tight mt-0.5">{matchDurationMinutes} Minutes</h3>
              </div>
              <div className="flex items-center gap-1.5 bg-forest/50 p-1 rounded-xl border border-white/5">
                <Button 
                  onClick={() => setMatchDurationMinutes(matchDurationMinutes - 1)} 
                  className="h-8 w-8 bg-transparent text-ivory hover:bg-white/10 rounded-lg p-0 min-h-0 min-w-0"
                >
                  -
                </Button>
                <span className="text-xs font-mono px-1">min</span>
                <Button 
                  onClick={() => setMatchDurationMinutes(matchDurationMinutes + 1)} 
                  className="h-8 w-8 bg-transparent text-ivory hover:bg-white/10 rounded-lg p-0 min-h-0 min-w-0"
                >
                  +
                </Button>
              </div>
            </div>

            {/* Voice style toggler bar */}
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-brass mb-2">Voice Style</p>
              <div className="flex flex-wrap gap-1">
                {[
                  ["british", "British (fast)"],
                  ["warm", "Warm"],
                  ["clear", "Clear"],
                  ["bright", "Bright"],
                  ["formal", "Formal"]
                ].map(([style, label]) => (
                  <button
                    key={style}
                    type="button"
                    onClick={() => changeVoiceStyle(style as VoiceStyle)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1 ${
                      selectedVoiceStyle === style 
                        ? "bg-brass text-forest shadow" 
                        : "bg-forest/40 text-ivory/70 hover:bg-forest/65"
                    }`}
                  >
                    <Volume2 size={12} /> {label}
                  </button>
                ))}
              </div>
            </div>

            {/* Single Unified Custom Announcement Bar */}
            <div className="space-y-2 border-t border-white/10 pt-3">
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-brass">Club Announcement / Marshall Command</p>
              <div className="flex items-center gap-2 bg-[#06241b] rounded-xl p-1 border border-white/5 focus-within:ring-1 focus-within:ring-brass transition">
                <input
                  id="club-announcement"
                  className="flex-1 bg-transparent px-3 py-2 text-xs text-ivory placeholder:text-ivory/40 outline-none border-none"
                  onChange={(event) => setAnnouncementMessage(event.target.value)}
                  placeholder="Type message to broadcast (e.g. Court 1 overtime...)"
                  value={announcementMessage}
                />
                <Button
                  disabled={!announcementMessage.trim()}
                  onClick={() => {
                    void useClubStore.getState().broadcastTvAnnouncement({
                      kind: "message",
                      message: announcementMessage.trim()
                    });
                    setAnnouncementMessage("");
                  }}
                  className="bg-brass hover:bg-brass/90 text-forest font-black px-4 py-2 text-xs rounded-lg min-h-0"
                >
                  Broadcast
                </Button>
              </div>
              <p className="text-[9px] text-ivory/50">Sends to every TV display screen — voice and on-screen alert.</p>
            </div>
          </div>
        </Card>
        <Card 
          className="work-surface transition"
          onDragOver={(event) => event.preventDefault()}
          onDrop={async (event) => {
            event.preventDefault();
            const playerId = event.dataTransfer.getData("text/player-id");
            if (playerId) {
              await removePlayerFromCourt(playerId);
            }
          }}
        >
          <div className="flex items-end justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-clay">Find players</p>
              <h2 className="font-display text-3xl text-ivory">Player roster</h2>
              <p className="mt-1 text-xs font-semibold text-linen/60">
                {rosterPlayers.length} not checked in · {checkedInCount} here tonight
              </p>
            </div>
          </div>
          <div className="relative mt-4">
            <Search aria-hidden="true" className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ivory/45" size={17} />
            <label className="sr-only" htmlFor="lounge-search">Search player roster</label>
            <input
              id="lounge-search"
              className="control-field w-full rounded-xl py-3 pl-10 pr-10 text-sm text-ivory placeholder:text-ivory/45 focus:outline-none"
              onChange={(event) => setLoungeSearch(event.target.value)}
              placeholder="Search by player name, rank, or tag"
              type="search"
              value={loungeSearch}
            />
            {loungeSearch && (
              <button
                aria-label="Clear lounge search"
                className="absolute right-2 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-lg text-ivory/55 hover:bg-forest/10 hover:text-ivory"
                onClick={() => setLoungeSearch("")}
                type="button"
              >
                <X size={16} />
              </button>
            )}
          </div>
          <div className="flex items-center gap-2 mt-2 px-1 text-xs text-linen/75 font-semibold">
            <input
              type="checkbox"
              id="auto-log-payment"
              checked={autoLogPayment}
              onChange={(e) => setAutoLogPayment(e.target.checked)}
              className="rounded text-forest focus:ring-forest bg-white/10 border-white/10"
            />
            <label htmlFor="auto-log-payment" className="cursor-pointer select-none text-ivory">
              Auto-log {formatPeso(CHECK_IN_FEE)} check-in fee (pending until collected)
            </label>
          </div>
          <div className="mt-4 space-y-2 max-h-[36rem] overflow-y-auto pr-1">
            {rosterPlayers.map((player) => (
              <div
                key={player.id}
                className="flex items-center justify-between gap-3 rounded-xl border border-white/5 bg-white/[0.03] px-3.5 py-3 transition hover:bg-white/[0.06]"
              >
                <div className="flex min-w-0 flex-1 items-center gap-2.5">
                  <img
                    src={getPlayerAvatar(player)}
                    alt={player.displayName}
                    className="h-10 w-10 rounded-full object-cover border-2 border-white/10"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="font-bold text-ivory text-sm leading-tight truncate">{player.displayName}</p>
                    <p className="text-[11px] text-linen/55 mt-0.5">
                      {player.skillLevel} · {player.totalGamesPlayed} games
                    </p>
                    {player.statusNote && (
                      <p className="mt-0.5 max-w-full truncate text-[10px] font-semibold text-brass/70" title={player.statusNote}>
                        ✦ {player.statusNote}
                      </p>
                    )}
                  </div>
                </div>
                <Button
                  onClick={() => checkIn(player.id, autoLogPayment, true)}
                  className="min-h-9 px-4 text-xs font-black bg-brass text-forest hover:bg-brass/90 shadow-sm rounded-xl shrink-0"
                >
                  Check In
                </Button>
              </div>
            ))}
            {rosterPlayers.length === 0 && (
              <div className="rounded-xl bg-white/5 px-4 py-8 text-center">
                <p className="font-semibold text-ivory">
                  {loungeSearch.trim() ? "No players found" : "Everyone is checked in"}
                </p>
                <p className="mt-1 text-xs text-linen/60">
                  {loungeSearch.trim()
                    ? "Try another name, rank, or tag."
                    : "See tonight's players in the Checked-in stack above."}
                </p>
              </div>
            )}
          </div>
        </Card>
        <Card className="bg-white/5 backdrop-blur-xl border border-white/10 text-ivory">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.16em] text-brass">Live club status</p>
              <h2 className="mt-1 font-display text-3xl">Publish to the venue</h2>
              <p className="mt-1 text-sm text-linen/75">Shown in the admin header and on the TV display until cleared.</p>
            </div>
            {clubStatus && <span className="rounded-full bg-brass px-3 py-1 text-xs font-black text-forest">LIVE</span>}
          </div>
          <label className="sr-only" htmlFor="club-status">Club status</label>
          <textarea
            id="club-status"
            className="mt-4 min-h-24 w-full resize-y rounded-xl bg-ivory/10 px-4 py-3 text-sm leading-6 text-ivory outline-none placeholder:text-ivory/45 focus:ring-2 focus:ring-brass"
            maxLength={120}
            onChange={(event) => setClubStatusDraft(event.target.value)}
            placeholder="Example: Hydration break until 7:30 PM"
            value={clubStatusDraft}
          />
          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              disabled={!clubStatusDraft.trim()}
              onClick={() => setClubStatus(clubStatusDraft)}
              className="bg-brass text-forest hover:bg-linen"
            >
              Publish Status
            </Button>
            <Button
              disabled={!clubStatus}
              onClick={() => {
                setClubStatus("");
                setClubStatusDraft("");
              }}
              className="bg-ivory/10 text-ivory hover:bg-ivory/20"
            >
              Clear
            </Button>
          </div>
        </Card>
          </aside>
        </div>
    </div>
  );
}

// ----------------------------------------------------
// PLAYERS CRUD TAB
// ----------------------------------------------------
function normalizePhoneNumber(value: string) {
  return value.replace(/\D/g, "");
}

function validatePlayerRegistration(
  players: ReturnType<typeof useClubStore.getState>["players"],
  displayName: string,
  phoneNumber: string,
  accessCode: string,
  editingPlayerId?: string
) {
  const name = displayName.trim();
  const phone = normalizePhoneNumber(phoneNumber);
  if (name.length < 2) return "Enter the player's name.";
  if (phone.length < 10 || phone.length > 15) return "Enter a valid phone number with 10 to 15 digits.";
  if (!/^\d{4}$/.test(accessCode.trim())) return "Create a 4-digit player login code.";

  const duplicatePhone = players.find(
    (player) => player.id !== editingPlayerId && normalizePhoneNumber(player.phoneNumber ?? "") === phone
  );
  if (duplicatePhone) return `That phone number already belongs to ${duplicatePhone.displayName}.`;

  return "";
}

function PlayerHistoryPanel({
  player,
  maxMatches = 12,
  className = "",
}: {
  player: ReturnType<typeof useClubStore.getState>["players"][number];
  maxMatches?: number;
  className?: string;
}) {
  const allPlayers = useClubStore((state) => state.players);
  const matches = useClubStore((state) => state.matches);
  const courts = useClubStore((state) => state.courts);
  const playerMatches = matches
    .filter((match) => match.status === "Completed" && [...match.teamAPlayerIds, ...match.teamBPlayerIds].includes(player.id))
    .sort((a, b) => new Date(b.endedAt ?? 0).getTime() - new Date(a.endedAt ?? 0).getTime())
    .slice(0, maxMatches);

  const liveStats = React.useMemo(
    () => computePlayerStats(player.id, matches, courts, useClubStore.getState().matchDurationMinutes),
    [player.id, matches, courts]
  );

  return (
    <div className={className}>
      <div className="grid grid-cols-3 gap-2">
        <div className="rounded-xl bg-white/5 p-3 text-center">
          <p className="text-xl font-black text-brass">{player.totalGamesPlayed}</p>
          <p className="text-[9px] font-bold uppercase tracking-wider text-linen/60">Games</p>
        </div>
        <div className="rounded-xl bg-white/5 p-3 text-center">
          <p className="text-xl font-black text-brass">{formatMinutesPlayed(liveStats.minutesPlayed)}</p>
          <p className="text-[9px] font-bold uppercase tracking-wider text-linen/60">Court Time</p>
        </div>
        <div className="rounded-xl bg-white/5 p-3 text-center">
          <p className="text-xl font-black text-brass">{player.totalDaysPlayed}</p>
          <p className="text-[9px] font-bold uppercase tracking-wider text-linen/60">Visits</p>
        </div>
      </div>

      <div className="mt-4">
        <p className="text-[10px] font-black uppercase tracking-wider text-brass">Match history</p>
        {playerMatches.length === 0 ? (
          <p className="mt-2 text-sm text-linen/55">No completed games logged yet.</p>
        ) : (
          <div className="mt-2 max-h-64 space-y-2 overflow-y-auto pr-1">
            {playerMatches.map((match) => {
              const court = courts.find((c) => c.id === match.courtId);
              const onTeamA = match.teamAPlayerIds.includes(player.id);
              const partners = getMatchOpponentIds(match, player.id)
                .map((id) => allPlayers.find((item) => item.id === id))
                .filter((item): item is NonNullable<typeof item> => Boolean(item && !item.isVacant));
              return (
                <div key={match.id} className="rounded-xl bg-white/5 px-3 py-2 text-xs">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-brass">{court?.name ?? "Court"}</span>
                    <span className="font-mono">{onTeamA ? match.scoreA : match.scoreB}–{onTeamA ? match.scoreB : match.scoreA}</span>
                  </div>
                  {partners.length > 0 && (
                    <p className="mt-1 text-[10px] text-linen/65">With {partners.map((item) => item.displayName).join(", ")}</p>
                  )}
                  {match.endedAt && (
                    <span className="mt-1 block text-[10px] text-linen/50">
                      {new Date(match.endedAt).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function PlayersCrudTab() {
  const { players, addPlayer, updatePlayer, deletePlayer, checkIn, checkOut } = useClubStore();
  const [search, setSearch] = React.useState("");
  const [showArchived, setShowArchived] = React.useState(false);
  const [editingPlayer, setEditingPlayer] = React.useState<any>(null);
  const [historyPlayer, setHistoryPlayer] = React.useState<any>(null);
  const [isAdding, setIsAdding] = React.useState(false);

  // Form states
  const [displayName, setDisplayName] = React.useState("");
  const [fullName, setFullName] = React.useState("");
  const [skillLevel, setSkillLevel] = React.useState<any>("Beginner");
  const [rating, setRating] = React.useState("2.0");
  const [totalGamesPlayed, setTotalGamesPlayed] = React.useState("0");
  const [totalDaysPlayed, setTotalDaysPlayed] = React.useState("0");
  const [statusNote, setStatusNote] = React.useState("");
  const [tags, setTags] = React.useState("");
  const [membership, setMembership] = React.useState<"MEMBER" | "NON-MEMBER">("NON-MEMBER");
  const [phoneNumber, setPhoneNumber] = React.useState("");
  const [accessCode, setAccessCode] = React.useState("");
  const [emergencyNote, setEmergencyNote] = React.useState("");
  const [preferredPlayStyle, setPreferredPlayStyle] = React.useState("");
  const [notes, setNotes] = React.useState("");
  const [avatarUrl, setAvatarUrl] = React.useState("");
  const [formError, setFormError] = React.useState("");
  const [isSaving, setIsSaving] = React.useState(false);
  const [photoCropSource, setPhotoCropSource] = React.useState<string | null>(null);

  const filtered = players.filter((p) => {
    const matchesSearch = p.displayName.toLowerCase().includes(search.toLowerCase());
    const matchesActive = showArchived ? true : (p.isActive !== false);
    return matchesSearch && matchesActive;
  });

  const resetForm = () => {
    setDisplayName("");
    setFullName("");
    setSkillLevel("Beginner");
    setRating("2.0");
    setTotalGamesPlayed("0");
    setTotalDaysPlayed("0");
    setStatusNote("");
    setTags("");
    setMembership("NON-MEMBER");
    setPhoneNumber("");
    setAccessCode("");
    setEmergencyNote("");
    setPreferredPlayStyle("");
    setNotes("");
    setAvatarUrl("");
    setFormError("");
    setIsSaving(false);
    setEditingPlayer(null);
    setHistoryPlayer(null);
    setIsAdding(false);
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    const error = validatePlayerRegistration(players, displayName, phoneNumber, accessCode);
    if (error) {
      setFormError(error);
      return;
    }
    setIsSaving(true);
    setFormError("");
    try {
      const finalTags = tags.split(",").map(t => t.trim()).filter(Boolean);
      finalTags.push(membership === "MEMBER" ? "Member" : "Non-Member");
      await addPlayer({
        displayName: displayName.trim(),
        skillLevel,
        rating: parseFloat(rating) || 2.0,
        tags: finalTags,
        checkedIn: false,
        isActive: true,
        phoneNumber: normalizePhoneNumber(phoneNumber),
        accessCode: accessCode.trim(),
        emergencyNote: emergencyNote.trim() || undefined,
        preferredPlayStyle: preferredPlayStyle.trim() || undefined,
        notes: notes.trim() || undefined,
        avatarUrl: avatarUrl.trim() || undefined
      });
      playSound("checkin");
      resetForm();
    } catch {
      setFormError("The player could not be saved. Please try again.");
      setIsSaving(false);
    }
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPlayer) return;
    const error = validatePlayerRegistration(players, displayName, phoneNumber, accessCode, editingPlayer.id);
    if (error) {
      setFormError(error);
      return;
    }
    setIsSaving(true);
    setFormError("");
    try {
      const finalTags = tags.split(",").map(t => t.trim()).filter(Boolean);
      finalTags.push(membership === "MEMBER" ? "Member" : "Non-Member");
      await updatePlayer({
        ...editingPlayer,
        displayName: displayName.trim(),
        fullName: fullName.trim() || undefined,
        skillLevel,
        rating: parseFloat(rating) || 2.0,
        totalGamesPlayed: Math.max(0, parseInt(totalGamesPlayed, 10) || 0),
        totalDaysPlayed: Math.max(0, parseInt(totalDaysPlayed, 10) || 0),
        statusNote: statusNote.trim() || undefined,
        tags: finalTags,
        phoneNumber: normalizePhoneNumber(phoneNumber),
        accessCode: accessCode.trim(),
        emergencyNote: emergencyNote.trim() || undefined,
        preferredPlayStyle: preferredPlayStyle.trim() || undefined,
        notes: notes.trim() || undefined,
        avatarUrl: avatarUrl.trim() || undefined
      });
      resetForm();
    } catch {
      setFormError("The player changes could not be saved. Please try again.");
      setIsSaving(false);
    }
  };

  const startEdit = (player: any) => {
    setHistoryPlayer(null);
    setEditingPlayer(player);
    setDisplayName(player.displayName);
    setFullName(player.fullName ?? "");
    setSkillLevel(player.skillLevel);
    setRating(player.rating.toString());
    setTotalGamesPlayed(String(player.totalGamesPlayed ?? 0));
    setTotalDaysPlayed(String(player.totalDaysPlayed ?? 0));
    setStatusNote(player.statusNote ?? "");
    const isMember = player.tags?.includes("Member") ?? false;
    setMembership(isMember ? "MEMBER" : "NON-MEMBER");
    const cleanTags = (player.tags ?? []).filter((t: string) => t !== "Member" && t !== "Non-Member").join(", ");
    setTags(cleanTags);
    setPhoneNumber(player.phoneNumber ?? "");
    setAccessCode(player.accessCode ?? "1234");
    setEmergencyNote(player.emergencyNote ?? "");
    setPreferredPlayStyle(player.preferredPlayStyle ?? "");
    setNotes(player.notes ?? "");
    setAvatarUrl(player.avatarUrl ?? "");
    setIsAdding(false);
  };

  const startHistory = (player: any) => {
    setEditingPlayer(null);
    setIsAdding(false);
    setHistoryPlayer(player);
  };

  const handleAdminPhoto = async (file?: File) => {
    if (!file) return;
    setFormError("");
    try {
      setPhotoCropSource(await readProfileImageFile(file));
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "The photo could not be added.");
    }
  };

  return (
    <>
    {photoCropSource && (
      <ProfilePhotoCropper
        webpOutput={useSupabaseData()}
        imageSrc={photoCropSource}
        onCancel={() => setPhotoCropSource(null)}
        onComplete={(dataUrl) => {
          setAvatarUrl(dataUrl);
          setPhotoCropSource(null);
        }}
        onCompleteBlob={async (blob) => {
          try {
            const dataUrl = await new Promise<string>((resolve, reject) => {
              const reader = new FileReader();
              reader.onload = () => resolve(String(reader.result));
              reader.onerror = () => reject(new Error("Could not read photo."));
              reader.readAsDataURL(blob);
            });
            setAvatarUrl(dataUrl);
            setFormError("");
          } catch (error) {
            setFormError(error instanceof Error ? error.message : "Photo upload failed.");
          } finally {
            setPhotoCropSource(null);
          }
        }}
      />
    )}
    <div className="grid gap-5 lg:grid-cols-[1.3fr_0.7fr]">
      <Card className="work-surface">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="font-display text-3xl">Player Roster ({filtered.length})</h2>
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 text-xs font-semibold text-linen/75 cursor-pointer">
              <input 
                type="checkbox" 
                checked={showArchived} 
                onChange={(e) => setShowArchived(e.target.checked)} 
                className="rounded border-white/10 text-brass focus:ring-brass bg-white/10"
              />
              Show archived
            </label>
            <Button onClick={() => { resetForm(); setIsAdding(true); }} className="min-h-10 bg-forest text-ivory text-xs px-4">
              <Plus size={14} /> Add Player
            </Button>
          </div>
        </div>

        {/* Search */}
        <div className="relative mt-4 flex items-center">
          <Search size={16} className="absolute left-4 text-ivory/40" />
          <input
            type="text"
            placeholder="Search players..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="control-field w-full rounded-xl pl-11 pr-4 py-3 text-sm text-ivory placeholder:text-ivory/45 focus:outline-none"
          />
        </div>

        {/* Grid List */}
        <div className="mt-4 space-y-3 max-h-[600px] overflow-y-auto pr-1">
          {filtered.map((player) => (
            <div 
              key={player.id} 
              className={`flex items-center justify-between gap-3 rounded-xl border border-white/5 p-3.5 transition-colors hover:bg-white/10 ${
                player.isActive === false ? "bg-white/5 opacity-70" : "bg-white/10"
              }`}
            >
              <div className="flex min-w-0 items-center gap-3">
                <img
                  alt=""
                  className="h-11 w-11 shrink-0 rounded-full bg-forest/10 object-cover"
                  src={getPlayerAvatar(player)}
                />
                <div className="min-w-0">
                 <p className="font-semibold text-ivory text-lg leading-tight flex items-center gap-2 flex-wrap">
                   {player.displayName}
                   {player.tags?.includes("Member") && (
                     <span className="text-[9px] bg-brass/25 text-brass border border-brass/35 px-1.5 py-0.5 rounded-full font-black uppercase tracking-wider">Member</span>
                   )}
                   {player.tags?.includes("Non-Member") && (
                     <span className="text-[9px] bg-white/10 text-linen border border-white/20 px-1.5 py-0.5 rounded-full font-bold uppercase tracking-wider">Non-Member</span>
                   )}
                   {player.isActive === false && (
                     <span className="text-[10px] bg-clay/10 text-clay border border-clay/20 px-1.5 py-0.5 rounded font-bold uppercase tracking-wider">Archived</span>
                   )}
                 </p>
                <div className="mt-1 flex items-center gap-1.5 flex-wrap">
                  <RankBadge skillLevel={player.skillLevel} compact />
                  <span className="text-xs text-linen/50">· Rating: {player.rating} · {player.totalGamesPlayed} games</span>
                  {player.preferredPlayStyle && (
                    <span className="text-xs text-linen/60">· Style: {player.preferredPlayStyle}</span>
                  )}
                  {player.tags.filter((tag) => tag !== "Member" && tag !== "Non-Member").map((tag) => (
                    <span key={tag} className="text-[10px] bg-white/5 text-linen/70 border border-white/10 px-1.5 py-0.2 rounded font-medium">{tag}</span>
                  ))}
                </div>
                </div>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                {player.isActive === false ? (
                  <Button 
                    onClick={() => updatePlayer({ ...player, isActive: true })}
                    className="min-h-9 px-3 text-xs bg-forest text-ivory hover:bg-forest/90"
                  >
                    Restore
                  </Button>
                ) : (
                  <>
                    {!player.checkedIn ? (
                      <button
                        onClick={() => checkIn(player.id, true, true)}
                        className="px-3 py-1.5 rounded-lg bg-brass text-forest font-black text-xs hover:bg-brass/90 transition shadow-sm mr-1"
                        title="Check In Player"
                      >
                        Check In
                      </button>
                    ) : (
                      <button
                        onClick={() => checkOut(player.id)}
                        className="px-3 py-1.5 rounded-lg bg-clay text-ivory font-bold text-xs hover:bg-clay/90 transition shadow-sm mr-1"
                        title="Check Out Player"
                      >
                        Check Out
                      </button>
                    )}
                    <button 
                      onClick={() => startHistory(player)} 
                      className="p-2 rounded-full hover:bg-white/5 text-ivory/60 hover:text-brass transition"
                      title="View history & kudos"
                    >
                      <Activity size={16} />
                    </button>
                    <button 
                      onClick={() => startEdit(player)} 
                      className="p-2 rounded-full hover:bg-white/5 text-ivory/60 hover:text-ivory transition"
                      title="Edit Player"
                    >
                      <Edit2 size={16} />
                    </button>
                    <button 
                      onClick={() => {
                        if (confirm(`Are you sure you want to archive ${player.displayName}?`)) {
                          deletePlayer(player.id);
                          if (editingPlayer?.id === player.id || historyPlayer?.id === player.id) resetForm();
                        }
                      }} 
                      className="p-2 rounded-full hover:bg-red-50 text-red-500/60 hover:text-red-500 transition"
                      title="Archive Player"
                    >
                      <Trash2 size={16} />
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
          {filtered.length === 0 && (
            <p className="text-center py-10 text-forest/50">No players found matching "{search}"</p>
          )}
        </div>
      </Card>

      {/* Editor / History Panel */}
      <Card className="bg-white/5 backdrop-blur-xl border border-white/10 text-ivory h-fit max-h-[calc(100vh-8rem)] overflow-y-auto">
        {historyPlayer && !isAdding && !editingPlayer ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-2">
              <div>
                <p className="text-xs font-black uppercase tracking-wider text-brass">Player history</p>
                <h3 className="font-display text-2xl">{historyPlayer.displayName}</h3>
              </div>
              <button type="button" onClick={resetForm} className="p-1 rounded-full hover:bg-white/10 text-ivory/80"><X size={18} /></button>
            </div>
            <PlayerHistoryPanel player={historyPlayer} maxMatches={20} />
            <Button onClick={() => startEdit(historyPlayer)} className="w-full min-h-11 bg-brass text-forest font-black border-none">
              <Edit2 size={16} /> Edit player info & stats
            </Button>
          </div>
        ) : isAdding || editingPlayer ? (
          <form onSubmit={isAdding ? handleAdd : handleUpdate} className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-2xl">{isAdding ? "Create Player" : "Edit Player"}</h3>
              <button type="button" onClick={resetForm} className="p-1 rounded-full hover:bg-white/10 text-ivory/80"><X size={18} /></button>
            </div>

            <div className="rounded-xl bg-ivory/10 p-3">
              <div className="flex items-center gap-3">
                <img
                  alt="Player photo preview"
                  className="h-20 w-20 shrink-0 rounded-full bg-ivory object-cover"
                  src={avatarUrl || tapbackAvatar(displayName || "Player")}
                />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold uppercase tracking-wider text-brass">Profile photo</p>
                  <p className="mt-1 text-xs leading-5 text-linen/65">Upload a photo, then drag and zoom to crop before saving.</p>
                  <label className="mt-2 inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-full bg-ivory px-4 text-xs font-bold text-forest hover:bg-linen">
                    <ImagePlus size={16} />
                    Upload Photo
                    <input
                      accept="image/jpeg,image/png,image/webp"
                      className="sr-only"
                      disabled={Boolean(photoCropSource)}
                      onChange={(event) => void handleAdminPhoto(event.target.files?.[0])}
                      type="file"
                    />
                  </label>
                </div>
              </div>
              {avatarUrl && (
                <button className="mt-2 text-xs font-bold text-linen/70 hover:text-ivory" onClick={() => setAvatarUrl("")} type="button">
                  Remove photo
                </button>
              )}
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold uppercase tracking-wider text-brass">Display Name</label>
              <input
                type="text"
                required
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="e.g. John Doe"
                className="w-full rounded-2xl bg-white/10 text-ivory border-none px-4 py-3 placeholder:text-ivory/30 focus:outline-none focus:ring-2 focus:ring-brass text-sm shadow-inner"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold uppercase tracking-wider text-brass">Full Name (optional)</label>
              <input
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Legal / roster name"
                className="w-full rounded-2xl bg-white/10 text-ivory border-none px-4 py-3 placeholder:text-ivory/30 focus:outline-none focus:ring-2 focus:ring-brass text-sm shadow-inner"
              />
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-bold uppercase tracking-wider text-brass">Skill Level</label>
                <select
                  value={skillLevel}
                  onChange={(e) => setSkillLevel(e.target.value as any)}
                  className="w-full rounded-2xl bg-white/10 text-ivory border-none px-4 py-3 focus:outline-none focus:ring-2 focus:ring-brass text-sm shadow-inner appearance-none"
                >
                  {["Newbie", "Beginner", "Novice", "Low Intermediate", "Intermediate", "Pro"].map((level) => (
                    <option key={level} value={level} className="bg-forest text-ivory">{level}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold uppercase tracking-wider text-brass">Membership</label>
                <select
                  value={membership}
                  onChange={(e) => setMembership(e.target.value as any)}
                  className="w-full rounded-2xl bg-white/10 text-ivory border-none px-4 py-3 focus:outline-none focus:ring-2 focus:ring-brass text-sm shadow-inner appearance-none"
                >
                  <option value="MEMBER" className="bg-forest text-ivory">Member</option>
                  <option value="NON-MEMBER" className="bg-forest text-ivory">Non-Member</option>
                </select>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold uppercase tracking-wider text-brass">Rating</label>
                <input
                  type="number"
                  step="0.1"
                  min="0.5"
                  max="10.0"
                  required
                  value={rating}
                  onChange={(e) => setRating(e.target.value)}
                  className="w-full rounded-2xl bg-white/10 text-ivory border-none px-4 py-3 focus:outline-none focus:ring-2 focus:ring-brass text-sm shadow-inner"
                />
              </div>
            </div>

            {!isAdding && (
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold uppercase tracking-wider text-brass">Games played</label>
                  <input
                    type="number"
                    min={0}
                    value={totalGamesPlayed}
                    onChange={(e) => setTotalGamesPlayed(e.target.value)}
                    className="w-full rounded-2xl bg-white/10 text-ivory border-none px-4 py-3 focus:outline-none focus:ring-2 focus:ring-brass text-sm shadow-inner"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold uppercase tracking-wider text-brass">Days played</label>
                  <input
                    type="number"
                    min={0}
                    value={totalDaysPlayed}
                    onChange={(e) => setTotalDaysPlayed(e.target.value)}
                    className="w-full rounded-2xl bg-white/10 text-ivory border-none px-4 py-3 focus:outline-none focus:ring-2 focus:ring-brass text-sm shadow-inner"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold uppercase tracking-wider text-brass">Status note</label>
                  <input
                    type="text"
                    maxLength={40}
                    value={statusNote}
                    onChange={(e) => setStatusNote(e.target.value)}
                    placeholder="Lounge / TV note"
                    className="w-full rounded-2xl bg-white/10 text-ivory border-none px-4 py-3 placeholder:text-ivory/30 focus:outline-none focus:ring-2 focus:ring-brass text-sm shadow-inner"
                  />
                </div>
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-bold uppercase tracking-wider text-brass">Phone Number</label>
                <input
                  type="tel"
                  required
                  inputMode="tel"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  placeholder="e.g. 0917 123 4567"
                  className="w-full rounded-2xl bg-white/10 text-ivory border-none px-4 py-3 placeholder:text-ivory/30 focus:outline-none focus:ring-2 focus:ring-brass text-sm shadow-inner"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold uppercase tracking-wider text-brass">Player Login Code</label>
                <input
                  type="password"
                  required
                  inputMode="numeric"
                  pattern="[0-9]{4}"
                  maxLength={4}
                  value={accessCode}
                  onChange={(e) => setAccessCode(e.target.value.replace(/\D/g, "").slice(0, 4))}
                  placeholder="4 digits"
                  className="w-full rounded-2xl bg-white/10 text-ivory border-none px-4 py-3 placeholder:text-ivory/30 focus:outline-none focus:ring-2 focus:ring-brass text-sm shadow-inner"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold uppercase tracking-wider text-brass">Preferred Style</label>
              <input
                type="text"
                value={preferredPlayStyle}
                onChange={(e) => setPreferredPlayStyle(e.target.value)}
                placeholder="e.g. Competitive, Drills"
                className="w-full rounded-2xl bg-white/10 text-ivory border-none px-4 py-3 placeholder:text-ivory/30 focus:outline-none focus:ring-2 focus:ring-brass text-sm shadow-inner"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold uppercase tracking-wider text-brass">Emergency Note / Contact Info</label>
              <input
                type="text"
                value={emergencyNote}
                onChange={(e) => setEmergencyNote(e.target.value)}
                placeholder="e.g. Jane Doe (Wife) - 555-0122"
                className="w-full rounded-2xl bg-white/10 text-ivory border-none px-4 py-3 placeholder:text-ivory/30 focus:outline-none focus:ring-2 focus:ring-brass text-sm shadow-inner"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold uppercase tracking-wider text-brass">Tags (comma separated)</label>
              <input
                type="text"
                value={tags}
                onChange={(e) => setTags(e.target.value)}
                placeholder="e.g. Regular, Left Handed"
                className="w-full rounded-2xl bg-white/10 text-ivory border-none px-4 py-3 placeholder:text-ivory/30 focus:outline-none focus:ring-2 focus:ring-brass text-sm shadow-inner"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold uppercase tracking-wider text-brass">General Notes</label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Internal marshal notes about behavior, schedule, etc."
                rows={2}
                className="w-full rounded-2xl bg-white/10 text-ivory border-none px-4 py-3 placeholder:text-ivory/30 focus:outline-none focus:ring-2 focus:ring-brass text-sm shadow-inner resize-none"
              />
            </div>

            {formError && (
              <p role="alert" className="rounded-xl bg-red-950/35 px-3 py-2 text-sm font-semibold text-red-100">
                {formError}
              </p>
            )}

            <div className="pt-2 flex gap-2">
              <Button disabled={isSaving} type="submit" className="w-full bg-brass text-forest min-h-11 disabled:cursor-wait disabled:opacity-60">
                <Save size={16} /> {isSaving ? "Saving..." : "Save Player"}
              </Button>
              <Button type="button" onClick={resetForm} className="bg-white/10 text-ivory min-h-11 px-4">
                Cancel
              </Button>
            </div>

            {editingPlayer && (
              <div className="border-t border-white/10 pt-4">
                <p className="text-xs font-black uppercase tracking-wider text-brass mb-3">Play history</p>
                <PlayerHistoryPanel player={editingPlayer} maxMatches={12} />
              </div>
            )}
          </form>
        ) : (
          <div className="text-center py-8">
            <UserRound className="mx-auto text-brass mb-3" size={32} />
            <h3 className="font-display text-2xl">No Player Selected</h3>
            <p className="text-sm text-linen/75 mt-1">Select a player to edit, view history (activity icon), or add a new player.</p>
          </div>
        )}
      </Card>
    </div>
    </>
  );
}

// ----------------------------------------------------
// ADMIN RESERVATIONS TAB
// ----------------------------------------------------
function AdminReservationsTab() {
  return (
    <React.Suspense fallback={<LoadingScreen />}>
      <AdminReservationCalendar />
    </React.Suspense>
  );
}

// ----------------------------------------------------
// PARK LOUNGE TAB (admin)
// ----------------------------------------------------
function CourtSchedulePanel({ courts }: { courts: ReturnType<typeof useClubStore.getState>["courts"] }) {
  const { updateCourt } = useClubStore();
  const [settings, setSettings] = React.useState<CourtSettings>(getCourtSettings);
  const sortedCourts = React.useMemo(() => sortCourts(courts), [courts]);

  const updateSetting = (courtId: string, patch: Partial<{ enabled: boolean; openingTime: string; closingTime: string }>) => {
    const next = { ...settings, [courtId]: { ...getCourtSetting(courtId), ...patch } };
    setSettings(next);
    saveCourtSettings(next);
  };

  return (
    <Card className="work-surface">
      <p className="text-xs font-black uppercase tracking-[0.2em] text-brass">Court schedule</p>
      <h2 className="font-display text-3xl">Hours &amp; booking ({sortedCourts.length} courts)</h2>
      <p className="mt-1 text-xs text-linen/60">Set open/close times and whether each court accepts reservations.</p>
      <div className="mt-5 grid gap-3 md:grid-cols-3">
        {sortedCourts.map((court) => {
          const s = settings[court.id] ?? getCourtSetting(court.id);
          return (
            <div className="rounded-2xl bg-white/10 p-4 border border-white/5" key={court.id}>
              <div className="flex items-center justify-between gap-2 mb-3">
                <h3 className="font-display text-xl font-black text-ivory">{court.name}</h3>
                <Chip color={court.status === "InUse" ? "warning" : court.status === "Maintenance" ? "danger" : "success"} variant="soft" size="sm">
                  {court.status}
                </Chip>
              </div>
              <div className="flex flex-wrap gap-2 mb-3">
                <Button
                  onClick={() => void updateCourt({ ...court, reservable: court.reservable === false })}
                  className={`min-h-8 text-[11px] px-3 font-bold ${court.reservable !== false ? "bg-brass/20 text-brass" : "bg-slate-500/20 text-slate-300"}`}
                >
                  {court.reservable !== false ? "Reservable" : "Not Reservable"}
                </Button>
                <Button
                  onClick={() => void updateCourt({ ...court, status: court.status === "Maintenance" ? "Available" : "Maintenance" })}
                  className={`min-h-8 text-[11px] px-3 font-bold ${court.status === "Maintenance" ? "bg-emerald-500 text-white" : "bg-red-500/10 text-red-300"}`}
                >
                  {court.status === "Maintenance" ? "Available" : "Maintenance"}
                </Button>
              </div>
              <label className="block text-[10px] font-black uppercase tracking-wider text-brass mb-1">
                Opens
                <input type="time" value={s.openingTime} onChange={(e) => updateSetting(court.id, { openingTime: e.target.value })} className="mt-1 w-full rounded-xl bg-forest/40 border border-white/10 px-3 py-2 text-sm text-ivory" />
              </label>
              <label className="mt-2 block text-[10px] font-black uppercase tracking-wider text-brass mb-1">
                Closes
                <input type="time" value={s.closingTime} onChange={(e) => updateSetting(court.id, { closingTime: e.target.value })} className="mt-1 w-full rounded-xl bg-forest/40 border border-white/10 px-3 py-2 text-sm text-ivory" />
              </label>
              <button
                type="button"
                onClick={() => updateSetting(court.id, { enabled: !s.enabled })}
                className={`mt-3 w-full rounded-xl px-3 py-2 text-xs font-black ${s.enabled ? "bg-emerald-500/20 text-emerald-200" : "bg-slate-500/20 text-slate-300"}`}
              >
                {s.enabled ? "Bookings open" : "Bookings closed"}
              </button>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

// ----------------------------------------------------
// PLAY HISTORY TAB
// ----------------------------------------------------
function HistoryTab() {
  const { matches, players, courts } = useClubStore();

  const completedMatches = React.useMemo(() => {
    return matches
      .filter((m) => m.status === "Completed")
      .sort((a, b) => {
        const timeA = a.endedAt ? new Date(a.endedAt).getTime() : 0;
        const timeB = b.endedAt ? new Date(b.endedAt).getTime() : 0;
        return timeB - timeA;
      });
  }, [matches]);

  const totalGames = completedMatches.length;

  const handleClearHistory = async () => {
    if (confirm("Are you sure you want to clear all completed match history? This action cannot be undone.")) {
      const activeMatches = matches.filter(m => m.status !== "Completed");
      await db.transaction("rw", [db.matches], async () => {
        const all = await db.matches.toArray();
        for (const m of all) {
          if (m.status === "Completed") {
            await db.matches.delete(m.id);
          }
        }
      });
      useClubStore.setState({ matches: activeMatches });
    }
  };

  const handleExportCSV = () => {
    const rows = [
      ["Match", "Court", "Team A", "Team B", "Duration (min)", "Logged At"],
      ...completedMatches.map((match, i) => {
        const court = courts.find(c => c.id === match.courtId);
        const teamA = match.teamAPlayerIds.map(id => players.find(p => p.id === id)?.displayName ?? "").filter(Boolean).join(" & ");
        const teamB = match.teamBPlayerIds.map(id => players.find(p => p.id === id)?.displayName ?? "").filter(Boolean).join(" & ");
        const dur = match.startedAt && match.endedAt
          ? Math.round((new Date(match.endedAt).getTime() - new Date(match.startedAt).getTime()) / 60000)
          : "";
        const time = match.endedAt ? new Date(match.endedAt).toLocaleString() : "";
        return [i + 1, court?.name ?? "", teamA, teamB, dur, time];
      })
    ];
    const csv = rows.map(r => r.map(v => `"${String(v).replace(/"/g, '""')}"`).join(",")).join("\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv" }));
    a.download = `haff-history-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
  };

  return (
    <div className="grid gap-5 lg:grid-cols-[1.3fr_0.7fr]">
      <Card className="work-surface">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-display text-3xl text-forest">Play History Log</h2>
            <p className="text-xs text-forest/70 mt-1">Showing all completed games from active courts</p>
          </div>
          <div className="flex items-center gap-2">
            {completedMatches.length > 0 && (
              <Button onClick={handleExportCSV} className="min-h-10 bg-forest hover:bg-forest/90 text-ivory text-xs px-4">
                <Download size={14} className="mr-1.5" /> Export CSV
              </Button>
            )}
            {completedMatches.length > 0 && (
              <Button onClick={handleClearHistory} className="min-h-10 bg-red-700 hover:bg-red-800 text-ivory text-xs px-4">
                <Trash2 size={14} className="mr-1.5" /> Clear
              </Button>
            )}
          </div>
        </div>

        <div className="mt-6 space-y-4 max-h-[550px] overflow-y-auto pr-1">
          {completedMatches.map((match) => {
            const court = courts.find(c => c.id === match.courtId);
            const teamANames = match.teamAPlayerIds
              .map(id => players.find(p => p.id === id)?.displayName)
              .filter(Boolean)
              .join(" & ");
            const teamBNames = match.teamBPlayerIds
              .map(id => players.find(p => p.id === id)?.displayName)
              .filter(Boolean)
              .join(" & ");
            
            const durationMin = match.startedAt && match.endedAt
              ? Math.round((new Date(match.endedAt).getTime() - new Date(match.startedAt).getTime()) / 60000)
              : 12;

            const timeStr = match.endedAt
              ? new Date(match.endedAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
              : "";

            return (
              <div 
                key={match.id}
                className="rounded-2xl p-4 bg-white/10 border border-white/5 hover:bg-white/15 transition flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-black bg-white/15 text-linen px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                      {court?.name ?? "Court"}
                    </span>
                    <span className="text-[10px] font-bold text-clay uppercase tracking-widest flex items-center gap-1">
                      <Clock size={11} /> {durationMin} min duration
                    </span>
                  </div>
                  
                  <div className="mt-2.5 text-base font-semibold text-ivory">
                    <span className="text-brass font-black">{teamANames || "Vacant"}</span>
                    <span className="text-xs text-linen/60 mx-2 uppercase">vs</span>
                    <span className="text-brass font-black">{teamBNames || "Vacant"}</span>
                  </div>
                </div>

                <div className="text-left sm:text-right shrink-0 border-t sm:border-t-0 border-white/5 pt-2 sm:pt-0">
                  <p className="text-xs font-black text-linen/55 uppercase tracking-wider">Match Logged</p>
                  <p className="text-sm font-bold text-ivory mt-0.5">{timeStr || "Just now"}</p>
                </div>
              </div>
            );
          })}
          {completedMatches.length === 0 && (
            <div className="text-center py-12 text-linen/40">
              <Calendar className="mx-auto text-linen/30 mb-2" size={36} />
              <p className="text-sm italic">No completed matches in history yet. Start play from active courts and tap Finish to log games.</p>
            </div>
          )}
        </div>
      </Card>

      <Card className="bg-white/5 backdrop-blur-xl border border-white/10 text-ivory h-fit p-5 rounded-2xl">
        <h3 className="font-display text-2xl text-brass border-b border-ivory/10 pb-3">Open Play Statistics</h3>
        <div className="mt-5 space-y-4">
          <div className="rounded-xl bg-ivory/8 p-4">
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-linen/70">Total Games Logged</span>
            <p className="text-5xl font-black text-brass mt-1 tracking-tight">{totalGames}</p>
            <p className="text-[10px] text-linen/60 mt-1.5">Matches finished and recorded today</p>
          </div>

          <div className="rounded-xl bg-ivory/8 p-4 space-y-3">
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-linen/70">Top Active Courts</span>
            {sortCourts(courts).map(court => {
              const courtCount = completedMatches.filter(m => m.courtId === court.id).length;
              return (
                <div key={court.id} className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-ivory/90">{court.name}</span>
                  <span className="rounded-full bg-brass/10 px-2 py-0.5 font-bold text-brass">{courtCount} games</span>
                </div>
              );
            })}
          </div>
        </div>
      </Card>
    </div>
  );
}

// ----------------------------------------------------
// COURT RESERVATION CALENDAR VIEWS
// ----------------------------------------------------
function CalendarView() {
  const [isAuthenticated, setIsAuthenticated] = React.useState(false);
  const [checkingAuth, setCheckingAuth] = React.useState(true);
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [authError, setAuthError] = React.useState("");

  React.useEffect(() => {
    apiFetch("/api/auth?action=me")
      .then((response) => parseResponseJson<{ user?: { role?: string } }>(response))
      .then((data) => setIsAuthenticated(data.user?.role === "ADMIN"))
      .catch(() => setIsAuthenticated(false))
      .finally(() => setCheckingAuth(false));
  }, []);

  if (checkingAuth) return <LoadingScreen />;
  if (!isAuthenticated) {
    const handleLogin = async (e: React.FormEvent) => {
      e.preventDefault();
      const response = await apiFetch("/api/auth?action=login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password })
      });
      const data = await parseResponseJson<{ user?: { role?: string }; error?: string }>(response);
      if (response.ok && data.user?.role === "ADMIN") {
        setIsAuthenticated(true);
        setAuthError("");
        window.dispatchEvent(new Event("haff-auth-change"));
        playSound("checkin");
      } else {
        setAuthError(data.user ? "This account is not an administrator." : (data.error ?? "Invalid administrator credentials"));
        playSound("complete");
      }
    };

    return (
      <div className="min-h-[calc(100vh-120px)] flex items-center justify-center px-4 py-12">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: "spring", stiffness: 300, damping: 24 }}
          className="max-w-md w-full bg-[#173f32] border border-white/10 rounded-[2.5rem] shadow-[0_24px_80px_rgba(0,0,0,0.3)] p-8 text-ivory relative overflow-hidden"
        >
          <div className="absolute -right-12 -top-12 opacity-[0.03] pointer-events-none">
            <LogoMark size="large" />
          </div>

          <div className="flex flex-col items-center text-center">
            <div className="h-16 w-16 rounded-2xl bg-forest flex items-center justify-center border border-white/10 shadow-inner">
              <LogoMark />
            </div>
            <h2 className="font-display text-3xl font-black mt-5 leading-none tracking-tight">HAFF Leisure Club - Cadiz City</h2>
            <p className="text-xs font-bold uppercase tracking-[0.24em] text-clay mt-2">Calendar Access</p>
          </div>

          <form onSubmit={handleLogin} className="mt-8 space-y-4">
            {authError && (
              <div className="p-3.5 bg-red-500/10 border border-red-500/20 text-red-300 rounded-2xl text-xs font-semibold text-center">
                {authError}
              </div>
            )}

            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-wider text-forest/70">Administrator Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="email@example.com"
                className="w-full rounded-2xl bg-forest/5 text-forest border-none px-4 py-3.5 focus:outline-none focus:ring-2 focus:ring-forest text-sm shadow-inner transition placeholder:text-forest/30"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-wider text-forest/70">Password</label>
              <PasswordField
                value={password}
                onChange={setPassword}
                className="w-full rounded-2xl bg-forest/5 text-forest border-none px-4 py-3.5 focus:outline-none focus:ring-2 focus:ring-forest text-sm shadow-inner transition placeholder:text-forest/30"
              />
            </div>

            <Button
              type="submit"
              className="w-full bg-brass text-forest hover:bg-linen font-black py-4 rounded-2xl shadow-xl transition-all hover:scale-[1.01] active:scale-95 border-none mt-6 flex items-center justify-center gap-2"
            >
              <Lock size={16} /> Sign In
            </Button>
          </form>
        </motion.div>
      </div>
    );
  }

  return (
    <section className="mx-auto max-w-7xl px-4 py-6 pb-32">
      <div className="relative overflow-hidden rounded-2xl bg-white/5 backdrop-blur-xl border border-white/10 p-5 text-ivory shadow-[0_18px_46px_rgba(0,0,0,0.2)] sm:p-6 mb-6">
        <div className="absolute -right-8 -top-12 opacity-[0.06]"><LogoMark size="large" /></div>
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-linen/80">HAFF Leisure Club</p>
        <h1 className="font-display text-4xl font-semibold leading-tight tracking-normal sm:text-5xl mt-1">
          Court Reservations
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-linen/85">
          Schedule and manage court rentals, check availability, and reserve play slots.
        </p>
      </div>
      <CalendarTab />
    </section>
  );
}

function FinanceView() {
  const [isAuthenticated, setIsAuthenticated] = React.useState(false);
  const [checkingAuth, setCheckingAuth] = React.useState(true);
  const [email, setEmail] = React.useState("");
  const [password, setPassword] = React.useState("");
  const [authError, setAuthError] = React.useState("");

  React.useEffect(() => {
    apiFetch("/api/auth?action=me")
      .then((response) => parseResponseJson<{ user?: { role?: string } }>(response))
      .then((data) => setIsAuthenticated(data.user?.role === "ADMIN"))
      .catch(() => setIsAuthenticated(false))
      .finally(() => setCheckingAuth(false));
  }, []);

  if (checkingAuth) return <LoadingScreen />;
  if (!isAuthenticated) {
    const handleLogin = async (e: React.FormEvent) => {
      e.preventDefault();
      const response = await apiFetch("/api/auth?action=login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password })
      });
      const data = await parseResponseJson<{ user?: { role?: string }; error?: string }>(response);
      if (response.ok && data.user?.role === "ADMIN") {
        setIsAuthenticated(true);
        setAuthError("");
        window.dispatchEvent(new Event("haff-auth-change"));
        playSound("checkin");
      } else {
        setAuthError(data.user ? "This account is not an administrator." : (data.error ?? "Invalid administrator credentials"));
        playSound("complete");
      }
    };

    return (
      <div className="min-h-[calc(100vh-120px)] flex items-center justify-center px-4 py-12">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: "spring", stiffness: 300, damping: 24 }}
          className="max-w-md w-full bg-[#173f32] border border-white/10 rounded-[2.5rem] shadow-[0_24px_80px_rgba(0,0,0,0.3)] p-8 text-ivory relative overflow-hidden"
        >
          <div className="absolute -right-12 -top-12 opacity-[0.03] pointer-events-none">
            <LogoMark size="large" />
          </div>

          <div className="flex flex-col items-center text-center">
            <div className="h-16 w-16 rounded-2xl bg-forest flex items-center justify-center border border-white/10 shadow-inner">
              <LogoMark />
            </div>
            <h2 className="font-display text-3xl font-black mt-5 leading-none tracking-tight">HAFF Leisure Club - Cadiz City</h2>
            <p className="text-xs font-bold uppercase tracking-[0.24em] text-clay mt-2">Finance Access</p>
          </div>

          <form onSubmit={handleLogin} className="mt-8 space-y-4">
            {authError && (
              <div className="p-3.5 bg-red-500/10 border border-red-500/20 text-red-300 rounded-2xl text-xs font-semibold text-center">
                {authError}
              </div>
            )}

            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-wider text-forest/70">Administrator Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="email@example.com"
                className="w-full rounded-2xl bg-forest/5 text-forest border-none px-4 py-3.5 focus:outline-none focus:ring-2 focus:ring-forest text-sm shadow-inner transition placeholder:text-forest/30"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-wider text-forest/70">Password</label>
              <PasswordField
                value={password}
                onChange={setPassword}
                className="w-full rounded-2xl bg-forest/5 text-forest border-none px-4 py-3.5 focus:outline-none focus:ring-2 focus:ring-forest text-sm shadow-inner transition placeholder:text-forest/30"
              />
            </div>

            <Button
              type="submit"
              className="w-full bg-brass text-forest hover:bg-linen font-black py-4 rounded-2xl shadow-xl transition-all hover:scale-[1.01] active:scale-95 border-none mt-6 flex items-center justify-center gap-2"
            >
              <Lock size={16} /> Sign In
            </Button>
          </form>
        </motion.div>
      </div>
    );
  }

  return (
    <section className="mx-auto max-w-7xl px-4 py-6 pb-32">
      <div className="relative overflow-hidden rounded-2xl bg-white/5 backdrop-blur-xl border border-white/10 p-5 text-ivory shadow-[0_18px_46px_rgba(0,0,0,0.2)] sm:p-6 mb-6">
        <div className="absolute -right-8 -top-12 opacity-[0.06]"><LogoMark size="large" /></div>
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-linen/80">HAFF Leisure Club</p>
        <h1 className="font-display text-4xl font-semibold leading-tight tracking-normal sm:text-5xl mt-1">
          Finance & Revenue
        </h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-linen/85">
          Track payments, verify play credits, and manage club ledger details.
        </p>
      </div>
      <PaymentsTab />
    </section>
  );
}

// ----------------------------------------------------
// COURT RESERVATION CALENDAR TAB
// ----------------------------------------------------
function CalendarTab() {
  const { courts, players, reservations, addReservation, cancelReservation } = useClubStore();
  const [selectedCourtId, setSelectedCourtId] = React.useState(courts[0]?.id || "");
  const [selectedPlayerId, setSelectedPlayerId] = React.useState("");
  const [reservationDate, setReservationDate] = React.useState(() => new Date().toISOString().split("T")[0]);
  const [startHour, setStartHour] = React.useState("16:00");
  const [endHour, setEndHour] = React.useState("17:00");
  const [title, setTitle] = React.useState("Court Play");
  const [notes, setNotes] = React.useState("");
  const [paymentStatus, setPaymentStatus] = React.useState<"Paid" | "Pending">("Pending");
  const [repeatWeeks, setRepeatWeeks] = React.useState("1");
  const [bookingError, setBookingError] = React.useState("");

  const hours = Array.from({ length: 20 }, (_, index) => {
    const totalMinutes = 8 * 60 + index * 30;
    return `${String(Math.floor(totalMinutes / 60)).padStart(2, "0")}:${String(totalMinutes % 60).padStart(2, "0")}`;
  });

  const handleBook = async () => {
    setBookingError("");
    if (!selectedCourtId || !selectedPlayerId) {
      setBookingError("Select both a court and a host player.");
      return;
    }
    const [startH, startM] = startHour.split(":").map(Number);
    const [endH, endM] = endHour.split(":").map(Number);
    const startIso = manilaDateTimeIso(reservationDate, startH, startM);
    const endIso = manilaDateTimeIso(reservationDate, endH, endM);
    if (new Date(endIso).getTime() <= new Date(startIso).getTime()) {
      setBookingError("End time must be after the start time.");
      return;
    }
    const hostPlayer = players.find((player) => player.id === selectedPlayerId);
    const count = Math.max(1, Math.min(12, Number(repeatWeeks) || 1));
    const seriesId = count > 1 ? crypto.randomUUID() : undefined;
    const occurrences = Array.from({ length: count }, (_, index) => {
      const day = new Date(`${reservationDate}T12:00:00+08:00`);
      day.setDate(day.getDate() + index * 7);
      const dayKey = reservationDateKey(day);
      return {
        start: manilaDateTimeIso(dayKey, startH, startM),
        end: manilaDateTimeIso(dayKey, endH, endM)
      };
    });
    const conflictingOccurrence = occurrences.find(({ start: occurrenceStart, end: occurrenceEnd }) =>
      reservations.some((reservation) =>
        ["Confirmed", "Requested"].includes(reservation.status)
        && reservation.courtId === selectedCourtId
        && new Date(occurrenceStart).getTime() < new Date(reservation.endTime).getTime()
        && new Date(occurrenceEnd).getTime() > new Date(reservation.startTime).getTime()
      )
    );
    if (conflictingOccurrence) {
      setBookingError(`This court is already booked on ${new Date(conflictingOccurrence.start).toLocaleDateString()} during that time.`);
      return;
    }
    try {
      for (const occurrence of occurrences) {
        await addReservation({
          title: title.trim() || "Court Play",
          notes: notes.trim(),
          courtId: selectedCourtId,
          hostPlayerId: selectedPlayerId,
          hostDisplayName: hostPlayer?.displayName,
          startTime: occurrence.start,
          endTime: occurrence.end,
          playerIds: [selectedPlayerId],
          status: "Confirmed",
          paymentStatus,
          feeAmount: COURT_HOURLY_FEE,
          seriesId
        });
      }
      alert(count > 1 ? `${count} weekly reservations created.` : "Reservation created successfully!");
    } catch (error) {
      setBookingError(error instanceof Error ? error.message : "The reservation could not be created.");
    }
  };

  return (
    <div className="grid gap-5 md:grid-cols-[1fr_2fr]">
      <Card className="p-5 bg-white/5 backdrop-blur-xl border border-white/10 text-ivory shadow-[0_12px_40px_rgba(0,0,0,0.25)] rounded-[2rem]">
        <h3 className="font-display text-2xl text-brass border-b border-white/10 pb-2">Book Court</h3>
        <div className="mt-4 space-y-4">
          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-brass block mb-1">Reservation Title</label>
            <input value={title} onChange={(event) => setTitle(event.target.value)} className="w-full rounded-xl bg-forest/50 text-white border border-white/10 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-brass" />
          </div>
          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-brass block mb-1">Select Court</label>
            <select
              value={selectedCourtId}
              onChange={(e) => setSelectedCourtId(e.target.value)}
              className="w-full rounded-xl bg-forest/50 text-white border border-white/10 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-brass"
            >
              {sortCourts(courts).map(c => (
                <option key={c.id} value={c.id} className="text-forest">{c.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-brass block mb-1">Select Host Player</label>
            <select
              value={selectedPlayerId}
              onChange={(e) => setSelectedPlayerId(e.target.value)}
              className="w-full rounded-xl bg-forest/50 text-white border border-white/10 px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-brass"
            >
              <option value="" className="text-forest">-- Choose Host Player --</option>
              {players.map(p => (
                <option key={p.id} value={p.id} className="text-forest">{p.displayName}</option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className="col-span-2">
              <label className="text-xs font-bold uppercase tracking-wider text-brass block mb-1">Date</label>
              <input type="date" min={new Date().toISOString().split("T")[0]} value={reservationDate} onChange={(event) => setReservationDate(event.target.value)} className="w-full rounded-xl bg-forest/50 text-white border border-white/10 px-3 py-2 text-sm focus:outline-none" />
            </div>
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-brass block mb-1">From</label>
              <select
                value={startHour}
                onChange={(e) => setStartHour(e.target.value)}
                className="w-full rounded-xl bg-forest/50 text-white border border-white/10 px-3 py-2 text-sm focus:outline-none"
              >
                {hours.map(h => (
                  <option key={h} value={h} className="text-forest">{h}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-brass block mb-1">To</label>
              <select
                value={endHour}
                onChange={(e) => setEndHour(e.target.value)}
                className="w-full rounded-xl bg-forest/50 text-white border border-white/10 px-3 py-2 text-sm focus:outline-none"
              >
                {hours.map(h => (
                  <option key={h} value={h} className="text-forest">{h}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-brass block mb-1">Payment</label>
              <select value={paymentStatus} onChange={(event) => setPaymentStatus(event.target.value as "Paid" | "Pending")} className="w-full rounded-xl bg-forest/50 text-white border border-white/10 px-3 py-2 text-sm">
                <option value="Pending" className="text-forest">Pending</option>
                <option value="Paid" className="text-forest">Paid</option>
              </select>
            </div>
            <div>
              <label className="text-xs font-bold uppercase tracking-wider text-brass block mb-1">Repeat Weekly</label>
              <select value={repeatWeeks} onChange={(event) => setRepeatWeeks(event.target.value)} className="w-full rounded-xl bg-forest/50 text-white border border-white/10 px-3 py-2 text-sm">
                {[1, 2, 4, 8, 12].map((count) => <option className="text-forest" key={count} value={count}>{count === 1 ? "No repeat" : `${count} weeks`}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-brass block mb-1">Notes</label>
            <textarea value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Players, equipment, or special instructions" className="min-h-20 w-full rounded-xl bg-forest/50 text-white border border-white/10 px-3 py-2 text-sm placeholder:text-ivory/35" />
          </div>
          {bookingError && <p className="rounded-xl bg-red-500/10 p-3 text-xs font-bold text-red-300">{bookingError}</p>}
          <Button
            onClick={handleBook}
            className="w-full bg-brass text-forest hover:bg-brass/90 font-black py-3 rounded-xl border-none mt-2"
          >
            Create Reservation
          </Button>
        </div>
      </Card>

      <Card className="p-5 bg-white/5 backdrop-blur-xl border border-white/10 text-ivory shadow-[0_12px_40px_rgba(0,0,0,0.25)] rounded-[2rem]">
        <h3 className="font-display text-2xl text-brass border-b border-white/10 pb-2">Active Schedule Blocks</h3>
        <div className="mt-4 space-y-3">
          {reservations.filter(r => r.status === "Confirmed").map((res) => {
            const court = courts.find(c => c.id === res.courtId);
            const player = players.find(p => p.id === res.hostPlayerId);
            const startTimeString = new Date(res.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            const endTimeString = new Date(res.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            return (
              <div key={res.id} className="flex justify-between items-center bg-forest/40 rounded-2xl p-4 border border-white/5">
                <div>
                  <h4 className="font-bold text-sm text-white">{res.title || "Court Play"} · {court?.name}</h4>
                  <p className="text-xs text-ivory/70 mt-1">{new Date(res.startTime).toLocaleDateString()} · {startTimeString} - {endTimeString}</p>
                  <p className="text-[11px] text-ivory/55 mt-1">Host: {player?.displayName}{res.notes ? ` · ${res.notes}` : ""}</p>
                </div>
                <div className="flex items-center gap-2">
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-black uppercase ${res.paymentStatus === 'Paid' ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/20' : 'bg-amber-500/10 text-amber-300 border border-amber-500/20'}`}>
                    {res.paymentStatus}
                  </span>
                  <button
                    onClick={() => {
                      const reason = prompt("Reason for cancelling this reservation:");
                      if (!reason?.trim()) return;
                      void cancelReservation(res.id, reason);
                    }}
                    className="p-1 rounded-lg text-red-400 hover:bg-red-500/10 text-xs font-bold transition"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            );
          })}
          {reservations.filter(r => r.status === "Confirmed").length === 0 && (
            <div className="text-center py-12 text-ivory/40 italic text-sm">
              No active reservations scheduled for today.
            </div>
          )}
        </div>
      </Card>
    </div>
  );
}

// ----------------------------------------------------
// PAYMENTS & REVENUE TAB
// ----------------------------------------------------
function PaymentsTab() {
  const { transactions, players, addTransaction, completeTransaction, voidTransaction, deleteTransaction } = useClubStore();
  const [selectedPlayerId, setSelectedPlayerId] = React.useState("");
  const [txAmount, setTxAmount] = React.useState(String(CHECK_IN_FEE));
  const [txType, setTxType] = React.useState<"CheckInFee" | "CourtReservation" | "SessionPass">("CheckInFee");
  const [paymentMethod, setPaymentMethod] = React.useState<PaymentMethod>("Cash");
  const [referenceNote, setReferenceNote] = React.useState("");
  const [ledgerRange, setLedgerRange] = React.useState<LedgerRange>("today");

  const outstanding = React.useMemo(
    () => getOutstandingCheckIns(players, transactions),
    [players, transactions]
  );
  const todayTx = React.useMemo(
    () => filterTransactionsByRange(transactions, "today"),
    [transactions]
  );
  const weekTx = React.useMemo(
    () => filterTransactionsByRange(transactions, "week"),
    [transactions]
  );
  const monthTx = React.useMemo(
    () => filterTransactionsByRange(transactions, "month"),
    [transactions]
  );
  const filteredLedger = React.useMemo(
    () => filterTransactionsByRange(transactions, ledgerRange)
      .slice()
      .sort((a, b) => b.timestamp.localeCompare(a.timestamp)),
    [transactions, ledgerRange]
  );
  const todayRevenue = sumSuccessfulRevenue(todayTx);
  const weekRevenue = sumSuccessfulRevenue(weekTx);
  const monthRevenue = sumSuccessfulRevenue(monthTx);
  const pendingCount = countPendingTransactions(transactions);
  const todayBreakdown = revenueByPaymentMethod(todayTx);

  const handleManualTx = async () => {
    if (!selectedPlayerId) {
      alert("Please select a player.");
      return;
    }
    const val = parseFloat(txAmount);
    if (!val || val <= 0) {
      alert("Please enter a valid amount.");
      return;
    }
    if ((paymentMethod === "GCash" || paymentMethod === "Maya") && !referenceNote.trim()) {
      alert("Enter the GCash or Maya reference number.");
      return;
    }
    await addTransaction({
      playerId: selectedPlayerId,
      amount: val,
      type: txType,
      paymentMethod,
      status: "Success",
      referenceNote: referenceNote.trim() || undefined
    });
    setReferenceNote("");
    alert("Payment logged.");
  };

  const handleCollectOutstanding = async (playerId: string, pendingId?: string) => {
    if (pendingId) {
      await completeTransaction(pendingId);
      return;
    }
    await addTransaction({
      playerId,
      amount: CHECK_IN_FEE,
      type: "CheckInFee",
      paymentMethod: "Cash",
      status: "Success"
    });
  };

  const handleDeleteLedgerEntry = (transactionId: string, status: string) => {
    const message =
      status === "Success"
        ? "Permanently delete this payment? Use Void if you need to keep an audit trail."
        : "Delete this ledger entry? This cannot be undone.";
    if (!confirm(message)) return;
    void deleteTransaction(transactionId);
  };

  const ledgerRanges: { key: LedgerRange; label: string }[] = [
    { key: "today", label: "Today" },
    { key: "week", label: "This week" },
    { key: "month", label: "This month" },
    { key: "all", label: "All time" }
  ];

  return (
    <div className="space-y-5">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[
          { label: "Today", value: formatPeso(todayRevenue), hint: `${pendingCount} pending` },
          { label: "This week", value: formatPeso(weekRevenue), hint: "Mon–today" },
          { label: "This month", value: formatPeso(monthRevenue), hint: "Calendar month" },
          { label: "Outstanding", value: String(outstanding.length), hint: "Checked in, unpaid" }
        ].map((card) => (
          <Card key={card.label} className="p-4 bg-white/5 backdrop-blur-xl border border-white/10 text-ivory rounded-[1.5rem]">
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-brass">{card.label}</p>
            <p className="mt-2 font-display text-3xl font-bold text-white">{card.value}</p>
            <p className="mt-1 text-xs text-linen/70">{card.hint}</p>
          </Card>
        ))}
      </div>

      {outstanding.length > 0 && (
        <Card className="p-5 bg-amber-500/10 backdrop-blur-xl border border-amber-400/20 text-ivory rounded-[2rem]">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-amber-400/20 pb-3">
            <div>
              <h3 className="font-display text-2xl text-amber-200">Outstanding check-ins</h3>
              <p className="text-sm text-linen/75">Players on court rotation who still need to pay {formatPeso(CHECK_IN_FEE)}.</p>
            </div>
            <span className="rounded-full bg-amber-400/15 px-3 py-1 text-xs font-black text-amber-100">
              {outstanding.length} unpaid
            </span>
          </div>
          <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {outstanding.map(({ player, pendingTransaction }) => (
              <div key={player.id} className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-black/20 px-4 py-3">
                <div>
                  <p className="font-bold text-white">{player.displayName}</p>
                  <p className="text-xs text-linen/70">
                    {pendingTransaction ? "Fee logged, awaiting collection" : "No fee logged yet"}
                  </p>
                </div>
                <Button
                  onClick={() => void handleCollectOutstanding(player.id, pendingTransaction?.id)}
                  className="shrink-0 bg-brass text-forest hover:bg-brass/90 font-black px-4 py-2 rounded-xl border-none"
                >
                  Mark paid
                </Button>
              </div>
            ))}
          </div>
        </Card>
      )}

      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)]">
        <Card className="p-5 bg-white/5 backdrop-blur-xl border border-white/10 text-ivory shadow-[0_12px_40px_rgba(0,0,0,0.25)] rounded-[2rem] h-fit">
          <h3 className="font-display text-2xl text-brass border-b border-white/10 pb-2">Log payment</h3>
          <div className="mt-4 space-y-4">
            <div>
              <label className="text-[10px] font-black uppercase tracking-[0.2em] text-brass block mb-1">Player</label>
              <select
                value={selectedPlayerId}
                onChange={(e) => setSelectedPlayerId(e.target.value)}
                className="w-full rounded-xl bg-forest/50 text-white border border-white/10 px-3 py-2 text-sm focus:outline-none"
              >
                <option value="" className="text-forest">-- Select player --</option>
                {players.map((player) => (
                  <option key={player.id} value={player.id} className="text-forest">{player.displayName}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="text-[10px] font-black uppercase tracking-[0.2em] text-brass block mb-1">Amount (PHP)</label>
              <input
                type="number"
                value={txAmount}
                onChange={(e) => setTxAmount(e.target.value)}
                className="w-full rounded-xl bg-forest/50 text-white border border-white/10 px-3 py-2 text-sm focus:outline-none"
              />
            </div>
            <div>
              <label className="text-[10px] font-black uppercase tracking-[0.2em] text-brass block mb-1">Category</label>
              <div className="grid grid-cols-3 gap-2">
                {(["CheckInFee", "CourtReservation", "SessionPass"] as const).map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => {
                      setTxType(type);
                      if (type === "CheckInFee") setTxAmount(String(CHECK_IN_FEE));
                      if (type === "CourtReservation") setTxAmount(String(COURT_HOURLY_FEE));
                    }}
                    className={`py-2 rounded-lg text-[11px] font-bold border transition ${
                      txType === type ? "bg-brass text-forest border-brass" : "bg-transparent text-white border-white/10 hover:bg-white/5"
                    }`}
                  >
                    {type === "CheckInFee" ? "Check-in" : type === "CourtReservation" ? "Court" : "Pass"}
                  </button>
                ))}
              </div>
            </div>
            <div>
              <label className="text-[10px] font-black uppercase tracking-[0.2em] text-brass block mb-1">Payment method</label>
              <div className="grid grid-cols-2 gap-2">
                {PAYMENT_METHODS.map((method) => (
                  <button
                    key={method}
                    type="button"
                    onClick={() => setPaymentMethod(method)}
                    className={`py-2 rounded-lg text-xs font-bold border transition ${
                      paymentMethod === method ? "bg-brass text-forest border-brass" : "bg-transparent text-white border-white/10 hover:bg-white/5"
                    }`}
                  >
                    {method}
                  </button>
                ))}
              </div>
            </div>
            {(paymentMethod === "GCash" || paymentMethod === "Maya") && (
              <div>
                <label className="text-[10px] font-black uppercase tracking-[0.2em] text-brass block mb-1">Reference number</label>
                <input
                  value={referenceNote}
                  onChange={(e) => setReferenceNote(e.target.value)}
                  placeholder="e.g. 091234567890"
                  className="w-full rounded-xl bg-forest/50 text-white border border-white/10 px-3 py-2 text-sm focus:outline-none"
                />
              </div>
            )}
            <Button
              onClick={() => void handleManualTx()}
              className="w-full bg-brass text-forest hover:bg-brass/90 font-black py-3 rounded-xl border-none mt-2"
            >
              Submit payment
            </Button>
          </div>
        </Card>

        <Card className="p-5 bg-white/5 backdrop-blur-xl border border-white/10 text-ivory shadow-[0_12px_40px_rgba(0,0,0,0.25)] rounded-[2rem] space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/10 pb-3">
            <div>
              <h3 className="font-display text-2xl text-brass font-bold">Revenue ledger</h3>
              <p className="text-xs text-linen/70 mt-1">
                Cash {formatPeso(todayBreakdown.Cash)} · GCash {formatPeso(todayBreakdown.GCash)} · Maya {formatPeso(todayBreakdown.Maya)}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              {ledgerRanges.map((range) => (
                <button
                  key={range.key}
                  type="button"
                  onClick={() => setLedgerRange(range.key)}
                  className={`rounded-full px-3 py-1 text-[11px] font-black border transition ${
                    ledgerRange === range.key
                      ? "bg-brass text-forest border-brass"
                      : "bg-transparent text-white border-white/10 hover:bg-white/5"
                  }`}
                >
                  {range.label}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2 max-h-[28rem] overflow-y-auto pr-1">
            {filteredLedger.map((transaction) => {
              const player = players.find((item) => item.id === transaction.playerId);
              const method = normalizePaymentMethod(transaction.paymentMethod);
              const isVoided = transaction.status === "Voided";
              const isPending = transaction.status === "Pending";
              return (
                <div
                  key={transaction.id}
                  className={`flex items-center justify-between gap-3 rounded-2xl border border-white/5 bg-black/15 px-4 py-3 text-sm ${
                    isVoided ? "opacity-55" : ""
                  }`}
                >
                  <div className="min-w-0">
                    <p className="font-bold text-white truncate">{player?.displayName ?? "Unknown player"}</p>
                    <p className="text-xs text-linen/70">
                      {formatTransactionType(transaction.type)} · {method} · {transaction.status}
                    </p>
                    <p className="text-[11px] text-linen/50">
                      {new Date(transaction.timestamp).toLocaleString("en-PH", { timeZone: "Asia/Manila" })}
                    </p>
                    {transaction.referenceNote && (
                      <p className="text-[11px] text-brass/90 mt-0.5">Ref: {transaction.referenceNote}</p>
                    )}
                    {transaction.voidReason && (
                      <p className="mt-0.5 text-[10px] text-red-300">Voided: {transaction.voidReason}</p>
                    )}
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className={`font-mono font-bold ${
                      isVoided ? "text-ivory/40 line-through" : isPending ? "text-amber-300" : "text-emerald-400"
                    }`}>
                      {formatPeso(transaction.amount)}
                    </span>
                    {isPending && (
                      <button
                        className="rounded-lg bg-emerald-500/15 px-2 py-1 font-black text-emerald-200 hover:bg-emerald-500/25"
                        onClick={() => void completeTransaction(transaction.id)}
                        type="button"
                      >
                        Collect
                      </button>
                    )}
                    {transaction.status === "Success" && (
                      <button
                        className="rounded-lg bg-red-500/10 px-2 py-1 font-black text-red-300 hover:bg-red-500/20"
                        onClick={() => {
                          const reason = prompt("Why is this payment being removed?");
                          if (!reason?.trim()) return;
                          void voidTransaction(transaction.id, reason);
                        }}
                        type="button"
                      >
                        Void
                      </button>
                    )}
                    <button
                      className="rounded-lg bg-white/5 px-2 py-1 font-black text-linen/70 hover:bg-white/10 hover:text-red-200"
                      onClick={() => handleDeleteLedgerEntry(transaction.id, transaction.status)}
                      type="button"
                      title="Delete entry"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              );
            })}
            {filteredLedger.length === 0 && (
              <p className="text-xs text-ivory/40 italic text-center py-8">No transactions in this period.</p>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
}

// ----------------------------------------------------
// BACKUP & SETTINGS TAB
// ----------------------------------------------------
function SettingsTab() {
  const { matchDurationMinutes, setMatchDurationMinutes } = useClubStore();
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleExport = async () => {
    try {
      const backup = {
        players: await db.players.toArray(),
        courts: await db.courts.toArray(),
        matches: await db.matches.toArray(),
        sessions: await db.sessions.toArray(),
        syncQueue: await db.syncQueue.toArray(),
        timestamp: new Date().toISOString()
      };
      
      const blob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `haff_cadiz_city_backup_${new Date().toISOString().slice(0,10)}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      playSound("complete");
      alert("Database export downloaded successfully!");
    } catch (e) {
      console.error(e);
      alert("Failed to export database backup.");
    }
  };

  const handleImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
      try {
        const data = JSON.parse(e.target?.result as string);
        if (!data.players || !data.courts || !data.matches || !data.sessions) {
          throw new Error("Invalid backup file structure");
        }

        if (confirm("Importing this backup will overwrite all current players, courts, matches, and sessions on this device. Proceed?")) {
          await db.transaction("rw", [db.players, db.courts, db.matches, db.sessions], async () => {
            await db.players.clear();
            await db.courts.clear();
            await db.matches.clear();
            await db.sessions.clear();

            await db.players.bulkPut(data.players);
            await db.courts.bulkPut(data.courts);
            await db.matches.bulkPut(data.matches);
            await db.sessions.bulkPut(data.sessions);
          });
          
          playSound("checkin");
          alert("Database imported successfully! Reloading state...");
          window.location.reload();
        }
      } catch (err) {
        console.error(err);
        alert("Failed to parse or restore backup. Verify file content integrity.");
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="grid gap-5 md:grid-cols-2">
      <Card className="work-surface">
        <h2 className="font-display text-3xl">System Configurations</h2>
        <p className="text-sm text-linen/70 mt-1">Global timers and rotation settings for court assignments.</p>

        <div className="mt-6 space-y-4">
          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-clay">Default Match Duration</label>
            <div className="mt-2 flex items-center gap-3">
              <Button onClick={() => setMatchDurationMinutes(matchDurationMinutes - 1)} className="bg-white/10 hover:bg-white/15 text-ivory min-h-10 px-4">-</Button>
              <span className="text-xl font-bold font-display w-24 text-center">{matchDurationMinutes} mins</span>
              <Button onClick={() => setMatchDurationMinutes(matchDurationMinutes + 1)} className="bg-forest text-ivory min-h-10 px-4">+</Button>
            </div>
            <p className="text-xs text-linen/50 mt-1.5">Determines the threshold before match cards transition to overtime on the display boards.</p>
          </div>
          <div className="mt-6 border-t border-white/10 pt-4">
            <label className="text-xs font-bold uppercase tracking-wider text-clay block mb-2">Queuing Simulation</label>
            <Button 
              onClick={async () => {
                await useClubStore.getState().seedDemoPlayers();
                playSound("checkin");
                alert("Successfully seeded 12 checked-in demo players into the stack rotation!");
              }} 
              className="bg-brass text-forest hover:bg-linen font-black py-2.5 px-4 rounded-xl min-h-0 text-xs w-full"
            >
              Seed 12 Active Demo Players
            </Button>
            <p className="text-[10px] text-linen/50 mt-1.5">Populates the queue stack with 12 mock players with Beginner/Intermediate/Pro skill levels to test court rotation.</p>
          </div>
        </div>
      </Card>

      <Card className="bg-white/5 backdrop-blur-xl border border-white/10 text-ivory">
        <h2 className="font-display text-3xl">Offline Safety & Backup</h2>
        <p className="text-sm text-linen/75 mt-1">Export local IndexedDB content to a file, or restore from a previous backup.</p>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <Button onClick={handleExport} className="bg-brass text-forest min-h-11 w-full sm:w-auto">
            <Download size={16} /> Export Backup
          </Button>
          
          <input
            type="file"
            accept=".json"
            ref={fileInputRef}
            onChange={handleImport}
            className="hidden"
          />
          <Button onClick={() => fileInputRef.current?.click()} className="bg-white/10 text-ivory min-h-11 w-full sm:w-auto">
            <Upload size={16} /> Import Backup
          </Button>
        </div>
        <p className="text-xs text-linen/50 mt-4 leading-relaxed">
          HAFF Leisure Club - Cadiz City saves all transactions locally on your device storage first. Use file backup to transfer session logs to backup devices in low-connectivity areas.
        </p>
      </Card>
    </div>
  );
}

// ----------------------------------------------------
// INLINE AUTH MODAL (replaces community redirect)
// ----------------------------------------------------
type AuthMember = {
  email?: string;
  playerId?: string | null;
  displayName: string;
  role: string;
  avatarUrl?: string | null;
  skillLevel?: string | null;
};

function normalizeAuthSkillLevel(skillLevel?: string | null): Player["skillLevel"] {
  if (
    skillLevel === "Newbie" ||
    skillLevel === "Beginner" ||
    skillLevel === "Novice" ||
    skillLevel === "Low Intermediate" ||
    skillLevel === "Intermediate" ||
    skillLevel === "Pro"
  ) {
    return skillLevel;
  }
  return "Beginner";
}

async function seedAuthenticatedPlayer(member: AuthMember | null | undefined) {
  if (!member?.playerId) return;
  const players = useClubStore.getState().players;
  const existing = players.find((item) => item.id === member.playerId);
  const player: Player = {
    id: member.playerId,
    displayName: member.displayName || existing?.displayName || member.email?.split("@")[0] || "Player",
    fullName: existing?.fullName ?? member.displayName,
    skillLevel: normalizeAuthSkillLevel(member.skillLevel ?? existing?.skillLevel),
    rating: existing?.rating ?? 2,
    tags: existing?.tags ?? ["Member"],
    checkedIn: existing?.checkedIn ?? false,
    totalGamesPlayed: existing?.totalGamesPlayed ?? 0,
    totalDaysPlayed: existing?.totalDaysPlayed ?? 0,
    lastPlayedDate: existing?.lastPlayedDate,
    isActive: existing?.isActive ?? true,
    avatarUrl: member.avatarUrl ?? existing?.avatarUrl,
    statusNote: existing?.statusNote,
    version: existing?.version,
  };
  const nextPlayers = existing
    ? players.map((item) => (item.id === player.id ? player : item))
    : [...players, player];
  await liveDb.playersPut(player);
  useClubStore.setState({ players: nextPlayers });
}

function AuthModal({ onSuccess }: { onSuccess: (member: AuthMember) => void | Promise<void> }) {
  const [mode, setMode] = React.useState<"login" | "register">(() => {
    if (typeof window === "undefined") return "login";
    return sessionStorage.getItem("haff-auth-mode") === "register" ? "register" : "login";
  });
  const [form, setForm] = React.useState({ displayName: "", email: "", password: "", skillLevel: "Beginner" });
  const [error, setError] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [showPassword, setShowPassword] = React.useState(false);
  const [successMsg, setSuccessMsg] = React.useState("");

  React.useEffect(() => {
    sessionStorage.removeItem("haff-auth-mode");
  }, []);

  const switchMode = (next: "login" | "register") => {
    setMode(next);
    setError("");
    setSuccessMsg("");
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch(`/api/auth?action=${mode}`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form)
      });
      const text = await res.text();
      const data = text ? JSON.parse(text) : {};
      if (!res.ok) throw new Error(data.error ?? "Unable to continue");
      if (mode === "register") {
        setSuccessMsg("Welcome to HAFF Leisure Club! Your account has been created.");
      }
      window.dispatchEvent(new Event("haff-auth-change"));
      await onSuccess(data.user);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to continue");
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className="mx-auto mt-6 max-w-lg"
    >
      <div className="overflow-hidden rounded-3xl border border-ivory/10 bg-white/5 backdrop-blur-xl shadow-[0_24px_60px_rgba(0,0,0,0.4)]">
        {/* Header */}
        <div className="flex border-b border-ivory/10">
          <button
            type="button"
            onClick={() => switchMode("login")}
            className={`flex flex-1 items-center justify-center gap-2 py-4 text-sm font-black transition ${mode === "login" ? "bg-brass text-forest" : "text-ivory/60 hover:bg-ivory/5 hover:text-ivory"}`}
          >
            <LogIn size={16} /> Sign In
          </button>
          <button
            type="button"
            onClick={() => switchMode("register")}
            className={`flex flex-1 items-center justify-center gap-2 py-4 text-sm font-black transition ${mode === "register" ? "bg-brass text-forest" : "text-ivory/60 hover:bg-ivory/5 hover:text-ivory"}`}
          >
            <UserPlus size={16} /> Register
          </button>
        </div>

        <div className="p-6 text-ivory">
          <h2 className="font-display text-2xl font-black">
            {mode === "register" ? "Create your HAFF account" : "Welcome back"}
          </h2>
          <p className="mt-1 text-sm text-ivory/60">
            {mode === "register"
              ? "Register to track your queue position, check in, and manage your profile."
              : "Sign in to access your player dashboard and queue status."}
          </p>

          {successMsg && (
            <div className="mt-4 flex items-center gap-3 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 px-4 py-3 text-sm font-semibold text-emerald-300">
              <CheckCircle2 size={18} /> {successMsg}
            </div>
          )}
          {error && (
            <div className="mt-4 rounded-2xl bg-red-500/15 border border-red-500/30 px-4 py-3 text-sm font-semibold text-red-300">
              {error}
            </div>
          )}

          <form onSubmit={submit} className="mt-5 space-y-3">
            {mode === "register" && (
              <>
                <input
                  className="w-full rounded-2xl border-none bg-white/10 px-4 py-3 text-sm text-ivory placeholder:text-ivory/40 focus:outline-none focus:ring-2 focus:ring-brass"
                  placeholder="Display name"
                  required
                  value={form.displayName}
                  onChange={(e) => setForm({ ...form, displayName: e.target.value })}
                />
                <div>
                  <label htmlFor="auth-skill-level" className="mb-1.5 block text-[10px] font-bold uppercase tracking-wider text-ivory/50">
                    Skill level
                  </label>
                  <select
                    id="auth-skill-level"
                    className="w-full rounded-2xl border border-ivory/10 bg-white/10 px-4 py-3 text-sm text-ivory focus:outline-none focus:ring-2 focus:ring-brass appearance-none"
                    value={form.skillLevel}
                    onChange={(e) => setForm({ ...form, skillLevel: e.target.value })}
                  >
                    {["Newbie", "Beginner", "Novice", "Low Intermediate", "Intermediate", "Pro"].map((lvl) => (
                      <option key={lvl} value={lvl} className="bg-[#0b3a2c]">{lvl}</option>
                    ))}
                  </select>
                </div>
              </>
            )}
            <input
              type="email"
              autoComplete="email"
              className="w-full rounded-2xl border-none bg-white/10 px-4 py-3 text-sm text-ivory placeholder:text-ivory/40 focus:outline-none focus:ring-2 focus:ring-brass"
              placeholder="Email address"
              required
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
            />
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                autoComplete={mode === "register" ? "new-password" : "current-password"}
                className="w-full rounded-2xl border-none bg-white/10 px-4 py-3 pr-12 text-sm text-ivory placeholder:text-ivory/40 focus:outline-none focus:ring-2 focus:ring-brass"
                placeholder="Password"
                required
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
              />
              <button
                type="button"
                aria-label={showPassword ? "Hide" : "Show"}
                className="absolute inset-y-0 right-0 grid w-12 place-items-center text-ivory/40 hover:text-ivory"
                onClick={() => setShowPassword((v) => !v)}
              >
                {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
              </button>
            </div>
            <button
              type="submit"
              disabled={loading}
              className="mt-1 w-full min-h-12 rounded-2xl bg-brass px-6 font-black text-forest shadow-lg shadow-brass/20 transition hover:bg-linen active:scale-95 disabled:opacity-60"
            >
              {loading ? "Please wait…" : mode === "register" ? "Create Account" : "Sign In"}
            </button>
          </form>

          <p className="mt-5 border-t border-ivory/10 pt-5 text-center text-sm text-ivory/65">
            {mode === "login" ? (
              <>
                Don&apos;t have an account?{" "}
                <button
                  type="button"
                  onClick={() => switchMode("register")}
                  className="font-black text-brass underline underline-offset-2 transition hover:text-linen"
                >
                  Register here
                </button>
              </>
            ) : (
              <>
                Already have an account?{" "}
                <button
                  type="button"
                  onClick={() => switchMode("login")}
                  className="font-black text-brass underline underline-offset-2 transition hover:text-linen"
                >
                  Sign in
                </button>
              </>
            )}
          </p>
        </div>
      </div>
    </motion.div>
  );
}

// ----------------------------------------------------
// PLAYER VIEW SCREEN (QR/PHONE LOGIN INCLUDED)
// ----------------------------------------------------
function PlayerView({
  sessionMember,
  sessionReady
}: {
  sessionMember: SessionMember | null;
  sessionReady: boolean;
}) {
  // Narrow selectors so this view only re-renders when court/match/player data
  // actually changes, not on every unrelated store mutation (toasts, admin UI, etc.).
  const players = useClubStore((s) => s.players);
  const courts = useClubStore((s) => s.courts);
  const matches = useClubStore((s) => s.matches);
  const stackOrder = useClubStore((s) => s.stackOrder);
  const matchDurationMinutes = useClubStore((s) => s.matchDurationMinutes);
  const updatePlayer = useClubStore((s) => s.updatePlayer);
  const setView = useClubStore((s) => s.setView);
  const hydrated = useClubStore((s) => s.hydrated);
  const refreshSharedState = useClubStore((s) => s.refreshSharedState);
  const [selectedPlayerId, setSelectedPlayerId] = React.useState<string | null>(() => localStorage.getItem("haff-player-account-id"));
  const [recoveringProfile, setRecoveringProfile] = React.useState(false);
  const now = useNow();

  const player = selectedPlayerId ? players.find((item) => item.id === selectedPlayerId) : undefined;
  // Coarsen the clock dependency to per-minute: queue position and estimated play
  // times change at most once per minute, so recomputing every second is wasteful
  // across 100 player tabs. The 1 Hz `now` is still used for display elsewhere.
  const nowMinute = Math.floor(now / 60_000);
  const status = React.useMemo(
    () => player ? getPlayerWaitStatus(player.id, players, courts, matches, stackOrder, matchDurationMinutes, now) : null,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [player?.id, players, courts, matches, stackOrder, matchDurationMinutes, nowMinute]
  );
  const assignedMatch = selectedPlayerId
    ? matches.find((match) => match.status === "InProgress" && [...match.teamAPlayerIds, ...match.teamBPlayerIds].includes(selectedPlayerId))
    : undefined;
  const assignedCourt = courts.find((court) => court.id === assignedMatch?.courtId);
  const [dismissedTurnMatchId, setDismissedTurnMatchId] = React.useState<string | null>(null);
  
  // Login flow state
  const [loginMethod, setLoginMethod] = React.useState<"list" | "phone" | "qr" | null>(null);
  const [phoneNumber, setPhoneNumber] = React.useState("");
  const [accessCode, setAccessCode] = React.useState("");
  const [loginError, setLoginError] = React.useState("");
  const [showQrPass, setShowQrPass] = React.useState(false);
  const [simulatingQrScan, setSimulatingQrScan] = React.useState(false);

  // Edit Profile state
  const [isEditingProfile, setIsEditingProfile] = React.useState(false);
  const [editDisplayName, setEditDisplayName] = React.useState("");
  const [editSkillLevel, setEditSkillLevel] = React.useState("Beginner");
  const [editAvatarUrl, setEditAvatarUrl] = React.useState("");
  const [editStatusNote, setEditStatusNote] = React.useState("");
  const [statusNoteDraft, setStatusNoteDraft] = React.useState("");
  const [isSavingStatusNote, setIsSavingStatusNote] = React.useState(false);
  const [profilePhotoError, setProfilePhotoError] = React.useState("");
  const [photoCropSource, setPhotoCropSource] = React.useState<string | null>(null);

  // Story share state
  const [showStoryModal, setShowStoryModal] = React.useState(false);

  React.useEffect(() => {
    void refreshSharedState({ force: true, context: "player" });
  }, [refreshSharedState]);

  React.useEffect(() => {
    if (!sessionReady || !sessionMember?.playerId) return;
    localStorage.setItem("haff-player-account-id", sessionMember.playerId);
    setSelectedPlayerId(sessionMember.playerId);
    void seedAuthenticatedPlayer(sessionMember);
  }, [sessionReady, sessionMember?.playerId, sessionMember?.displayName, sessionMember?.avatarUrl, sessionMember?.skillLevel]);

  React.useEffect(() => {
    if (!sessionReady || !hydrated || !selectedPlayerId || player) {
      setRecoveringProfile(false);
      return;
    }
    setRecoveringProfile(true);
    const timer = window.setTimeout(() => {
      if (sessionMember && sessionMember.playerId !== selectedPlayerId) {
        localStorage.removeItem("haff-player-account-id");
        setSelectedPlayerId(null);
      } else if (sessionMember && sessionMember.playerId === selectedPlayerId) {
        void seedAuthenticatedPlayer(sessionMember).finally(() => setRecoveringProfile(false));
        return;
      }
      setRecoveringProfile(false);
    }, 1200);
    return () => window.clearTimeout(timer);
  }, [sessionReady, hydrated, selectedPlayerId, player, sessionMember]);

  React.useEffect(() => {
    if (!player) return;
    setStatusNoteDraft(player.statusNote ?? "");
  }, [player?.id, player?.statusNote]);

  React.useEffect(() => {
    if (!assignedMatch || assignedMatch.id === dismissedTurnMatchId) return;
    playSound("complete");
    if ("vibrate" in navigator) navigator.vibrate([300, 150, 300, 150, 600]);
  }, [assignedMatch?.id, dismissedTurnMatchId]);

  const activePlayers = players.filter((p) => p.isActive !== false);

  // Must be called unconditionally before any early returns (Rules of Hooks).
  const playerLiveStats = React.useMemo(
    () => player ? computePlayerStats(player.id, matches, courts, matchDurationMinutes, now) : null,
    [player?.id, matches, courts, matchDurationMinutes, nowMinute]
  );

  if (!sessionReady || !hydrated) return <LoadingScreen />;
  if (selectedPlayerId && !player && recoveringProfile) {
    return (
      <div className="mx-auto max-w-lg px-4 py-16 text-center text-ivory">
        <LoadingScreen />
        <p className="mt-4 text-sm text-linen/70">Loading your player profile…</p>
      </div>
    );
  }

  const startEditing = () => {
    if (!player) return;
    setEditDisplayName(player.displayName);
    setEditSkillLevel(player.skillLevel);
    setEditAvatarUrl(player.avatarUrl || "");
    setEditStatusNote(player.statusNote || "");
    setIsEditingProfile(true);
  };

  const handleSaveProfile = async () => {
    if (!player) return;
    const updated = {
      ...player,
      displayName: editDisplayName.trim() || player.displayName,
      skillLevel: editSkillLevel as typeof player.skillLevel,
      avatarUrl: editAvatarUrl.trim() || undefined,
      statusNote: editStatusNote.trim() || undefined,
    };
    try {
      await updatePlayer(updated);
      setStatusNoteDraft(editStatusNote.trim());
      setIsEditingProfile(false);
    } catch (error) {
      setProfilePhotoError(error instanceof Error ? error.message : "Profile save failed.");
    }
  };

  const handleSaveStatusNote = async () => {
    if (!player) return;
    setIsSavingStatusNote(true);
    try {
      const trimmed = statusNoteDraft.trim();
      await updatePlayer({ ...player, statusNote: trimmed || undefined });
      setStatusNoteDraft(trimmed);
      playSound("checkin");
    } finally {
      setIsSavingStatusNote(false);
    }
  };

  const handlePlayerPhoto = async (file?: File) => {
    if (!file) return;
    setProfilePhotoError("");
    try {
      setPhotoCropSource(await readProfileImageFile(file));
    } catch (error) {
      setProfilePhotoError(error instanceof Error ? error.message : "The photo could not be added.");
    }
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) {
      const seed = player ? player.id.split("-")[1] || "1" : "1";
      const val = parseInt(seed, 10) || 1;
      const day = (val % 28) + 1;
      const hour = (val % 12) || 12;
      const minute = (val * 7) % 60;
      const formattedMin = minute < 10 ? `0${minute}` : minute;
      const ampm = val % 2 === 0 ? "PM" : "AM";
      return `Jun ${day}, 2026 ${hour}:${formattedMin}${ampm}`;
    }
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) + " " + d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
    } catch {
      return dateStr;
    }
  };

  const handlePhoneLogin = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanNum = phoneNumber.replace(/\D/g, "");
    const cleanCode = accessCode.trim();
    if (!cleanNum || !cleanCode) return;
    
    const matched = activePlayers.find((p) => {
      if (p.phoneNumber) {
        const cleanP = p.phoneNumber.replace(/\D/g, "");
        if (cleanP === cleanNum && (p.accessCode ?? "1234") === cleanCode) return true;
      }
      const seedIndex = Number(p.id.split("-")[1]);
      if (!Number.isFinite(seedIndex)) return false;
      const mockPhone = `0917123456${seedIndex}`;
      return mockPhone === cleanNum && cleanCode === "1234";
    });

    if (matched) {
      playSound("checkin");
      localStorage.setItem("haff-player-account-id", matched.id);
      setSelectedPlayerId(matched.id);
      setLoginMethod(null);
      setPhoneNumber("");
      setAccessCode("");
      setLoginError("");
    } else {
      setLoginError("No player account matched that phone number and access code.");
    }
  };

  const handleQrLoginSimulate = (mockPlayerId: string) => {
    setSimulatingQrScan(true);
    setTimeout(() => {
      playSound("complete");
      localStorage.setItem("haff-player-account-id", mockPlayerId);
      setSelectedPlayerId(mockPlayerId);
      setLoginMethod(null);
      setSimulatingQrScan(false);
    }, 1500);
  };

  return (
    <motion.section 
      initial={{ opacity: 0, y: 16 }} 
      animate={{ opacity: 1, y: 0 }} 
      exit={{ opacity: 0 }} 
      className="mx-auto max-w-5xl px-4 py-4 pb-32"
    >
      {photoCropSource && (
        <ProfilePhotoCropper
          webpOutput={useSupabaseData()}
          imageSrc={photoCropSource}
          onCancel={() => setPhotoCropSource(null)}
          onComplete={(dataUrl) => {
            setEditAvatarUrl(dataUrl);
            setPhotoCropSource(null);
          }}
          onCompleteBlob={async (blob) => {
            if (!player) return;
            setProfilePhotoError("");
            try {
              const dataUrl = await new Promise<string>((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = () => resolve(String(reader.result));
                reader.onerror = () => reject(new Error("Could not read photo."));
                reader.readAsDataURL(blob);
              });
              setEditAvatarUrl(dataUrl);
            } catch (error) {
              setProfilePhotoError(error instanceof Error ? error.message : "Photo upload failed.");
            } finally {
              setPhotoCropSource(null);
            }
          }}
        />
      )}
      {assignedMatch && assignedMatch.id !== dismissedTurnMatchId && (
        <div className="fixed inset-0 z-[120] grid place-items-center bg-[#06241b] p-5 text-center text-ivory">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-xl rounded-[2rem] border border-white/10 bg-white/5 backdrop-blur-xl p-7 shadow-2xl sm:p-10"
          >
            <div className="mx-auto grid h-20 w-20 place-items-center rounded-full bg-brass text-forest">
              <Megaphone size={38} />
            </div>
            <p className="mt-6 text-sm font-black uppercase tracking-wider text-brass">Your turn</p>
            <h1 className="mt-2 font-display text-5xl font-black leading-none sm:text-7xl">{assignedCourt?.name ?? "Court ready"}</h1>
            <p className="mx-auto mt-5 max-w-md text-lg font-bold leading-7 text-linen">
              Your stack is ready. Please proceed to the court now.
            </p>
            <button
              className="mt-8 min-h-16 w-full rounded-2xl bg-brass px-6 text-xl font-black text-forest"
              onClick={() => setDismissedTurnMatchId(assignedMatch.id)}
            >
              I’m going to the court
            </button>
          </motion.div>
        </div>
      )}
      <div>
        <p className="text-xs font-bold uppercase tracking-wider text-brass">Private player page</p>
        <h1 className="font-display text-4xl leading-tight text-ivory sm:text-5xl">Know when you play.</h1>
      </div>

      {/* Queue alert banner — visible without scrolling */}
      {player && status && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className={`mt-3 flex items-center gap-3 rounded-2xl px-4 py-3 font-bold ${
            assignedMatch
              ? "bg-brass text-forest"
              : player.checkedIn
              ? "bg-emerald-500/15 border border-emerald-500/30 text-emerald-200"
              : "bg-ivory/10 border border-ivory/10 text-ivory/60"
          }`}
        >
          <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${
            assignedMatch ? "bg-forest animate-pulse" :
            player.checkedIn ? "bg-emerald-400 animate-pulse" :
            "bg-ivory/30"
          }`} />
          <span className="flex-1 text-sm">
            {assignedMatch
              ? `🎾 It's your turn! Head to ${assignedCourt?.name ?? "the court"} now.`
              : player.checkedIn
              ? `📍 ${status.showCountdown && status.estimatedAt ? formatEstimatedPlayTime(status.estimatedAt, now) : `${status.label}${status.summary ? ` · ${status.summary}` : ""}`}`
              : "You are not checked in yet. Check in at the desk."}
          </span>
        </motion.div>
      )}
      
      {!sessionMember && (
        <AuthModal onSuccess={async (member) => {
          await seedAuthenticatedPlayer(member);
          if (member?.playerId) {
            localStorage.setItem("haff-player-account-id", member.playerId);
            setSelectedPlayerId(member.playerId);
          }
          window.dispatchEvent(new Event("haff-auth-change"));
          void refreshSharedState({ force: true, context: "player" });
        }} />
      )}

      {/* PHONE LOGIN MODAL/PANEL */}
      {false && loginMethod === "phone" && (
        <Card className="bg-white/5 backdrop-blur-xl border border-white/10 text-ivory mt-4 max-w-md mx-auto p-5 shadow-2xl animate-fade-in">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-display text-2xl text-brass font-bold">Player Login</h2>
            <button onClick={() => setLoginMethod(null)} className="p-1.5 rounded-full hover:bg-white/10 text-ivory/60 transition"><X size={18} /></button>
          </div>
          <form onSubmit={handlePhoneLogin} className="space-y-4">
            {loginError && (
              <div className="rounded-2xl bg-red-500/10 border border-red-500/20 px-4 py-3 text-xs font-semibold text-red-300">
                {loginError}
              </div>
            )}
            <input
              type="tel"
              required
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              placeholder="Phone number"
              className="w-full rounded-2xl bg-forest/50 text-white border border-white/10 px-4 py-3 placeholder:text-ivory/40 focus:outline-none focus:ring-2 focus:ring-brass shadow-inner"
            />
            <input
              type="password"
              inputMode="numeric"
              required
              value={accessCode}
              onChange={(e) => setAccessCode(e.target.value)}
              placeholder="Access code"
              className="w-full rounded-2xl bg-forest/50 text-white border border-white/10 px-4 py-3 placeholder:text-ivory/40 focus:outline-none focus:ring-2 focus:ring-brass shadow-inner"
            />
            <Button type="submit" className="w-full bg-brass text-forest hover:bg-brass/90 font-black">
              Log In
            </Button>
          </form>
        </Card>
      )}

      {/* QR CODE SCAN SIMULATION */}
      {false && loginMethod === "qr" && (
        <Card className="bg-white/5 backdrop-blur-xl border border-white/10 text-ivory mt-4 max-w-md mx-auto p-5 text-center shadow-2xl">
          <div className="mb-4 flex items-center justify-between text-left">
            <h2 className="font-display text-2xl text-brass font-bold">Scan QR Member Pass</h2>
            <button onClick={() => setLoginMethod(null)} className="p-1.5 rounded-full hover:bg-white/10 text-ivory/60 transition"><X size={18} /></button>
          </div>
          
          <div className="relative mx-auto w-52 h-52 bg-black rounded-2xl overflow-hidden flex items-center justify-center text-white border-2 border-forest">
            {simulatingQrScan ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80">
                <div className="w-8 h-8 border-4 border-brass border-t-transparent rounded-full animate-spin mb-2" />
                <span className="text-xs uppercase tracking-widest text-brass">Decoding...</span>
              </div>
            ) : (
              <div className="text-center p-4">
                <QrCode size={48} className="mx-auto text-brass mb-2" />
                <p className="text-[10px] text-brass/75 uppercase tracking-wider">Awaiting Camera Scan</p>
              </div>
            )}
            <div className="absolute left-0 right-0 top-1/2 h-0.5 bg-red-500 shadow-[0_0_8px_red] animate-bounce" />
          </div>

          <div className="mt-5 space-y-2">
            <p className="text-xs text-ivory/60">Simulate scanning member pass for:</p>
            <div className="flex flex-wrap gap-2 justify-center">
              {activePlayers.slice(0, 4).map((p) => (
                <button
                  key={p.id}
                  onClick={() => handleQrLoginSimulate(p.id)}
                  disabled={simulatingQrScan}
                  className="px-3 py-1 bg-forest/50 hover:bg-forest border border-white/10 rounded-full text-xs font-semibold text-white transition"
                >
                  {p.displayName.split(" ")[0]}
                </button>
              ))}
            </div>
          </div>
        </Card>
      )}

      {/* ROSTER PICKER LOGIN */}
      {false && loginMethod === "list" && (
        <Card className="bg-white/5 backdrop-blur-xl border border-white/10 text-ivory shadow-2xl mt-4 max-w-xl mx-auto p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-display text-2xl font-bold text-brass">Select Your Roster Name</h2>
            <button onClick={() => setLoginMethod(null)} className="p-1.5 rounded-full hover:bg-white/10 text-ivory/60 transition"><X size={18} /></button>
          </div>
          <div className="grid gap-2 max-h-80 overflow-y-auto pr-1">
            {activePlayers.map((item) => (
              <button
                key={item.id}
                onClick={() => { localStorage.setItem("haff-player-account-id", item.id); setSelectedPlayerId(item.id); setLoginMethod(null); }}
                className={`flex min-h-14 items-center justify-between rounded-2xl px-4 text-left transition border ${selectedPlayerId === item.id ? "bg-brass text-forest border-brass font-bold" : "bg-forest/50 text-white border-white/5 hover:bg-forest"}`}
              >
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-full overflow-hidden bg-white/10 border border-white/10 shrink-0">
                    <img 
                      src={getPlayerAvatar(item)} 
                      alt={item.displayName} 
                      className="h-full w-full object-cover" 
                    />
                  </div>
                  <span className="font-semibold">{item.displayName}</span>
                </div>
                <span className="text-xs opacity-70">{item.checkedIn ? "Checked in" : "Not in"}</span>
              </button>
            ))}
          </div>
        </Card>
      )}

      {/* LOGGED IN PLAYER BOARD */}
      {selectedPlayerId && player && status && (
        <div className="mt-4 max-w-xl mx-auto">
          <Card className="bg-white/5 backdrop-blur-xl border border-white/10 text-ivory p-4 sm:p-5 rounded-2xl shadow-[0_18px_46px_rgba(2,20,15,0.28)] relative">
            {/* Top Row */}
            <div className="flex items-center justify-between border-b border-ivory/10 pb-3">
              <div>
                <span className="text-[10px] font-black uppercase tracking-[0.24em] text-brass">Player Dashboard</span>
                <p className="mt-1 text-sm font-semibold text-linen/80">Live stack, parking, and court status</p>
              </div>
            </div>

            {/* Greeting */}
            <div className="mt-4 flex items-center gap-3">
              <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-full bg-brass p-1 shadow-md">
                <img 
                  src={getPlayerAvatar(player)} 
                  alt={player.displayName} 
                  className="h-full w-full rounded-full object-cover"
                />
              </div>
              <div className="flex-1">
                <h2 className="font-display text-2xl font-bold tracking-tight text-ivory sm:text-3xl">
                  Welcome back, <span className="text-brass">{player.displayName}</span>!
                </h2>
                <p className="text-xs text-linen/70 mt-1">Here's your player dashboard</p>
              </div>
            </div>

            {/* Status note */}
            <div className="mt-4 rounded-xl bg-ivory/10 p-3 border border-ivory/10 shadow-inner space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-lg" aria-hidden>💬</span>
                <label htmlFor="player-status-note" className="text-[10px] font-black uppercase tracking-wider text-brass">
                  Status note
                </label>
              </div>
              <input
                id="player-status-note"
                type="text"
                maxLength={40}
                placeholder="Share a short note for the lounge & TV (max 40 chars)"
                value={statusNoteDraft}
                onChange={(e) => setStatusNoteDraft(e.target.value)}
                className="w-full rounded-xl bg-[#073427]/60 border border-white/10 px-3 py-2 text-xs text-ivory placeholder:text-ivory/40 outline-none focus:ring-1 focus:ring-brass"
              />
              <div className="flex gap-2">
                <Button
                  type="button"
                  onClick={() => void handleSaveStatusNote()}
                  disabled={isSavingStatusNote || statusNoteDraft.trim() === (player.statusNote ?? "").trim()}
                  className="flex-1 min-h-9 bg-brass text-forest hover:bg-ivory font-black text-xs border-none disabled:opacity-50"
                >
                  {isSavingStatusNote ? "Saving..." : "Save status"}
                </Button>
                {statusNoteDraft.trim() && (
                  <button
                    type="button"
                    onClick={async () => {
                      setStatusNoteDraft("");
                      if (player.statusNote) {
                        setIsSavingStatusNote(true);
                        try {
                          await updatePlayer({ ...player, statusNote: undefined });
                          playSound("checkin");
                        } finally {
                          setIsSavingStatusNote(false);
                        }
                      }
                    }}
                    className="rounded-xl px-3 text-[10px] text-brass hover:text-ivory font-bold uppercase shrink-0 border border-white/10"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>

            {/* 1. Status Section */}
            <div className="mt-4 rounded-xl bg-[#124a39] p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-brass">Rotation Status</p>
                  <div className="mt-1 flex items-baseline gap-2">
                    <span className={`inline-block h-2.5 w-2.5 rounded-full ${
                      player.checkedIn 
                        ? "bg-emerald-400 animate-pulse" 
                        : "bg-red-500"
                    }`} />
                    <span className="text-2xl font-black tracking-normal uppercase">
                      {player.checkedIn ? "Active" : "Not Checked In"}
                    </span>
                  </div>
                  <p className="text-xs text-linen/82 mt-1 font-semibold">
                    {player.checkedIn
                      ? status.label === "Playing now"
                        ? status.summary
                        : "In tonight's rotation"
                      : "Inactive · Not in queue"}
                  </p>
                </div>
                
                {/* QR Code Pass Quick Action Button */}
                <button
                  onClick={() => setShowQrPass(!showQrPass)}
                  className="flex flex-col items-center gap-1 p-2 bg-brass text-ink border border-brass rounded-2xl hover:bg-ivory transition"
                  title="Show/Hide QR Pass"
                >
                  <QrCode size={20} />
                  <span className="text-[9px] font-bold uppercase">QR Pass</span>
                </button>
              </div>

              {/* Simulated QR Pass */}
              {showQrPass && (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.95 }} 
                  animate={{ opacity: 1, scale: 1 }} 
                  className="mt-4 p-4 bg-white rounded-2xl text-center max-w-[200px] mx-auto text-forest shadow-inner"
                >
                  <div className="p-2 bg-ivory rounded-xl w-fit mx-auto border border-forest/10">
                    <QrCode size={120} className="text-forest mx-auto" />
                  </div>
                  <p className="font-bold text-sm mt-2 leading-tight">{player.displayName}</p>
                  <p className="text-[8px] text-forest/50 font-mono mt-0.5 uppercase">ID: {player.id}</p>
                </motion.div>
              )}

              {/* Queue Wait Time Box */}
              {player.checkedIn && (
                <div className="mt-3 rounded-xl bg-[#edf2ed] p-4 text-ink shadow-[0_12px_28px_rgba(6,36,27,0.18)]">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-1.5 text-clay">
                      <Clock size={18} />
                      <span className="text-[10px] font-bold uppercase tracking-[0.2em]">
                        {status?.showCountdown ? "Estimated play time" : "Queue status"}
                      </span>
                    </div>
                    <span className="rounded-full bg-forest px-3 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-ivory">
                      {status?.label}
                    </span>
                  </div>
                  {status?.showCountdown && status.estimatedAt ? (
                    <p className="mt-3 text-center font-display text-4xl font-black tracking-tight text-forest sm:text-5xl">
                      {formatEstimatedPlayTime(status.estimatedAt, now)}
                    </p>
                  ) : null}
                  {status?.summary ? (
                    <p className="mt-3 text-center text-xs font-semibold text-ink/70">{status.summary}</p>
                  ) : null}
                </div>
              )}

              {/* Status Action Button */}
              {!player.checkedIn && (
                <div className="mt-4 rounded-2xl bg-[#06241B] px-4 py-3.5 ring-1 ring-forest/30 text-center">
                  <p className="text-xs font-black uppercase tracking-[0.12em] text-brass">Check In at the Front Desk</p>
                  <p className="mt-1 text-[11px] leading-relaxed text-linen/65">
                    Please see the admin at the front desk to complete your check-in and join the queue.
                  </p>
                </div>
              )}
            </div>

            <PlayerTvPreview />

            {/* 2. Profile Card */}
            <div className="mt-4 rounded-xl bg-[#124a39] p-4">
              <div className="mb-3 flex items-center justify-between border-b border-[#2f7b61] pb-2.5">
                <div className="flex items-center gap-1.5 text-brass">
                  <UserRound size={16} />
                  <span className="text-[10px] font-bold uppercase tracking-[0.2em]">Profile Details</span>
                </div>
                <button 
                  onClick={() => {
                    if (isEditingProfile) {
                      setIsEditingProfile(false);
                    } else {
                      startEditing();
                    }
                  }}
                  className="text-xs font-bold text-brass hover:text-white transition flex items-center gap-1"
                >
                  {isEditingProfile ? "Cancel" : "Edit"}
                </button>
              </div>

              {isEditingProfile ? (
                <div className="mt-2 space-y-3">
                  <div>
                    <label className="text-[10px] uppercase font-bold text-linen/70 block mb-1">Display Name</label>
                    <input 
                      type="text" 
                      value={editDisplayName} 
                      onChange={(e) => setEditDisplayName(e.target.value)} 
                      className="w-full rounded-xl bg-white/10 text-ivory border-none px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-brass"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] uppercase font-bold text-brass block mb-2">Profile Photo</label>
                    <div className="mb-3 flex items-center gap-3 rounded-xl bg-white/5 p-3">
                      <img
                        alt="Profile photo preview"
                        className="h-20 w-20 shrink-0 rounded-full bg-ivory object-cover"
                        src={editAvatarUrl || getPlayerAvatar(player)}
                      />
                      <div className="flex-1">
                        <label className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-full bg-brass px-4 text-xs font-black text-forest hover:bg-ivory">
                          <ImagePlus size={16} />
                          Upload Photo
                          <input
                            accept="image/jpeg,image/png,image/webp"
                            className="sr-only"
                            disabled={Boolean(photoCropSource)}
                            onChange={(event) => void handlePlayerPhoto(event.target.files?.[0])}
                            type="file"
                          />
                        </label>
                        <p className="mt-1.5 text-[10px] leading-4 text-linen/60">Choose a photo, then drag and zoom to crop your profile picture.</p>
                      </div>
                    </div>
                    {profilePhotoError && <p className="mb-2 text-xs font-semibold text-red-200">{profilePhotoError}</p>}
                    <label className="text-[10px] uppercase font-bold text-linen/70 block mb-1">Choose an avatar</label>
                    <div className="grid grid-cols-5 gap-2">
                      {AVATAR_PRESETS.map((opt) => (
                        <button
                          key={opt.url}
                          type="button"
                          onClick={() => setEditAvatarUrl(opt.url)}
                          className={`relative aspect-square rounded-xl overflow-hidden border-2 transition ${
                            editAvatarUrl === opt.url ? "border-brass bg-brass/20" : "border-transparent bg-white/5 hover:border-white/20"
                          }`}
                        >
                          <img src={opt.url} alt={opt.name} className="w-full h-full object-cover" />
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="text-[10px] uppercase font-bold text-linen/70 block mb-1">Skill Level</label>
                    <select
                      value={editSkillLevel}
                      onChange={(e) => setEditSkillLevel(e.target.value)}
                      className="w-full rounded-xl bg-white/10 text-ivory border-none px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-brass appearance-none"
                    >
                      {["Newbie", "Beginner", "Novice", "Low Intermediate", "Intermediate", "Pro"].map((lvl) => (
                        <option key={lvl} value={lvl} className="bg-forest text-ivory">{lvl}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="text-[10px] uppercase font-bold text-linen/70 block mb-1">Status note</label>
                    <input
                      type="text"
                      maxLength={40}
                      value={editStatusNote}
                      onChange={(e) => setEditStatusNote(e.target.value)}
                      placeholder="Short note shown on lounge & TV"
                      className="w-full rounded-xl bg-white/10 text-ivory border-none px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-brass"
                    />
                  </div>
                  <Button 
                    onClick={handleSaveProfile}
                    className="w-full bg-brass text-forest hover:bg-brass/90 font-black py-2 rounded-xl text-xs mt-1 border-none"
                  >
                    Save Changes
                  </Button>
                </div>
              ) : (
                <div className="space-y-2.5 text-sm">
                  <div className="flex justify-between items-baseline">
                    <span className="text-linen/50 text-xs">Display Name</span>
                    <span className="font-bold text-ivory">{player.displayName}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-linen/50 text-xs">Skill Level</span>
                    <RankBadge skillLevel={player.skillLevel} compact />
                  </div>
                  {player.phoneNumber && (
                    <div className="flex justify-between items-baseline">
                      <span className="text-linen/50 text-xs">Phone</span>
                      <span className="font-mono text-xs text-ivory">{player.phoneNumber}</span>
                    </div>
                  )}
                  {player.statusNote && (
                    <div className="flex justify-between items-baseline gap-3">
                      <span className="text-linen/50 text-xs shrink-0">Status</span>
                      <span className="text-xs text-brass font-semibold text-right">{player.statusNote}</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* 3. Statistics Card */}
            <div className="mt-4 rounded-xl bg-[#124a39] p-4">
              <div className="mb-3 flex items-center justify-between border-b border-[#2f7b61] pb-2.5">
                <div className="flex items-center gap-1.5 text-brass">
                  <Activity size={16} />
                  <span className="text-[10px] font-bold uppercase tracking-[0.20em]">Player Statistics</span>
                </div>
                <button
                  type="button"
                  onClick={() => setShowStoryModal(true)}
                  className="flex items-center gap-1 rounded-lg bg-[#2ee882]/10 border border-[#2ee882]/25 px-2.5 py-1 text-[10px] font-black uppercase tracking-wider text-[#2ee882] hover:bg-[#2ee882]/20 transition"
                >
                  <Share2 size={12} />
                  Share Story
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2 text-center sm:grid-cols-4">
                <div className="rounded-2xl bg-[#073427] p-2.5">
                  <p className="text-2xl font-black text-ivory">{player.totalGamesPlayed}</p>
                  <p className="text-[9px] uppercase tracking-wider text-linen/50 mt-1">Games</p>
                </div>
                <div className="rounded-2xl bg-[#073427] p-2.5">
                  <p className="text-xl font-black text-[#2ee882] leading-tight">
                    {playerLiveStats ? formatMinutesPlayed(playerLiveStats.minutesPlayed) : "0m"}
                  </p>
                  <p className="text-[9px] uppercase tracking-wider text-linen/50 mt-1">Court Time</p>
                </div>
                <div className="rounded-2xl bg-[#073427] p-2.5">
                  <p className="text-2xl font-black text-ivory">{player.totalDaysPlayed}</p>
                  <p className="text-[9px] uppercase tracking-wider text-linen/50 mt-1">Visits</p>
                </div>
                <div className="rounded-2xl bg-[#073427] p-2.5">
                  <p className="text-xs font-black text-ivory leading-tight mt-1">
                    {playerLiveStats?.favCourt?.name ?? "—"}
                  </p>
                  <p className="text-[9px] uppercase tracking-wider text-linen/50 mt-1">Fav Court</p>
                </div>
              </div>

              <div className="mt-3 text-center">
                <p className="text-[10px] text-linen/55">
                  Last visit: <span className="text-ivory font-mono">{formatDate(player.lastPlayedDate)}</span>
                </p>
              </div>
            </div>

            {/* Recent Games */}
            {player && (() => {
              const completedGames = matches
                .filter((m) => m.status === "Completed" && [...m.teamAPlayerIds, ...m.teamBPlayerIds].includes(player.id))
                .sort((a, b) => new Date(b.endedAt ?? 0).getTime() - new Date(a.endedAt ?? 0).getTime())
                .slice(0, 8);

              return (
                <div className="mt-4 rounded-xl bg-[#124a39] p-4 text-ivory">
                  <div className="mb-3 flex items-center gap-1.5 border-b border-[#2f7b61] pb-2.5 text-brass">
                    <Activity size={16} />
                    <span className="text-[10px] font-bold uppercase tracking-[0.20em]">Play History</span>
                  </div>

                  {completedGames.length === 0 ? (
                    <p className="text-xs text-linen/50 italic text-center py-4">No completed matches yet.</p>
                  ) : (
                    <div className="space-y-3">
                      {completedGames.map((m) => {
                        const court = courts.find((c) => c.id === m.courtId);
                        const teammates = getMatchOpponentIds(m, player.id)
                          .map((id) => players.find((p) => p.id === id))
                          .filter((p): p is NonNullable<typeof p> => Boolean(p && !p.isVacant));
                        const onTeamA = m.teamAPlayerIds.includes(player.id);
                        const myScore = onTeamA ? m.scoreA : m.scoreB;
                        const oppScore = onTeamA ? m.scoreB : m.scoreA;

                        return (
                          <div key={m.id} className="rounded-2xl bg-[#073427] p-3 border border-white/5">
                            <div className="min-w-0">
                              <p className="text-[10px] font-bold uppercase tracking-wider text-brass">{court?.name ?? "Court"}</p>
                              <p className="text-xs font-bold text-ivory mt-0.5">
                                <span className="font-mono">{myScore}–{oppScore}</span>
                              </p>
                              {teammates.length > 0 && (
                                <p className="text-[10px] text-linen/65 mt-1 truncate">
                                  With {teammates.map((p) => p.displayName).join(", ")}
                                </p>
                              )}
                              {m.endedAt && (
                                <p className="text-[10px] text-linen/50 mt-0.5">
                                  {new Date(m.endedAt).toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                                </p>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })()}
          </Card>
        </div>
      )}

      {showStoryModal && player && playerLiveStats && (
        <StoryShareModal
          playerName={player.displayName}
          skillLevel={player.skillLevel}
          avatarUrl={getPlayerAvatar(player)}
          totalDaysPlayed={player.totalDaysPlayed}
          totalGamesPlayed={player.totalGamesPlayed}
          lastPlayedDate={player.lastPlayedDate}
          stats={playerLiveStats}
          onClose={() => setShowStoryModal(false)}
        />
      )}
    </motion.section>
  );
}

function MiniStat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl bg-ivory/10 p-3 text-center">
      <p className="text-3xl font-black tracking-normal leading-none">{value}</p>
      <p className="text-[10px] uppercase tracking-[0.2em] text-linen/70 mt-1.5">{label}</p>
    </div>
  );
}

function PlayerTvPreview() {
  const { courts, matches, players, stackOrder } = useClubStore();
  const visibleCourts = sortCourts(courts);

  return (
    <div className="mt-4 overflow-hidden rounded-xl bg-[#124a39]">
      <div className="flex items-center justify-between px-4 py-3">
        <div className="flex items-center gap-2 text-brass">
          <Monitor size={16} />
          <span className="text-[10px] font-bold uppercase tracking-[0.2em]">Monitor Preview</span>
        </div>
      </div>

      <div className="bg-forest p-3">
        <div className="rounded-[1.1rem] border border-ivory/12 bg-[#13221d] p-3 shadow-[inset_0_0_0_1px_rgba(244,241,232,0.03)]">
          <div className="flex items-end justify-between border-b border-ivory/10 pb-2">
            <div>
              <p className="text-[9px] font-black uppercase tracking-[0.18em] text-brass">HAFF Leisure Club</p>
              <p className="text-2xl font-black uppercase leading-none tracking-normal text-ivory">Now Playing</p>
            </div>
            <span className="rounded-full bg-brass px-2 py-1 text-[9px] font-black uppercase text-forest">Open Play</span>
          </div>

          <div className="mt-3 grid grid-cols-1 gap-2 min-[420px]:grid-cols-2">
            {visibleCourts.length === 0 ? (
              <p className="col-span-full py-6 text-center text-xs font-semibold text-linen/50">Courts loading…</p>
            ) : visibleCourts.map((court) => {
              const match = getActiveCourtMatch(court, matches);
              const names = match
                ? [...match.teamAPlayerIds, ...match.teamBPlayerIds]
                : court.reservedPlayerIds ?? [];
              const hasPlayers = names.length > 0;

              return (
                <div key={court.id} className="min-h-24 rounded-xl border border-ivory/10 bg-ivory/[0.06] p-2">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-black uppercase text-ivory">{court.name}</p>
                    <span className={`rounded-full px-2 py-0.5 text-[8px] font-black uppercase ${
                      match
                        ? "bg-amber-300 text-forest"
                        : court.status === "Reserved"
                        ? "bg-brass text-forest"
                        : court.status === "Maintenance"
                        ? "bg-clay text-ivory"
                        : "bg-ivory/12 text-linen"
                    }`}>
                      {match ? "In Use" : court.status === "Available" ? "Available" : court.status}
                    </span>
                  </div>
                  {hasPlayers ? (
                    <div className="mt-2 grid gap-1">
                      {names.slice(0, 4).map((id) => {
                        const person = resolvePlayerById(id, players);
                        return (
                          <p key={id} className="truncate rounded-lg bg-ivory/10 px-2 py-1 text-xs font-bold text-ivory">
                            {person.isVacant ? "Open Slot" : person.displayName}
                          </p>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="mt-5 text-center text-lg font-black uppercase tracking-normal text-brass">
                      {court.status === "Available" ? "Available" : court.status}
                    </p>
                  )}
                </div>
              );
            })}
          </div>

          <PlayerStackPreview
            stackOrder={stackOrder}
            players={players}
            matches={matches}
            courts={courts}
          />
        </div>
      </div>
    </div>
  );
}

function CourtTimer({ matchId, size }: { matchId: string; size: "small" | "large" }) {
  const match = useClubStore((state) => state.matches.find((item) => item.id === matchId));
  const duration = useClubStore((state) => state.matchDurationMinutes);
  const now = useSmoothNow(Boolean(match?.startedAt && !match?.timerPausedAt));
  if (!match?.startedAt) return null;
  const remainingMs = getRemainingMilliseconds(match.startedAt, duration, now, match.timerPausedAt);
  const overtime = remainingMs < 0;
  return (
    <div className={`rounded-full text-center font-black tracking-normal tabular-nums ${overtime ? "bg-clay text-ivory" : "bg-brass text-forest"} ${size === "large" ? "mt-auto px-4 py-2 text-[clamp(2rem,3.2vw,4rem)] leading-none" : "mt-5 px-5 py-3 text-3xl"}`}>
      <CountdownClock totalMs={Math.abs(remainingMs)} prefix={overtime ? "-" : ""} />
    </div>
  );
}

function PlayerChip({ 
  playerId, 
  tone = "dark",
  draggable = false,
  compact = false
}: { 
  playerId: string; 
  tone?: "dark" | "light";
  draggable?: boolean;
  compact?: boolean;
}) {
  const player = useClubStore((state) => state.players.find((item) => item.id === playerId));
  
  if (playerId.startsWith("vacant")) {
    return (
      <div
        className={`flex items-center justify-between gap-3 rounded-xl px-3 py-2 border border-dashed ${
          tone === "light"
            ? "border-forest/20 text-forest/40 bg-white/10"
            : "border-ivory/20 text-ivory/40 bg-ivory/5"
        }`}
      >
        <span className="text-xl font-bold leading-none tracking-normal italic">Open Slot</span>
        <span className="text-xs opacity-50">-</span>
      </div>
    );
  }

  if (!player) return null;
  
  return (
    <div
      draggable={draggable}
      onDragStart={(event) => {
        if (draggable) {
          event.dataTransfer.setData("text/player-id", playerId);
        }
      }}
      className={`rank-chip ${tone === "light" ? "tv-chip" : ""} rank-${rankKey(player.skillLevel)} flex items-center gap-2 rounded-xl ${compact ? "px-2.5 py-1.5" : "gap-3 px-3 py-2"} ${draggable ? "cursor-grab active:cursor-grabbing hover:brightness-95 transition" : ""} ${tone === "light" ? "bg-forest text-ivory" : "bg-ivory/10 text-ivory"}`}
    >
      <span className="flex min-w-0 flex-1 items-center gap-2.5">
        <div className="relative shrink-0">
          <img
            src={getPlayerAvatar(player)}
            alt=""
            className={`${compact ? "h-9 w-9" : "h-11 w-11"} shrink-0 rounded-full border-2 border-ivory/30 bg-ivory object-cover`}
          />
        </div>
        <span className="min-w-0 flex-1">
          <span className={`block truncate font-black leading-tight tracking-normal ${compact ? "text-sm" : "text-2xl"}`}>
            {getPlayerDisplayLabel(player)}
          </span>
          {player.statusNote && (
            <span className={`block truncate font-bold opacity-70 ${compact ? "mt-0.5 text-[8px]" : "mt-1 text-[9px]"}`} title={player.statusNote}>
              {player.statusNote}
            </span>
          )}
        </span>
      </span>
      <RankBadge skillLevel={player.skillLevel} compact={compact} className="shrink-0 self-center" />
    </div>
  );
}

function RankBadge({ skillLevel, compact = false, className = "" }: { skillLevel: ReturnType<typeof useClubStore.getState>["players"][number]["skillLevel"]; compact?: boolean; className?: string }) {
  return (
    <span className={`rank-badge rank-${rankKey(skillLevel)} inline-flex max-w-[7.5rem] items-center truncate rounded-md font-medium normal-case tracking-normal ${compact ? "px-1.5 py-0.5 text-[9px] leading-tight" : "px-2 py-0.5 text-[11px]"} ${className}`}>
      {skillLevel}
    </span>
  );
}

const TV_BROADCAST_REPLAY_WINDOW_MS = 45_000;

const tvAnnouncementMemory = {
  seenMatchIds: new Set<string>(),
  handledBroadcastIds: new Set<string>(),
};

function isFreshTvBroadcast(broadcast: TvBroadcast) {
  const createdAt = Date.parse(broadcast.createdAt);
  if (!Number.isFinite(createdAt)) return false;
  return Date.now() - createdAt < TV_BROADCAST_REPLAY_WINDOW_MS;
}

function DisplayView({ setView: _setView }: { setView: (view: ViewMode) => void }) {
  // Narrow selectors prevent the entire TV view from re-rendering on unrelated
  // store changes (e.g. toasts, player edits that don't affect courts/matches).
  const courts = useClubStore((s) => s.courts);
  const matches = useClubStore((s) => s.matches);
  const players = useClubStore((s) => s.players);
  const stackOrder = useClubStore((s) => s.stackOrder);
  const clubStatus = useClubStore((s) => s.clubStatus);
  const tvBroadcast = useClubStore((s) => s.tvBroadcast);
  const online = useClubStore((s) => s.online);
  const syncDegraded = useClubStore((s) => s.syncDegraded);
  const refreshSharedState = useClubStore((s) => s.refreshSharedState);
  const goBackFromTv = useClubStore((s) => s.goBackFromTv);
  const now = useNow();

  React.useEffect(() => {
    void refreshSharedState({ force: true, context: "tv" });
    // 60 s fallback interval when Realtime is degraded. The app-level Realtime
    // subscriber (in the root useEffect) already handles TV context and fires a
    // debounced refresh on every Session change, so we don't need a second
    // subscribeToClubState here. That avoids a duplicate full-fetch per event.
    const interval = window.setInterval(() => {
      if (!isClubPushHealthy()) {
        void refreshSharedState({ allowUnchanged: true, context: "tv" });
      }
    }, 60_000);
    const onTvRefresh = (event: MessageEvent) => {
      if (event.origin !== window.location.origin) return;
      if (event.data?.type === "haff-tv-refresh") {
        void refreshSharedState({ force: true, context: "tv" });
      }
    };
    window.addEventListener("message", onTvRefresh);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener("message", onTvRefresh);
    };
  }, [refreshSharedState]);

  const matchDurationMinutes = useClubStore((state) => state.matchDurationMinutes);
  const announcedOvertimeRef = React.useRef<Record<string, number>>({});
  const announcedReservationsRef = React.useRef<Record<string, string>>({});

  const [activeBillboard, setActiveBillboard] = React.useState<{
    courtName: string;
    courtId: string;
    participantIds: string[];
    players: Array<{ displayName: string; avatarUrl?: string; skillLevel: string }>;
    variant: "active" | "reserved";
  } | null>(null);

  const seenMatchIdsRef = React.useRef(tvAnnouncementMemory.seenMatchIds);
  const isInitialCourtSeedRef = React.useRef(true);
  const billboardDismissTimerRef = React.useRef<number | undefined>(undefined);
  const messageBillboardTimerRef = React.useRef<number | undefined>(undefined);
  const handledBroadcastIdRef = React.useRef<string | null>(null);
  const [activeTextBillboard, setActiveTextBillboard] = React.useState<string | null>(null);

  const scheduleBillboardDismiss = React.useCallback((courtName: string, delayMs = 8000) => {
    window.clearTimeout(billboardDismissTimerRef.current);
    billboardDismissTimerRef.current = window.setTimeout(() => {
      setActiveBillboard((current) => (current?.courtName === courtName ? null : current));
    }, delayMs);
  }, []);

  const triggerCourtAnnouncement = React.useCallback((
    courtId: string,
    courtName: string,
    participantIds: string[],
    playerList = players,
    variant: "active" | "reserved" = "active"
  ) => {
    void unlockAudio();
    playSound("checkin");

    const billboardPlayers = participantIds
      .map((id) => resolvePlayerById(id, playerList))
      .filter((player) => !player.isVacant)
      .map((player) => ({
        displayName: player.displayName,
        avatarUrl: player.avatarUrl,
        skillLevel: player.skillLevel
      }));

    if (billboardPlayers.length > 0) {
      setActiveBillboard({
        courtId,
        courtName,
        participantIds,
        players: billboardPlayers,
        variant
      });
      scheduleBillboardDismiss(courtName);
    }

    announceNextPlayers(courtName, participantIds, playerList);
  }, [players, scheduleBillboardDismiss]);

  const handleReplayBillboard = React.useCallback(() => {
    if (!activeBillboard) return;
    triggerCourtAnnouncement(
      activeBillboard.courtId,
      activeBillboard.courtName,
      activeBillboard.participantIds
    );
  }, [activeBillboard, triggerCourtAnnouncement]);

  React.useLayoutEffect(() => {
    if (!isInitialCourtSeedRef.current || courts.length === 0) return;
    courts.forEach((court) => {
      if (court.currentMatchId) tvAnnouncementMemory.seenMatchIds.add(court.currentMatchId);
    });
    isInitialCourtSeedRef.current = false;
  }, [courts]);

  React.useLayoutEffect(() => {
    if (!tvBroadcast?.id || isFreshTvBroadcast(tvBroadcast)) return;
    tvAnnouncementMemory.handledBroadcastIds.add(tvBroadcast.id);
    handledBroadcastIdRef.current = tvBroadcast.id;
  }, [tvBroadcast?.id]);

  React.useEffect(() => {
    if (!tvBroadcast?.id) return;
    if (
      handledBroadcastIdRef.current === tvBroadcast.id ||
      tvAnnouncementMemory.handledBroadcastIds.has(tvBroadcast.id)
    ) {
      handledBroadcastIdRef.current = tvBroadcast.id;
      return;
    }
    handledBroadcastIdRef.current = tvBroadcast.id;
    tvAnnouncementMemory.handledBroadcastIds.add(tvBroadcast.id);

    if (tvBroadcast.kind === "message" && tvBroadcast.message) {
      void unlockAudio();
      playSound("checkin");
      setActiveBillboard(null);
      setActiveTextBillboard(tvBroadcast.message);
      speakAnnouncement(tvBroadcast.message);
      window.clearTimeout(messageBillboardTimerRef.current);
      messageBillboardTimerRef.current = window.setTimeout(() => setActiveTextBillboard(null), 10000);
      return;
    }

    setActiveTextBillboard(null);
    if (tvBroadcast.kind === "court" && tvBroadcast.courtName) {
      triggerCourtAnnouncement(
        tvBroadcast.courtId ?? "",
        tvBroadcast.courtName,
        tvBroadcast.participantIds ?? [],
        players,
        tvBroadcast.variant ?? "active"
      );
      return;
    }
    if (tvBroadcast.kind === "overtime" && tvBroadcast.courtName) {
      void unlockAudio();
      announceCourtOvertime(tvBroadcast.courtName, tvBroadcast.participantIds ?? [], players);
    }
  }, [tvBroadcast, players, triggerCourtAnnouncement]);

  const broadcastCourtAnnouncement = React.useCallback((
    courtId: string,
    courtName: string,
    participantIds: string[],
    variant: "active" | "reserved" = "active"
  ) => {
    void useClubStore.getState().broadcastTvAnnouncement({
      kind: "court",
      courtId,
      courtName,
      participantIds,
      variant
    });
  }, []);

  // Unlock speech/audio on first interaction (TV has no TopBar sound toggle)
  React.useEffect(() => {
    const unlock = () => void unlockAudio();
    window.addEventListener("pointerdown", unlock, { once: true });
    window.addEventListener("keydown", unlock, { once: true });
    return () => {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
    };
  }, []);

  React.useEffect(() => () => {
    window.clearTimeout(billboardDismissTimerRef.current);
    window.clearTimeout(messageBillboardTimerRef.current);
  }, []);

  // Monitor for new matches assigned to courts
  React.useEffect(() => {
    courts.forEach((court) => {
      if (court.status === "InUse" && court.currentMatchId) {
        const matchId = court.currentMatchId;
        if (!seenMatchIdsRef.current.has(matchId)) {
          seenMatchIdsRef.current.add(matchId);

          const match = matches.find((m) => m.id === matchId);
          if (match) {
            const participantIds = [...match.teamAPlayerIds, ...match.teamBPlayerIds];
            const hasPlayers = participantIds.some((id) => !resolvePlayerById(id, players).isVacant);
            if (hasPlayers) {
              triggerCourtAnnouncement(court.id, court.name, participantIds);
            }
          }
        }
      }
    });
  }, [courts, matches, players, triggerCourtAnnouncement]);

  const overtimeCourts = courts
    .map((court) => {
      const match = matches.find((item) => item.id === court.currentMatchId && item.status === "InProgress" && item.startedAt);
      if (!match?.startedAt) return null;
      const remaining = getRemainingMilliseconds(match.startedAt, matchDurationMinutes, now, match.timerPausedAt);
      return remaining < 0 ? { court, milliseconds: Math.abs(remaining) } : null;
    })
    .filter((item): item is { court: typeof courts[number]; milliseconds: number } => Boolean(item));

  const overtimeAnnouncementKey = overtimeCourts
    .map(({ court, milliseconds }) => `${court.id}:${Math.floor(milliseconds / 120_000)}`)
    .join("|");

  React.useEffect(() => {
    overtimeCourts.forEach(({ court, milliseconds }) => {
      const repeatWindow = Math.floor(milliseconds / 120_000);
      if (announcedOvertimeRef.current[court.id] === repeatWindow) return;

      const match = matches.find((item) => item.id === court.currentMatchId);
      if (!match) return;
      if (announceCourtOvertime(court.name, [...match.teamAPlayerIds, ...match.teamBPlayerIds], players)) {
        announcedOvertimeRef.current[court.id] = repeatWindow;
      }
    });

    const activeCourtIds = new Set(overtimeCourts.map(({ court }) => court.id));
    Object.keys(announcedOvertimeRef.current).forEach((courtId) => {
      if (!activeCourtIds.has(courtId)) delete announcedOvertimeRef.current[courtId];
    });
  }, [overtimeAnnouncementKey, courts, matches, players]);

  const reservationAnnouncementKey = courts
    .filter((court) => court.status === "Reserved")
    .map((court) => `${court.id}:${court.reservedFor ?? ""}:${court.reservedPlayerIds?.join(",") ?? ""}`)
    .join("|");

  React.useEffect(() => {
    courts.forEach((court) => {
      if (court.status !== "Reserved") {
        delete announcedReservationsRef.current[court.id];
        return;
      }
      const reservationKey = `${court.reservedFor ?? ""}:${court.reservedPlayerIds?.join(",") ?? ""}`;
      if (announcedReservationsRef.current[court.id] === reservationKey) return;
      if (court.reservedPlayerIds?.length) {
        if (announceNextPlayers(court.name, court.reservedPlayerIds, players)) {
          announcedReservationsRef.current[court.id] = reservationKey;
        }
      } else {
        announcedReservationsRef.current[court.id] = reservationKey;
      }
    });
  }, [reservationAnnouncementKey, courts, players]);
  const sortedCourts = React.useMemo(() => sortCourts(courts).slice(0, 3), [courts]);
  const courtCount = sortedCourts.length;

  const playerNote = (p: (typeof players)[number] | undefined) => (p ? getPlayerStatusNote(p) : "");

  const noteIcon = (note: string) => {
    const n = note.toLowerCase();
    if (n.includes("aggressive") || n.includes("attack")) return "⚡";
    if (n.includes("left")) return "↖";
    if (n.includes("beginner") || n.includes("newbie")) return "★";
    if (n.includes("consistent")) return "◎";
    if (n.includes("serve")) return "◈";
    if (n.includes("net")) return "⊕";
    if (n.includes("pro") || n.includes("intermediate")) return "◆";
    return "·";
  };

  return (
    <section className="tv-display relative flex h-[100dvh] max-h-[100dvh] w-screen max-w-[100vw] flex-col overflow-hidden bg-[#0b2e22] text-ivory select-none" style={{ fontFamily: "'Inter', 'Helvetica Neue', sans-serif" }}>
      <style dangerouslySetInnerHTML={{ __html: `
        @keyframes gradientShift {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
        .animate-billboard-bg {
          background: linear-gradient(-45deg, #05241c, #0a3d30, #041f17, #0b4536);
          background-size: 400% 400%;
          animation: gradientShift 8s ease infinite;
        }
        .tv-elapsed {
          letter-spacing: -0.02em;
        }
        .tv-court-name {
          font-size: clamp(1.25rem, 2.8vw, 2.75rem);
          line-height: 0.95;
        }
        @media (max-width: 767px) {
          .tv-court-name {
            font-size: clamp(1.5rem, 6vw, 2rem);
          }
        }
        .tv-ready-title {
          font-size: clamp(1.1rem, 2.2vw, 2rem);
          line-height: 1.05;
        }
        .tv-player-name {
          font-size: clamp(0.875rem, 1.75vw, 1.35rem);
        }
        @media (max-width: 767px) {
          .tv-player-name-mobile {
            font-size: clamp(0.95rem, 3.8vw, 1.15rem);
          }
          .tv-timer-digits-mobile {
            font-size: clamp(1.75rem, 7vw, 2.25rem);
          }
        }
        .tv-timer-digits {
          font-size: clamp(1.35rem, 2.8vw, 2.5rem);
        }
      `}} />

      {/* ── Text announcement overlay ── */}
      <AnimatePresence>
        {activeTextBillboard && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-[150] flex flex-col items-center justify-center animate-billboard-bg text-ivory p-6 md:p-10"
          >
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_40%,rgba(203,239,67,0.18),transparent_55%)] pointer-events-none" />
            <motion.div
              initial={{ scale: 0.92, y: 16 }} animate={{ scale: 1, y: 0 }} exit={{ scale: 0.96, y: -12 }}
              className="relative z-10 max-w-5xl text-center px-4"
            >
              <span className="inline-flex items-center gap-2 rounded-full bg-brass/10 px-4 py-1.5 text-sm md:text-lg font-black text-brass border border-brass/25 uppercase tracking-wider mb-6">
                <Megaphone className="h-5 w-5" />
                Club Announcement
              </span>
              <p className="font-display text-[clamp(1.75rem,6vw,5rem)] font-black leading-tight text-ivory break-words">
                {activeTextBillboard}
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Billboard overlay ── */}
      <AnimatePresence>
        {activeBillboard && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[150] flex flex-col items-center justify-center bg-[#05241c] text-ivory p-6 md:p-8"
          >
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_40%,rgba(203,239,67,0.15),transparent_60%)] pointer-events-none" />
            <div className="absolute top-10 left-10 opacity-[0.03] pointer-events-none">
              <LogoMark size="large" />
            </div>

            <motion.div
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: -20 }}
              transition={{ type: "spring", damping: 20, stiffness: 100 }}
              className="w-full max-w-5xl text-center z-10"
            >
              <span className="inline-flex items-center gap-2 rounded-full bg-brass/10 px-4 py-1.5 text-base md:text-xl font-black text-brass border border-brass/25 uppercase tracking-wider mb-4 md:mb-6">
                <Megaphone className="h-5 w-5 md:h-7 md:w-7 animate-bounce" />
                <span>{activeBillboard.variant === "reserved" ? "Court Reserved" : "Walk-Up Announcement"}</span>
              </span>

              <h1 className="font-display text-[clamp(4rem,7vw,9rem)] font-black leading-none tracking-tight text-ivory mb-2 md:mb-4">
                {activeBillboard.courtName.toUpperCase()}
              </h1>
              <p className="text-xl md:text-2xl text-linen/80 font-bold max-w-2xl mx-auto mb-10 md:mb-12">
                {activeBillboard.variant === "reserved"
                  ? "This court is reserved. Please wait courtside until the match begins."
                  : "Your stack is active. Please proceed to the court now."}
              </p>

              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6 px-2 md:px-4">
                {activeBillboard.players.map((p, idx) => (
                  <motion.div
                    key={p.displayName + idx}
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.15 + idx * 0.1, type: "spring" }}
                    className="relative flex flex-col items-center p-5 md:p-6 rounded-[2rem] border border-white/10 bg-[#0b3a2c] shadow-2xl"
                  >
                    <div className="h-24 w-24 md:h-28 md:w-28 rounded-full overflow-hidden border-[3px] border-brass/40 shadow-xl bg-forest mb-4">
                      <img
                        src={getPlayerAvatar(p)}
                        alt={p.displayName}
                        className="h-full w-full object-cover"
                      />
                    </div>
                    <h3 className="text-xl md:text-2xl font-black text-white break-words leading-tight text-center px-1 w-full">
                      {p.displayName}
                    </h3>
                    <span className="mt-2.5 px-3 py-1 rounded-full text-[10px] md:text-xs font-black uppercase bg-white/10 text-ivory/70 border border-white/5 tracking-wider">
                      {p.skillLevel}
                    </span>
                  </motion.div>
                ))}
              </div>

              <button
                type="button"
                onClick={handleReplayBillboard}
                className="mt-8 md:mt-10 inline-flex items-center gap-2.5 rounded-full border border-brass/40 bg-brass/15 px-6 py-3 md:px-8 md:py-4 text-sm md:text-lg font-black uppercase tracking-wider text-brass transition hover:bg-brass hover:text-forest"
              >
                <RotateCcw className="h-5 w-5 md:h-6 md:w-6" />
                Replay announcement
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Back button ── */}
      <div className="fixed left-2 top-2 z-50 md:left-4 md:top-4">
        <button onClick={() => goBackFromTv()}
          className="rounded-full border border-ivory/20 bg-ivory/5 px-2 py-1 text-[10px] font-black uppercase tracking-wider text-ivory/70 backdrop-blur hover:bg-ivory hover:text-forest transition flex items-center gap-1 shadow-md md:border-ivory/30 md:bg-ivory/10 md:px-3 md:py-1.5 md:text-xs md:text-ivory md:shadow-lg md:gap-1.5">
          <ArrowLeft className="h-3 w-3 md:h-3.5 md:w-3.5" />
          <span className="sr-only sm:not-sr-only sm:inline">Back</span>
        </button>
      </div>

      {/* ── Auth warning ── */}
        {!online && (
          <div className="fixed bottom-4 right-4 z-50 flex items-center gap-2 rounded-xl border border-red-400/40 bg-[#1a0a0a]/90 px-4 py-2.5 shadow-xl backdrop-blur">
            <span className="h-2 w-2 shrink-0 rounded-full bg-red-400 animate-pulse" />
            <span className="text-xs font-black uppercase tracking-wider text-red-300">Not signed in — live sync paused. <button onClick={() => _setView("player")} className="underline decoration-dotted">Sign in</button></span>
          </div>
        )}
        {online && syncDegraded && (
          <div className="fixed bottom-4 left-4 z-50 flex items-center gap-2 rounded-xl border border-amber-400/40 bg-[#1a1408]/90 px-4 py-2.5 shadow-xl backdrop-blur">
            <span className="h-2 w-2 shrink-0 rounded-full bg-amber-400 animate-pulse" />
            <span className="text-xs font-black uppercase tracking-wider text-amber-200">Sync slowed — retrying automatically</span>
          </div>
        )}

      {/* ── Main layout — grid on TV so courts fill remaining 1080p height ── */}
      <div className={`tv-display-shell mx-auto min-h-0 w-full max-w-[1920px] flex-1 overflow-hidden px-[clamp(0.75rem,1.5vw,1.75rem)] pb-[clamp(0.25rem,0.5vh,0.5rem)] pt-[clamp(2rem,3vh,2.5rem)]${courtCount >= 3 ? " tv-display-shell--courts-primary" : ""}`}>

        {/* ── Header ── */}
        <header className="tv-display-header order-1 shrink-0 flex flex-col items-center gap-0.5 text-center md:flex-row md:items-end md:justify-between md:gap-2 md:text-left">
          <div className="min-w-0">
            <p className="text-[9px] sm:text-[10px] font-black uppercase tracking-[0.22em] text-ivory/60 leading-none">HAFF LEISURE CLUB</p>
            <h1 className="tv-display-title font-display font-black leading-none tracking-tighter uppercase text-ivory mt-0.5">NOW PLAYING</h1>
          </div>
          <div className="tv-display-header-meta flex items-center justify-center gap-1.5 md:gap-2 flex-wrap">
            {clubStatus && (
              <span className="flex items-center gap-1.5 rounded-full bg-brass/15 border border-brass/30 px-3 md:px-4 py-1 md:py-1.5 text-[10px] md:text-sm font-black text-brass uppercase tracking-wider">
                <span className="h-1.5 w-1.5 rounded-full bg-brass animate-pulse" />
                {clubStatus}
              </span>
            )}
            {overtimeCourts.length > 0 && (
              <span className="flex items-center gap-1.5 rounded-full bg-red-500/20 border border-red-400/30 px-3 md:px-4 py-1 md:py-1.5 text-[10px] md:text-sm font-black text-red-300 uppercase tracking-wider animate-pulse">
                ⚠ <span className="hidden sm:inline">OVERTIME: {overtimeCourts.map(({ court }) => court.name).join(", ")}</span>
                <span className="sm:hidden">OT</span>
              </span>
            )}
            <p className="tv-display-open-play text-[10px] font-black tracking-[0.12em] uppercase text-brass">
              {courts.some(c => c.status === "Reserved") ? "🔒 RESERVED" : "OPEN PLAY"}
            </p>
          </div>
        </header>

        {/* ── Stack Queue — Mobile (vertical, max 4 visible, animates when more) ── */}
        <TvStackQueue
          className="order-3 md:hidden"
          variant="mobile"
          stackOrder={stackOrder}
          players={players}
          matches={matches}
          courts={courts}
          getPlayerAvatar={getPlayerAvatar}
        />

        {/* ── Stack Queue — Desktop / TV ── */}
        <TvStackQueue
          className="order-2 hidden md:block"
          variant="tv"
          stackOrder={stackOrder}
          players={players}
          matches={matches}
          courts={courts}
          getPlayerAvatar={getPlayerAvatar}
        />

        {/* ── Courts — pickleball court diagram scoreboards ── */}
        <div className={`tv-display-courts order-2 md:order-3 mx-auto grid w-full min-h-0 min-w-0 flex-1 gap-[clamp(0.35rem,0.6vw,0.65rem)] overflow-hidden ${
          courtCount <= 1
            ? "tv-display-courts--single grid-cols-1"
            : courtCount === 2
              ? "tv-display-courts--pair grid-cols-1 md:grid-cols-2"
              : "tv-display-courts--triple grid-cols-1 md:grid-cols-3"
        }`}>
          {sortedCourts.map((court) => {
            const match = getActiveCourtMatch(court, matches);
            const teamA = match ? resolveMatchTeamPlayers(match.teamAPlayerIds, players).filter((player) => !player.isVacant && !isUnresolvedPlayerStub(player)) : [];
            const teamB = match ? resolveMatchTeamPlayers(match.teamBPlayerIds, players).filter((player) => !player.isVacant && !isUnresolvedPlayerStub(player)) : [];
            const isPlaying = Boolean(match);
            const isReserved = !isPlaying && court.status === "Reserved";
            const reservedPlayers = (court.reservedPlayerIds ?? [])
              .map((id) => resolvePlayerById(id, players))
              .filter((player) => !player.isVacant);
            return (
              <TvPickleballCourt
                key={court.id}
                court={court}
                match={match ?? undefined}
                teamA={teamA}
                teamB={teamB}
                reservedPlayers={reservedPlayers}
                getPlayerAvatar={getPlayerAvatar}
                onAnnounce={
                  isPlaying && match
                    ? () => broadcastCourtAnnouncement(court.id, court.name, [...match.teamAPlayerIds, ...match.teamBPlayerIds], "active")
                    : isReserved
                      ? () => broadcastCourtAnnouncement(court.id, court.name, court.reservedPlayerIds ?? [], "reserved")
                      : undefined
                }
                timerSlot={
                  match ? <TvElapsedTimer matchId={match.id} variant="court-baseline" /> : undefined
                }
              />
            );
          })}
        </div>

        {/* ── Footer note ── */}
        <p className="tv-display-footer order-4 shrink-0 text-center text-[9px] font-bold text-ivory/25 tracking-wide md:order-none">
          ⓘ Open Play is self-officiated. Please rotate in and out of play. Have fun and be respectful!
        </p>
      </div>
    </section>
  );
}

function TvPlayerCard({
  player,
  playerNote,
  noteIcon,
  getPlayerAvatar,
  variant = "default",
  compact = false,
  tv = false,
  tvCourt = false,
  tvCourtMobile = false,
  tvCourtRow = false,
}: {
  player: { id: string; displayName: string; rating: number; avatarUrl?: string; skillLevel: string };
  playerNote: string;
  noteIcon: string;
  getPlayerAvatar: (p: any) => string;
  variant?: "default" | "reserved";
  compact?: boolean;
  tv?: boolean;
  tvCourt?: boolean;
  tvCourtMobile?: boolean;
  tvCourtRow?: boolean;
}) {
  const borderClass = variant === "reserved" ? "border-amber-400/30 bg-[#173d2c]/90" : "border-[#1e4f3a] bg-[#132e24] shadow-[inset_0_1px_0_rgba(201,168,76,0.06)]";
  const avatarBorderClass = variant === "reserved" ? "border-amber-300/40" : "border-brass/40";

  /* ── Unified court row used for both mobile and desktop ── */
  if (tvCourtRow) {
    return (
      <div className={`flex min-h-0 min-w-0 items-center gap-2 sm:gap-3 rounded-xl border px-2.5 py-2.5 sm:px-3 sm:py-3 ${borderClass}`}>
        <img
          src={getPlayerAvatar(player)}
          alt=""
          className={`h-10 w-10 sm:h-12 sm:w-12 shrink-0 rounded-full border-2 object-cover bg-[#0d2e22] shadow-md ${avatarBorderClass}`}
        />
        <div className="min-w-0 flex-1">
          <p className="tv-player-name font-black text-ivory leading-tight line-clamp-2 break-words">
            {getPlayerDisplayLabel(player)}
          </p>
          <p className="mt-0.5 truncate text-[9px] sm:text-[10px] font-black uppercase tracking-wide text-ivory/55">
            {player.skillLevel}
          </p>
        </div>
      </div>
    );
  }

  if (tvCourtMobile) {
    return (
      <div className={`flex min-h-0 min-w-0 flex-col items-center gap-2 rounded-xl border px-2.5 py-2.5 text-center ${borderClass}`}>
        <img
          src={getPlayerAvatar(player)}
          alt=""
          className={`h-12 w-12 shrink-0 rounded-full border-2 object-cover bg-[#0d2e22] shadow-lg ${avatarBorderClass}`}
        />
        <div className="min-w-0 w-full">
          <p className="tv-player-name-mobile break-words font-black text-ivory leading-tight line-clamp-2">
            {getPlayerDisplayLabel(player)}
          </p>
          <p className="mt-0.5 truncate text-[9px] font-black uppercase tracking-wide text-ivory/55">
            {player.skillLevel}
          </p>
        </div>
      </div>
    );
  }

  if (tvCourt) {
    return (
      <div className={`flex min-h-0 min-w-0 items-center gap-2.5 rounded-xl border px-3 py-2.5 md:gap-2 md:rounded-lg md:px-2 md:py-1.5 md:px-2.5 md:py-2 ${borderClass}`}>
        <img
          src={getPlayerAvatar(player)}
          alt=""
          className={`h-10 w-10 sm:h-11 sm:w-11 md:h-8 md:w-8 shrink-0 rounded-full border-2 object-cover bg-[#0d2e22] ${avatarBorderClass}`}
        />
        <div className="min-w-0 flex-1 text-left">
          <p className="tv-player-name break-words text-sm sm:text-base md:truncate md:text-xs font-black text-ivory leading-tight line-clamp-2 md:line-clamp-1">
            {getPlayerDisplayLabel(player)}
          </p>
          <p className="truncate text-[9px] sm:text-[10px] md:text-[8px] font-black uppercase tracking-wide text-ivory/55">
            {player.skillLevel}
          </p>
        </div>
      </div>
    );
  }

  if (tv) {
    return (
      <div className={`flex min-h-0 min-w-0 flex-col items-center text-center gap-1.5 rounded-xl border px-3 py-2.5 sm:px-4 sm:py-3 ${borderClass}`}>
        <img
          src={getPlayerAvatar(player)}
          alt=""
          className={`h-10 w-10 sm:h-12 sm:w-12 md:h-14 md:w-14 shrink-0 rounded-full border-2 object-cover bg-[#0d2e22] shadow-xl ${avatarBorderClass}`}
        />
        <p className="tv-player-name min-w-0 w-full break-words font-black text-ivory leading-tight line-clamp-2">
          {getPlayerDisplayLabel(player)}
        </p>
        <div className="flex min-w-0 flex-wrap items-center justify-center gap-1.5">
          <span className="shrink-0 rounded-md bg-white/10 px-2 py-0.5 text-[9px] sm:text-[10px] font-black uppercase tracking-wide text-ivory/65 border border-white/10">
            {player.skillLevel}
          </span>
          {playerNote ? (
            <span className="min-w-0 max-w-full line-clamp-1 text-[9px] sm:text-[10px] font-bold text-brass/80 leading-tight">
              <span className="text-brass">{noteIcon}</span> {playerNote}
            </span>
          ) : null}
        </div>
      </div>
    );
  }

  const avatarClass = compact
    ? "h-8 w-8 md:h-9 md:w-9"
    : "h-10 w-10 md:h-12 md:w-12";
  const nameClass = compact
    ? "text-xs md:text-sm font-black text-ivory leading-tight"
    : "text-sm md:text-[clamp(1rem,1.35vw,1.25rem)] font-black text-ivory leading-tight";
  const metaIndent = compact ? "pl-[2.25rem] md:pl-[2.75rem]" : "pl-[2.875rem] md:pl-[3.75rem]";
  const shellClass = compact
    ? "gap-1 rounded-lg border px-2 py-1.5 md:px-2.5 md:py-2 shadow-md"
    : "gap-1.5 md:gap-2 rounded-xl md:rounded-2xl border px-3 md:px-3.5 py-2.5 md:py-3 shadow-lg";

  return (
    <div className={`flex min-h-0 min-w-0 flex-col ${shellClass} ${borderClass}`}>
      <div className="flex min-w-0 items-center gap-2">
        <img
          src={getPlayerAvatar(player)}
          alt=""
          className={`${avatarClass} shrink-0 rounded-full border-2 object-cover bg-[#0d2e22] shadow-xl ${avatarBorderClass}`}
        />
        <p className={`min-w-0 flex-1 break-words ${nameClass}`}>
          {getPlayerDisplayLabel(player)}
        </p>
      </div>
      <div className={`flex min-w-0 items-center gap-1 ${metaIndent}`}>
        <span className="shrink-0 rounded-md bg-white/10 px-1.5 py-0.5 text-[7px] md:text-[8px] font-black uppercase tracking-wide text-ivory/65 border border-white/10">
          {player.skillLevel}
        </span>
        {playerNote ? (
          <span className="min-w-0 line-clamp-1 text-[8px] md:text-[9px] font-bold text-brass/80 leading-tight">
            <span className="text-brass">{noteIcon}</span> {playerNote}
          </span>
        ) : null}
      </div>
    </div>
  );
}

function TvElapsedTimer({ matchId, compact = false, variant = "default" }: { matchId: string; compact?: boolean; variant?: "default" | "divider" | "compact" | "mobile" | "bar" | "court-baseline" }) {
  const match = useClubStore((state) => state.matches.find((m) => m.id === matchId));
  const durationMinutes = useClubStore((state) => state.matchDurationMinutes);
  const now = useSmoothNow(Boolean(match?.startedAt && !match?.timerPausedAt));
  if (!match?.startedAt || match.status === "Completed") return null;
  const remainingMs = getRemainingMilliseconds(match.startedAt, durationMinutes, now, match.timerPausedAt);
  const overtime = remainingMs < 0;

  if (variant === "mobile") {
    return (
      <div className="flex shrink-0 w-full items-center gap-2 py-1" aria-label={overtime ? "Overtime" : "Time remaining"}>
        <div className="h-px flex-1 bg-gradient-to-r from-transparent via-[#1e4f3a] to-brass/35" />
        <div className={`flex flex-col items-center rounded-xl border px-5 py-2 tabular-nums ${
          overtime ? "border-red-400/35 bg-red-500/10" : "border-brass/35 bg-[#05241c]/80"
        }`}>
          <span className={`tv-timer-digits-mobile font-black leading-none ${overtime ? "text-red-400 animate-pulse" : "text-brass"}`}>
            <CountdownClock totalMs={Math.abs(remainingMs)} prefix={overtime ? "-" : ""} />
          </span>
          <span className="mt-0.5 text-[9px] font-black uppercase tracking-[0.18em] text-ivory/40">
            {overtime ? "OVERTIME" : "TIME LEFT"}
          </span>
        </div>
        <div className="h-px flex-1 bg-gradient-to-l from-transparent via-[#1e4f3a] to-brass/35" />
      </div>
    );
  }

  if (variant === "divider") {
    return (
      <div className="flex shrink-0 w-full items-center gap-2 py-1.5 sm:py-2" aria-label={overtime ? "Overtime" : "Time remaining"}>
        <div className="h-px flex-1 bg-gradient-to-r from-transparent via-[#1e4f3a] to-brass/35" />
        <div className={`flex flex-col items-center rounded-xl border px-4 py-1.5 sm:px-5 sm:py-2 tabular-nums ${
          overtime ? "border-red-400/35 bg-red-500/10" : "border-brass/35 bg-[#05241c]/80"
        }`}>
          <span className={`tv-timer-digits font-black leading-none ${overtime ? "text-red-400 animate-pulse" : "text-brass"}`}>
            <CountdownClock totalMs={Math.abs(remainingMs)} prefix={overtime ? "-" : ""} />
          </span>
          <span className="mt-1 text-[8px] sm:text-[9px] font-black uppercase tracking-[0.18em] text-ivory/40">
            {overtime ? "OVERTIME" : "TIME LEFT"}
          </span>
        </div>
        <div className="h-px flex-1 bg-gradient-to-l from-transparent via-[#1e4f3a] to-brass/35" />
      </div>
    );
  }

  if (variant === "compact") {
    return (
      <div className={`flex min-h-0 min-w-0 flex-col items-center justify-center gap-0.5 rounded-lg border px-2 py-2 tabular-nums ${
        overtime ? "border-red-400/35 bg-red-500/10" : "border-brass/35 bg-[#05241c]/80"
      }`} aria-label={overtime ? "Overtime" : "Time remaining"}>
        <span className={`tv-timer-digits text-lg sm:text-xl font-black leading-none ${overtime ? "text-red-400 animate-pulse" : "text-brass"}`}>
          <CountdownClock totalMs={Math.abs(remainingMs)} prefix={overtime ? "-" : ""} />
        </span>
        <span className="text-[7px] sm:text-[8px] font-black uppercase tracking-wider text-ivory/40">
          {overtime ? "OT" : "LEFT"}
        </span>
      </div>
    );
  }

  if (variant === "bar") {
    return (
      <div className="flex items-center justify-center gap-2.5 tabular-nums" aria-label={overtime ? "Overtime" : "Time remaining"}>
        <span className={`tv-timer-digits-mobile font-black leading-none ${overtime ? "text-red-400 animate-pulse" : "text-brass"}`}>
          <CountdownClock totalMs={Math.abs(remainingMs)} prefix={overtime ? "-" : ""} />
        </span>
        <span className="text-[9px] sm:text-[10px] font-black uppercase tracking-[0.2em] text-ivory/40">
          {overtime ? "OVERTIME" : "TIME LEFT"}
        </span>
      </div>
    );
  }

  if (variant === "court-baseline") {
    return (
      <div className="tv-court-timer" aria-label={overtime ? "Overtime" : "Time remaining"}>
        <span className={`tv-court-timer__digits ${overtime ? "tv-court-timer__digits--overtime" : ""}`}>
          <CountdownClock totalMs={Math.abs(remainingMs)} prefix={overtime ? "-" : ""} />
        </span>
        <span className="tv-court-timer__label">{overtime ? "OVERTIME" : "MATCH CLOCK"}</span>
      </div>
    );
  }

  if (compact) {
    return (
      <div className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 tabular-nums ${
        overtime ? "border-red-400/35 bg-red-500/10" : "border-brass/30 bg-brass/10"
      }`}>
        <span className={`text-sm md:text-base font-black leading-none ${overtime ? "text-red-400" : "text-brass"}`}>
          <CountdownClock totalMs={Math.abs(remainingMs)} prefix={overtime ? "-" : ""} />
        </span>
        <span className="text-[8px] font-black uppercase tracking-wider text-ivory/45">
          {overtime ? "OT" : "Left"}
        </span>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center">
      <span className={`tv-elapsed text-2xl md:text-[clamp(2rem,3.2vw,3.5rem)] font-black leading-none tabular-nums ${overtime ? "text-red-400 animate-pulse" : "text-brass"}`}>
        <CountdownClock totalMs={Math.abs(remainingMs)} prefix={overtime ? "-" : ""} />
      </span>
      <span className="mt-0.5 text-[9px] font-black uppercase tracking-[0.2em] text-ivory/35">
        {overtime ? "OVERTIME" : "TIME LEFT"}
      </span>
    </div>
  );
}

function isUnresolvedPlayerStub(player: Pick<Player, "displayName" | "isVacant">) {
  const name = player.displayName?.trim();
  return !player.isVacant && (name === "Player" || name === "Queued");
}

function announceCourtOvertime(courtName: string, playerIds: string[], players: Player[]) {
  const names = playerIds
    .map((playerId) => resolvePlayerById(playerId, players))
    .filter((player) => !player.isVacant && !isUnresolvedPlayerStub(player))
    .map((player) => player.displayName);
  const playerList = formatSpokenNames(names);
  const courtLabel = courtName.replace(/^Court\s*/i, "Court ");
  const message = playerList
    ? `${courtLabel} overtime. ${courtLabel} players: ${playerList}. Please finish your game.`
    : `${courtLabel} overtime. Please finish your game.`;
  return speakAnnouncement(message);
}

function announceNextPlayers(courtName: string, playerIds: string[], players: Player[]) {
  const names = playerIds
    .map((playerId) => resolvePlayerById(playerId, players))
    .filter((player) => !player.isVacant && !isUnresolvedPlayerStub(player))
    .map((player) => player.displayName);
  const playerList = formatSpokenNames(names);
  const courtLabel = courtName.replace(/^Court\s*/i, "Court ");
  return speakAnnouncement(
    playerList
      ? `Next players for ${courtLabel}: ${playerList}. Please proceed to your court.`
      : `${courtLabel} is ready for the next players.`
  );
}

function formatSpokenNames(names: string[]) {
  if (names.length === 0) return "";
  if (names.length === 1) return names[0];
  if (names.length === 2) return `${names[0]} and ${names[1]}`;
  return `${names.slice(0, -1).join(", ")}, and ${names[names.length - 1]}`;
}

function getRemainingSeconds(startedAt: string, durationMinutes: number, now: number) {
  const elapsedMs = now - new Date(startedAt).getTime();
  const remainingMs = durationMinutes * 60_000 - elapsedMs;
  return Math.ceil(remainingMs / 1000);
}

function formatClockSeconds(totalSeconds: number) {
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) {
    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function formatClockMilliseconds(totalMilliseconds: number) {
  const safeMs = Math.max(0, Math.floor(totalMilliseconds));
  const hours = Math.floor(safeMs / 3_600_000);
  const minutes = Math.floor((safeMs % 3_600_000) / 60_000);
  const seconds = Math.floor((safeMs % 60_000) / 1000);
  const centiseconds = Math.floor((safeMs % 1000) / 10);
  const cs = String(centiseconds).padStart(2, "0");
  if (hours > 0) {
    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}.${cs}`;
  }
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}.${cs}`;
}

function CountdownClock({ totalMs, className = "", prefix = "" }: { totalMs: number; className?: string; prefix?: string }) {
  const safeMs = Math.max(0, Math.floor(totalMs));
  const hours = Math.floor(safeMs / 3_600_000);
  const minutes = Math.floor((safeMs % 3_600_000) / 60_000);
  const seconds = Math.floor((safeMs % 60_000) / 1000);
  const centiseconds = Math.floor((safeMs % 1000) / 10);
  const mm = String(minutes).padStart(2, "0");
  const ss = String(seconds).padStart(2, "0");
  const cs = String(centiseconds).padStart(2, "0");
  if (hours > 0) {
    const hh = String(hours).padStart(2, "0");
    return (
      <span className={`countdown-digits ${className}`.trim()}>
        {prefix}
        <span className="countdown-seg">{hh}</span>
        <span className="countdown-sep">:</span>
        <span className="countdown-seg">{mm}</span>
        <span className="countdown-sep">:</span>
        <span className="countdown-seg">{ss}</span>
        <span className="countdown-sep">.</span>
        <span className="countdown-seg">{cs}</span>
      </span>
    );
  }
  return (
    <span className={`countdown-digits ${className}`.trim()}>
      {prefix}
      <span className="countdown-seg">{mm}</span>
      <span className="countdown-sep">:</span>
      <span className="countdown-seg">{ss}</span>
      <span className="countdown-sep">.</span>
      <span className="countdown-seg">{cs}</span>
    </span>
  );
}

function rankKey(skillLevel: ReturnType<typeof useClubStore.getState>["players"][number]["skillLevel"]) {
  return skillLevel.toLowerCase().replace(/\s+/g, "-");
}

function getActivePlayerIds(matches: ReturnType<typeof useClubStore.getState>["matches"]) {
  return new Set(
    matches
      .filter((match) => match.status === "InProgress")
      .flatMap((match) => [...match.teamAPlayerIds, ...match.teamBPlayerIds])
  );
}

function getReservedPlayerIds(courts: ReturnType<typeof useClubStore.getState>["courts"]) {
  return new Set(courts.flatMap((court) => court.reservedPlayerIds ?? []));
}

function getWaitingPlayers(
  players: ReturnType<typeof useClubStore.getState>["players"],
  matches: ReturnType<typeof useClubStore.getState>["matches"],
  courts: ReturnType<typeof useClubStore.getState>["courts"] = [],
  stackOrder: string[] = []
) {
  const activeIds = getActivePlayerIds(matches);
  const reservedIds = getReservedPlayerIds(courts);
  const eligibleIds = new Set(
    players
      .filter((p) => p.checkedIn && !activeIds.has(p.id) && !reservedIds.has(p.id))
      .map((p) => p.id)
  );

  return stackOrder
    .filter((id) => id !== "vacant" && id !== "reserved" && eligibleIds.has(id))
    .map((id) => players.find((p) => p.id === id)!)
    .filter(Boolean);
}

function getWaitingGroups(
  players: ReturnType<typeof useClubStore.getState>["players"],
  courts: ReturnType<typeof useClubStore.getState>["courts"],
  matches: ReturnType<typeof useClubStore.getState>["matches"],
  stackOrder: string[] = []
) {
  return getStackDisplayGroups(stackOrder, players, matches, courts);
}

function Metric({ label, value }: { label: string; value: number }) {
  return <div className="rounded-2xl bg-ivory/12 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]"><p className="font-display text-4xl leading-none">{value}</p><p className="text-[10px] uppercase tracking-[0.2em] text-linen/70 mt-1.5">{label}</p></div>;
}

function MatchLine({ matchId }: { matchId: string }) {
  const match = useClubStore((state) => state.matches.find((item) => item.id === matchId));
  const players = useClubStore((state) => state.players);
  if (!match) return null;

  const renderTeam = (ids: string[]) => (
    <div className="flex flex-col gap-1.5">
      {ids.map((id) => {
        const p = players.find((pl) => pl.id === id);
        if (!p || p.isVacant) return null;
        return (
          <div key={id} className="flex items-center gap-2 rounded-lg bg-white/5 px-2.5 py-1.5 cursor-grab active:cursor-grabbing" draggable onDragStart={(e) => e.dataTransfer.setData("text/player-id", id)}>
            <img src={getPlayerAvatar(p)} alt="" className="h-7 w-7 shrink-0 rounded-full border border-brass/30 object-cover bg-forest/20" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-black text-ivory leading-tight">{p.displayName.split(" ")[0]}</p>
              <p className="truncate text-[8px] uppercase tracking-wide text-linen/50">{p.skillLevel}</p>
            </div>
          </div>
        );
      })}
    </div>
  );

  return (
    <div className="mt-3">
      <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-x-2">
        {renderTeam(match.teamAPlayerIds)}
        <span className="text-[9px] font-black uppercase tracking-widest text-clay/70">vs</span>
        {renderTeam(match.teamBPlayerIds)}
      </div>
      <CourtTimer matchId={match.id} size="small" />
      <p className="mt-3 text-[9px] font-bold uppercase tracking-[0.18em] text-ivory/40">Tap Finish when done · drag players to swap</p>
    </div>
  );
}

function PlayerNames({
  ids,
  className,
  showRanks = false,
  tone = "dark",
  compact = false
}: {
  ids: string[];
  className?: string;
  showRanks?: boolean;
  tone?: "dark" | "light";
  compact?: boolean;
}) {
  const players = useClubStore((state) => state.players);
  if (!showRanks) {
    return (
      <p className={className}>
        {ids.map((id) => {
          const player = players.find((p) => p.id === id);
          return player?.displayName ? player.displayName.split(" ")[0] : "Open";
        }).join(" / ")}
      </p>
    );
  }
  return (
    <div className={compact ? "grid grid-cols-2 gap-2" : "space-y-2"}>
      {ids.map((id) => <PlayerChip key={id} playerId={id} tone={tone} draggable={tone === "dark"} compact={compact} />)}
    </div>
  );
}

function Toasts() {
  const { toasts, dismissToast } = useClubStore();
  
  const getToastIcon = (tone: string) => {
    switch (tone) {
      case "achievement":
        return <Sparkles className="text-amber-500 shrink-0" size={20} />;
      case "fun":
        return <Flame className="text-orange-500 shrink-0" size={20} />;
      case "system":
      default:
        return <CheckCircle2 className="text-emerald-500 shrink-0" size={20} />;
    }
  };

  const getAccentColor = (tone: string) => {
    switch (tone) {
      case "achievement":
        return "bg-amber-500";
      case "fun":
        return "bg-orange-500";
      case "system":
      default:
        return "bg-emerald-500";
    }
  };

  return (
    <div className="fixed bottom-6 right-6 z-50 mx-auto max-w-sm w-full space-y-3 px-4 sm:px-0">
      <AnimatePresence>
        {toasts.map((toast) => (
          <motion.div
            key={toast.id}
            initial={{ opacity: 0, y: 50, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.15 } }}
            transition={{ type: "spring", stiffness: 300, damping: 22 }}
            className="relative w-full rounded-2xl bg-white/95 border border-forest/10 p-4 shadow-[0_20px_48px_rgba(19,36,29,0.12)] backdrop-blur-md overflow-hidden flex items-start gap-3.5"
          >
            <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${getAccentColor(toast.tone)}`} />
            <div className="mt-0.5">{getToastIcon(toast.tone)}</div>
            <div className="flex-1 min-w-0">
              <p className="font-display text-base font-bold text-forest leading-tight">{toast.title}</p>
              <p className="text-xs text-forest/70 mt-1 leading-normal">{toast.message}</p>
            </div>
            <button
              onClick={() => dismissToast(toast.id)}
              className="p-1 rounded-full text-forest/35 hover:text-forest hover:bg-forest/5 transition shrink-0"
              aria-label="Dismiss notification"
            >
              <X size={15} />
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

function StackSlotSearchModal({
  slotIndex,
  players,
  matches,
  onClose,
  onSelect
}: {
  slotIndex: number;
  players: ReturnType<typeof useClubStore.getState>["players"];
  matches: ReturnType<typeof useClubStore.getState>["matches"];
  onClose: () => void;
  onSelect: (playerId: string) => void;
}) {
  const [query, setQuery] = React.useState("");
  const activeIds = new Set(
    matches
      .filter((match) => match.status === "InProgress")
      .flatMap((match) => [...match.teamAPlayerIds, ...match.teamBPlayerIds])
  );
  const candidates = players.filter(
    (player) =>
      player.isActive !== false &&
      player.checkedIn &&
      !activeIds.has(player.id) &&
      (query.trim() === "" || player.displayName.toLowerCase().includes(query.trim().toLowerCase()))
  );

  return (
    <div className="fixed inset-0 z-[130] flex items-end justify-center bg-black/70 p-4 backdrop-blur-sm sm:items-center" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-2xl border border-white/10 bg-[#0a2a20] p-4 shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-3 flex items-center justify-between gap-3">
          <h3 className="font-display text-xl font-black text-ivory">Add to slot #{slotIndex + 1}</h3>
          <button type="button" className="rounded-full p-1.5 text-ivory/60 hover:bg-white/10 hover:text-ivory" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>
        <div className="relative mb-3">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-ivory/40" size={16} />
          <input
            autoFocus
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search checked-in players..."
            className="w-full rounded-xl border border-white/10 bg-white/5 py-2.5 pl-9 pr-3 text-sm text-ivory outline-none focus:ring-2 focus:ring-brass"
          />
        </div>
        <div className="max-h-64 space-y-1 overflow-y-auto pr-1">
          {candidates.map((player) => (
            <button
              key={player.id}
              type="button"
              onClick={() => onSelect(player.id)}
              className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition hover:bg-white/10"
            >
              <img src={getPlayerAvatar(player)} alt="" className="h-9 w-9 shrink-0 rounded-full border border-white/10 object-cover bg-forest/20" />
              <div className="min-w-0">
                <p className="truncate font-semibold text-ivory">{player.displayName}</p>
                <p className="text-xs text-linen/60">{player.skillLevel}</p>
              </div>
            </button>
          ))}
          {candidates.length === 0 && (
            <p className="py-8 text-center text-sm text-linen/50">No checked-in players match your search.</p>
          )}
        </div>
      </div>
    </div>
  );
}

function StackBuilder({
  players,
  courts,
  matches,
  stackOrder
}: {
  players: ReturnType<typeof useClubStore.getState>["players"];
  courts: ReturnType<typeof useClubStore.getState>["courts"];
  matches: ReturnType<typeof useClubStore.getState>["matches"];
  stackOrder: string[];
}) {
  const movePlayerToIndex = useClubStore((state) => state.movePlayerToIndex);
  const moveStackToIndex = useClubStore((state) => state.moveStackToIndex);
  const addEmptyStack = useClubStore((state) => state.addEmptyStack);
  const removeStackAtIndex = useClubStore((state) => state.removeStackAtIndex);
  const setStackSlotKind = useClubStore((state) => state.setStackSlotKind);
  const waitingGroups = getStackDisplayGroups(stackOrder, players, matches, courts, MAX_STACKS);
  const waiting = getWaitingPlayers(players, matches, courts, stackOrder);
  const stackSlotCount = stackOrder.length;
  const atStackLimit = waitingGroups.length >= MAX_STACKS;
  const [draggingPlayerId, setDraggingPlayerId] = React.useState<string | null>(null);
  const [draggingStackIndex, setDraggingStackIndex] = React.useState<number | null>(null);
  const [dragOverStackIndex, setDragOverStackIndex] = React.useState<number | null>(null);
  const draggingStackIndexRef = React.useRef<number | null>(null);
  const [searchSlotIndex, setSearchSlotIndex] = React.useState<number | null>(null);
  const canDrag = true;
  const STACK_DRAG_TYPE = "application/x-haff-stack-index";

  const isStackDrag = (event: React.DragEvent) =>
    draggingStackIndexRef.current !== null
    || event.dataTransfer.types.includes(STACK_DRAG_TYPE)
    || event.dataTransfer.types.includes("text/stack-index");

  const readStackDragIndex = (event: React.DragEvent) => {
    const raw = event.dataTransfer.getData(STACK_DRAG_TYPE) || event.dataTransfer.getData("text/stack-index");
    if (raw !== "") {
      const parsed = Number(raw);
      if (Number.isFinite(parsed)) return parsed;
    }
    return draggingStackIndexRef.current;
  };

  const clearStackDrag = () => {
    draggingStackIndexRef.current = null;
    setDraggingStackIndex(null);
    setDragOverStackIndex(null);
  };

  const handleStackDragOver = (event: React.DragEvent, groupIndex: number) => {
    if (!isStackDrag(event)) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    setDragOverStackIndex(groupIndex);
  };

  const handleStackDropOnGroup = (event: React.DragEvent, targetGroupIndex: number) => {
    if (!isStackDrag(event)) return false;
    event.preventDefault();
    event.stopPropagation();
    const fromIndex = readStackDragIndex(event);
    if (fromIndex !== null && Number.isFinite(fromIndex) && fromIndex !== targetGroupIndex) {
      void moveStackToIndex(fromIndex, targetGroupIndex);
    }
    clearStackDrag();
    return true;
  };

  const startStackDrag = (event: React.DragEvent, groupIndex: number) => {
    event.stopPropagation();
    const payload = String(groupIndex);
    event.dataTransfer.setData(STACK_DRAG_TYPE, payload);
    event.dataTransfer.setData("text/stack-index", payload);
    event.dataTransfer.effectAllowed = "move";
    draggingStackIndexRef.current = groupIndex;
    setDraggingStackIndex(groupIndex);
    setDraggingPlayerId(null);
  };

  return (
    <Card className="overflow-hidden bg-white/5 backdrop-blur-xl border border-white/10 text-ivory">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-[0.24em] text-brass">Play order</p>
          <h2 className="font-display text-2xl leading-tight sm:text-3xl">
            <span className="lg:hidden">Queue stacks</span>
            <span className="hidden lg:inline">Queue stacks — who plays next</span>
          </h2>
        </div>
        <p className="max-w-xs text-xs leading-5 text-linen/65 sm:text-right">
          Groups of 4 in play order. Drag from the checked-in stack above, reorder stacks, then Assign Courts.
        </p>
      </div>
      {searchSlotIndex !== null && (
        <StackSlotSearchModal
          slotIndex={searchSlotIndex}
          players={players}
          matches={matches}
          onClose={() => setSearchSlotIndex(null)}
          onSelect={(playerId) => {
            void movePlayerToIndex(playerId, searchSlotIndex, true);
            setSearchSlotIndex(null);
          }}
        />
      )}
      <div 
        className="mt-4 grid min-w-0 grid-cols-1 gap-3 min-[520px]:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4"
        onDragOver={(event) => {
          if (isStackDrag(event)) event.preventDefault();
        }}
        onDrop={(event) => {
          if (isStackDrag(event)) {
            event.preventDefault();
            clearStackDrag();
            return;
          }
          event.preventDefault();
          const droppedId = event.dataTransfer.getData("text/player-id") || draggingPlayerId;
          // If dropped outside a specific player, append to the end of the queue
          if (droppedId && waiting.findIndex(p => p.id === droppedId) === -1) {
             void movePlayerToIndex(droppedId, stackSlotCount, true);
          }
          setDraggingPlayerId(null);
        }}
      >
        {waitingGroups.map((group, groupIndex) => {
          const filledCount = group.filter((player) => !player.isVacant && !player.isReservedSlot).length;
          const stackKey = stackGroupKey(stackOrder, groupIndex);
          return (
          <div
            key={stackKey}
            className={`min-w-0 min-h-32 rounded-xl border border-[#1e4f3a] bg-[#0d2e22] p-3 transition ${
              groupIndex === 0 ? "border-l-4 border-l-brass" : ""
            } ${
              draggingStackIndex === groupIndex ? "opacity-70 ring-2 ring-brass/50" : ""
            } ${
              dragOverStackIndex === groupIndex && draggingStackIndex !== null && draggingStackIndex !== groupIndex
                ? "ring-2 ring-brass border-brass/50"
                : ""
            }`}
            onDragOver={(event) => handleStackDragOver(event, groupIndex)}
            onDragLeave={(event) => {
              if (!event.currentTarget.contains(event.relatedTarget as Node)) {
                setDragOverStackIndex((current) => (current === groupIndex ? null : current));
              }
            }}
            onDrop={(event) => {
              handleStackDropOnGroup(event, groupIndex);
            }}
          >
            <div
              className="mb-2 flex cursor-grab items-center justify-between gap-2 active:cursor-grabbing"
              draggable={canDrag}
              onDragStart={(event) => startStackDrag(event, groupIndex)}
              onDragEnd={clearStackDrag}
            >
              <div className="flex min-w-0 items-center gap-2">
                <GripVertical size={16} className="shrink-0 text-brass/80" />
                <p className={`truncate text-sm font-black uppercase tracking-normal ${groupIndex === 0 ? "text-brass" : "text-ivory/80"}`}>
                  {getStackLabel(groupIndex)}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-1.5">
                <span className="hidden rounded-full border border-[#1e4f3a] bg-[#132e24] px-2 py-1 text-[10px] font-bold text-ivory/70 sm:inline">
                  {filledCount}/4
                </span>
                <label className="relative shrink-0">
                  <span className="sr-only">Move {getStackLabel(groupIndex)} to position</span>
                  <select
                    key={`${stackKey}-pos`}
                    aria-label={`Move ${getStackLabel(groupIndex)} to position`}
                    className="min-h-8 max-w-[6.5rem] appearance-none truncate rounded-lg bg-forest py-1 pl-2 pr-6 text-[10px] font-bold text-ivory outline-none focus:ring-2 focus:ring-brass"
                    value={groupIndex}
                    onChange={(event) => {
                      const target = Number(event.target.value);
                      if (Number.isFinite(target) && target !== groupIndex) {
                        void moveStackToIndex(groupIndex, target);
                      }
                    }}
                  >
                    {waitingGroups.map((_, optionIndex) => (
                      <option key={optionIndex} value={optionIndex}>
                        {getStackLabel(optionIndex)}
                      </option>
                    ))}
                  </select>
                  <ChevronDown aria-hidden="true" className="pointer-events-none absolute right-1 top-1/2 -translate-y-1/2 text-ivory/75" size={11} />
                </label>
                <button
                  type="button"
                  onClick={() => {
                    if (filledCount > 0) {
                      const ok = window.confirm(
                        `Delete ${getStackLabel(groupIndex)}? ${filledCount} player(s) will move to the end of the queue.`
                      );
                      if (!ok) return;
                    }
                    void removeStackAtIndex(groupIndex);
                  }}
                  className="inline-flex min-h-8 min-w-8 items-center justify-center rounded-lg border border-red-400/25 bg-red-500/10 text-red-300 transition hover:bg-red-500/20 hover:text-red-200"
                  title={`Delete ${getStackLabel(groupIndex)}`}
                  aria-label={`Delete ${getStackLabel(groupIndex)}`}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
            <div className="grid grid-cols-1 gap-1.5">
              {group.map((player, idxInGroup) => {
                const overallIndex = groupIndex * 4 + idxInGroup;
                const slotKind = stackOrder[overallIndex];
                if (player.isReservedSlot || slotKind === "reserved") {
                  return (
                    <div
                      key={player.id}
                      className="flex min-h-11 items-center justify-between gap-2 rounded-xl border border-amber-400/35 bg-amber-400/10 px-2.5 py-2"
                    >
                      <div className="flex min-w-0 items-center gap-2">
                        <Lock size={14} className="shrink-0 text-amber-300" />
                        <span className="text-xs font-black uppercase tracking-wider text-amber-200">Reserved slot</span>
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        <button
                          type="button"
                          onClick={() => setSearchSlotIndex(overallIndex)}
                          className="inline-flex items-center gap-1 rounded-lg bg-brass/20 px-2 py-1 text-[10px] font-black uppercase tracking-wide text-brass hover:bg-brass hover:text-forest"
                        >
                          <Plus size={12} /> Add
                        </button>
                        <button
                          type="button"
                          onClick={() => void setStackSlotKind(overallIndex, "vacant")}
                          className="rounded-lg bg-white/10 px-2 py-1 text-[10px] font-bold text-ivory/70 hover:bg-white/15"
                        >
                          Open
                        </button>
                      </div>
                    </div>
                  );
                }
                if (player.isVacant) {
                  return (
                    <div
                      key={player.id}
                      onDragOver={(event) => {
                        if (isStackDrag(event)) {
                          handleStackDragOver(event, groupIndex);
                          return;
                        }
                        event.preventDefault();
                        event.stopPropagation();
                      }}
                      onDrop={(event) => {
                        if (handleStackDropOnGroup(event, groupIndex)) return;
                        event.preventDefault();
                        event.stopPropagation();
                        const droppedId = event.dataTransfer.getData("text/player-id") || draggingPlayerId;
                        if (droppedId) void movePlayerToIndex(droppedId, overallIndex, true);
                        setDraggingPlayerId(null);
                      }}
                      className="flex min-h-11 items-center justify-between gap-2 rounded-lg border border-dashed border-[#1e4f3a]/70 bg-[#05241c]/50 px-2.5 py-2"
                    >
                      <span className="text-xs font-bold text-ivory/40">Open slot</span>
                      <div className="flex shrink-0 items-center gap-1">
                        <button
                          type="button"
                          onClick={() => setSearchSlotIndex(overallIndex)}
                          className="inline-flex items-center gap-1 rounded-lg bg-brass px-2 py-1 text-[10px] font-black uppercase tracking-wide text-forest hover:bg-brass/90"
                        >
                          <Plus size={12} /> Add
                        </button>
                        <button
                          type="button"
                          onClick={() => void setStackSlotKind(overallIndex, "reserved")}
                          className="inline-flex items-center gap-1 rounded-lg bg-amber-400/15 px-2 py-1 text-[10px] font-black uppercase tracking-wide text-amber-200 hover:bg-amber-400/25"
                          title="Hold this slot as reserved"
                        >
                          <Lock size={12} /> Hold
                        </button>
                      </div>
                    </div>
                  );
                }
                return (
                  <div
                    key={player.id}
                    draggable={canDrag}
                    onDragStart={(event) => {
                      event.stopPropagation();
                      event.dataTransfer.setData("text/player-id", player.id);
                      draggingStackIndexRef.current = null;
                      setDraggingPlayerId(player.id);
                      setDraggingStackIndex(null);
                    }}
                    onDragEnd={() => setDraggingPlayerId(null)}
                    onDragOver={(event) => {
                      if (isStackDrag(event)) {
                        handleStackDragOver(event, groupIndex);
                        return;
                      }
                      event.preventDefault();
                      event.stopPropagation();
                    }}
                    onDrop={(event) => {
                      if (handleStackDropOnGroup(event, groupIndex)) return;
                      event.preventDefault();
                      event.stopPropagation();
                      const droppedId = event.dataTransfer.getData("text/player-id") || draggingPlayerId;
                      if (droppedId && droppedId !== player.id) {
                        void movePlayerToIndex(droppedId, overallIndex, true);
                      }
                      setDraggingPlayerId(null);
                    }}
                    className={`flex min-w-0 items-center gap-2 overflow-hidden rounded-lg border border-[#1e4f3a] bg-[#132e24] px-2.5 py-2 text-ivory shadow-sm lg:cursor-grab lg:active:cursor-grabbing transition ${
                      draggingPlayerId === player.id ? "opacity-50 ring-2 ring-brass/50" : "hover:border-brass/30 hover:bg-[#173d2c]"
                    }`}
                    title={canDrag ? "Drag player over another to insert" : "Choose a position"}
                  >
                    <GripVertical size={16} className="hidden shrink-0 text-brass/50 lg:block" />
                    <img
                      src={getPlayerAvatar(player)}
                      alt=""
                      className="h-8 w-8 shrink-0 rounded-full border-2 border-brass/40 object-cover bg-[#0d2e22]"
                    />
                    <div className="min-w-0 flex flex-1 items-center justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-semibold leading-tight text-ivory">
                          <span className="text-brass/60 mr-1.5 text-xs">#{overallIndex + 1}</span>
                          {player.displayName}
                        </p>
                        {player.statusNote && (
                          <span className="mt-0.5 block max-w-full truncate text-[9px] font-bold text-brass/75" title={player.statusNote}>
                            {player.statusNote}
                          </span>
                        )}
                      </div>
                      <RankBadge skillLevel={player.skillLevel} compact className="shrink-0 self-center" />
                    </div>
                    <label className="relative shrink-0 lg:hidden">
                      <span className="sr-only">Move {player.displayName} to position</span>
                      <select
                        aria-label={`Move ${player.displayName} to position`}
                        className="min-h-10 appearance-none rounded-lg bg-forest py-2 pl-3 pr-8 text-xs font-bold text-ivory outline-none focus:ring-2 focus:ring-brass"
                        onChange={(event) => {
                          const targetIndex = Number(event.target.value);
                          if (Number.isFinite(targetIndex)) void movePlayerToIndex(player.id, targetIndex, true);
                        }}
                        value={overallIndex}
                      >
                        {(stackOrder.length > 0 ? stackOrder : waiting.map((p) => p.id)).map((slotId, optionIndex) => (
                          <option key={optionIndex} value={optionIndex}>
                            Pos {optionIndex + 1}{slotId === "vacant" ? " (open)" : slotId === "reserved" ? " (held)" : ""}
                          </option>
                        ))}
                      </select>
                      <ChevronDown aria-hidden="true" className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-ivory/75" size={14} />
                    </label>
                  </div>
                );
              })}
            </div>
          </div>
          );
        })}
        <button
          type="button"
          onClick={() => void addEmptyStack()}
          disabled={atStackLimit}
          className={`flex min-h-28 w-full flex-col items-center justify-center gap-1.5 rounded-xl border border-dashed p-3 transition ${
            atStackLimit
              ? "cursor-not-allowed border-ivory/15 bg-[#0d2e22]/60 text-ivory/35"
              : "border-brass/35 bg-[#0d2e22] text-brass hover:border-brass/60 hover:bg-[#132e24]"
          }`}
        >
          <Plus size={24} strokeWidth={2.5} />
          <span className="text-xs font-black uppercase tracking-wider">
            {atStackLimit ? "Max stacks reached" : "Add stack"}
          </span>
          <span className="text-[10px] font-semibold text-linen/55">
            {atStackLimit ? `${MAX_STACKS} of ${MAX_STACKS} stacks` : "4 empty slots"}
          </span>
        </button>
        {waitingGroups.length === 0 && (
          <div className="col-span-full rounded-xl border border-dashed border-[#1e4f3a] bg-[#0d2e22] py-8 text-center">
            <p className="text-sm font-semibold text-ivory/60">No stacks yet</p>
            <p className="mt-1 text-xs text-ivory/40">Tap Add stack to create a deck, then fill slots with +.</p>
          </div>
        )}
      </div>
    </Card>
  );
}

function AdminDetails() {
  return (
    <Card className="bg-white/5 backdrop-blur-xl border border-white/10 text-ivory">
      <div className="flex items-center gap-2 text-brass">
        <ShieldCheck size={19} />
        <span className="text-xs font-bold uppercase tracking-[0.24em]">Admin details</span>
      </div>
      <div className="mt-4 grid gap-3">
        {[
          ["Owner", "Full access to players, courts, sessions, display, reports, sync conflicts, and settings."],
          ["Admin", "Runs check-in, generates matches, assigns courts, edits scores, and publishes announcements."],
          ["Scorekeeper", "Can open scoring, update points, pause play, and finish assigned matches."]
        ].map(([role, detail]) => (
          <div key={role} className="rounded-2xl bg-ivory/[0.07] p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]">
            <p className="font-display text-2xl leading-none">{role}</p>
            <p className="mt-1.5 text-xs leading-5 text-linen/75">{detail}</p>
          </div>
        ))}
      </div>
    </Card>
  );
}

function SessionCommandRail() {
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      {[
        [Sparkles, "Next Stack", "Drag players into order"],
        [Flame, "Court Status", "Available, in use, reserved"],
        [ShieldCheck, "Local Saves", "Changes saved on this device"]
      ].map(([Icon, title, detail]) => (
        <div key={title as string} className="rounded-2xl bg-white border border-forest/10 p-4 shadow-sm flex flex-col items-start text-forest">
          <div className="p-2 rounded-xl bg-forest/5 text-forest shrink-0">
            <Icon size={18} />
          </div>
          <p className="mt-3 font-display text-lg font-bold leading-tight">{title as string}</p>
          <p className="mt-1 text-xs text-forest/70 leading-normal">{detail as string}</p>
        </div>
      ))}
    </div>
  );
}

function PlayerDetails() {
  return (
    <Card className="bg-ivory text-forest">
      <div className="flex items-center gap-2 text-clay">
        <Users size={19} />
        <span className="text-xs font-bold uppercase tracking-[0.24em]">Player details</span>
      </div>
      <div className="mt-4 grid grid-cols-2 gap-3">
        <DetailTile icon={<ListChecks size={18} />} label="Profile" value="Skill, tags, notes" />
        <DetailTile icon={<Activity size={18} />} label="Activity" value="Games, days, rank" />
        <DetailTile icon={<CalendarDays size={18} />} label="Attendance" value="Days played" />
        <DetailTile icon={<Activity size={18} />} label="Display" value="TV highlights" />
      </div>
    </Card>
  );
}

function DetailTile({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-white/55 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.65)]">
      <div className="text-forest">{icon}</div>
      <p className="mt-2 text-xs font-bold uppercase tracking-[0.18em] text-clay">{label}</p>
      <p className="mt-1 font-display text-2.5xl leading-none text-forest mt-1.5">{value}</p>
    </div>
  );
}

function ReservedStack({ courtId }: { courtId: string }) {
  const court = useClubStore((state) => state.courts.find((item) => item.id === courtId));
  const players = useClubStore((state) => state.players);
  const reservedPlayers = (court?.reservedPlayerIds ?? [])
    .map((id) => players.find((player) => player.id === id))
    .filter(Boolean);

  return (
    <div className="mt-6">
      <p className="text-xs font-bold uppercase tracking-[0.22em] text-clay">Reserved stack</p>
      {reservedPlayers.length ? (
        <div className="mt-3 grid grid-cols-2 gap-2">
          {reservedPlayers.map((player) => (
            <div 
              key={player!.id} 
              draggable
              onDragStart={(event) => {
                event.dataTransfer.setData("text/player-id", player!.id);
              }}
              className="rounded-2xl bg-white/10 px-3 py-2 cursor-grab active:cursor-grabbing hover:bg-white/15 border border-white/5 transition"
            >
              <p className="font-semibold text-ivory leading-none">{(player?.displayName || "Player").split(" ")[0]}</p>
              <RankBadge skillLevel={player!.skillLevel} compact />
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-3 text-sm text-linen/75">Reserved game — drag players here or tap Assign stack, then Start Match.</p>
      )}
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <>
    <App />
    <Analytics />
  </>
);
