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
  Pause, 
  Play, 
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
  QrCode, 
  X, 
  Calendar, 
  MapPin, 
  Database,
  Volume2,
  VolumeX
} from "lucide-react";
import { Button, Card, Badge } from "./components/ui";
import { Chip } from "./components/ui/heroui-chip";
import { Component as PlayerHero } from "./components/ui/hero";
import { useClubStore } from "./store/useClubStore";
import { db } from "./lib/db";
import { getVoiceStyle, isSoundEnabled, playSound, setSoundEnabled, setVoiceStyle, speakAnnouncement, unlockAudio } from "./lib/sound";
import type { VoiceStyle } from "./lib/sound";
import { io } from "socket.io-client";
import "./styles/globals.css";

// Socket.IO client initialization (falls back gracefully if offline/not found)
let socket: any = null;
try {
  socket = io((import.meta as any).env?.VITE_API_URL || "http://localhost:3001", {
    transports: ["websocket"],
    autoConnect: true,
    reconnection: true
  });
} catch (e) {
  console.log("Socket.IO client initialization bypassed or failed:", e);
}

function App() {
  const { hydrate, hydrated, view, setView, online, setOnline, pendingSyncCount, refreshPendingSyncCount } = useClubStore();
  const [socketConnected, setSocketConnected] = React.useState(false);

  React.useEffect(() => {
    hydrate();
  }, [hydrate]);

  // Synchronize router via pathname / history API and hashes
  React.useEffect(() => {
    const handleOnline = () => setOnline(true);
    const handleOffline = () => setOnline(false);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    const syncRoute = () => {
      const path = window.location.pathname.replace(/^\//, "");
      const hash = window.location.hash.replace(/^#\/?/, "");
      
      let targetView: ViewMode = "admin";
      if (path === "admin" || path === "player" || path === "tv") {
        targetView = path as ViewMode;
      } else if (hash === "admin" || hash === "player" || hash === "tv") {
        targetView = hash as ViewMode;
      } else if (path === "display" || hash === "display") {
        targetView = "tv";
      } else {
        if (window.location.pathname === "/" && !window.location.hash) {
          window.history.replaceState(null, "", "/admin");
          targetView = "admin";
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

    const unsubscribe = useClubStore.subscribe((state) => {
      if (
        state.courts !== prevCourts ||
        state.matches !== prevMatches ||
        state.players !== prevPlayers ||
        state.stackOrder !== prevStackOrder
      ) {
        prevCourts = state.courts;
        prevMatches = state.matches;
        prevPlayers = state.players;
        prevStackOrder = state.stackOrder;
        if (socket && socket.connected) {
          socket.emit("state_changed");
        }
      }
    });

    const timer = window.setInterval(refreshPendingSyncCount, 2500);

    // Socket.IO Connection Event Handlers
    if (socket) {
      const onConnect = () => setSocketConnected(true);
      const onDisconnect = () => setSocketConnected(false);
      const onSyncUpdate = () => {
        console.log("Received broadcast event, syncing local state...");
        hydrate();
      };
      const onStateChanged = () => {
        console.log("Received state change broadcast event, syncing local state...");
        hydrate();
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
        unsubscribe();
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
      unsubscribe();
    };
  }, [refreshPendingSyncCount, setOnline, hydrate]);

  if (!hydrated) return <LoadingScreen />;

  return (
    <main className="min-h-screen bg-forest text-ivory">
      <div className="fixed inset-0 z-0 texture pointer-events-none" />
      <TopBar 
        view={view} 
        setView={setView} 
        online={online} 
        pendingSyncCount={pendingSyncCount} 
        socketConnected={socketConnected}
      />
      <div className="relative z-10">
        <AnimatePresence mode="wait">
          {view === "admin" && <AdminView key="admin" />}
          {view === "player" && <PlayerView key="player" />}
          {view === "tv" && <DisplayView key="tv" />}
        </AnimatePresence>
      </div>
      <MobileDock view={view} setView={setView} />
      <Toasts />
    </main>
  );
}

function LoadingScreen() {
  return (
    <main className="min-h-screen bg-forest px-4 py-6 text-ivory">
      <div className="fixed inset-0 texture pointer-events-none" />
      <div className="mx-auto max-w-6xl">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="premium-loader"><LogoMark /></div>
            <div>
              <p className="font-display text-2xl leading-none">HAFF Leisure Club</p>
              <p className="text-xs uppercase tracking-[0.24em] text-brass">Loading session</p>
            </div>
          </div>
          <div className="hidden h-10 w-36 rounded-full bg-ivory/10 sm:block" />
        </div>
        <div className="mt-10 grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
          <div className="space-y-5">
            <div className="skeleton-panel h-72 rounded-[1.75rem]" />
            <div className="grid gap-4 md:grid-cols-2">
              <div className="skeleton-panel h-48 rounded-[1.25rem]" />
              <div className="skeleton-panel h-48 rounded-[1.25rem]" />
            </div>
          </div>
          <div className="space-y-5">
            <div className="skeleton-panel h-28 rounded-[1.25rem]" />
            <div className="skeleton-panel h-80 rounded-[1.25rem]" />
          </div>
        </div>
      </div>
    </main>
  );
}

function useNow() {
  const [now, setNow] = React.useState(() => Date.now());
  React.useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 67);
    return () => window.clearInterval(timer);
  }, []);
  return now;
}

type ViewMode = "admin" | "player" | "tv";

function TopBar({ 
  view, 
  setView, 
  online, 
  pendingSyncCount,
  socketConnected 
}: { 
  view: string; 
  setView: (view: ViewMode) => void; 
  online: boolean; 
  pendingSyncCount: number;
  socketConnected: boolean;
}) {
  const [soundOn, setSoundOn] = React.useState(isSoundEnabled);

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
        <button className="flex items-center gap-3 text-left" onClick={() => setView("admin")}>
          <LogoMark />
          <span className="hidden sm:block">
            <span className="block font-display text-xl leading-none text-ivory">HAFF Leisure Club</span>
            <span className="text-xs uppercase tracking-[0.28em] text-brass">PicklePulse</span>
          </span>
        </button>
        <nav className="hidden rounded-full bg-ivory/10 p-1 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)] sm:flex">
          {[
            ["admin", Smartphone],
            ["player", UserRound],
            ["tv", Monitor]
          ].map(([key, Icon]) => (
            <button
              key={key as string}
              onClick={() => setView(key as ViewMode)}
              className={`grid h-10 w-11 place-items-center rounded-full transition ${view === key ? "bg-ivory text-forest" : "text-ivory/70"}`}
              title={key as string}
            >
              <Icon size={18} />
            </button>
          ))}
        </nav>
        <div className="flex items-center gap-2">
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
            className="flex min-h-10 items-center gap-2 rounded-full bg-ivory/10 px-3 text-xs font-semibold text-ivory shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]"
            title="Offline-first save status. All actions save on this device first, then sync later."
          >
            {online ? <Wifi size={16} /> : <WifiOff size={16} />}
            <span className="hidden sm:inline">{online ? "Online" : "Offline"} - {pendingSyncCount ? `${pendingSyncCount} pending` : "all saved"}</span>
          </div>
        </div>
      </div>
    </header>
  );
}

function MobileDock({ view, setView }: { view: string; setView: (view: ViewMode) => void }) {
  return (
    <nav className="fixed bottom-4 left-1/2 z-40 flex -translate-x-1/2 rounded-full bg-ivory p-1.5 shadow-[0_24px_70px_rgba(0,0,0,0.34)] sm:hidden">
      {[
        ["admin", Smartphone],
        ["player", UserRound],
        ["tv", Monitor]
      ].map(([key, Icon]) => (
        <button
          key={key as string}
          onClick={() => setView(key as ViewMode)}
          className={`grid h-12 w-14 place-items-center rounded-full transition ${view === key ? "bg-forest text-ivory" : "text-forest/75"}`}
        >
          <Icon size={19} />
        </button>
      ))}
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

type AdminTab = "control" | "players" | "courts" | "sessions" | "settings";

function AdminView() {
  const { players, courts, matches, sessions, currentSessionId } = useClubStore();
  const [activeTab, setActiveTab] = React.useState<AdminTab>("control");
  const [isQrOpen, setIsQrOpen] = React.useState(false);

  // Admin Portal Authentication
  const [isAuthenticated, setIsAuthenticated] = React.useState(() => {
    return localStorage.getItem("haff_admin_authenticated") === "true";
  });
  const [email, setEmail] = React.useState("gianaibo.dev@gmail.com");
  const [password, setPassword] = React.useState("••••••••");
  const [authError, setAuthError] = React.useState("");

  const checkedIn = players.filter((player) => player.checkedIn);
  const activeSession = sessions.find((s) => s.id === currentSessionId);
  const waiting = checkedIn.length - matches.filter((match) => match.status === "InProgress").length * 4;

  if (!isAuthenticated) {
    const handleLogin = (e: React.FormEvent) => {
      e.preventDefault();
      if (email === "gianaibo.dev@gmail.com" && (password === "••••••••" || password === "password" || password === "gianaibo")) {
        localStorage.setItem("haff_admin_authenticated", "true");
        setIsAuthenticated(true);
        setAuthError("");
        playSound("checkin");
      } else {
        setAuthError("Invalid administrator credentials");
        playSound("complete");
      }
    };

    return (
      <div className="min-h-[calc(100vh-120px)] flex items-center justify-center px-4 py-12">
        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: "spring", stiffness: 300, damping: 24 }}
          className="max-w-md w-full bg-white border border-forest/10 rounded-[2.5rem] shadow-[0_24px_80px_rgba(19,36,29,0.12)] p-8 text-forest relative overflow-hidden"
        >
          <div className="absolute -right-12 -top-12 opacity-[0.03] pointer-events-none">
            <LogoMark size="large" />
          </div>

          <div className="flex flex-col items-center text-center">
            <div className="h-16 w-16 rounded-2xl bg-forest/5 flex items-center justify-center border border-forest/10 shadow-inner">
              <LogoMark />
            </div>
            <h2 className="font-display text-3xl font-black mt-5 leading-none tracking-tight">HAFF PicklePulse</h2>
            <p className="text-xs font-bold uppercase tracking-[0.24em] text-clay mt-2">Admin Portal</p>
          </div>

          <form onSubmit={handleLogin} className="mt-8 space-y-4">
            {authError && (
              <div className="p-3.5 bg-red-50 border border-red-100 text-red-600 rounded-2xl text-xs font-semibold text-center">
                {authError}
              </div>
            )}

            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-wider text-forest/60">Administrator Email</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="email@example.com"
                className="w-full rounded-2xl bg-forest/5 text-forest border-forest/10 px-4 py-3.5 focus:outline-none focus:ring-2 focus:ring-forest text-sm shadow-inner transition"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-bold uppercase tracking-wider text-forest/60">Password</label>
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password"
                className="w-full rounded-2xl bg-forest/5 text-forest border-forest/10 px-4 py-3.5 focus:outline-none focus:ring-2 focus:ring-forest text-sm shadow-inner transition"
              />
            </div>

            <Button
              type="submit"
              className="w-full bg-forest text-ivory hover:bg-forest/90 font-black py-4 rounded-2xl shadow-xl transition-all hover:scale-[1.01] active:scale-95 border-none mt-6 flex items-center justify-center gap-2"
            >
              <Lock size={16} /> Sign In
            </Button>
          </form>

          <p className="text-[10px] text-center text-forest/40 mt-8 leading-relaxed px-4">
            Unauthorized access is restricted. Data transactions are logged and encrypted.
          </p>
        </motion.div>
      </div>
    );
  }

  return (
    <section className="mx-auto max-w-7xl px-4 py-4">
      {/* Header Panel */}
      <section className="relative overflow-hidden rounded-[1.5rem] bg-[#29483d] p-5 text-ivory shadow-[0_22px_70px_rgba(0,0,0,0.18)]">
        <div className="absolute -right-8 -top-12 opacity-[0.06]"><LogoMark size="large" /></div>
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-linen/80">
          {activeSession ? `${activeSession.name} (${activeSession.location || "HAFF Leisure Club"})` : "No active session"}
        </p>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mt-1">
          <h1 className="font-display text-4xl font-semibold leading-tight tracking-normal sm:text-6xl">
            Open Play Control
          </h1>
          <div className="flex gap-2">
            <Button
              onClick={() => setIsQrOpen(true)}
              className="bg-ivory/15 text-ivory hover:bg-ivory/25 font-bold px-5 py-3 rounded-full flex items-center gap-2"
            >
              <QrCode size={16} /> Player QR
            </Button>
            <Button
              onClick={() => {
                localStorage.removeItem("haff_admin_authenticated");
                setIsAuthenticated(false);
                playSound("complete");
              }}
              className="bg-ivory/15 text-ivory hover:bg-ivory/25 font-bold px-5 py-3 rounded-full flex items-center gap-2"
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
                className="bg-clay text-ivory hover:bg-clay/90 font-bold px-5 py-3 rounded-full shadow-md"
              >
                End Session
              </Button>
            )}
          </div>
        </div>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-linen/85">
          Check players in, park players who are taking a break, drag names into stacks, then assign the next stack to an available court.
        </p>
        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <Metric label="Checked in" value={checkedIn.length} />
          <Metric label="Courts" value={courts.length} />
          <Metric label="Completed" value={matches.filter((match) => match.status === "Completed").length} />
          <Metric label="Waiting" value={Math.max(0, waiting)} />
        </div>
      </section>

      {/* Tab Navigation */}
      <div className="my-3 border-b border-ivory/10 pb-px">
        <div className="flex gap-2 overflow-x-auto pb-1.5 scrollbar-none">
          {[
            { id: "control", label: "Play Rotation" },
            { id: "players", label: "Manage Players" },
            { id: "courts", label: "Manage Courts" },
            { id: "sessions", label: "Sessions" },
            { id: "settings", label: "Backup & Settings" }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as AdminTab)}
              className={`whitespace-nowrap rounded-full px-4 py-2 text-sm font-bold transition-all ${
                activeTab === tab.id 
                  ? "bg-ivory text-forest shadow-[0_4px_12px_rgba(0,0,0,0.15)]" 
                  : "bg-ivory/5 text-ivory/70 hover:bg-ivory/10 hover:text-ivory"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Contents */}
      <div key={activeTab}>
        {activeTab === "control" && <PlayRotationTab />}
        {activeTab === "players" && <PlayersCrudTab />}
        {activeTab === "courts" && <CourtsCrudTab />}
        {activeTab === "sessions" && <SessionsCrudTab />}
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
    setPlayerParked,
    generateMatches, 
    reserveCourt, 
    startReservedCourt, 
    clearCourt, 
    finishCourt, 
    matchDurationMinutes, 
    setMatchDurationMinutes,
    currentSessionId,
    startNewSession,
    returnReservedToQueue,
    assignPlayerToCourt,
    removePlayerFromCourt
  } = useClubStore();
  const [sessionName, setSessionName] = React.useState("");
  const [announcementMessage, setAnnouncementMessage] = React.useState("");
  const [selectedVoiceStyle, setSelectedVoiceStyle] = React.useState<VoiceStyle>(getVoiceStyle);
  const [testAnnouncement, setTestAnnouncement] = React.useState(
    "Court 1 overtime. Court 1 players: Juan, Maria, Alex, and Kim. Please finish your game."
  );

  const mostActive = [...players].sort((a, b) => b.totalGamesPlayed - a.totalGamesPlayed)[0];



  const activePlayers = players.filter((p) => p.isActive !== false);
  const changeVoiceStyle = (style: VoiceStyle) => {
    setSelectedVoiceStyle(style);
    setVoiceStyle(style);
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="space-y-4">
          <StackBuilder players={players} courts={courts} matches={matches} stackOrder={stackOrder} />
        <div className="grid gap-4 md:grid-cols-2">
          {courts.map((court) => {
            const match = matches.find((item) => item.id === court.currentMatchId);
            return (
              <Card 
                key={court.id} 
                className={`court-card min-h-48 bg-ivory text-forest transition ${court.status === "Maintenance" || court.status === "Paused" || court.status === "InUse" ? "" : "hover:border-forest/30"}`}
                onDragOver={(event) => {
                  if (court.status !== "Maintenance" && court.status !== "Paused" && court.status !== "InUse") {
                    event.preventDefault();
                  }
                }}
                onDrop={async (event) => {
                  event.preventDefault();
                  const playerId = event.dataTransfer.getData("text/player-id");
                  if (playerId && court.status !== "Maintenance" && court.status !== "Paused" && court.status !== "InUse") {
                    await assignPlayerToCourt(playerId, court.id);
                  }
                }}
              >
                <div className="flex items-center justify-between">
                  <h2 className="font-display text-3xl text-forest">{court.name}</h2>
                  <Chip
                    color={
                      court.status === "InUse" ? "warning" :
                      court.status === "Reserved" ? "accent" :
                      court.status === "Maintenance" ? "danger" : "success"
                    }
                    variant="soft"
                    size="sm"
                    className="font-bold"
                  >
                    {court.status === "InUse" ? "IN USE" : court.status}
                  </Chip>
                </div>
                {match ? (
                  <MatchLine matchId={match.id} />
                ) : court.status === "Reserved" ? (
                  <ReservedStack courtId={court.id} />
                ) : court.status === "Maintenance" ? (
                  <p className="mt-8 text-sm text-red-700/80 font-semibold">Under Maintenance. Players cannot be assigned.</p>
                ) : court.status === "Paused" ? (
                  <p className="mt-8 text-sm text-amber-700/80 font-semibold">Temporarily paused by admin.</p>
                ) : (
                  <p className="mt-8 text-sm text-forest/75">Available for the next balanced rotation.</p>
                )}
                <div className="mt-5 flex flex-wrap gap-2">
                  {match ? (
                    <Button onClick={() => { playSound("complete"); finishCourt(court.id); }} className="min-h-10 bg-forest px-4 text-xs text-ivory">
                      <CheckCircle2 size={14} /> Finish
                    </Button>
                  ) : court.status === "Reserved" ? (
                    <>
                      <Button 
                        onClick={() => {
                          const count = court.reservedPlayerIds?.length ?? 0;
                          if (count < 4) {
                            if (confirm(`This stack has only ${count} players. Start anyway?`)) {
                              startReservedCourt(court.id);
                            }
                          } else {
                            startReservedCourt(court.id);
                          }
                        }} 
                        className="min-h-10 bg-brass px-4 text-xs text-forest"
                      >
                        Start Stack
                      </Button>
                      <Button onClick={() => returnReservedToQueue(court.id)} className="min-h-10 bg-linen px-4 text-xs text-forest">
                        Return to Queue
                      </Button>
                      <Button onClick={() => clearCourt(court.id)} className="min-h-10 bg-forest/10 px-4 text-xs text-forest">
                        Clear Hold
                      </Button>
                    </>
                  ) : court.status === "Available" ? (
                    <Button onClick={() => reserveCourt(court.id)} className="min-h-10 bg-linen px-4 text-xs text-forest">
                      <Lock size={14} /> Assign Next Stack
                    </Button>
                  ) : null}
                </div>
              </Card>
            );
          })}
        </div>
      </div>
      <aside className="space-y-5">
        <Card className="bg-white border border-forest/10 shadow-lg text-forest">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-clay">Quick action</p>
              <h2 className="font-display text-3xl text-forest">Open play rotation</h2>
            </div>
            <Button onClick={() => { playSound("complete"); generateMatches(); }} className="bg-forest text-ivory hover:bg-forest/90">Assign Courts</Button>
          </div>
        </Card>
        <Card className="bg-white border border-forest/10 shadow-lg text-forest">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-clay">Default open play time</p>
              <h2 className="font-display text-3xl text-forest">{matchDurationMinutes} minutes</h2>
              <p className="mt-1 text-sm text-forest/75">Timer goes negative when a court is in overtime.</p>
            </div>
            <div className="flex gap-2">
              <Button onClick={() => setMatchDurationMinutes(matchDurationMinutes - 1)} className="min-h-11 bg-forest px-4 text-ivory hover:bg-forest/90">-</Button>
              <Button onClick={() => setMatchDurationMinutes(matchDurationMinutes + 1)} className="min-h-11 bg-forest px-4 text-ivory hover:bg-forest/90">+</Button>
            </div>
          </div>
          <div className="mt-4 border-t border-forest/10 pt-4">
            <p className="text-xs font-bold uppercase tracking-[0.16em] text-clay">Voice style</p>
            <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {[
                ["warm", "Warm"],
                ["clear", "Clear"],
                ["bright", "Bright"],
                ["formal", "Formal"]
              ].map(([style, label]) => (
                <button
                  key={style}
                  type="button"
                  aria-pressed={selectedVoiceStyle === style}
                  onClick={() => changeVoiceStyle(style as VoiceStyle)}
                  className={`min-h-10 rounded-lg px-3 text-sm font-bold transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brass ${
                    selectedVoiceStyle === style ? "bg-forest text-ivory" : "bg-linen text-forest hover:bg-forest/10"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            <label className="mt-4 block text-xs font-bold uppercase tracking-[0.16em] text-clay" htmlFor="test-announcement">
              Test script
            </label>
            <textarea
              id="test-announcement"
              className="mt-2 min-h-24 w-full resize-y rounded-lg bg-linen px-4 py-3 text-sm leading-6 text-forest outline-none ring-1 ring-forest/10 placeholder:text-forest/45 focus:ring-2 focus:ring-brass"
              onChange={(event) => setTestAnnouncement(event.target.value)}
              value={testAnnouncement}
            />
            <Button
              disabled={!testAnnouncement.trim()}
              onClick={() => speakAnnouncement(testAnnouncement.trim())}
              className="mt-2 min-h-11 bg-brass px-4 text-forest hover:bg-[#d7bd82] disabled:cursor-not-allowed disabled:opacity-45"
            >
              <Volume2 size={16} /> Test Voice
            </Button>
          </div>
          <div className="mt-4 flex flex-col gap-2 border-t border-forest/10 pt-4 sm:flex-row">
            <label className="sr-only" htmlFor="club-announcement">Club announcement</label>
            <input
              id="club-announcement"
              className="min-h-11 flex-1 rounded-lg bg-linen px-4 text-sm text-forest outline-none ring-1 ring-forest/10 placeholder:text-forest/45 focus:ring-2 focus:ring-brass"
              onChange={(event) => setAnnouncementMessage(event.target.value)}
              placeholder="Type an announcement for the club"
              value={announcementMessage}
            />
            <Button
              disabled={!announcementMessage.trim()}
              onClick={() => speakAnnouncement(announcementMessage.trim())}
              className="min-h-11 bg-forest px-5 text-ivory hover:bg-forest/90 disabled:cursor-not-allowed disabled:opacity-45"
            >
              <Volume2 size={16} /> Announce
            </Button>
          </div>
        </Card>
        <Card 
          className="bg-white border border-forest/10 shadow-lg text-forest transition"
          onDragOver={(event) => event.preventDefault()}
          onDrop={async (event) => {
            event.preventDefault();
            const playerId = event.dataTransfer.getData("text/player-id");
            if (playerId) {
              await removePlayerFromCourt(playerId);
            }
          }}
        >
          <h2 className="font-display text-3xl text-forest">Check-in lounge</h2>
          <div className="mt-4 space-y-3 max-h-96 overflow-y-auto pr-1">
            {activePlayers.map((player) => {
              const activeMatchIds = new Set(
                matches.filter((m) => m.status === "InProgress").flatMap((m) => [...m.teamAPlayerIds, ...m.teamBPlayerIds])
              );
              const isPlaying = activeMatchIds.has(player.id);
              const isDraggable = !isPlaying;

              return (
                <div
                  key={player.id}
                  draggable={isDraggable}
                  onDragStart={(event) => {
                    event.dataTransfer.setData("text/player-id", player.id);
                  }}
                  className={`flex min-h-16 items-center justify-between gap-3 rounded-2xl bg-white px-3.5 shadow-sm border border-forest/5 ${
                    isDraggable ? "cursor-grab active:cursor-grabbing hover:bg-forest/5 transition" : ""
                  }`}
                  title={isDraggable ? "Drag player into a stack or court" : undefined}
                >
                  <div className="flex items-center gap-2.5">
                    {isDraggable && <GripVertical size={16} className="text-forest/30 shrink-0" />}
                    <div className="h-8 w-8 rounded-full overflow-hidden bg-forest/10 border border-forest/10 shrink-0">
                      <img 
                        src={getPlayerAvatar(player)} 
                        alt={player.displayName} 
                        className="h-full w-full object-cover" 
                      />
                    </div>
                    <div>
                      <p className="font-semibold text-forest">{player.displayName}</p>
                      <p className="text-xs text-forest/75">
                        {isPlaying ? "Playing" : player.parked ? "Parked" : player.skillLevel} · {player.totalGamesPlayed} games
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-1.5">
                    {!player.checkedIn ? (
                      <Button
                        onClick={() => checkIn(player.id)}
                        className="min-h-10 px-4 text-xs font-bold bg-forest text-ivory hover:bg-forest/90"
                      >
                        Check In
                      </Button>
                    ) : isPlaying ? (
                      <span className="inline-flex items-center rounded-full bg-amber-100 px-3 py-1 text-xs font-bold text-amber-800">
                        Playing
                      </span>
                    ) : (
                      <>
                        <Button
                          onClick={() => setPlayerParked(player.id, !player.parked)}
                          className={`min-h-10 px-3 text-xs font-bold transition ${
                            player.parked
                              ? "bg-brass text-forest hover:bg-brass/90"
                              : "bg-linen text-forest hover:bg-linen/90"
                          }`}
                        >
                          {player.parked ? "Resume" : "Park"}
                        </Button>
                        <Button
                          onClick={() => checkOut(player.id)}
                          className="min-h-10 px-3 text-xs font-bold bg-clay text-ivory hover:bg-clay/90"
                        >
                          Out
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </Card>
        <Card className="bg-[#29483d] text-ivory">
          <Activity className="mb-3 text-brass" />
          <p className="font-display text-4xl">{mostActive?.displayName}</p>
          <p className="text-sm text-linen/80">Most active player with {mostActive?.totalGamesPlayed} games logged.</p>
        </Card>
      </aside>
    </div>
    </div>
  );
}

// ----------------------------------------------------
// PLAYERS CRUD TAB
// ----------------------------------------------------
function PlayersCrudTab() {
  const { players, addPlayer, updatePlayer, deletePlayer } = useClubStore();
  const [search, setSearch] = React.useState("");
  const [showArchived, setShowArchived] = React.useState(false);
  const [editingPlayer, setEditingPlayer] = React.useState<any>(null);
  const [isAdding, setIsAdding] = React.useState(false);

  // Form states
  const [displayName, setDisplayName] = React.useState("");
  const [skillLevel, setSkillLevel] = React.useState<any>("Beginner");
  const [rating, setRating] = React.useState("2.0");
  const [tags, setTags] = React.useState("");
  const [phoneNumber, setPhoneNumber] = React.useState("");
  const [emergencyNote, setEmergencyNote] = React.useState("");
  const [preferredPlayStyle, setPreferredPlayStyle] = React.useState("");
  const [notes, setNotes] = React.useState("");
  const [avatarUrl, setAvatarUrl] = React.useState("");

  const filtered = players.filter((p) => {
    const matchesSearch = p.displayName.toLowerCase().includes(search.toLowerCase());
    const matchesActive = showArchived ? true : (p.isActive !== false);
    return matchesSearch && matchesActive;
  });

  const resetForm = () => {
    setDisplayName("");
    setSkillLevel("Beginner");
    setRating("2.0");
    setTags("");
    setPhoneNumber("");
    setEmergencyNote("");
    setPreferredPlayStyle("");
    setNotes("");
    setAvatarUrl("");
    setEditingPlayer(null);
    setIsAdding(false);
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!displayName.trim()) return;
    await addPlayer({
      displayName: displayName.trim(),
      skillLevel,
      rating: parseFloat(rating) || 2.0,
      tags: tags.split(",").map(t => t.trim()).filter(Boolean),
      checkedIn: false,
      isActive: true,
      phoneNumber: phoneNumber.trim() || undefined,
      emergencyNote: emergencyNote.trim() || undefined,
      preferredPlayStyle: preferredPlayStyle.trim() || undefined,
      notes: notes.trim() || undefined,
      avatarUrl: avatarUrl.trim() || undefined
    });
    resetForm();
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingPlayer || !displayName.trim()) return;
    await updatePlayer({
      ...editingPlayer,
      displayName: displayName.trim(),
      skillLevel,
      rating: parseFloat(rating) || 2.0,
      tags: tags.split(",").map(t => t.trim()).filter(Boolean),
      phoneNumber: phoneNumber.trim() || undefined,
      emergencyNote: emergencyNote.trim() || undefined,
      preferredPlayStyle: preferredPlayStyle.trim() || undefined,
      notes: notes.trim() || undefined,
      avatarUrl: avatarUrl.trim() || undefined
    });
    resetForm();
  };

  const startEdit = (player: any) => {
    setEditingPlayer(player);
    setDisplayName(player.displayName);
    setSkillLevel(player.skillLevel);
    setRating(player.rating.toString());
    setTags(player.tags.join(", "));
    setPhoneNumber(player.phoneNumber ?? "");
    setEmergencyNote(player.emergencyNote ?? "");
    setPreferredPlayStyle(player.preferredPlayStyle ?? "");
    setNotes(player.notes ?? "");
    setAvatarUrl(player.avatarUrl ?? "");
    setIsAdding(false);
  };

  return (
    <div className="grid gap-5 lg:grid-cols-[1.3fr_0.7fr]">
      {/* Player List */}
      <Card className="bg-white border border-forest/10 shadow-lg text-forest">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="font-display text-3xl">Player Roster ({filtered.length})</h2>
          <div className="flex items-center gap-4">
            <label className="flex items-center gap-2 text-xs font-semibold text-forest/75 cursor-pointer">
              <input 
                type="checkbox" 
                checked={showArchived} 
                onChange={(e) => setShowArchived(e.target.checked)} 
                className="rounded border-forest/20 text-forest focus:ring-forest"
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
          <Search size={16} className="absolute left-4 text-forest/40" />
          <input
            type="text"
            placeholder="Search players..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-2xl bg-white/60 text-forest border-none pl-11 pr-4 py-3 placeholder:text-forest/40 focus:outline-none focus:ring-2 focus:ring-forest shadow-inner text-sm"
          />
        </div>

        {/* Grid List */}
        <div className="mt-4 space-y-3 max-h-[600px] overflow-y-auto pr-1">
          {filtered.map((player) => (
            <div 
              key={player.id} 
              className={`flex items-center justify-between gap-3 rounded-2xl p-3.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.65)] hover:bg-white/80 transition ${
                player.isActive === false ? "bg-white/30 opacity-70" : "bg-white/55"
              }`}
            >
              <div>
                <p className="font-semibold text-forest text-lg leading-tight flex items-center gap-2">
                  {player.displayName}
                  {player.isActive === false && (
                    <span className="text-[10px] bg-clay/10 text-clay border border-clay/20 px-1.5 py-0.5 rounded font-bold uppercase tracking-wider">Archived</span>
                  )}
                </p>
                <div className="mt-1 flex items-center gap-1.5 flex-wrap">
                  <RankBadge skillLevel={player.skillLevel} compact />
                  <span className="text-xs text-forest/50">· Rating: {player.rating} · {player.totalGamesPlayed} games</span>
                  {player.preferredPlayStyle && (
                    <span className="text-xs text-forest/60">· Style: {player.preferredPlayStyle}</span>
                  )}
                  {player.tags.map((tag) => (
                    <span key={tag} className="text-[10px] bg-forest/5 text-forest/70 border border-forest/10 px-1.5 py-0.2 rounded font-medium">{tag}</span>
                  ))}
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
                    <button 
                      onClick={() => startEdit(player)} 
                      className="p-2 rounded-full hover:bg-forest/5 text-forest/60 hover:text-forest transition"
                      title="Edit Player"
                    >
                      <Edit2 size={16} />
                    </button>
                    <button 
                      onClick={() => {
                        if (confirm(`Are you sure you want to archive ${player.displayName}?`)) {
                          deletePlayer(player.id);
                          if (editingPlayer?.id === player.id) resetForm();
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

      {/* Editor Panel */}
      <Card className="bg-[#29483d] text-ivory h-fit">
        {isAdding || editingPlayer ? (
          <form onSubmit={isAdding ? handleAdd : handleUpdate} className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-2xl">{isAdding ? "Create Player" : "Edit Player"}</h3>
              <button type="button" onClick={resetForm} className="p-1 rounded-full hover:bg-white/10 text-ivory/80"><X size={18} /></button>
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

            <div className="grid grid-cols-2 gap-3">
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

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-bold uppercase tracking-wider text-brass">Phone Number</label>
                <input
                  type="tel"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  placeholder="e.g. 555-0199"
                  className="w-full rounded-2xl bg-white/10 text-ivory border-none px-4 py-3 placeholder:text-ivory/30 focus:outline-none focus:ring-2 focus:ring-brass text-sm shadow-inner"
                />
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

            <div className="pt-2 flex gap-2">
              <Button type="submit" className="w-full bg-brass text-forest min-h-11">
                <Save size={16} /> Save Player
              </Button>
              <Button type="button" onClick={resetForm} className="bg-white/10 text-ivory min-h-11 px-4">
                Cancel
              </Button>
            </div>
          </form>
        ) : (
          <div className="text-center py-8">
            <UserRound className="mx-auto text-brass mb-3" size={32} />
            <h3 className="font-display text-2xl">No Player Selected</h3>
            <p className="text-sm text-linen/75 mt-1">Select a player from the list to edit, or click Add Player to create a new one.</p>
          </div>
        )}
      </Card>
    </div>
  );
}

// ----------------------------------------------------
// COURTS CRUD TAB
// ----------------------------------------------------
function CourtsCrudTab() {
  const { courts, addCourt, updateCourt, deleteCourt } = useClubStore();
  const [editingCourt, setEditingCourt] = React.useState<any>(null);
  const [isAdding, setIsAdding] = React.useState(false);

  // Form states
  const [name, setName] = React.useState("");
  const [number, setNumber] = React.useState("1");

  const resetForm = () => {
    setName("");
    setNumber("1");
    setEditingCourt(null);
    setIsAdding(false);
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    await addCourt({
      name: name.trim(),
      number: parseInt(number) || 1
    });
    resetForm();
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingCourt || !name.trim()) return;
    await updateCourt({
      ...editingCourt,
      name: name.trim(),
      number: parseInt(number) || 1
    });
    resetForm();
  };

  const startEdit = (court: any) => {
    setEditingCourt(court);
    setName(court.name);
    setNumber(court.number.toString());
    setIsAdding(false);
  };

  const toggleCourtMaintenance = async (court: any) => {
    const nextStatus = court.status === "Maintenance" ? "Available" : "Maintenance";
    await updateCourt({
      ...court,
      status: nextStatus
    });
  };

  return (
    <div className="grid gap-5 lg:grid-cols-[1.3fr_0.7fr]">
      {/* Court List */}
      <Card className="bg-white border border-forest/10 shadow-lg text-forest">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-3xl">Court Configurations ({courts.length})</h2>
          <Button onClick={() => { resetForm(); setIsAdding(true); }} className="min-h-10 bg-forest text-ivory text-xs px-4">
            <Plus size={14} /> Add Court
          </Button>
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-2 max-h-[550px] overflow-y-auto pr-1">
          {courts.map((court) => (
            <div 
              key={court.id}
              className="flex flex-col justify-between rounded-2xl bg-white/55 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.65)] hover:bg-white/75 transition"
            >
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-display text-2xl text-forest">{court.name}</h3>
                  <p className="text-xs text-forest/65">Court Number: {court.number}</p>
                </div>
                <Chip
                  color={
                    court.status === "InUse" ? "warning" :
                    court.status === "Reserved" ? "accent" :
                    court.status === "Maintenance" ? "danger" : "success"
                  }
                  variant="soft"
                  size="sm"
                  className="font-bold"
                >
                  {court.status}
                </Chip>
              </div>

              <div className="mt-6 flex items-center justify-between border-t border-forest/10 pt-3">
                <Button 
                  onClick={() => toggleCourtMaintenance(court)} 
                  className={`min-h-8 text-[11px] px-3 font-bold ${court.status === "Maintenance" ? "bg-emerald-500 text-white" : "bg-red-100 text-red-700"}`}
                >
                  {court.status === "Maintenance" ? "Make Available" : "Set Maintenance"}
                </Button>
                <div className="flex gap-1">
                  <button 
                    onClick={() => startEdit(court)} 
                    className="p-1.5 rounded-full hover:bg-forest/5 text-forest/60 hover:text-forest transition"
                  >
                    <Edit2 size={15} />
                  </button>
                  <button 
                    onClick={() => {
                      if (confirm(`Are you sure you want to delete ${court.name}?`)) {
                        deleteCourt(court.id);
                        if (editingCourt?.id === court.id) resetForm();
                      }
                    }} 
                    className="p-1.5 rounded-full hover:bg-red-50 text-red-500/60 hover:text-red-500 transition"
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            </div>
          ))}
          {courts.length === 0 && (
            <p className="text-center py-10 text-forest/50 col-span-2">No courts configured.</p>
          )}
        </div>
      </Card>

      {/* Editor Panel */}
      <Card className="bg-[#29483d] text-ivory h-fit">
        {isAdding || editingCourt ? (
          <form onSubmit={isAdding ? handleAdd : handleUpdate} className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-2xl">{isAdding ? "Create Court" : "Edit Court"}</h3>
              <button type="button" onClick={resetForm} className="p-1 rounded-full hover:bg-white/10 text-ivory/80"><X size={18} /></button>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold uppercase tracking-wider text-brass">Court Display Name</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Court 5 or Center Court"
                className="w-full rounded-2xl bg-white/10 text-ivory border-none px-4 py-3 placeholder:text-ivory/30 focus:outline-none focus:ring-2 focus:ring-brass text-sm shadow-inner"
              />
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold uppercase tracking-wider text-brass">Court Position/Number</label>
              <input
                type="number"
                required
                min="1"
                max="50"
                value={number}
                onChange={(e) => setNumber(e.target.value)}
                className="w-full rounded-2xl bg-white/10 text-ivory border-none px-4 py-3 focus:outline-none focus:ring-2 focus:ring-brass text-sm shadow-inner"
              />
            </div>

            <div className="pt-2 flex gap-2">
              <Button type="submit" className="w-full bg-brass text-forest min-h-11">
                <Save size={16} /> Save Court
              </Button>
              <Button type="button" onClick={resetForm} className="bg-white/10 text-ivory min-h-11 px-4">
                Cancel
              </Button>
            </div>
          </form>
        ) : (
          <div className="text-center py-8">
            <Database className="mx-auto text-brass mb-3" size={32} />
            <h3 className="font-display text-2xl">No Court Selected</h3>
            <p className="text-sm text-linen/75 mt-1">Select a court from the list to edit, or click Add Court to create a new one.</p>
          </div>
        )}
      </Card>
    </div>
  );
}

// ----------------------------------------------------
// SESSIONS CRUD TAB
// ----------------------------------------------------
function SessionsCrudTab() {
  const { sessions, courts, currentSessionId, addSession, updateSession, deleteSession, setCurrentSessionId } = useClubStore();
  const [editingSession, setEditingSession] = React.useState<any>(null);
  const [isAdding, setIsAdding] = React.useState(false);

  // Form states
  const [name, setName] = React.useState("");
  const [date, setDate] = React.useState(new Date().toISOString().split("T")[0]);
  const [startTime, setStartTime] = React.useState("08:00");
  const [endTime, setEndTime] = React.useState("11:00");
  const [location, setLocation] = React.useState("HAFF Leisure Club");
  const [mode, setMode] = React.useState("Open Play");
  const [selectedCourts, setSelectedCourts] = React.useState<string[]>([]);

  const resetForm = () => {
    setName("");
    setDate(new Date().toISOString().split("T")[0]);
    setStartTime("08:00");
    setEndTime("11:00");
    setLocation("HAFF Leisure Club");
    setMode("Open Play");
    setSelectedCourts([]);
    setEditingSession(null);
    setIsAdding(false);
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    await addSession({
      name: name.trim(),
      date,
      startTime,
      endTime,
      location: location.trim(),
      mode,
      status: "Draft",
      courtIds: selectedCourts,
      checkedInPlayerIds: [],
      settings: {}
    });
    resetForm();
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingSession || !name.trim()) return;
    await updateSession({
      ...editingSession,
      name: name.trim(),
      date,
      startTime,
      endTime,
      location: location.trim(),
      mode,
      courtIds: selectedCourts
    });
    resetForm();
  };

  const startEdit = (session: any) => {
    setEditingSession(session);
    setName(session.name);
    setDate(session.date);
    setStartTime(session.startTime || "");
    setEndTime(session.endTime || "");
    setLocation(session.location || "");
    setMode(session.mode);
    setSelectedCourts(session.courtIds || []);
    setIsAdding(false);
  };

  const toggleCourtSelect = (courtId: string) => {
    setSelectedCourts((prev) => 
      prev.includes(courtId) ? prev.filter((id) => id !== courtId) : [...prev, courtId]
    );
  };

  const setStatus = async (session: any, status: "Draft" | "Active" | "Completed") => {
    await updateSession({
      ...session,
      status
    });
  };

  return (
    <div className="grid gap-5 lg:grid-cols-[1.3fr_0.7fr]">
      {/* Session List */}
      <Card className="bg-white border border-forest/10 shadow-lg text-forest">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-3xl">Open Play Sessions ({sessions.length})</h2>
          <Button onClick={() => { resetForm(); setIsAdding(true); }} className="min-h-10 bg-forest text-ivory text-xs px-4">
            <Plus size={14} /> New Session
          </Button>
        </div>

        <div className="mt-6 space-y-4 max-h-[550px] overflow-y-auto pr-1">
          {sessions.map((session) => {
            const isActive = currentSessionId === session.id;
            return (
              <div 
                key={session.id}
                className={`rounded-2xl p-5 shadow-[0_4px_20px_rgba(0,0,0,0.05)] border-l-4 transition ${
                  isActive 
                    ? "bg-white border-emerald-500 ring-2 ring-emerald-500/20" 
                    : "bg-white/60 border-transparent hover:bg-white"
                }`}
              >
                <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-display text-2xl text-forest">{session.name}</h3>
                      {isActive && <span className="text-[10px] font-black tracking-widest bg-emerald-500 text-white uppercase px-2 py-0.5 rounded-full">ACTIVE</span>}
                    </div>
                    <div className="mt-2 grid grid-cols-2 gap-y-1.5 gap-x-4 text-xs text-forest/70">
                      <span className="flex items-center gap-1"><Calendar size={13} /> {session.date}</span>
                      <span className="flex items-center gap-1"><Clock size={13} /> {session.startTime} - {session.endTime}</span>
                      <span className="flex items-center gap-1"><MapPin size={13} /> {session.location}</span>
                      <span className="flex items-center gap-1"><Activity size={13} /> {session.mode}</span>
                    </div>
                  </div>

                  <div className="flex gap-2 mt-4 sm:mt-0 items-center">
                    <select
                      value={session.status}
                      onChange={(e) => setStatus(session, e.target.value as any)}
                      className="rounded-xl border border-forest/20 text-xs px-2.5 py-1.5 bg-ivory focus:outline-none"
                    >
                      <option value="Draft">Draft</option>
                      <option value="Active">Active</option>
                      <option value="Completed">Completed</option>
                    </select>

                    <Button 
                      disabled={isActive}
                      onClick={() => setCurrentSessionId(session.id)}
                      className={`min-h-8 text-[11px] px-3 font-black ${isActive ? "bg-gray-200 text-gray-500" : "bg-forest text-ivory"}`}
                    >
                      {isActive ? "Selected" : "Select Session"}
                    </Button>
                  </div>
                </div>

                <div className="mt-4 flex items-center justify-between border-t border-forest/10 pt-3 text-xs">
                  <span className="text-forest/65 font-medium">Using {session.courtIds?.length || 0} courts · {session.checkedInPlayerIds?.length || 0} players checked in</span>
                  <div className="flex gap-1.5">
                    <button 
                      onClick={() => startEdit(session)} 
                      className="p-1 rounded-full hover:bg-forest/5 text-forest/50 hover:text-forest transition"
                    >
                      <Edit2 size={14} />
                    </button>
                    <button 
                      onClick={() => {
                        if (confirm(`Are you sure you want to delete ${session.name}?`)) {
                          deleteSession(session.id);
                        }
                      }} 
                      className="p-1 rounded-full hover:bg-red-50 text-red-500/50 hover:text-red-500 transition"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
          {sessions.length === 0 && (
            <p className="text-center py-10 text-forest/50">No sessions registered.</p>
          )}
        </div>
      </Card>

      {/* Editor Panel */}
      <Card className="bg-[#29483d] text-ivory h-fit">
        {isAdding || editingSession ? (
          <form onSubmit={isAdding ? handleAdd : handleUpdate} className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-2xl">{isAdding ? "Create Session" : "Edit Session"}</h3>
              <button type="button" onClick={resetForm} className="p-1 rounded-full hover:bg-white/10 text-ivory/80"><X size={18} /></button>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold uppercase tracking-wider text-brass">Session Name</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Thursday Open Play"
                className="w-full rounded-2xl bg-white/10 text-ivory border-none px-4 py-3 placeholder:text-ivory/30 focus:outline-none focus:ring-2 focus:ring-brass text-sm shadow-inner"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-bold uppercase tracking-wider text-brass">Date</label>
                <input
                  type="date"
                  required
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                  className="w-full rounded-2xl bg-white/10 text-ivory border-none px-4 py-3 focus:outline-none focus:ring-2 focus:ring-brass text-sm shadow-inner"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold uppercase tracking-wider text-brass">Mode</label>
                <select
                  value={mode}
                  onChange={(e) => setMode(e.target.value)}
                  className="w-full rounded-2xl bg-white/10 text-ivory border-none px-4 py-3 focus:outline-none focus:ring-2 focus:ring-brass text-sm shadow-inner"
                >
                  <option value="Open Play" className="bg-forest text-ivory">Open Play</option>
                  <option value="Balanced rotation" className="bg-forest text-ivory">Balanced rotation</option>
                  <option value="Tournament" className="bg-forest text-ivory">Tournament</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-xs font-bold uppercase tracking-wider text-brass">Start Time</label>
                <input
                  type="time"
                  required
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                  className="w-full rounded-2xl bg-white/10 text-ivory border-none px-4 py-3 focus:outline-none focus:ring-2 focus:ring-brass text-sm shadow-inner"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold uppercase tracking-wider text-brass">End Time</label>
                <input
                  type="time"
                  required
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                  className="w-full rounded-2xl bg-white/10 text-ivory border-none px-4 py-3 focus:outline-none focus:ring-2 focus:ring-brass text-sm shadow-inner"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-xs font-bold uppercase tracking-wider text-brass">Location</label>
              <input
                type="text"
                required
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="HAFF Leisure Club"
                className="w-full rounded-2xl bg-white/10 text-ivory border-none px-4 py-3 focus:outline-none focus:ring-2 focus:ring-brass text-sm shadow-inner"
              />
            </div>

            <div className="space-y-2">
              <label className="text-xs font-bold uppercase tracking-wider text-brass">Assign Courts</label>
              <div className="grid grid-cols-2 gap-2 bg-white/5 p-3 rounded-2xl">
                {courts.map((court) => (
                  <label key={court.id} className="flex items-center gap-2 text-sm text-linen cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={selectedCourts.includes(court.id)}
                      onChange={() => toggleCourtSelect(court.id)}
                      className="h-4.5 w-4.5 rounded border-none bg-white/10 text-brass focus:ring-brass"
                    />
                    {court.name}
                  </label>
                ))}
              </div>
            </div>

            <div className="pt-2 flex gap-2">
              <Button type="submit" className="w-full bg-brass text-forest min-h-11">
                <Save size={16} /> Save Session
              </Button>
              <Button type="button" onClick={resetForm} className="bg-white/10 text-ivory min-h-11 px-4">
                Cancel
              </Button>
            </div>
          </form>
        ) : (
          <div className="text-center py-8">
            <Calendar className="mx-auto text-brass mb-3" size={32} />
            <h3 className="font-display text-2xl">No Session Selected</h3>
            <p className="text-sm text-linen/75 mt-1">Select a session from the list to modify it, or click New Session to start a fresh rotation schedule.</p>
          </div>
        )}
      </Card>
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
      link.download = `haff_picklepulse_backup_${new Date().toISOString().slice(0,10)}.json`;
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
      <Card className="bg-white border border-forest/10 shadow-lg text-forest">
        <h2 className="font-display text-3xl">System Configurations</h2>
        <p className="text-sm text-forest/75 mt-1">Global timers and rotation settings for court assignments.</p>

        <div className="mt-6 space-y-4">
          <div>
            <label className="text-xs font-bold uppercase tracking-wider text-clay">Default Match Duration</label>
            <div className="mt-2 flex items-center gap-3">
              <Button onClick={() => setMatchDurationMinutes(matchDurationMinutes - 1)} className="bg-linen hover:bg-forest/5 text-forest min-h-10 px-4">-</Button>
              <span className="text-xl font-bold font-display w-24 text-center">{matchDurationMinutes} mins</span>
              <Button onClick={() => setMatchDurationMinutes(matchDurationMinutes + 1)} className="bg-forest text-ivory min-h-10 px-4">+</Button>
            </div>
            <p className="text-xs text-forest/50 mt-1.5">Determines the threshold before match cards transition to overtime on the display boards.</p>
          </div>
        </div>
      </Card>

      <Card className="bg-[#29483d] text-ivory">
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
          HAFF PicklePulse saves all transactions locally on your device storage first. Use file backup to transfer session logs to backup devices in low-connectivity areas.
        </p>
      </Card>
    </div>
  );
}

const AVATAR_OPTIONS = [
  { name: "Pixel Aibo", url: "https://api.dicebear.com/7.x/pixel-art/svg?seed=Aibo" },
  { name: "Pixel Whipslash", url: "https://api.dicebear.com/7.x/pixel-art/svg?seed=Whipslash" },
  { name: "Pixel Spike", url: "https://api.dicebear.com/7.x/pixel-art/svg?seed=Spike" },
  { name: "Pixel Ace", url: "https://api.dicebear.com/7.x/pixel-art/svg?seed=Ace" },
  { name: "Pixel Dink", url: "https://api.dicebear.com/7.x/pixel-art/svg?seed=Dink" },
  { name: "Dancing Pickle", url: "https://media.giphy.com/media/vJelP799L51pq2p5QC/giphy.gif" },
  { name: "Bouncing Ball", url: "https://media.giphy.com/media/kZzXYwUv94s4B1E9Yv/giphy.gif" },
  { name: "Snoopy Play", url: "https://media.giphy.com/media/H4948mpxL2g706b8tH/giphy.gif" },
  { name: "Cool Smash", url: "https://media.giphy.com/media/7Y3tHSuG80c43sI7pS/giphy.gif" },
  { name: "Happy Win", url: "https://media.giphy.com/media/vJ5B32EaXyS5KkW9P5/giphy.gif" }
];

const getPlayerAvatar = (player: any) => {
  return player?.avatarUrl || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(player?.displayName || "PL")}`;
};

// ----------------------------------------------------
// PLAYER VIEW SCREEN (QR/PHONE LOGIN INCLUDED)
// ----------------------------------------------------
function PlayerView() {
  const { players, courts, matches, stackOrder, checkIn, setPlayerParked, matchDurationMinutes, currentSessionId, updatePlayer } = useClubStore();
  const [selectedPlayerId, setSelectedPlayerId] = React.useState<string | null>(() => localStorage.getItem("haff-player-account-id"));
  const now = useNow();

  const activePlayers = players.filter((p) => p.isActive !== false);
  const player = activePlayers.find((item) => item.id === selectedPlayerId);
  const status = player ? getPlayerWaitStatus(player.id, players, courts, matches, stackOrder, matchDurationMinutes, now) : null;
  
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
  const [editFullName, setEditFullName] = React.useState("");
  const [editPhone, setEditPhone] = React.useState("");
  const [editEmergencyNote, setEditEmergencyNote] = React.useState("");
  const [editPlayStyle, setEditPlayStyle] = React.useState("");
  const [editSkillLevel, setEditSkillLevel] = React.useState("Beginner");
  const [editAvatarUrl, setEditAvatarUrl] = React.useState("");

  const startEditing = () => {
    if (!player) return;
    setEditDisplayName(player.displayName);
    setEditFullName(player.fullName || player.displayName);
    setEditPhone(player.phoneNumber || "");
    setEditEmergencyNote(player.emergencyNote || "");
    setEditPlayStyle(player.preferredPlayStyle || "");
    setEditSkillLevel(player.skillLevel);
    setEditAvatarUrl(player.avatarUrl || "");
    setIsEditingProfile(true);
  };

  const handleSaveProfile = async () => {
    if (!player) return;
    const updated = {
      ...player,
      displayName: editDisplayName || player.displayName,
      fullName: editFullName,
      phoneNumber: editPhone,
      emergencyNote: editEmergencyNote,
      preferredPlayStyle: editPlayStyle,
      skillLevel: editSkillLevel as any,
      avatarUrl: editAvatarUrl,
    };
    await updatePlayer(updated);
    setIsEditingProfile(false);
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
      className="mx-auto max-w-5xl px-4 py-4 pb-8"
    >
      <div>
        <p className="text-xs font-bold uppercase tracking-[0.28em] text-brass">Private player page</p>
        <h1 className="font-display text-4xl leading-tight text-ivory sm:text-5xl">Know when you play.</h1>
      </div>
      
      {!selectedPlayerId && !loginMethod ? (
        <div className="mt-4">
          <PlayerHero
            onLogin={() => setLoginMethod("phone")}
            onQuickCheckIn={async () => {
              const demo = activePlayers.find((item) => item.id === "player-haff-demo") ?? activePlayers[0];
              if (!demo) return;
              localStorage.setItem("haff-player-account-id", demo.id);
              await checkIn(demo.id);
              setSelectedPlayerId(demo.id);
            }}
          />
          <Card className="mx-auto mt-3 max-w-xl bg-ivory p-4 text-forest">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-clay">Created player account</p>
            <p className="mt-1 font-semibold">Giana Ibo</p>
            <p className="text-xs text-forest/70">Phone: 09170000000 · Code: 1234</p>
          </Card>
        </div>
      ) : null}

      {/* PHONE LOGIN MODAL/PANEL */}
      {loginMethod === "phone" && (
        <Card className="bg-ivory text-forest mt-4 max-w-md mx-auto p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-display text-2xl">Player Login</h2>
            <button onClick={() => setLoginMethod(null)} className="p-1 rounded-full hover:bg-forest/5"><X size={18} /></button>
          </div>
          <form onSubmit={handlePhoneLogin} className="space-y-4">
            {loginError && (
              <div className="rounded-2xl bg-red-50 px-4 py-3 text-xs font-semibold text-red-700">
                {loginError}
              </div>
            )}
            <input
              type="tel"
              required
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              placeholder="Phone number"
              className="w-full rounded-2xl bg-white/60 text-forest border border-forest/10 px-4 py-3 placeholder:text-forest/40 focus:outline-none focus:ring-2 focus:ring-forest shadow-inner"
            />
            <input
              type="password"
              inputMode="numeric"
              required
              value={accessCode}
              onChange={(e) => setAccessCode(e.target.value)}
              placeholder="Access code"
              className="w-full rounded-2xl bg-white/60 text-forest border border-forest/10 px-4 py-3 placeholder:text-forest/40 focus:outline-none focus:ring-2 focus:ring-forest shadow-inner"
            />
            <p className="text-[11px] text-forest/50 leading-tight">Use 09170000000 and 1234 for the player account I created.</p>
            <Button type="submit" className="w-full bg-forest text-ivory hover:bg-forest/90">
              Log In
            </Button>
          </form>
        </Card>
      )}

      {/* QR CODE SCAN SIMULATION */}
      {loginMethod === "qr" && (
        <Card className="bg-ivory text-forest mt-4 max-w-md mx-auto p-5 text-center">
          <div className="mb-4 flex items-center justify-between text-left">
            <h2 className="font-display text-2xl">Scan QR Member Pass</h2>
            <button onClick={() => setLoginMethod(null)} className="p-1 rounded-full hover:bg-forest/5"><X size={18} /></button>
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
            <p className="text-xs text-forest/65">Simulate scanning member pass for:</p>
            <div className="flex flex-wrap gap-2 justify-center">
              {activePlayers.slice(0, 4).map((p) => (
                <button
                  key={p.id}
                  onClick={() => handleQrLoginSimulate(p.id)}
                  disabled={simulatingQrScan}
                  className="px-3 py-1 bg-white hover:bg-forest/5 border border-forest/15 rounded-full text-xs font-semibold text-forest transition"
                >
                  {p.displayName.split(" ")[0]}
                </button>
              ))}
            </div>
          </div>
        </Card>
      )}

      {/* ROSTER PICKER LOGIN */}
      {loginMethod === "list" && (
        <Card className="bg-white border border-forest/10 shadow-lg text-forest mt-4 max-w-xl mx-auto p-5">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-display text-2xl font-semibold">Select Your Roster Name</h2>
            <button onClick={() => setLoginMethod(null)} className="p-1 rounded-full hover:bg-forest/5"><X size={18} /></button>
          </div>
          <div className="grid gap-2 max-h-80 overflow-y-auto pr-1">
            {activePlayers.map((item) => (
              <button
                key={item.id}
                onClick={() => { localStorage.setItem("haff-player-account-id", item.id); setSelectedPlayerId(item.id); setLoginMethod(null); }}
                className={`flex min-h-14 items-center justify-between rounded-2xl px-4 text-left transition border ${selectedPlayerId === item.id ? "bg-forest text-ivory border-forest" : "bg-forest/5 text-forest border-forest/5 hover:bg-forest/10"}`}
              >
                <div className="flex items-center gap-3">
                  <div className="h-8 w-8 rounded-full overflow-hidden bg-forest/10 border border-forest/10 shrink-0">
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
          <Card className="bg-[#073427] border border-[#2f7b61] text-ivory p-4 sm:p-5 rounded-[1.5rem] sm:rounded-[2rem] shadow-[0_28px_90px_rgba(6,36,27,0.42)] relative">
            {/* Top Row: Brand & Logout */}
            <div className="flex items-center justify-between border-b border-[#2f7b61] pb-3">
              <div>
                <span className="text-[10px] font-black uppercase tracking-[0.24em] text-brass">Player Dashboard</span>
                <p className="mt-1 text-sm font-semibold text-linen/80">Queue, park mode, and monitor preview</p>
              </div>
              <button 
                onClick={() => {
                  localStorage.removeItem("haff-player-account-id");
                  setSelectedPlayerId(null);
                }} 
                className="rounded-full bg-[#0e5a43] px-3 py-1.5 text-[10px] font-black uppercase tracking-wider text-brass transition hover:bg-brass hover:text-ink"
              >
                Logout
              </button>
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
              <div>
                <h2 className="font-display text-2xl font-bold tracking-tight text-ivory sm:text-3xl">
                  Welcome back, <span className="text-brass">{player.displayName}</span>!
                </h2>
                <p className="text-xs text-linen/70 mt-1">Here's your player dashboard</p>
              </div>
            </div>

            {/* 1. Status Section */}
            <div className="mt-4 rounded-[1.35rem] sm:rounded-[1.6rem] bg-[#0b4635] p-4 shadow-[inset_0_1px_0_rgba(255,248,234,0.06)]">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-black uppercase tracking-[0.2em] text-brass">Rotation Status</p>
                  <div className="mt-1 flex items-baseline gap-2">
                    <span className={`inline-block h-2.5 w-2.5 rounded-full ${
                      player.parked 
                        ? "bg-amber-400" 
                        : player.checkedIn 
                        ? "bg-emerald-400 animate-pulse" 
                        : "bg-red-500"
                    }`} />
                    <span className="text-2xl font-black tracking-normal uppercase">
                      {player.parked ? "Paused" : player.checkedIn ? "Active" : "Not Checked In"}
                    </span>
                  </div>
                  <p className="text-xs text-linen/82 mt-1 font-semibold">
                    {player.parked 
                      ? "Not Playing · Temporarily on hold" 
                      : player.checkedIn 
                      ? status.label.includes("Court") 
                        ? "On Court" 
                        : "Waiting in Rotation Queue"
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
              {player.checkedIn && !player.parked && (
                <div className="mt-3 rounded-[1.35rem] sm:rounded-[1.5rem] bg-[#FFF8EA] p-4 text-ink shadow-[0_18px_40px_rgba(6,36,27,0.2),inset_0_1px_2px_rgba(255,255,255,0.5)]">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-1.5 text-clay">
                      <Clock size={18} />
                      <span className="text-[10px] font-bold uppercase tracking-[0.2em]">Approx. Countdown</span>
                    </div>
                    <span className="rounded-full bg-forest px-3 py-1 text-[10px] font-black uppercase tracking-[0.12em] text-ivory">
                      {status.label}
                    </span>
                  </div>
                  <div className="mt-3 grid grid-cols-3 gap-2.5">
                    {formatDurationParts(status.estimatedSeconds ?? 0).map((part) => (
                      <div key={part.label} className="rounded-[1rem] bg-[#06241B] px-2 py-3.5 text-center text-ivory shadow-[0_14px_30px_rgba(6,36,27,0.24)] ring-1 ring-forest/20">
                        <p className="text-4xl font-black leading-none tracking-normal tabular-nums sm:text-5xl">{part.value}</p>
                        <p className="mt-2 text-[9px] font-black uppercase tracking-[0.16em] text-linen/75">{part.label}</p>
                      </div>
                    ))}
                  </div>
                  <div className="mt-3 rounded-2xl bg-linen p-3 ring-1 ring-forest/10">
                    <p className="text-sm font-black leading-tight text-ink">{status.stackDetail}</p>
                    <p className="mt-1 text-xs leading-relaxed text-ink/75">{status.reason}</p>
                  </div>
                </div>
              )}

              {/* Status Action Button */}
              {!player.checkedIn ? (
                <Button 
                  onClick={() => checkIn(player.id)} 
                  className="mt-4 w-full bg-brass text-ink hover:bg-ivory font-black py-3 rounded-2xl shadow-lg transition-transform hover:scale-[1.01] active:scale-95 border-none"
                >
                  Check Me In
                </Button>
              ) : (
                <Button 
                  onClick={() => setPlayerParked(player.id, !player.parked)} 
                  className={`mt-4 w-full font-black py-3 rounded-2xl shadow-lg flex items-center justify-center gap-2 transition-transform hover:scale-[1.01] active:scale-95 border-none ${
                    player.parked 
                      ? "bg-brass text-ink hover:bg-ivory" 
                      : "bg-clay text-ivory hover:bg-[#D97757]"
                  }`}
                >
                  {player.parked ? <Play size={16} /> : <Pause size={16} />}
                  {player.parked ? "Resume Play Rotation" : "Pause / Park Me"}
                </Button>
              )}
            </div>

            <PlayerTvPreview />

            {/* 2. Profile Card */}
            <div className="mt-4 rounded-[1.35rem] sm:rounded-[1.6rem] bg-[#0b4635] p-4">
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
                    <label className="text-[10px] uppercase font-bold text-brass block mb-1">Select Avatar / GIF</label>
                    <div className="grid grid-cols-5 gap-2 mb-2">
                      {AVATAR_OPTIONS.map((opt) => (
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
                    <label className="text-[10px] uppercase font-bold text-linen/70 block mb-1">Custom Image / GIF URL</label>
                    <input 
                      type="text" 
                      value={editAvatarUrl} 
                      onChange={(e) => setEditAvatarUrl(e.target.value)} 
                      className="w-full rounded-xl bg-white/10 text-ivory border-none px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-brass"
                      placeholder="Paste any PNG, JPG, or GIF URL"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] uppercase font-bold text-linen/70 block mb-1">Full Name</label>
                    <input 
                      type="text" 
                      value={editFullName} 
                      onChange={(e) => setEditFullName(e.target.value)} 
                      className="w-full rounded-xl bg-white/10 text-ivory border-none px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-brass"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] uppercase font-bold text-linen/70 block mb-1">Phone Number</label>
                    <input 
                      type="text" 
                      value={editPhone} 
                      onChange={(e) => setEditPhone(e.target.value)} 
                      className="w-full rounded-xl bg-white/10 text-ivory border-none px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-brass"
                    />
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
                    <label className="text-[10px] uppercase font-bold text-linen/70 block mb-1">Preferred Play Style</label>
                    <input 
                      type="text" 
                      value={editPlayStyle} 
                      onChange={(e) => setEditPlayStyle(e.target.value)} 
                      className="w-full rounded-xl bg-white/10 text-ivory border-none px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-brass"
                      placeholder="e.g. Dinks, Aggressive, Balanced"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] uppercase font-bold text-linen/70 block mb-1">Emergency Notes</label>
                    <input 
                      type="text" 
                      value={editEmergencyNote} 
                      onChange={(e) => setEditEmergencyNote(e.target.value)} 
                      className="w-full rounded-xl bg-white/10 text-ivory border-none px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-brass"
                      placeholder="e.g. Asthma, Contact: Jane +639..."
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
                  <div className="flex justify-between items-baseline">
                    <span className="text-linen/50 text-xs">Full Name</span>
                    <span className="font-medium text-ivory">{player.fullName || player.displayName}</span>
                  </div>
                  <div className="flex justify-between items-baseline">
                    <span className="text-linen/50 text-xs">Handle</span>
                    <span className="font-mono text-xs text-brass">
                      @{player.fullName ? player.fullName.toLowerCase().replace(/\s+/g, "") : player.displayName.toLowerCase()}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-linen/50 text-xs">Skill Level / Tag</span>
                    <div className="flex gap-1.5">
                      <RankBadge skillLevel={player.skillLevel} compact />
                      {player.totalGamesPlayed < 5 && (
                        <span className="bg-brass text-forest text-[9px] font-black uppercase rounded-md px-1.5 py-0.5 tracking-wider">New</span>
                      )}
                    </div>
                  </div>
                  <div className="flex justify-between items-baseline">
                    <span className="text-linen/50 text-xs">Phone</span>
                    <span className="font-mono text-xs text-ivory">{player.phoneNumber || "Not set"}</span>
                  </div>
                  {player.preferredPlayStyle && (
                    <div className="flex justify-between items-baseline">
                      <span className="text-linen/50 text-xs">Play Style</span>
                      <span className="font-medium text-ivory">{player.preferredPlayStyle}</span>
                    </div>
                  )}
                  {player.emergencyNote && (
                    <div className="flex justify-between items-baseline">
                      <span className="text-linen/50 text-xs">Emergency Notes</span>
                      <span className="text-xs text-clay font-semibold">{player.emergencyNote}</span>
                    </div>
                  )}
                  
                  <button 
                    onClick={() => {
                      playSound("checkin");
                      alert("Password change requests are managed securely at the club registration counter.");
                    }}
                    className="w-full text-center text-xs text-brass/75 hover:text-white transition font-semibold pt-2 border-t border-white/5 bg-transparent border-none cursor-pointer"
                  >
                    Change Password
                  </button>
                </div>
              )}
            </div>

            {/* 3. Statistics Card */}
            <div className="mt-4 rounded-[1.35rem] sm:rounded-[1.6rem] bg-[#0b4635] p-4">
              <div className="mb-3 flex items-center gap-1.5 border-b border-[#2f7b61] pb-2.5 text-brass">
                <Activity size={16} />
                <span className="text-[10px] font-bold uppercase tracking-[0.20em]">Player Statistics</span>
              </div>
              <div className="grid grid-cols-2 gap-3 text-center">
                <div className="rounded-2xl bg-[#073427] p-3">
                  <p className="text-3xl font-black text-ivory">{player.totalGamesPlayed}</p>
                  <p className="text-[9px] uppercase tracking-wider text-linen/50 mt-1">Total Games</p>
                </div>
                <div className="rounded-2xl bg-[#073427] p-3">
                  <p className="text-3xl font-black text-ivory">{player.totalDaysPlayed}</p>
                  <p className="text-[9px] uppercase tracking-wider text-linen/50 mt-1">Total Visits</p>
                </div>
              </div>
              
              <div className="mt-3 text-center">
                <p className="text-[10px] text-linen/55">
                  Last visit: <span className="text-ivory font-mono">{formatDate(player.lastPlayedDate)}</span>
                </p>
              </div>
            </div>
          </Card>
        </div>
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
  const queueGroups = getWaitingGroups(players, courts, matches, stackOrder).filter((group) =>
    group.some((player) => !player.isVacant)
  );
  const visibleCourts = courts.slice(0, 4);

  return (
    <div className="mt-4 overflow-hidden rounded-[1.35rem] sm:rounded-[1.6rem] bg-[#0b4635]">
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

          <div className="mt-3 grid grid-cols-2 gap-2">
            {visibleCourts.map((court) => {
              const match = matches.find((item) => item.id === court.currentMatchId);
              const names = match
                ? [...match.teamAPlayerIds, ...match.teamBPlayerIds]
                : court.reservedPlayerIds ?? [];
              const hasPlayers = names.length > 0;

              return (
                <div key={court.id} className="min-h-24 rounded-xl border border-ivory/10 bg-ivory/[0.06] p-2">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-black uppercase text-ivory">{court.name}</p>
                    <span className={`rounded-full px-2 py-0.5 text-[8px] font-black uppercase ${
                      court.status === "InUse"
                        ? "bg-amber-300 text-forest"
                        : court.status === "Reserved"
                        ? "bg-brass text-forest"
                        : court.status === "Maintenance"
                        ? "bg-clay text-ivory"
                        : "bg-ivory/12 text-linen"
                    }`}>
                      {court.status === "InUse" ? "In Use" : court.status}
                    </span>
                  </div>
                  {hasPlayers ? (
                    <div className="mt-2 grid gap-1">
                      {names.slice(0, 4).map((id) => {
                        const person = players.find((item) => item.id === id);
                        return (
                          <p key={id} className="truncate rounded-lg bg-ivory/10 px-2 py-1 text-xs font-bold text-ivory">
                            {person?.displayName ?? "Open Slot"}
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

          <div className="mt-3 rounded-xl bg-ivory p-3 text-forest">
            <div className="flex items-center gap-2 text-clay">
              <ListChecks size={14} />
              <span className="text-[9px] font-black uppercase tracking-[0.18em]">Next Up</span>
            </div>
            <div className="mt-2 grid gap-1.5">
              {queueGroups.length ? queueGroups.slice(0, 2).map((group, index) => (
                <div key={group.map((item) => item.id).join("-")} className="rounded-lg bg-white/70 px-2.5 py-2">
                  <p className="text-[9px] font-black uppercase tracking-[0.14em] text-brass">Stack {index + 1}</p>
                  <p className="mt-1 truncate text-xs font-black text-forest">
                    {group
                      .filter((item) => !item.isVacant)
                      .map((item) => item.displayName.split(" ")[0])
                      .join(" / ") || "Waiting for players"}
                  </p>
                </div>
              )) : (
                <p className="py-2 text-center text-xs font-bold text-forest/60">No waiting stack yet</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function CourtTimer({ matchId, size }: { matchId: string; size: "small" | "large" }) {
  const now = useNow();
  const match = useClubStore((state) => state.matches.find((item) => item.id === matchId));
  const duration = useClubStore((state) => state.matchDurationMinutes);
  if (!match?.startedAt) return null;
  const remainingMs = getRemainingMilliseconds(match.startedAt, duration, now);
  const overtime = remainingMs < 0;
  const label = formatClockMilliseconds(Math.abs(remainingMs));
  return (
    <div className={`mt-5 rounded-full px-5 py-3 text-center font-black tracking-normal tabular-nums ${overtime ? "bg-clay text-ivory" : "bg-brass text-forest"} ${size === "large" ? "text-6xl" : "text-3xl"}`}>
      {overtime ? "-" : ""}{label}
    </div>
  );
}

function PlayerChip({ playerId, tone = "dark" }: { playerId: string; tone?: "dark" | "light" }) {
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
      className={`rank-chip ${tone === "light" ? "tv-chip" : ""} rank-${rankKey(player.skillLevel)} flex items-center justify-between gap-3 rounded-xl px-3 py-2 ${tone === "light" ? "bg-forest text-ivory" : "bg-ivory/10 text-ivory"}`}
    >
      <span className="flex min-w-0 items-center gap-3">
        <img
          src={getPlayerAvatar(player)}
          alt=""
          className="h-11 w-11 shrink-0 rounded-full border-2 border-ivory/30 bg-ivory object-cover"
        />
        <span className="truncate text-2xl font-black leading-none tracking-normal">{player.displayName.split(" ")[0]}</span>
      </span>
      <RankBadge skillLevel={player.skillLevel} />
    </div>
  );
}

function RankBadge({ skillLevel, compact = false }: { skillLevel: ReturnType<typeof useClubStore.getState>["players"][number]["skillLevel"]; compact?: boolean }) {
  return (
    <span className={`rank-badge rank-${rankKey(skillLevel)} inline-flex items-center rounded-md font-medium normal-case tracking-normal ${compact ? "mt-1 px-1.5 py-0.5 text-[10px]" : "px-2 py-0.5 text-[11px]"}`}>
      {skillLevel}
    </span>
  );
}

function DisplayView() {
  const { courts, matches, players, stackOrder } = useClubStore();
  const now = useNow();
  const matchDurationMinutes = useClubStore((state) => state.matchDurationMinutes);
  const announcedOvertimeRef = React.useRef<Record<string, number>>({});
  const announcedReservationsRef = React.useRef<Record<string, string>>({});
  const queueGroups = getWaitingGroups(players, courts, matches, stackOrder).filter(
    (group) => group.some((player) => !player.isVacant)
  );
  const overtimeCourts = courts
    .map((court) => {
      const match = matches.find((item) => item.id === court.currentMatchId && item.status === "InProgress" && item.startedAt);
      if (!match?.startedAt) return null;
      const remaining = getRemainingMilliseconds(match.startedAt, matchDurationMinutes, now);
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
    .filter((court) => court.status === "Reserved" && court.reservedPlayerIds?.length)
    .map((court) => `${court.id}:${court.reservedPlayerIds?.join(",")}`)
    .join("|");

  React.useEffect(() => {
    courts.forEach((court) => {
      if (court.status !== "Reserved" || !court.reservedPlayerIds?.length) {
        delete announcedReservationsRef.current[court.id];
        return;
      }
      const reservationKey = court.reservedPlayerIds.join(",");
      if (announcedReservationsRef.current[court.id] === reservationKey) return;
      if (announceNextPlayers(court.name, court.reservedPlayerIds, players)) {
        announcedReservationsRef.current[court.id] = reservationKey;
      }
    });
  }, [reservationAnnouncementKey, courts, players]);
  const visibleQueueGroups = queueGroups.length ? queueGroups.slice(0, 5) : Array.from({ length: 3 }, (_, index) => [
    { id: `vacant-tv-empty-${index}-1`, displayName: "Waiting", skillLevel: "Newbie" as const, rating: 0, tags: [], checkedIn: false, parked: false, totalGamesPlayed: 0, totalDaysPlayed: 0, isVacant: true },
    { id: `vacant-tv-empty-${index}-2`, displayName: "Waiting", skillLevel: "Newbie" as const, rating: 0, tags: [], checkedIn: false, parked: false, totalGamesPlayed: 0, totalDaysPlayed: 0, isVacant: true },
    { id: `vacant-tv-empty-${index}-3`, displayName: "Waiting", skillLevel: "Newbie" as const, rating: 0, tags: [], checkedIn: false, parked: false, totalGamesPlayed: 0, totalDaysPlayed: 0, isVacant: true },
    { id: `vacant-tv-empty-${index}-4`, displayName: "Waiting", skillLevel: "Newbie" as const, rating: 0, tags: [], checkedIn: false, parked: false, totalGamesPlayed: 0, totalDaysPlayed: 0, isVacant: true }
  ]);
  return (
    <section className="relative z-10 min-h-[calc(100vh-73px)] bg-forest px-5 py-6 text-ivory">
      <div className="mx-auto max-w-7xl">
        <div className="fixed right-5 top-5 z-50 flex gap-2">
          <a
            href="/admin"
            className="rounded-full bg-ivory px-4 py-2 text-sm font-black uppercase tracking-[0.12em] text-forest shadow-[0_16px_38px_rgba(0,0,0,0.24)] hover:bg-linen"
          >
            Admin
          </a>
          <a
            href="/player"
            className="rounded-full border border-ivory/30 bg-ivory/12 px-4 py-2 text-sm font-black uppercase tracking-[0.12em] text-ivory backdrop-blur hover:bg-ivory hover:text-forest"
          >
            Players
          </a>
        </div>
        <div className="flex items-end justify-between pb-5 border-b border-ivory/10">
          <div>
            <p className="text-lg font-black uppercase tracking-[0.16em] text-brass">HAFF Leisure Club</p>
            <h1 className="text-6xl font-black leading-none tracking-normal sm:text-8xl">NOW PLAYING</h1>
          </div>
          <p className="hidden text-4xl font-black tracking-normal sm:block">OPEN PLAY</p>
        </div>
        {overtimeCourts.length > 0 && (
          <div className="mt-5 rounded-[1.4rem] bg-clay px-5 py-4 text-ivory shadow-[0_20px_70px_rgba(0,0,0,0.22)]">
            <p className="text-3xl font-black uppercase tracking-normal">
              Overtime: {overtimeCourts.map(({ court, milliseconds }) => `${court.name} -${formatClockMilliseconds(milliseconds)}`).join("   ")}
            </p>
          </div>
        )}
        <div className="mt-6 grid gap-5 lg:grid-cols-[1fr_420px]">
          <div className="grid gap-5 md:grid-cols-2">
            {courts.map((court) => {
              const match = matches.find((item) => item.id === court.currentMatchId);
              return (
                <div key={court.id} className="display-court min-h-72 rounded-[1.6rem] p-5 text-ivory">
                  <div className="flex items-center justify-between">
                    <h2 className="text-5xl font-black tracking-normal text-ivory">{court.name}</h2>
                    <span className={`rounded-full px-4 py-2 text-lg font-black uppercase ${
                      court.status === "InUse"
                        ? "bg-amber-400 text-forest"
                        : court.status === "Maintenance"
                        ? "bg-clay text-ivory"
                        : court.status === "Paused"
                        ? "bg-ivory text-forest"
                        : "bg-brass text-forest"
                    }`}>
                      {court.status === "InUse" ? "IN USE" : court.status === "Maintenance" ? "MAINTENANCE" : court.status === "Paused" ? "PAUSED" : court.status}
                    </span>
                  </div>
                  {match ? (
                    <div className="mt-8">
                      <PlayerNames ids={match.teamAPlayerIds} className="text-5xl font-black leading-tight tracking-normal" showRanks tone="light" />
                      <p className="my-4 text-2xl font-black uppercase tracking-[0.16em] text-brass">versus</p>
                      <PlayerNames ids={match.teamBPlayerIds} className="text-5xl font-black leading-tight tracking-normal" showRanks tone="light" />
                      <CourtTimer matchId={match.id} size="large" />
                    </div>
                  ) : (
                    <div className="mt-10">
                      {court.status === "Reserved" && court.reservedPlayerIds?.length ? (
                        <>
                          <p className="text-2xl font-black uppercase tracking-[0.16em] text-brass">Reserved for</p>
                          <PlayerNames ids={court.reservedPlayerIds} className="mt-4 text-5xl font-black leading-tight tracking-normal" showRanks tone="light" />
                        </>
                      ) : court.status === "Maintenance" ? (
                        <p className="mt-16 text-5xl font-black tracking-normal text-clay uppercase">Under Maintenance</p>
                      ) : court.status === "Paused" ? (
                        <p className="mt-16 text-5xl font-black tracking-normal text-linen uppercase">Paused</p>
                      ) : court.status === "InUse" ? (
                        <p className="mt-16 text-5xl font-black tracking-normal text-amber-400 uppercase">Match Starting...</p>
                      ) : (
                        <p className="mt-16 text-5xl font-black tracking-normal text-brass uppercase">AVAILABLE</p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <div className="rounded-[1.6rem] bg-[#FFF8EA] p-5 text-ink shadow-[0_28px_90px_rgba(0,0,0,0.28)]">
            <div className="flex items-center gap-2 text-clay"><ListChecks size={26} /><span className="text-xl font-black uppercase tracking-[0.16em]">Next Up</span></div>
            <div className="mt-5 space-y-4">
              {visibleQueueGroups.map((group, index) => (
                <div key={group.map((player) => player.id).join("-")} className="rounded-[1.2rem] bg-linen p-4 ring-1 ring-forest/10">
                  <p className="text-lg font-black uppercase tracking-[0.16em] text-forest">Stack {index + 1}</p>
                  <div className="mt-2 grid gap-2">
                    {group.map((player) => <PlayerChip key={player.id} playerId={player.id} tone="light" />)}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="mt-5 overflow-hidden rounded-[1.4rem] bg-brass px-5 py-4 text-4xl font-black tracking-normal text-forest shadow-[0_20px_70px_rgba(0,0,0,0.22)]">
          WATCH THE NEXT UP STACK. PLAYERS MOVE AS MATCHES FINISH.
        </div>
      </div>
    </section>
  );
}

function announceCourtOvertime(courtName: string, playerIds: string[], players: Array<{ id: string; displayName: string }>) {
  const names = playerIds
    .map((playerId) => players.find((player) => player.id === playerId)?.displayName)
    .filter((name): name is string => Boolean(name));
  const playerList = formatSpokenNames(names);
  const courtLabel = courtName.replace(/^Court\s*/i, "Court ");
  const message = playerList
    ? `${courtLabel} overtime. ${courtLabel} players: ${playerList}. Please finish your game.`
    : `${courtLabel} overtime. Please finish your game.`;
  return speakAnnouncement(message);
}

function announceNextPlayers(courtName: string, playerIds: string[], players: Array<{ id: string; displayName: string }>) {
  const names = playerIds
    .map((playerId) => players.find((player) => player.id === playerId)?.displayName)
    .filter((name): name is string => Boolean(name));
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

function getRemainingMilliseconds(startedAt: string, durationMinutes: number, now: number) {
  const elapsedMs = now - new Date(startedAt).getTime();
  return durationMinutes * 60_000 - elapsedMs;
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
  const milliseconds = safeMs % 1000;
  const ms = String(milliseconds).padStart(3, "0");
  if (hours > 0) {
    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}.${ms}`;
  }
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}.${ms}`;
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
      .filter((p) => p.checkedIn && !p.parked && !activeIds.has(p.id) && !reservedIds.has(p.id))
      .map((p) => p.id)
  );

  return stackOrder.map((id, index) => {
    if (id !== "vacant" && eligibleIds.has(id)) {
      const player = players.find((p) => p.id === id);
      if (player) return { ...player, isVacant: false };
    }
    return {
      id: `vacant-${index}`,
      displayName: "Vacant Slot",
      fullName: "Vacant Slot",
      skillLevel: "Beginner" as const,
      rating: 2.0,
      tags: [],
      checkedIn: true,
      parked: false,
      totalGamesPlayed: 0,
      totalDaysPlayed: 0,
      isVacant: true
    };
  });
}

function getWaitingGroups(
  players: ReturnType<typeof useClubStore.getState>["players"],
  courts: ReturnType<typeof useClubStore.getState>["courts"],
  matches: ReturnType<typeof useClubStore.getState>["matches"],
  stackOrder: string[] = []
) {
  const waiting = getWaitingPlayers(players, matches, courts, stackOrder);
  const groups: Array<Array<ReturnType<typeof getWaitingPlayers>[number]>> = [];
  for (let index = 0; index < waiting.length; index += 4) {
    groups.push(waiting.slice(index, index + 4));
  }
  return groups;
}

function getPlayerWaitStatus(
  playerId: string,
  players: ReturnType<typeof useClubStore.getState>["players"],
  courts: ReturnType<typeof useClubStore.getState>["courts"],
  matches: ReturnType<typeof useClubStore.getState>["matches"],
  stackOrder: string[],
  matchDurationMinutes: number,
  now: number
) {
  const player = players.find((item) => item.id === playerId);
  if (!player?.checkedIn) {
    return {
      label: "Check in first",
      reason: "Once checked in, the system can place you in the waiting order.",
      stackDetail: "You are not in the rotation yet.",
      estimatedSeconds: 0
    };
  }
  if (player.parked) {
    return {
      label: "Parked",
      reason: "You are paused from rotation. Tap Resume Play when you are ready to be added back into the stack order.",
      stackDetail: "Your spot is paused until you resume.",
      estimatedSeconds: 0
    };
  }
  const activeMatch = matches.find((match) => match.status === "InProgress" && [...match.teamAPlayerIds, ...match.teamBPlayerIds].includes(playerId));
  if (activeMatch) {
    const court = courts.find((item) => item.id === activeMatch.courtId);
    return {
      label: "Playing now",
      reason: `You are currently assigned to ${court?.name ?? "a court"}.`,
      stackDetail: `${court?.name ?? "Court"} is active now.`,
      estimatedSeconds: 0
    };
  }
  const waiting = getWaitingPlayers(players, matches, courts, stackOrder);
  const position = waiting.findIndex((item) => item.id === playerId);
  const rotationCourts = Math.max(1, courts.filter((court) => court.status !== "Maintenance" && court.status !== "Paused").length);
  const playersPerWave = rotationCourts * 4;
  const wave = Math.floor(Math.max(0, position) / playersPerWave);
  const stackNumber = Math.floor(Math.max(0, position) / 4) + 1;
  const stackSlot = (Math.max(0, position) % 4) + 1;
  const activeRemainingSeconds = matches
    .filter((match) => match.status === "InProgress" && match.startedAt)
    .map((match) => Math.max(0, Math.ceil((matchDurationMinutes * 60_000 - (now - new Date(match.startedAt!).getTime())) / 1000)));
  const nextCourtSeconds = activeRemainingSeconds.length ? Math.min(...activeRemainingSeconds) : Math.max(120, Math.ceil(matchDurationMinutes * 60 / 3));
  const estimatedSeconds = Math.max(0, nextCourtSeconds + wave * matchDurationMinutes * 60);
  return {
    label: position < 4 ? "Next stack" : `Stack wave ${wave + 1}`,
    reason: `You are #${position + 1} in the waiting order. Estimate uses ${matchDurationMinutes} minutes per game and ${rotationCourts} active court${rotationCourts === 1 ? "" : "s"}.`,
    stackDetail: `Stack ${stackNumber}, slot ${stackSlot}. Estimated from the current court timer and the open play rotation.`,
    estimatedSeconds
  };
}

function formatDurationParts(totalSeconds: number) {
  const safeSeconds = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const seconds = safeSeconds % 60;
  return [
    { label: "hours", value: String(hours).padStart(2, "0") },
    { label: "minutes", value: String(minutes).padStart(2, "0") },
    { label: "seconds", value: String(seconds).padStart(2, "0") }
  ];
}

function Metric({ label, value }: { label: string; value: number }) {
  return <div className="rounded-2xl bg-ivory/12 p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.08)]"><p className="font-display text-4xl leading-none">{value}</p><p className="text-[10px] uppercase tracking-[0.2em] text-linen/70 mt-1.5">{label}</p></div>;
}

function MatchLine({ matchId }: { matchId: string }) {
  const match = useClubStore((state) => state.matches.find((item) => item.id === matchId));
  if (!match) return null;
  return <div className="mt-6"><PlayerNames ids={match.teamAPlayerIds} className="font-display text-2xl text-forest" showRanks /><p className="my-1 text-xs uppercase tracking-[0.2em] text-clay">vs</p><PlayerNames ids={match.teamBPlayerIds} className="font-display text-2xl text-forest" showRanks /><CourtTimer matchId={match.id} size="small" /><p className="mt-4 text-xs font-bold uppercase tracking-[0.22em] text-forest/75">Tap Finish when this court is done</p></div>;
}

function PlayerNames({
  ids,
  className,
  showRanks = false,
  tone = "dark"
}: {
  ids: string[];
  className?: string;
  showRanks?: boolean;
  tone?: "dark" | "light";
}) {
  const players = useClubStore((state) => state.players);
  if (!showRanks) return <p className={className}>{ids.map((id) => players.find((player) => player.id === id)?.displayName.split(" ")[0]).join(" / ")}</p>;
  return (
    <div className="space-y-2">
      {ids.map((id) => <PlayerChip key={id} playerId={id} tone={tone} />)}
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
  const movePlayerToStack = useClubStore((state) => state.movePlayerToStack);
  const waitingGroups = getWaitingGroups(players, courts, matches, stackOrder);
  const [draggingPlayerId, setDraggingPlayerId] = React.useState<string | null>(null);
  const stacks = waitingGroups;

  return (
    <Card className="bg-[#29483d] text-ivory">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.24em] text-brass">Stack builder</p>
          <h2 className="font-display text-4xl leading-none">Drag players into play order</h2>
        </div>
        <p className="hidden max-w-xs text-right text-xs leading-5 text-linen/65 sm:block">Drop a player onto Stack 1, Stack 2, or Stack 3. Each stack is a group of four for court assignment.</p>
      </div>
      <div className="mt-5 grid gap-3 lg:grid-cols-3">
        {stacks.map((group, stackIndex) => (
          <div
            key={stackIndex}
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => {
              event.preventDefault();
              const playerId = event.dataTransfer.getData("text/player-id") || draggingPlayerId;
              if (playerId) movePlayerToStack(playerId, stackIndex);
              setDraggingPlayerId(null);
            }}
            className={`min-h-48 rounded-[1.2rem] p-3 transition ${draggingPlayerId ? "bg-ivory/16" : "bg-ivory/8"}`}
          >
            <div className="mb-3 flex items-center justify-between">
              <p className="text-sm font-black uppercase tracking-[0.16em] text-brass">Stack {stackIndex + 1}</p>
              <span className="rounded-full bg-ivory/10 px-2 py-1 text-xs font-bold text-linen">
                {group.filter((p) => !("isVacant" in p && p.isVacant)).length}/4
              </span>
            </div>
            <div className="grid gap-2">
              {group.map((player) => {
                const isVacant = "isVacant" in player && player.isVacant;
                if (isVacant) {
                  return (
                    <div
                      key={player.id}
                      className="flex items-center justify-center rounded-xl border border-dashed border-ivory/20 bg-ivory/5 px-2.5 py-4 text-linen/40 text-sm font-medium italic"
                    >
                      Open Slot
                    </div>
                  );
                }
                return (
                  <div
                    key={player.id}
                    draggable
                    onDragStart={(event) => {
                      event.dataTransfer.setData("text/player-id", player.id);
                      setDraggingPlayerId(player.id);
                    }}
                    onDragEnd={() => setDraggingPlayerId(null)}
                    className="flex cursor-grab items-center gap-2 rounded-xl bg-ivory px-2.5 py-2 text-forest shadow-[0_10px_26px_rgba(0,0,0,0.14)] ring-1 ring-forest/10 active:cursor-grabbing hover:bg-white transition"
                    title="Drag player to another stack"
                  >
                    <GripVertical size={16} className="shrink-0 text-forest/55" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold">{player.displayName}</p>
                      <RankBadge skillLevel={player.skillLevel} compact />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

function AdminDetails() {
  return (
    <Card className="bg-[#29483d] text-ivory">
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
      <div className="text-brass">{icon}</div>
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
              className="rounded-2xl bg-white/60 px-3 py-2 cursor-grab active:cursor-grabbing hover:bg-white/80 transition"
            >
              <p className="font-semibold text-forest leading-none">{player!.displayName.split(" ")[0]}</p>
              <RankBadge skillLevel={player!.skillLevel} compact />
            </div>
          ))}
        </div>
      ) : (
        <p className="mt-3 text-sm text-forest/75">Held without assigned players.</p>
      )}
    </div>
  );
}

ReactDOM.createRoot(document.getElementById("root")!).render(<App />);
