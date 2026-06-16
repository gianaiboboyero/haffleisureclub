import React from "react";
import ReactDOM from "react-dom/client";
import { AnimatePresence, motion } from "framer-motion";
import { 
  Activity, 
  CalendarDays, 
  CheckCircle2, 
  Clock, 
  Coffee,
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
  BarChart2
} from "lucide-react";
import { Button, Card, Badge } from "./components/ui";
import { Chip } from "./components/ui/heroui-chip";
import { AiLoader } from "./components/ui/ai-loader";
import { useClubStore } from "./store/useClubStore";
import { db } from "./lib/db";
import { getVoiceStyle, isSoundEnabled, playSound, setSoundEnabled, setVoiceStyle, speakAnnouncement, unlockAudio } from "./lib/sound";
import type { VoiceStyle } from "./lib/sound";
import "./styles/globals.css";
import { Analytics } from "@vercel/analytics/react";

const LandingView = React.lazy(() =>
  import("./components/LandingView").then((module) => ({ default: module.LandingView }))
);
const ReservationCalendar = React.lazy(() =>
  import("./components/ReservationCalendar").then((module) => ({ default: module.ReservationCalendar }))
);

// Vercel runs the production API as serverless functions, so live refreshes use
// the existing lightweight polling path instead of opening a dead WebSocket.
const socket: any = null;

function App() {
  const { hydrate, hydrated, view, setView, online, setOnline, pendingSyncCount, refreshPendingSyncCount } = useClubStore();
  const [socketConnected, setSocketConnected] = React.useState(false);
  const [sessionMember, setSessionMember] = React.useState<{ displayName: string; avatarUrl?: string } | null>(null);
  const [sessionReady, setSessionReady] = React.useState(false);

  const refreshSession = React.useCallback(() => {
    return fetch(`/api/auth?action=me`, { credentials: "include" })
      .then(async (response) => {
        const text = await response.text();
        return text && response.headers.get("content-type")?.includes("application/json") ? JSON.parse(text) : { user: null };
      })
      .then((data) => setSessionMember(data.user))
      .catch(() => setSessionMember(null))
      .finally(() => setSessionReady(true));
  }, []);

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
      } else if (["admin", "player", "parking", "tv", "calendar", "finance"].includes(path)) {
        targetView = path as ViewMode;
      } else if (["admin", "player", "parking", "tv", "calendar", "finance"].includes(hash)) {
        targetView = hash as ViewMode;
      } else if (path === "display" || hash === "display") {
        targetView = "tv";
      } else if (path === "payments" || hash === "payments" || path === "revenue" || hash === "revenue") {
        targetView = "finance";
      } else if (path === "schedule" || hash === "schedule" || path === "reservation" || hash === "reservation") {
        targetView = "calendar";
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
    let sharedStateInitialized = useClubStore.getState().hydrated;
    let sharedPublishTimer: number | undefined;

    const unsubscribe = useClubStore.subscribe((state) => {
      const operationalStateChanged =
        state.courts !== prevCourts ||
        state.matches !== prevMatches ||
        state.players !== prevPlayers ||
        state.stackOrder !== prevStackOrder;
      if (operationalStateChanged) {
        prevCourts = state.courts;
        prevMatches = state.matches;
        prevPlayers = state.players;
        prevStackOrder = state.stackOrder;
        if (!sharedStateInitialized) {
          if (state.hydrated) {
            sharedStateInitialized = true;
            void state.refreshSharedState();
          }
          return;
        }
        state.suppressRefresh();
        window.clearTimeout(sharedPublishTimer);
        sharedPublishTimer = window.setTimeout(() => void state.publishSharedState(), 250);
        if (socket && socket.connected) {
          socket.emit("state_changed");
        }
      }
    });

    const timer = window.setInterval(refreshPendingSyncCount, 30000);
    const sharedStateTimer = window.setInterval(() => {
      if (!socket || !socket.connected) {
        void useClubStore.getState().refreshSharedState();
      }
    }, 30000);

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
        window.clearInterval(sharedStateTimer);
        window.clearTimeout(sharedPublishTimer);
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
      window.clearInterval(sharedStateTimer);
      window.clearTimeout(sharedPublishTimer);
      unsubscribe();
    };
  }, [refreshPendingSyncCount, setOnline, hydrate]);

  if (!hydrated) return <LoadingScreen />;

  return (
    <main className="min-h-screen bg-forest text-ivory">
      <div className="fixed inset-0 z-0 texture pointer-events-none" />
      {(view === "landing" || view === "tv") && (
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
          onSignedOut={() => setSessionMember(null)}
        />
      )}
      <div className="relative z-10">
        <AnimatePresence>
          {view === "landing" && (
            <React.Suspense fallback={<LoadingScreen />}>
              <LandingView key="landing" setView={setView} signedIn={Boolean(sessionMember)} />
            </React.Suspense>
          )}
          {view === "admin" && <AdminView key="admin" />}
          {view === "player" && <PlayerView key="player" />}
          {view === "parking" && <ParkingView key="parking" />}
          {view === "tv" && <DisplayView key="tv" />}
          {view === "calendar" && <React.Suspense fallback={<LoadingScreen />}><ReservationCalendar key="calendar" /></React.Suspense>}
          {view === "finance" && <FinanceView key="finance" />}
        </AnimatePresence>
      </div>
      <FloatingDock view={view} setView={setView} />
      <Toasts />
    </main>
  );
}

function AccountMenu({
  member,
  setView,
  onSignedOut
}: {
  member: { displayName: string; avatarUrl?: string } | null;
  setView: (view: ViewMode) => void;
  onSignedOut: () => void;
}) {
  const [open, setOpen] = React.useState(false);
  if (!member) return null;
  const avatar = member.avatarUrl || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(member.displayName)}&backgroundColor=d9ad5b`;
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
            await fetch("/api/auth?action=logout", { method: "POST", credentials: "include" });
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
    const timer = window.setInterval(() => setNow(Date.now()), 500);
    return () => window.clearInterval(timer);
  }, []);
  return now;
}

type ViewMode = "landing" | "admin" | "player" | "parking" | "tv" | "calendar" | "finance";

function TopBar({ 
  view, 
  setView, 
  online, 
  pendingSyncCount,
  socketConnected,
  member,
  onSignedOut
}: { 
  view: string; 
  setView: (view: ViewMode) => void; 
  online: boolean; 
  pendingSyncCount: number;
  socketConnected: boolean;
  member: { displayName: string; avatarUrl?: string } | null;
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
          <InlineAccountMenu member={member} setView={setView} onSignedOut={onSignedOut} />
        </div>
      </div>
    </header>
  );
}

function InlineAccountMenu({
  member,
  setView,
  onSignedOut
}: {
  member: { displayName: string; avatarUrl?: string } | null;
  setView: (view: ViewMode) => void;
  onSignedOut: () => void;
}) {
  const [open, setOpen] = React.useState(false);
  if (!member) return null;
  const avatar = member.avatarUrl || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(member.displayName)}&backgroundColor=d9ad5b`;
  const signOut = async () => {
    await fetch("/api/auth?action=logout", { method: "POST", credentials: "include" });
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

function FloatingDock({ view, setView }: { view: string; setView: (view: ViewMode) => void }) {
  const [isAdmin, setIsAdmin] = React.useState(false);
  React.useEffect(() => {
    const checkRole = () => {
      fetch("/api/auth?action=me", { credentials: "include" })
        .then((response) => response.json())
        .then((data) => setIsAdmin(data.user?.role === "ADMIN"))
        .catch(() => setIsAdmin(false));
    };
    checkRole();
    window.addEventListener("haff-auth-change", checkRole);
    return () => window.removeEventListener("haff-auth-change", checkRole);
  }, []);
  const publicItems = [
    { key: "landing", label: "Home", icon: Home },
    { key: "player", label: "Players", icon: UserRound },
    { key: "parking", label: "Parking", icon: Coffee },
    { key: "calendar", label: "Reserve", icon: CalendarDays },
  ];
  const adminItems = [
    { key: "landing", label: "Home", icon: Home },
    { key: "admin", label: "Admin", icon: Sliders },
    { key: "player", label: "Players", icon: UserRound },
    { key: "parking", label: "Parking", icon: Coffee },
    { key: "calendar", label: "Reserve", icon: CalendarDays },
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

function ParkingView() {
  const { players, courts, matches, setPlayerParked, setView, refreshSharedState } = useClubStore();
  const [member, setMember] = React.useState<{ role: string; playerId?: string; displayName: string } | null>(null);
  const [checking, setChecking] = React.useState(true);

  React.useEffect(() => {
    Promise.all([
      fetch("/api/auth?action=me", { credentials: "include", cache: "no-store" }).then(async (response) =>
        response.headers.get("content-type")?.includes("application/json") ? response.json() : { user: null }
      ),
      refreshSharedState()
    ])
      .then(([data]) => setMember(data.user ?? null))
      .catch(() => setMember(null))
      .finally(() => setChecking(false));
  }, [refreshSharedState]);

  if (checking) return <LoadingScreen />;
  if (!member) {
    return (
      <section className="mx-auto max-w-xl px-4 py-12 pb-32 text-center text-ivory">
        <div className="rounded-3xl border border-ivory/10 bg-[#0b3a2c] p-8 shadow-2xl">
          <Coffee className="mx-auto text-brass" size={34} />
          <h1 className="mt-4 font-display text-4xl font-black">Parking Area</h1>
          <p className="mt-2 text-sm leading-6 text-ivory/65">Sign in to see your paid check-in status and control your rotation availability.</p>
          <button className="mt-6 min-h-12 w-full rounded-full bg-brass px-6 font-black text-forest" onClick={() => setView("player")}>Sign in</button>
        </div>
      </section>
    );
  }

  const parkedPlayers = players.filter((player) => player.checkedIn && player.parked);
  const readyPlayers = players.filter((player) => player.checkedIn && !player.parked);
  const canManage = (playerId: string) => member.role === "ADMIN" || member.playerId === playerId;

  const activeMatches = matches.filter(m => m.status === "InProgress");
  const getPlayingMatch = (playerId: string) => activeMatches.find(m => m.teamAPlayerIds.includes(playerId) || m.teamBPlayerIds.includes(playerId));
  const getCourt = (matchId: string) => courts.find(c => c.currentMatchId === matchId);

  return (
    <motion.section
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      className="mx-auto max-w-6xl px-4 py-5 pb-32 text-ivory"
    >
      <div className="relative overflow-hidden rounded-3xl bg-[#173f32] p-6 shadow-[0_18px_46px_rgba(0,0,0,0.22)] sm:p-8">
        <Coffee className="absolute -right-5 -top-7 h-40 w-40 text-brass opacity-[0.07]" />
        <p className="text-xs font-black uppercase tracking-[0.22em] text-brass">Paid and checked in</p>
        <h1 className="mt-2 font-display text-4xl font-black sm:text-5xl">Parking Area</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-linen/75">
          Players here are cleared by the desk but are not included in the active stack. Resume when ready; park again whenever you need a break.
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
          <Badge>{parkedPlayers.length} parked</Badge>
          <Badge>{readyPlayers.length} in rotation</Badge>
        </div>
      </div>

      <div className="mt-5 grid gap-5 lg:grid-cols-[1.15fr_0.85fr]">
        <Card className="bg-ivory text-forest">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-clay">Cleared lounge</p>
              <h2 className="font-display text-3xl font-black">Parked Players</h2>
            </div>
            <Coffee className="text-brass" size={26} />
          </div>
          <div className="mt-5 space-y-3">
            {parkedPlayers.map((player) => (
              <div className="flex items-center gap-3 rounded-2xl bg-forest/[0.06] p-3" key={player.id}>
                <img className="h-11 w-11 rounded-full bg-white object-cover" src={getPlayerAvatar(player)} alt="" />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-black">{player.displayName}</p>
                  <p className="text-xs text-forest/55">Paid · checked in · outside rotation</p>
                </div>
                {canManage(player.id) && (
                  <button className="min-h-10 rounded-full bg-forest px-4 text-xs font-black text-ivory" onClick={() => void setPlayerParked(player.id, false)}>
                    Join rotation
                  </button>
                )}
              </div>
            ))}
            {parkedPlayers.length === 0 && <p className="rounded-2xl bg-forest/[0.04] p-6 text-center text-sm text-forest/55">No players are parked right now.</p>}
          </div>
        </Card>

        <Card className="bg-[#0b3a2c] text-ivory">
          <p className="text-xs font-black uppercase tracking-[0.18em] text-brass">Active queue</p>
          <h2 className="font-display text-3xl font-black">In Rotation</h2>
          <div className="mt-5 space-y-3">
            {readyPlayers.map((player) => {
              const match = getPlayingMatch(player.id);
              const court = match ? getCourt(match.id) : null;
              
              return (
                <div className="flex items-center gap-3 rounded-2xl bg-ivory/[0.08] p-3" key={player.id}>
                  {match ? (
                    <span className="h-2.5 w-2.5 rounded-full bg-amber-400 animate-pulse" title="Playing" />
                  ) : (
                    <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" title="Waiting" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold">{player.displayName}</p>
                    {court && <p className="text-xs text-amber-200 mt-0.5">Playing on {court.name}</p>}
                  </div>
                  {canManage(player.id) && !match && (
                    <button className="min-h-9 rounded-full bg-brass px-3 text-xs font-black text-forest" onClick={() => void setPlayerParked(player.id, true)}>
                      Park
                    </button>
                  )}
                </div>
              );
            })}
            {readyPlayers.length === 0 && <p className="text-sm text-ivory/50">Nobody is in the rotation yet.</p>}
          </div>
        </Card>
      </div>
    </motion.section>
  );
}

type AdminTab = "control" | "players" | "courts" | "history" | "settings";

function AdminView() {
  const { players, courts, matches, sessions, currentSessionId, clubStatus } = useClubStore();
  const [activeTab, setActiveTab] = React.useState<AdminTab>("control");
  const [isQrOpen, setIsQrOpen] = React.useState(false);

  React.useEffect(() => {
    const openAdminTab = (event: Event) => {
      const tab = (event as CustomEvent<AdminTab>).detail;
      if (["control", "players", "courts", "history", "settings"].includes(tab)) {
        setActiveTab(tab);
        window.scrollTo({ top: 0, behavior: "smooth" });
      }
    };
    window.addEventListener("haff-admin-tab", openAdminTab);
    return () => window.removeEventListener("haff-admin-tab", openAdminTab);
  }, []);

  // Admin Portal Authentication
  const [isAuthenticated, setIsAuthenticated] = React.useState(false);
  const [checkingAuth, setCheckingAuth] = React.useState(true);
  const [email, setEmail] = React.useState("gianaibo.dev@gmail.com");
  const [password, setPassword] = React.useState("");
  const [authError, setAuthError] = React.useState("");

  React.useEffect(() => {
    fetch("/api/auth?action=me", { credentials: "include" })
      .then((response) => response.json())
      .then((data) => setIsAuthenticated(data.user?.role === "ADMIN"))
      .finally(() => setCheckingAuth(false));
  }, []);

  const checkedIn = players.filter((player) => player.checkedIn);
  const activeSession = sessions.find((s) => s.id === currentSessionId);
  const waiting = checkedIn.length - matches.filter((match) => match.status === "InProgress").length * 4;

  if (checkingAuth) return <LoadingScreen />;
  if (!isAuthenticated) {
    const handleLogin = async (e: React.FormEvent) => {
      e.preventDefault();
      setAuthError("");
      const response = await fetch("/api/auth?action=login", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password })
      });
      const data = await response.json();
      if (response.ok && data.user?.role === "ADMIN") {
        setIsAuthenticated(true);
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
          className="max-w-md w-full bg-white border border-forest/10 rounded-[2.5rem] shadow-[0_24px_80px_rgba(19,36,29,0.12)] p-8 text-forest relative overflow-hidden"
        >
          <div className="absolute -right-12 -top-12 opacity-[0.03] pointer-events-none">
            <LogoMark size="large" />
          </div>

          <div className="flex flex-col items-center text-center">
            <div className="h-16 w-16 rounded-2xl bg-forest/5 flex items-center justify-center border border-forest/10 shadow-inner">
              <LogoMark />
            </div>
            <h2 className="font-display text-3xl font-black mt-5 leading-none tracking-tight">HAFF Leisure Club - Cadiz City</h2>
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
              <PasswordField
                value={password}
                onChange={setPassword}
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
      <section className="relative overflow-hidden rounded-2xl bg-[#173f32] p-5 text-ivory shadow-[0_18px_46px_rgba(0,0,0,0.2)] sm:p-6">
        <div className="absolute -right-8 -top-12 opacity-[0.06]"><LogoMark size="large" /></div>
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-linen/80">
          {activeSession ? `${activeSession.name} (${activeSession.location || "HAFF Leisure Club"})` : "No active session"}
        </p>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mt-1">
          <h1 className="font-display text-4xl font-semibold leading-tight tracking-normal sm:text-5xl">
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
        {clubStatus && (
          <div className="mt-4 flex items-start gap-3 rounded-xl bg-brass px-4 py-3 text-forest">
            <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-clay" />
            <div>
              <p className="text-[10px] font-black uppercase tracking-[0.16em]">Live club status</p>
              <p className="mt-0.5 font-bold leading-snug">{clubStatus}</p>
            </div>
          </div>
        )}
        <div className="mt-5 grid grid-cols-2 gap-px overflow-hidden rounded-xl bg-ivory/12 sm:grid-cols-4">
          <Metric label="Checked in" value={checkedIn.length} />
          <Metric label="Courts" value={courts.length} />
          <Metric label="Completed" value={matches.filter((match) => match.status === "Completed").length} />
          <Metric label="Waiting" value={Math.max(0, waiting)} />
        </div>
      </section>

      {/* Tab Navigation */}
      <div className="my-4">
        <div className="flex gap-1 overflow-x-auto rounded-xl bg-black/10 p-1 scrollbar-none">
          {[
            { id: "control", label: "Play Rotation" },
            { id: "players", label: "Manage Players" },
            { id: "courts", label: "Manage Courts" },
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
      </div>

      {/* Tab Contents */}
      <div key={activeTab}>
        {activeTab === "control" && <PlayRotationTab />}
        {activeTab === "players" && <PlayersCrudTab />}
        {activeTab === "courts" && <CourtsCrudTab />}
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

// Court elapsed-time timer badge (live)
function CourtElapsedTimer({ startedAt, matchDurationMinutes }: { startedAt: string; matchDurationMinutes: number }) {
  const now = useNow();
  const elapsedSeconds = Math.floor((now.getTime() - new Date(startedAt).getTime()) / 1000);
  const elapsedMin = Math.floor(elapsedSeconds / 60);
  const elapsedSec = elapsedSeconds % 60;
  const isOver = elapsedMin >= matchDurationMinutes;
  const isNearing = elapsedMin >= matchDurationMinutes - 2;
  return (
    <span className={`ml-1 inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-black tabular-nums ${
      isOver ? "bg-red-500/20 text-red-300 animate-pulse" :
      isNearing ? "bg-amber-500/20 text-amber-300" :
      "bg-ivory/10 text-ivory/70"
    }`}>
      <Clock size={10} />
      {elapsedMin}:{String(elapsedSec).padStart(2, "0")}
    </span>
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
  const loungePlayers = activePlayers.filter((player) => {
    const query = loungeSearch.trim().toLowerCase();
    if (!query) return true;
    return [
      player.displayName,
      player.fullName,
      player.skillLevel,
      ...(player.tags ?? [])
    ].some((value) => value?.toLowerCase().includes(query));
  }).sort((a, b) => {
    if (a.checkedIn === b.checkedIn) return 0;
    return a.checkedIn ? -1 : 1;
  });
  const changeVoiceStyle = (style: VoiceStyle) => {
    setSelectedVoiceStyle(style);
    setVoiceStyle(style);
  };

  return (
    <div className="space-y-4">
      {/* Quick-action sticky bar */}
      <div className="sticky top-16 z-30 -mx-1 rounded-2xl border border-white/10 bg-[#0a1f18]/95 px-4 py-3 backdrop-blur-xl shadow-[0_8px_32px_rgba(0,0,0,0.3)]">
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
                checkIn(match.id, autoLogPayment);
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

      <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="space-y-4">
          <StackBuilder players={players} courts={courts} matches={matches} stackOrder={stackOrder} />
        <div className="grid gap-4 md:grid-cols-2">
          {courts.map((court) => {
            const match = matches.find((item) => item.id === court.currentMatchId);
            return (
              <Card 
                key={court.id} 
                className={`admin-court min-h-48 transition relative overflow-hidden ${
                  court.status === "Reserved" 
                    ? "bg-white/5 grayscale opacity-80 border-white/5" 
                    : court.status === "Maintenance" || court.status === "Paused" || court.status === "InUse" 
                      ? "text-ivory" 
                      : "text-ivory hover:border-white/30"
                }`}
                onDragOver={(event) => {
                  const match = matches.find((m) => m.id === court.currentMatchId && m.status === "InProgress");
                  const hasVacant = match && [...match.teamAPlayerIds, ...match.teamBPlayerIds].some(id => id.startsWith("vacant"));
                  if (court.status !== "Maintenance" && court.status !== "Paused" && (court.status !== "InUse" || hasVacant)) {
                    event.preventDefault();
                  }
                }}
                onDrop={async (event) => {
                  event.preventDefault();
                  const playerId = event.dataTransfer.getData("text/player-id");
                  if (!playerId) return;

                  if (court.status === "InUse") {
                    await useClubStore.getState().joinActiveMatch(playerId, court.id);
                  } else if (court.status !== "Maintenance" && court.status !== "Paused") {
                    await assignPlayerToCourt(playerId, court.id);
                  }
                }}
              >
                <div className="flex items-center justify-between border-b border-white/5 pb-2">
                  <h2 className="font-display text-3xl text-ivory font-bold">{court.name}</h2>
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
                  {court.status === "InUse" && match?.startedAt && (
                    <CourtElapsedTimer startedAt={match.startedAt} matchDurationMinutes={matchDurationMinutes} />
                  )}
                </div>
                {match ? (
                  <MatchLine matchId={match.id} />
                ) : court.status === "Reserved" ? (
                  <ReservedStack courtId={court.id} />
                ) : court.status === "Maintenance" ? (
                  <p className="mt-8 text-sm text-red-400 font-semibold">Under Maintenance. Players cannot be assigned.</p>
                ) : court.status === "Paused" ? (
                  <p className="mt-8 text-sm text-amber-400 font-semibold">Temporarily paused by admin.</p>
                ) : (
                  <p className="mt-8 rounded-lg bg-forest px-3 py-2 text-sm font-semibold text-ivory">
                    Available for the next balanced rotation.
                  </p>
                )}
                <div className="mt-5 flex flex-wrap gap-2 pt-2">
                  {match ? (
                    <Button onClick={() => { playSound("complete"); finishCourt(court.id); }} className="min-h-10 bg-brass hover:bg-brass/90 px-4 text-xs text-forest font-black">
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
                        className="min-h-10 bg-brass px-4 text-xs text-forest font-black"
                      >
                        Start Stack
                      </Button>
                      <Button onClick={() => returnReservedToQueue(court.id)} className="min-h-10 bg-white/10 hover:bg-white/20 px-4 text-xs text-white">
                        Return to Queue
                      </Button>
                      <Button onClick={() => clearCourt(court.id)} className="min-h-10 bg-white/5 hover:bg-white/10 px-4 text-xs text-white/80">
                        Clear Hold
                      </Button>
                    </>
                  ) : court.status === "Available" ? (
                    <Button onClick={() => reserveCourt(court.id)} className="min-h-10 bg-brass hover:bg-brass/90 px-4 text-xs font-black text-ink shadow-md">
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
        <Card className="work-surface">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-clay">Quick action</p>
              <h2 className="font-display text-3xl text-forest">Open play rotation</h2>
            </div>
            <Button onClick={() => { playSound("complete"); generateMatches(); }} className="bg-forest text-ivory hover:bg-forest/90">Assign Courts</Button>
          </div>
        </Card>
        <Card className="bg-[#0b3a2c] text-ivory border border-white/10 shadow-[0_12px_40px_rgba(0,0,0,0.25)] rounded-[2rem] p-5">
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
                    speakAnnouncement(announcementMessage.trim());
                    setAnnouncementMessage("");
                  }}
                  className="bg-brass hover:bg-brass/90 text-forest font-black px-4 py-2 text-xs rounded-lg min-h-0"
                >
                  Speak
                </Button>
              </div>
              <p className="text-[9px] text-ivory/50">Broadcasting will use the selected club speaker system configuration.</p>
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
              <h2 className="font-display text-3xl text-forest">Check-in lounge</h2>
              <p className="mt-1 text-xs font-semibold text-forest/60">
                {loungePlayers.length} of {activePlayers.length} players
              </p>
            </div>
            {loungePlayers.some(p => p.checkedIn) && (
              <Button
                onClick={() => {
                  if (confirm("Are you sure you want to checkout all checked-in players? This will clear the current open play rotation.")) {
                    useClubStore.getState().checkOutAll();
                  }
                }}
                className="bg-clay text-ivory hover:bg-clay/90 min-h-10 px-4 text-xs font-bold"
              >
                Checkout All
              </Button>
            )}
          </div>
          <div className="relative mt-4">
            <Search aria-hidden="true" className="absolute left-3.5 top-1/2 -translate-y-1/2 text-forest/45" size={17} />
            <label className="sr-only" htmlFor="lounge-search">Search check-in lounge players</label>
            <input
              id="lounge-search"
              className="control-field w-full rounded-xl py-3 pl-10 pr-10 text-sm text-forest placeholder:text-forest/45 focus:outline-none"
              onChange={(event) => setLoungeSearch(event.target.value)}
              placeholder="Search by player name, rank, or tag"
              type="search"
              value={loungeSearch}
            />
            {loungeSearch && (
              <button
                aria-label="Clear lounge search"
                className="absolute right-2 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-lg text-forest/55 hover:bg-forest/10 hover:text-forest"
                onClick={() => setLoungeSearch("")}
                type="button"
              >
                <X size={16} />
              </button>
            )}
          </div>
          <div className="flex items-center gap-2 mt-2 px-1 text-xs text-forest/75 font-semibold">
            <input
              type="checkbox"
              id="auto-log-payment"
              checked={autoLogPayment}
              onChange={(e) => setAutoLogPayment(e.target.checked)}
              className="rounded text-forest focus:ring-forest bg-white/50 border-white/10"
            />
            <label htmlFor="auto-log-payment" className="cursor-pointer select-none">
              Auto-log 150 PHP payment on check-in
            </label>
          </div>
          <div className="mt-4 space-y-3 max-h-96 overflow-y-auto pr-1">
            {loungePlayers.map((player) => {
              const activeMatchIds = new Set(
                matches.filter((m) => m.status === "InProgress").flatMap((m) => [...m.teamAPlayerIds, ...m.teamBPlayerIds])
              );
              const isPlaying = activeMatchIds.has(player.id);
              const isDraggable = player.checkedIn && !isPlaying;

              return (
                <div
                  key={player.id}
                  draggable={isDraggable}
                  onDragStart={(event) => {
                    event.dataTransfer.setData("text/player-id", player.id);
                  }}
                  className={`flex min-h-16 items-center justify-between gap-3 rounded-xl px-3.5 border border-forest/5 ${
                    !player.checkedIn ? "bg-white/30" : "bg-white/55"
                  } ${
                    isDraggable ? "cursor-grab active:cursor-grabbing hover:bg-forest/5 transition" : ""
                  }`}
                  title={isDraggable ? "Drag player into a stack or court" : !player.checkedIn ? "Check in player to assign them" : undefined}
                >
                  <div className="flex items-center gap-2.5">
                    {isDraggable && <GripVertical size={16} className="text-forest/30 shrink-0" />}
                    <div className="relative shrink-0">
                      <div className="h-10 w-10 rounded-full overflow-hidden bg-forest/10 border border-forest/10">
                        <img 
                          src={getPlayerAvatar(player)} 
                          alt={player.displayName} 
                          className="h-full w-full object-cover" 
                        />
                      </div>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-forest">{player.displayName}</p>
                      <p className="text-xs text-forest/75">
                        {isPlaying ? "Playing" : player.parked ? "Parked" : player.skillLevel} · {player.totalGamesPlayed} games
                      </p>
                      {player.statusNote && (
                        <p className="mt-1 max-w-full truncate text-[10px] font-bold text-forest/70" title={player.statusNote}>
                          Note: {player.statusNote}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-1.5">
                    {!player.checkedIn ? (
                      <Button
                        onClick={() => checkIn(player.id, autoLogPayment)}
                        className="min-h-10 px-4 text-xs font-black bg-brass text-forest hover:bg-brass/90 shadow-sm"
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
            {loungePlayers.length === 0 && (
              <div className="rounded-xl bg-white/35 px-4 py-8 text-center">
                <p className="font-semibold text-forest">No players found</p>
                <p className="mt-1 text-xs text-forest/60">Try another name, rank, or tag.</p>
              </div>
            )}
          </div>
        </Card>
        <Card className="bg-[#173f32] text-ivory">
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

async function prepareProfileImage(file: File) {
  if (!file.type.startsWith("image/")) throw new Error("Choose a JPG, PNG, or WebP image.");
  if (file.size > 8 * 1024 * 1024) throw new Error("Choose an image smaller than 8 MB.");

  const source = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("The image could not be read."));
    reader.readAsDataURL(file);
  });
  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const next = new Image();
    next.onload = () => resolve(next);
    next.onerror = () => reject(new Error("The image could not be opened."));
    next.src = source;
  });
  const size = Math.min(640, Math.max(image.naturalWidth, image.naturalHeight));
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Photo processing is unavailable.");
  const crop = Math.min(image.naturalWidth, image.naturalHeight);
  const sourceX = (image.naturalWidth - crop) / 2;
  const sourceY = (image.naturalHeight - crop) / 2;
  context.drawImage(image, sourceX, sourceY, crop, crop, 0, 0, size, size);
  return canvas.toDataURL("image/jpeg", 0.82);
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

function PlayersCrudTab() {
  const { players, addPlayer, updatePlayer, deletePlayer, checkIn, checkOut } = useClubStore();
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
  const [accessCode, setAccessCode] = React.useState("");
  const [emergencyNote, setEmergencyNote] = React.useState("");
  const [preferredPlayStyle, setPreferredPlayStyle] = React.useState("");
  const [notes, setNotes] = React.useState("");
  const [avatarUrl, setAvatarUrl] = React.useState("");
  const [formError, setFormError] = React.useState("");
  const [isSaving, setIsSaving] = React.useState(false);
  const [isProcessingPhoto, setIsProcessingPhoto] = React.useState(false);

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
    setAccessCode("");
    setEmergencyNote("");
    setPreferredPlayStyle("");
    setNotes("");
    setAvatarUrl("");
    setFormError("");
    setIsSaving(false);
    setEditingPlayer(null);
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
      await addPlayer({
        displayName: displayName.trim(),
        skillLevel,
        rating: parseFloat(rating) || 2.0,
        tags: tags.split(",").map(t => t.trim()).filter(Boolean),
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
      await updatePlayer({
        ...editingPlayer,
        displayName: displayName.trim(),
        skillLevel,
        rating: parseFloat(rating) || 2.0,
        tags: tags.split(",").map(t => t.trim()).filter(Boolean),
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
    setEditingPlayer(player);
    setDisplayName(player.displayName);
    setSkillLevel(player.skillLevel);
    setRating(player.rating.toString());
    setTags(player.tags.join(", "));
    setPhoneNumber(player.phoneNumber ?? "");
    setAccessCode(player.accessCode ?? "1234");
    setEmergencyNote(player.emergencyNote ?? "");
    setPreferredPlayStyle(player.preferredPlayStyle ?? "");
    setNotes(player.notes ?? "");
    setAvatarUrl(player.avatarUrl ?? "");
    setIsAdding(false);
  };

  const handleAdminPhoto = async (file?: File) => {
    if (!file) return;
    setIsProcessingPhoto(true);
    setFormError("");
    try {
      setAvatarUrl(await prepareProfileImage(file));
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "The photo could not be added.");
    } finally {
      setIsProcessingPhoto(false);
    }
  };

  return (
    <div className="grid gap-5 lg:grid-cols-[1.3fr_0.7fr]">
      {/* Player List */}
      <Card className="work-surface">
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
            className="control-field w-full rounded-xl pl-11 pr-4 py-3 text-sm text-forest placeholder:text-forest/45 focus:outline-none"
          />
        </div>

        {/* Grid List */}
        <div className="mt-4 space-y-3 max-h-[600px] overflow-y-auto pr-1">
          {filtered.map((player) => (
            <div 
              key={player.id} 
              className={`flex items-center justify-between gap-3 rounded-xl border border-forest/5 p-3.5 transition-colors hover:bg-white/55 ${
                player.isActive === false ? "bg-white/20 opacity-70" : "bg-white/35"
              }`}
            >
              <div className="flex min-w-0 items-center gap-3">
                <img
                  alt=""
                  className="h-11 w-11 shrink-0 rounded-full bg-forest/10 object-cover"
                  src={getPlayerAvatar(player)}
                />
                <div className="min-w-0">
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
                        onClick={() => checkIn(player.id, autoLogPayment)}
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
      <Card className="bg-[#173f32] text-ivory h-fit">
        {isAdding || editingPlayer ? (
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
                  src={avatarUrl || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(displayName || "Player")}`}
                />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-bold uppercase tracking-wider text-brass">Profile photo</p>
                  <p className="mt-1 text-xs leading-5 text-linen/65">Choose a clear square or portrait photo. It will appear in the lounge, player page, and TV queue.</p>
                  <label className="mt-2 inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-full bg-ivory px-4 text-xs font-bold text-forest hover:bg-linen">
                    <ImagePlus size={16} />
                    {isProcessingPhoto ? "Preparing..." : "Upload Photo"}
                    <input
                      accept="image/jpeg,image/png,image/webp"
                      className="sr-only"
                      disabled={isProcessingPhoto}
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
      <Card className="work-surface">
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
      <Card className="bg-[#173f32] text-ivory h-fit">
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
                className="rounded-2xl p-4 bg-white/60 border border-forest/10 hover:bg-white transition flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
              >
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-black bg-forest/15 text-forest px-2.5 py-0.5 rounded-full uppercase tracking-wider">
                      {court?.name ?? "Court"}
                    </span>
                    <span className="text-[10px] font-bold text-clay uppercase tracking-widest flex items-center gap-1">
                      <Clock size={11} /> {durationMin} min duration
                    </span>
                  </div>
                  
                  <div className="mt-2.5 text-base font-semibold text-ink">
                    <span className="text-forest font-black">{teamANames || "Vacant"}</span>
                    <span className="text-xs text-forest/60 mx-2 uppercase">vs</span>
                    <span className="text-forest font-black">{teamBNames || "Vacant"}</span>
                  </div>
                </div>

                <div className="text-left sm:text-right shrink-0 border-t sm:border-t-0 border-forest/5 pt-2 sm:pt-0">
                  <p className="text-xs font-black text-forest/55 uppercase tracking-wider">Match Logged</p>
                  <p className="text-sm font-bold text-ink mt-0.5">{timeStr || "Just now"}</p>
                </div>
              </div>
            );
          })}
          {completedMatches.length === 0 && (
            <div className="text-center py-12 text-forest/40">
              <Calendar className="mx-auto text-forest/30 mb-2" size={36} />
              <p className="text-sm italic">No completed matches in history yet. Start play from active courts and tap Finish to log games.</p>
            </div>
          )}
        </div>
      </Card>

      <Card className="bg-[#173f32] text-ivory h-fit p-5 rounded-2xl">
        <h3 className="font-display text-2xl text-brass border-b border-ivory/10 pb-3">Open Play Statistics</h3>
        <div className="mt-5 space-y-4">
          <div className="rounded-xl bg-ivory/8 p-4">
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-linen/70">Total Games Logged</span>
            <p className="text-5xl font-black text-brass mt-1 tracking-tight">{totalGames}</p>
            <p className="text-[10px] text-linen/60 mt-1.5">Matches finished and recorded today</p>
          </div>

          <div className="rounded-xl bg-ivory/8 p-4 space-y-3">
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-linen/70">Top Active Courts</span>
            {courts.map(court => {
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
  const [email, setEmail] = React.useState("gianaibo.dev@gmail.com");
  const [password, setPassword] = React.useState("");
  const [authError, setAuthError] = React.useState("");

  React.useEffect(() => {
    fetch("/api/auth?action=me", { credentials: "include" })
      .then((response) => response.json())
      .then((data) => setIsAuthenticated(data.user?.role === "ADMIN"))
      .finally(() => setCheckingAuth(false));
  }, []);

  if (checkingAuth) return <LoadingScreen />;
  if (!isAuthenticated) {
    const handleLogin = async (e: React.FormEvent) => {
      e.preventDefault();
      const response = await fetch("/api/auth?action=login", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password })
      });
      const data = await response.json();
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
          className="max-w-md w-full bg-white border border-forest/10 rounded-[2.5rem] shadow-[0_24px_80px_rgba(19,36,29,0.12)] p-8 text-forest relative overflow-hidden"
        >
          <div className="absolute -right-12 -top-12 opacity-[0.03] pointer-events-none">
            <LogoMark size="large" />
          </div>

          <div className="flex flex-col items-center text-center">
            <div className="h-16 w-16 rounded-2xl bg-forest/5 flex items-center justify-center border border-forest/10 shadow-inner">
              <LogoMark />
            </div>
            <h2 className="font-display text-3xl font-black mt-5 leading-none tracking-tight">HAFF Leisure Club - Cadiz City</h2>
            <p className="text-xs font-bold uppercase tracking-[0.24em] text-clay mt-2">Calendar Access</p>
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
              <PasswordField
                value={password}
                onChange={setPassword}
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
        </motion.div>
      </div>
    );
  }

  return (
    <section className="mx-auto max-w-7xl px-4 py-6 pb-32">
      <div className="relative overflow-hidden rounded-2xl bg-[#173f32] p-5 text-ivory shadow-[0_18px_46px_rgba(0,0,0,0.2)] sm:p-6 mb-6">
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
  const [email, setEmail] = React.useState("gianaibo.dev@gmail.com");
  const [password, setPassword] = React.useState("");
  const [authError, setAuthError] = React.useState("");

  React.useEffect(() => {
    fetch("/api/auth?action=me", { credentials: "include" })
      .then((response) => response.json())
      .then((data) => setIsAuthenticated(data.user?.role === "ADMIN"))
      .finally(() => setCheckingAuth(false));
  }, []);

  if (checkingAuth) return <LoadingScreen />;
  if (!isAuthenticated) {
    const handleLogin = async (e: React.FormEvent) => {
      e.preventDefault();
      const response = await fetch("/api/auth?action=login", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password })
      });
      const data = await response.json();
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
          className="max-w-md w-full bg-white border border-forest/10 rounded-[2.5rem] shadow-[0_24px_80px_rgba(19,36,29,0.12)] p-8 text-forest relative overflow-hidden"
        >
          <div className="absolute -right-12 -top-12 opacity-[0.03] pointer-events-none">
            <LogoMark size="large" />
          </div>

          <div className="flex flex-col items-center text-center">
            <div className="h-16 w-16 rounded-2xl bg-forest/5 flex items-center justify-center border border-forest/10 shadow-inner">
              <LogoMark />
            </div>
            <h2 className="font-display text-3xl font-black mt-5 leading-none tracking-tight">HAFF Leisure Club - Cadiz City</h2>
            <p className="text-xs font-bold uppercase tracking-[0.24em] text-clay mt-2">Finance Access</p>
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
              <PasswordField
                value={password}
                onChange={setPassword}
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
        </motion.div>
      </div>
    );
  }

  return (
    <section className="mx-auto max-w-7xl px-4 py-6 pb-32">
      <div className="relative overflow-hidden rounded-2xl bg-[#173f32] p-5 text-ivory shadow-[0_18px_46px_rgba(0,0,0,0.2)] sm:p-6 mb-6">
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
    const start = new Date(`${reservationDate}T${startHour}:00`);
    const end = new Date(`${reservationDate}T${endHour}:00`);
    if (end <= start) {
      setBookingError("End time must be after the start time.");
      return;
    }
    const count = Math.max(1, Math.min(12, Number(repeatWeeks) || 1));
    const seriesId = count > 1 ? crypto.randomUUID() : undefined;
    const occurrences = Array.from({ length: count }, (_, index) => {
      const occurrenceStart = new Date(start);
      const occurrenceEnd = new Date(end);
      occurrenceStart.setDate(occurrenceStart.getDate() + index * 7);
      occurrenceEnd.setDate(occurrenceEnd.getDate() + index * 7);
      return { start: occurrenceStart, end: occurrenceEnd };
    });
    const conflictingOccurrence = occurrences.find(({ start: occurrenceStart, end: occurrenceEnd }) =>
      reservations.some((reservation) =>
        reservation.status === "Confirmed"
        && reservation.courtId === selectedCourtId
        && occurrenceStart.getTime() < new Date(reservation.endTime).getTime()
        && occurrenceEnd.getTime() > new Date(reservation.startTime).getTime()
      )
    );
    if (conflictingOccurrence) {
      setBookingError(`This court is already booked on ${conflictingOccurrence.start.toLocaleDateString()} during that time.`);
      return;
    }
    try {
      for (const occurrence of occurrences) {
        await addReservation({
          title: title.trim() || "Court Play",
          notes: notes.trim(),
          courtId: selectedCourtId,
          hostPlayerId: selectedPlayerId,
          startTime: occurrence.start.toISOString(),
          endTime: occurrence.end.toISOString(),
          playerIds: [selectedPlayerId],
          status: "Confirmed",
          paymentStatus,
          feeAmount: 350,
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
      <Card className="p-5 bg-[#0b3a2c] text-ivory border border-white/10 shadow-[0_12px_40px_rgba(0,0,0,0.25)] rounded-[2rem]">
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
              {courts.map(c => (
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

      <Card className="p-5 bg-[#0b3a2c] text-ivory border border-white/10 shadow-[0_12px_40px_rgba(0,0,0,0.25)] rounded-[2rem]">
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
  const { transactions, players, addTransaction, voidTransaction } = useClubStore();
  const [selectedPlayerId, setSelectedPlayerId] = React.useState("");
  const [txAmount, setTxAmount] = React.useState("150");
  const [txType, setTxType] = React.useState<"CheckInFee" | "CourtReservation">("CheckInFee");

  const successTx = transactions.filter(t => t.status === "Success");

  const totalRevenue = successTx.reduce((sum, t) => sum + t.amount, 0);

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
    await addTransaction({
      playerId: selectedPlayerId,
      amount: val,
      type: txType,
      paymentMethod: "Cash"
    });
    alert("Payment added to revenue.");
  };

  return (
    <div className="grid gap-5 md:grid-cols-3">
      <Card className="p-5 bg-[#0b3a2c] text-ivory border border-white/10 shadow-[0_12px_40px_rgba(0,0,0,0.25)] rounded-[2rem] h-fit">
        <h3 className="font-display text-2xl text-brass border-b border-white/10 pb-2">Log Payment</h3>
        <div className="mt-4 space-y-4">
          <div>
            <label className="text-[10px] font-black uppercase tracking-[0.2em] text-brass block mb-1">Player</label>
            <select
              value={selectedPlayerId}
              onChange={(e) => setSelectedPlayerId(e.target.value)}
              className="w-full rounded-xl bg-forest/50 text-white border border-white/10 px-3 py-2 text-sm focus:outline-none"
            >
              <option value="" className="text-forest">-- Select Player --</option>
              {players.map(p => (
                <option key={p.id} value={p.id} className="text-forest">{p.displayName}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-[10px] font-black uppercase tracking-[0.2em] text-brass block mb-1">Fee Amount (PHP)</label>
            <input
              type="number"
              value={txAmount}
              onChange={(e) => setTxAmount(e.target.value)}
              className="w-full rounded-xl bg-forest/50 text-white border border-white/10 px-3 py-2 text-sm focus:outline-none"
            />
          </div>
          <div>
            <label className="text-[10px] font-black uppercase tracking-[0.2em] text-brass block mb-1">Fee Category</label>
            <div className="flex gap-2">
              {["CheckInFee", "CourtReservation"].map(type => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setTxType(type as any)}
                  className={`flex-1 py-1.5 rounded-lg text-xs font-bold border transition ${txType === type ? 'bg-brass text-forest border-brass' : 'bg-transparent text-white border-white/10 hover:bg-white/5'}`}
                >
                  {type === "CheckInFee" ? "Check In" : "Court Rent"}
                </button>
              ))}
            </div>
          </div>
          <Button
            onClick={handleManualTx}
            className="w-full bg-brass text-forest hover:bg-brass/90 font-black py-3 rounded-xl border-none mt-2"
          >
            Submit Transaction
          </Button>
        </div>
      </Card>

      <Card className="p-5 bg-[#0b3a2c] text-ivory border border-white/10 shadow-[0_12px_40px_rgba(0,0,0,0.25)] rounded-[2rem] md:col-span-2 space-y-5">
        <div>
          <div className="flex justify-between items-center border-b border-white/10 pb-2">
            <h3 className="font-display text-2xl text-brass font-bold">Revenue Ledger</h3>
            <span className="bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 text-xs font-black px-3 py-1 rounded-full">
              Total: PHP {totalRevenue}
            </span>
          </div>
          <div className="mt-3 space-y-2 max-h-48 overflow-y-auto">
            {transactions.slice().sort((a, b) => b.timestamp.localeCompare(a.timestamp)).map(t => {
              const player = players.find(p => p.id === t.playerId);
              return (
                <div key={t.id} className={`flex items-center justify-between gap-3 border-b border-white/5 pb-2 text-xs ${t.status === "Voided" ? "opacity-55" : ""}`}>
                  <div>
                    <p className="font-bold text-white">{player?.displayName}</p>
                    <p className="text-ivory/70">{t.type} via {t.paymentMethod} · {t.status}</p>
                    {t.voidReason && <p className="mt-0.5 text-[10px] text-red-300">Voided: {t.voidReason}</p>}
                  </div>
                  <div className="flex items-center gap-2">
                    <span className={`font-mono font-bold ${t.status === "Voided" ? "text-ivory/40 line-through" : "text-emerald-400"}`}>+ PHP {t.amount}</span>
                    {t.status === "Success" && (
                      <button
                        className="rounded-lg bg-red-500/10 px-2 py-1 font-black text-red-300 hover:bg-red-500/20"
                        onClick={() => {
                          const reason = prompt("Why is this payment being removed?");
                          if (!reason?.trim()) return;
                          void voidTransaction(t.id, reason);
                        }}
                        type="button"
                      >
                        Void
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
            {transactions.length === 0 && (
              <p className="text-xs text-ivory/40 italic text-center py-4">No logged revenues yet today.</p>
            )}
          </div>
        </div>
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
          <div className="mt-6 border-t border-forest/10 pt-4">
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
            <p className="text-[10px] text-forest/50 mt-1.5">Populates the queue stack with 12 mock players with Beginner/Intermediate/Pro skill levels to test court rotation.</p>
          </div>
        </div>
      </Card>

      <Card className="bg-[#173f32] text-ivory">
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
// INLINE AUTH MODAL (replaces community redirect)
// ----------------------------------------------------
type AuthMember = { playerId?: string; displayName: string; role: string };

function AuthModal({ onSuccess }: { onSuccess: (member: AuthMember) => void }) {
  const [mode, setMode] = React.useState<"login" | "register">("login");
  const [form, setForm] = React.useState({ displayName: "", email: "", password: "", skillLevel: "Beginner" });
  const [error, setError] = React.useState("");
  const [loading, setLoading] = React.useState(false);
  const [showPassword, setShowPassword] = React.useState(false);
  const [successMsg, setSuccessMsg] = React.useState("");

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
      onSuccess(data.user);
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
      <div className="overflow-hidden rounded-3xl border border-ivory/10 bg-[#0b3a2c] shadow-[0_24px_60px_rgba(0,0,0,0.4)] backdrop-blur-xl">
        {/* Header */}
        <div className="flex border-b border-ivory/10">
          <button
            onClick={() => setMode("login")}
            className={`flex flex-1 items-center justify-center gap-2 py-4 text-sm font-black transition ${mode === "login" ? "bg-brass text-forest" : "text-ivory/60 hover:text-ivory"}`}
          >
            <LogIn size={16} /> Sign In
          </button>
          <button
            onClick={() => setMode("register")}
            className={`flex flex-1 items-center justify-center gap-2 py-4 text-sm font-black transition ${mode === "register" ? "bg-brass text-forest" : "text-ivory/60 hover:text-ivory"}`}
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
                <select
                  className="w-full rounded-2xl border-none bg-white/10 px-4 py-3 text-sm text-ivory focus:outline-none focus:ring-2 focus:ring-brass appearance-none"
                  value={form.skillLevel}
                  onChange={(e) => setForm({ ...form, skillLevel: e.target.value })}
                >
                  {["Newbie", "Beginner", "Novice", "Low Intermediate", "Intermediate", "Pro"].map((lvl) => (
                    <option key={lvl} value={lvl} className="bg-[#0b3a2c]">{lvl}</option>
                  ))}
                </select>
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
              className="mt-1 w-full min-h-12 rounded-2xl bg-brass px-6 font-black text-forest transition hover:bg-linen active:scale-95 disabled:opacity-60"
            >
              {loading ? "Please wait…" : mode === "register" ? "Create Account" : "Sign In"}
            </button>
          </form>
        </div>
      </div>
    </motion.div>
  );
}

// ----------------------------------------------------
// PLAYER VIEW SCREEN (QR/PHONE LOGIN INCLUDED)
// ----------------------------------------------------
function PlayerView() {
  const { players, courts, matches, stackOrder, checkIn, setPlayerParked, movePlayerToIndex, matchDurationMinutes, currentSessionId, updatePlayer, setView } = useClubStore();
  const [selectedPlayerId, setSelectedPlayerId] = React.useState<string | null>(() => localStorage.getItem("haff-player-account-id"));
  const [sessionMember, setSessionMember] = React.useState<{ playerId?: string; displayName: string } | null>(null);
  const [checkingSession, setCheckingSession] = React.useState(true);
  const now = useNow();
  const autoLogPayment = true;

  const activePlayers = players.filter((p) => p.isActive !== false);
  const player = activePlayers.find((item) => item.id === selectedPlayerId);
  const status = player ? getPlayerWaitStatus(player.id, players, courts, matches, stackOrder, matchDurationMinutes, now) : null;
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
  const [editFullName, setEditFullName] = React.useState("");
  const [editPhone, setEditPhone] = React.useState("");
  const [editEmergencyNote, setEditEmergencyNote] = React.useState("");
  const [editPlayStyle, setEditPlayStyle] = React.useState("");
  const [editSkillLevel, setEditSkillLevel] = React.useState("Beginner");
  const [editAvatarUrl, setEditAvatarUrl] = React.useState("");
  const [profilePhotoError, setProfilePhotoError] = React.useState("");
  const [isProcessingProfilePhoto, setIsProcessingProfilePhoto] = React.useState(false);

  React.useEffect(() => {
    fetch("/api/auth?action=me", { credentials: "include" })
      .then((response) => response.json())
      .then((data) => {
        const member = data.user as { playerId?: string; displayName: string } | null;
        setSessionMember(member);
        if (member?.playerId) {
          localStorage.setItem("haff-player-account-id", member.playerId);
          setSelectedPlayerId(member.playerId);
        }
      })
      .finally(() => setCheckingSession(false));
  }, []);

  React.useEffect(() => {
    if (!assignedMatch || assignedMatch.id === dismissedTurnMatchId) return;
    playSound("complete");
    if ("vibrate" in navigator) navigator.vibrate([300, 150, 300, 150, 600]);
  }, [assignedMatch?.id, dismissedTurnMatchId]);

  React.useEffect(() => {
    if (selectedPlayerId && !player) {
      localStorage.removeItem("haff-player-account-id");
      setSelectedPlayerId(null);
      setLoginMethod(null);
    }
  }, [player, selectedPlayerId]);
  
  if (checkingSession) return <LoadingScreen />;

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

  const handlePlayerPhoto = async (file?: File) => {
    if (!file) return;
    setIsProcessingProfilePhoto(true);
    setProfilePhotoError("");
    try {
      setEditAvatarUrl(await prepareProfileImage(file));
    } catch (error) {
      setProfilePhotoError(error instanceof Error ? error.message : "The photo could not be added.");
    } finally {
      setIsProcessingProfilePhoto(false);
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
      {assignedMatch && assignedMatch.id !== dismissedTurnMatchId && (
        <div className="fixed inset-0 z-[120] grid place-items-center bg-[#06241b] p-5 text-center text-ivory">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            className="w-full max-w-xl rounded-[2rem] border border-brass/40 bg-[#0b3a2c] p-7 shadow-2xl sm:p-10"
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
              : player.parked
              ? "bg-amber-500/20 border border-amber-500/30 text-amber-200"
              : player.checkedIn
              ? "bg-emerald-500/15 border border-emerald-500/30 text-emerald-200"
              : "bg-ivory/10 border border-ivory/10 text-ivory/60"
          }`}
        >
          <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${
            assignedMatch ? "bg-forest animate-pulse" :
            player.parked ? "bg-amber-400" :
            player.checkedIn ? "bg-emerald-400 animate-pulse" :
            "bg-ivory/30"
          }`} />
          <span className="flex-1 text-sm">
            {assignedMatch
              ? `🎾 It's your turn! Head to ${assignedCourt?.name ?? "the court"} now.`
              : player.parked
              ? "⏸ You are parked — rejoin rotation when ready."
              : player.checkedIn
              ? `📍 ${status.label} — ${status.stackDetail}`
              : "You are not checked in yet. Check in at the desk."}
          </span>
        </motion.div>
      )}
      
      {!checkingSession && !sessionMember && (
        <AuthModal onSuccess={(member) => {
          setSessionMember(member);
          if (member?.playerId) {
            localStorage.setItem("haff-player-account-id", member.playerId);
            setSelectedPlayerId(member.playerId);
          }
        }} />
      )}

      {/* PHONE LOGIN MODAL/PANEL */}
      {false && loginMethod === "phone" && (
        <Card className="bg-[#0b3a2c] text-ivory mt-4 max-w-md mx-auto p-5 border border-white/10 shadow-2xl animate-fade-in">
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
            <p className="text-[11px] text-ivory/50 leading-tight">Use 09170000000 and 1234 for the player account I created.</p>
            <Button type="submit" className="w-full bg-brass text-forest hover:bg-brass/90 font-black">
              Log In
            </Button>
          </form>
        </Card>
      )}

      {/* QR CODE SCAN SIMULATION */}
      {false && loginMethod === "qr" && (
        <Card className="bg-[#0b3a2c] text-ivory mt-4 max-w-md mx-auto p-5 text-center border border-white/10 shadow-2xl">
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
        <Card className="bg-[#0b3a2c] text-ivory border border-white/10 shadow-2xl mt-4 max-w-xl mx-auto p-5">
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
          <Card className="bg-[#0b3a2c] text-ivory p-4 sm:p-5 rounded-2xl shadow-[0_18px_46px_rgba(2,20,15,0.28)] relative">
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

            {/* Instagram Note Editor */}
            <div className="mt-4 rounded-xl bg-ivory/10 p-3 flex items-center gap-2 border border-ivory/10 shadow-inner">
              <span className="text-lg animate-bounce" style={{ animationDuration: '3s' }}>💬</span>
              <div className="flex-1">
                <input 
                  type="text" 
                  maxLength={40}
                  placeholder="Share a status note... (like Instagram notes)"
                  value={player.statusNote || ""}
                  onChange={async (e) => {
                    const updatedPlayer = { ...player, statusNote: e.target.value };
                    await updatePlayer(updatedPlayer);
                  }}
                  className="w-full bg-transparent border-none outline-none text-xs text-ivory placeholder:text-ivory/40 focus:ring-0 px-1 py-0.5"
                />
              </div>
              {player.statusNote && (
                <button 
                  onClick={async () => {
                    const updatedPlayer = { ...player, statusNote: "" };
                    await updatePlayer(updatedPlayer);
                  }}
                  className="text-[10px] text-brass hover:text-ivory font-bold uppercase shrink-0"
                >
                  Clear
                </button>
              )}
            </div>

            {/* 1. Status Section */}
            <div className="mt-4 rounded-xl bg-[#124a39] p-4">
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
                      {player.parked ? "Parked" : player.checkedIn ? "Active" : "Not Checked In"}
                    </span>
                  </div>
                  <p className="text-xs text-linen/82 mt-1 font-semibold">
                    {player.parked 
                      ? "Paid and checked in · Outside rotation" 
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
                <div className="mt-3 rounded-xl bg-[#edf2ed] p-4 text-ink shadow-[0_12px_28px_rgba(6,36,27,0.18)]">
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
                  onClick={() => checkIn(player.id, autoLogPayment)} 
                  className="mt-4 w-full bg-brass text-ink hover:bg-ivory font-black py-3 rounded-2xl shadow-lg transition-transform hover:scale-[1.01] active:scale-95 border-none"
                >
                  Check In and Park
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
                  {player.parked ? "Join Play Rotation" : "Park Me"}
                </Button>
              )}

              {/* Stack Placement/Transfer Selector */}
              <div className="mt-4 rounded-xl bg-ivory/5 p-3.5 border border-ivory/10">
                <span className="text-[10px] font-black uppercase tracking-[0.2em] text-brass">Queue Stack Placement</span>
                <p className="text-[11px] text-linen/70 mt-0.5 mb-3">Join or transfer directly into a specific stack:</p>
                <div className="space-y-2">
                  {(() => {
                    const groups = getWaitingGroups(players, courts, matches, stackOrder);
                    const totalGroupsToShow = Math.max(groups.length, 3);
                    
                    return Array.from({ length: totalGroupsToShow }).map((_, idx) => {
                      const group = groups[idx] || [];
                      const hasCurrentPlayer = group.some(p => p.id === player.id);
                      const names = group.filter(p => !p.isVacant).map(p => p.displayName.split(" ")[0]).join(" / ");
                      
                      return (
                        <div key={idx} className="flex items-center justify-between p-2 rounded-xl bg-[#092b21] border border-white/5">
                          <div className="min-w-0 flex-1 pr-2">
                            <p className="text-[10px] font-black text-brass uppercase">Stack {idx + 1}</p>
                            <p className="text-xs text-ivory/80 font-semibold truncate mt-0.5">
                              {names || "Empty / Open"}
                            </p>
                          </div>
                          <button
                            disabled={hasCurrentPlayer}
                            onClick={async () => {
                              let targetIndex = stackOrder.length;
                              if (group.length > 0) {
                                const idxInOrder = stackOrder.indexOf(group[0].id);
                                if (idxInOrder !== -1) {
                                  targetIndex = idxInOrder;
                                }
                              }
                              await movePlayerToIndex(player.id, targetIndex);
                            }}
                            className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase transition shrink-0 ${
                              hasCurrentPlayer
                                ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/30"
                                : "bg-brass text-forest hover:bg-ivory"
                            }`}
                          >
                            {hasCurrentPlayer ? "Current" : player.checkedIn && !player.parked ? "Transfer" : "Check In"}
                          </button>
                        </div>
                      );
                    });
                  })()}
                </div>
              </div>
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
                          {isProcessingProfilePhoto ? "Preparing..." : "Use Existing Photo"}
                          <input
                            accept="image/jpeg,image/png,image/webp"
                            className="sr-only"
                            disabled={isProcessingProfilePhoto}
                            onChange={(event) => void handlePlayerPhoto(event.target.files?.[0])}
                            type="file"
                          />
                        </label>
                        <p className="mt-1.5 text-[10px] leading-4 text-linen/60">Choose an existing image from your phone or computer photo library.</p>
                      </div>
                    </div>
                    {profilePhotoError && <p className="mb-2 text-xs font-semibold text-red-200">{profilePhotoError}</p>}
                    <label className="text-[10px] uppercase font-bold text-linen/70 block mb-1">Or select an avatar</label>
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
                    <label className="text-[10px] uppercase font-bold text-linen/70 block mb-1">Custom image URL</label>
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
            <div className="mt-4 rounded-xl bg-[#124a39] p-4">
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
              <span className="text-[9px] font-black uppercase tracking-normal">Next Up</span>
            </div>
            <div className="mt-2 grid gap-1.5">
              {queueGroups.length ? queueGroups.slice(0, 2).map((group, index) => (
                <div key={group.map((item) => item.id).join("-")} className="rounded-lg bg-white/70 px-2.5 py-2">
                  <p className="text-[9px] font-black uppercase tracking-normal text-forest">Stack {index + 1}</p>
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
    <div className={`rounded-full text-center font-black tracking-normal tabular-nums ${overtime ? "bg-clay text-ivory" : "bg-brass text-forest"} ${size === "large" ? "mt-auto px-4 py-2 text-[clamp(2rem,3.2vw,4rem)] leading-none" : "mt-5 px-5 py-3 text-3xl"}`}>
      {overtime ? "-" : ""}{label}
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
      className={`rank-chip ${tone === "light" ? "tv-chip" : ""} rank-${rankKey(player.skillLevel)} flex items-center justify-between rounded-xl ${compact ? "gap-2 px-2.5 py-1.5" : "gap-3 px-3 py-2"} ${draggable ? "cursor-grab active:cursor-grabbing hover:brightness-95 transition" : ""} ${tone === "light" ? "bg-forest text-ivory" : "bg-ivory/10 text-ivory"}`}
    >
      <span className="flex min-w-0 items-center gap-3">
        <div className="relative shrink-0">
          <img
            src={getPlayerAvatar(player)}
            alt=""
            className={`${compact ? "h-9 w-9" : "h-11 w-11"} shrink-0 rounded-full border-2 border-ivory/30 bg-ivory object-cover`}
          />
        </div>
        <span className="min-w-0">
          <span className={`block truncate font-black leading-none tracking-normal ${compact ? "text-[clamp(1rem,1.25vw,1.45rem)]" : "text-2xl"}`}>{player.displayName.split(" ")[0]}</span>
          {player.statusNote && (
            <span className={`block truncate font-bold opacity-70 ${compact ? "mt-0.5 max-w-32 text-[8px]" : "mt-1 max-w-40 text-[9px]"}`} title={player.statusNote}>
              Note: {player.statusNote}
            </span>
          )}
        </span>
      </span>
      <RankBadge skillLevel={player.skillLevel} compact={compact} />
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
  const { courts, matches, players, stackOrder, clubStatus } = useClubStore();
  const now = useNow();
  const matchDurationMinutes = useClubStore((state) => state.matchDurationMinutes);
  const announcedOvertimeRef = React.useRef<Record<string, number>>({});
  const announcedReservationsRef = React.useRef<Record<string, string>>({});

  const [activeBillboard, setActiveBillboard] = React.useState<{
    courtName: string;
    players: Array<{ displayName: string; avatarUrl?: string; skillLevel: string }>;
  } | null>(null);

  const seenMatchIdsRef = React.useRef<Set<string>>(new Set());

  // Populate initial match IDs so we don't billboard them on initial mount
  React.useEffect(() => {
    courts.forEach((court) => {
      if (court.currentMatchId) {
        seenMatchIdsRef.current.add(court.currentMatchId);
      }
    });
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
            const teamAPlayers = match.teamAPlayerIds.map(id => players.find(p => p.id === id)).filter(Boolean);
            const teamBPlayers = match.teamBPlayerIds.map(id => players.find(p => p.id === id)).filter(Boolean);
            const allPlayers = [...teamAPlayers, ...teamBPlayers];

            if (allPlayers.length > 0) {
              setActiveBillboard({
                courtName: court.name,
                players: allPlayers.map(p => ({
                  displayName: p!.displayName,
                  avatarUrl: p!.avatarUrl,
                  skillLevel: p!.skillLevel
                }))
              });
              
              playSound("checkin");

              setTimeout(() => {
                setActiveBillboard(current => current?.courtName === court.name ? null : current);
              }, 8000);
            }
          }
        }
      }
    });
  }, [courts, matches, players]);

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
  const displayQueueGroups = queueGroups.length ? queueGroups : Array.from({ length: 3 }, (_, index) => [
    { id: `vacant-tv-empty-${index}-1`, displayName: "Waiting", skillLevel: "Newbie" as const, rating: 0, tags: [], checkedIn: false, parked: false, totalGamesPlayed: 0, totalDaysPlayed: 0, statusNote: undefined, isVacant: true },
    { id: `vacant-tv-empty-${index}-2`, displayName: "Waiting", skillLevel: "Newbie" as const, rating: 0, tags: [], checkedIn: false, parked: false, totalGamesPlayed: 0, totalDaysPlayed: 0, statusNote: undefined, isVacant: true },
    { id: `vacant-tv-empty-${index}-3`, displayName: "Waiting", skillLevel: "Newbie" as const, rating: 0, tags: [], checkedIn: false, parked: false, totalGamesPlayed: 0, totalDaysPlayed: 0, statusNote: undefined, isVacant: true },
    { id: `vacant-tv-empty-${index}-4`, displayName: "Waiting", skillLevel: "Newbie" as const, rating: 0, tags: [], checkedIn: false, parked: false, totalGamesPlayed: 0, totalDaysPlayed: 0, statusNote: undefined, isVacant: true }
  ]);
  return (
    <section className="tv-display relative z-10 bg-forest text-ivory">
      <AnimatePresence>
        {activeBillboard && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[150] flex flex-col items-center justify-center bg-[#05241c] text-ivory p-6"
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
              <span className="inline-flex items-center gap-2 rounded-full bg-brass/10 px-4 py-1.5 text-base font-black text-brass border border-brass/25 uppercase tracking-wider mb-4">
                <Megaphone className="h-5 w-5 animate-bounce" />
                <span>Walk-Up Announcement</span>
              </span>

              <h1 className="font-display text-[clamp(4rem,7vw,9rem)] font-black leading-none tracking-tight text-ivory mb-2">
                {activeBillboard.courtName.toUpperCase()}
              </h1>
              <p className="text-xl md:text-2xl text-linen/80 font-bold max-w-2xl mx-auto mb-12">
                Your stack is active. Please proceed to the court now.
              </p>

              <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 px-4">
                {activeBillboard.players.map((p, idx) => (
                  <motion.div
                    key={p.displayName + idx}
                    initial={{ opacity: 0, y: 30 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.15 + idx * 0.1, type: "spring" }}
                    className="relative flex flex-col items-center p-6 rounded-[2rem] border border-white/10 bg-[#0b3a2c] shadow-2xl hover:border-brass/35 transition-all"
                  >
                    <div className="h-24 w-24 md:h-28 md:w-28 rounded-full overflow-hidden border-3 border-brass/40 shadow-xl bg-forest mb-4 relative">
                      <img
                        src={p.avatarUrl || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(p.displayName)}`}
                        alt={p.displayName}
                        className="h-full w-full object-cover"
                      />
                    </div>
                    <h3 className="text-2xl font-black text-white truncate max-w-full">
                      {p.displayName}
                    </h3>
                    <span className="mt-2.5 px-3 py-1 rounded-full text-[10px] font-black uppercase bg-white/10 text-ivory/70 border border-white/5 tracking-wider">
                      {p.skillLevel}
                    </span>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      <div className="mx-auto flex h-full max-w-[1920px] flex-col">
        <div className="tv-display-actions fixed right-7 top-7 z-50 flex gap-2 opacity-20 transition hover:opacity-100 focus-within:opacity-100">
          <a
            href="/player"
            className="rounded-full border border-ivory/30 bg-ivory/12 px-4 py-2 text-sm font-black uppercase tracking-wider text-ivory backdrop-blur hover:bg-ivory hover:text-forest"
          >
            Players
          </a>
        </div>
        <div className="tv-display-header flex shrink-0 items-end justify-between border-b border-ivory/10 pb-4 pr-52">
          <div>
            <p className="text-base font-black uppercase tracking-wider text-brass">HAFF Leisure Club</p>
            <h1 className="tv-display-title text-[clamp(3.5rem,5vw,6rem)] font-black leading-none tracking-normal">NOW PLAYING</h1>
          </div>
          <p className="hidden text-3xl font-black tracking-normal lg:block">OPEN PLAY</p>
        </div>
        {clubStatus && (
          <div className="mt-3 flex shrink-0 items-center gap-3 rounded-xl bg-brass px-5 py-3 text-forest">
            <span className="h-3 w-3 shrink-0 rounded-full bg-clay" />
            <p className="truncate text-2xl font-black leading-tight tracking-normal">{clubStatus}</p>
          </div>
        )}
        {overtimeCourts.length > 0 && (
          <div className="mt-3 shrink-0 rounded-xl bg-clay px-5 py-3 text-ivory">
            <p className="text-2xl font-black uppercase tracking-normal">
              Overtime: {overtimeCourts.map(({ court, milliseconds }) => `${court.name} -${formatClockMilliseconds(milliseconds)}`).join("   ")}
            </p>
          </div>
        )}
        <div className="tv-display-layout mt-4 grid min-h-0 flex-1 grid-cols-[minmax(300px,23%)_1fr] gap-4">
          <aside className="tv-queue-rail min-h-0 overflow-hidden rounded-2xl border border-ivory/10 bg-[#061f18] shadow-[0_18px_48px_rgba(0,0,0,0.28)]">
            <div className="border-b border-ivory/10 px-5 py-4">
              <p className="text-sm font-black uppercase tracking-normal text-brass">Up Next</p>
              <p className="mt-1 text-2xl font-black tracking-normal text-ivory">Queue Stacks</p>
            </div>
            <div className="tv-vertical-marquee h-[calc(100%-81px)] overflow-hidden px-3 py-3">
              <div className="tv-vertical-marquee-track">
                {[0, 1].map((copy) => (
                  <div aria-hidden={copy === 1} className="grid shrink-0 gap-3 pb-3" key={copy}>
                    {displayQueueGroups.map((group, index) => (
                      <div className="tv-queue-stack overflow-hidden rounded-xl bg-ivory text-forest" key={`${copy}-${group.map((player) => player.id).join("-")}`}>
                        <div className="flex items-center justify-between bg-brass px-4 py-2 text-forest">
                          <span className="text-base font-black uppercase tracking-normal">Stack {index + 1}</span>
                          <span className="text-sm font-black">{group.filter((player) => !player.isVacant).length}/4</span>
                        </div>
                        <div className="grid gap-px bg-forest/10">
                          {group.map((player) => (
                            <div className="flex min-w-0 items-center gap-3 bg-ivory px-3 py-2.5" key={player.id}>
                              <img
                                src={getPlayerAvatar(player)}
                                alt=""
                                className="h-12 w-12 shrink-0 rounded-full border-2 border-forest/15 bg-linen object-cover"
                              />
                              <div className="min-w-0">
                                <p className="truncate text-lg font-black leading-tight tracking-normal">{player.displayName}</p>
                                <p className="truncate text-xs font-bold leading-5 text-forest/70">
                                  {player.statusNote ? `Note: ${player.statusNote}` : player.isVacant ? "Open player slot" : player.skillLevel}
                                </p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          </aside>
          <div className="tv-court-grid grid h-full min-w-0 grid-cols-2 grid-rows-2 gap-4">
            {courts.map((court) => {
              const match = matches.find((item) => item.id === court.currentMatchId);
              return (
                <div key={court.id} className="display-court flex min-h-0 flex-col overflow-hidden rounded-2xl p-[clamp(0.85rem,1.2vw,1.25rem)] text-ivory">
                  <div className="flex items-center justify-between">
                    <h2 className="tv-court-title text-[clamp(2rem,2.5vw,3.5rem)] font-black tracking-normal text-ivory">{court.name}</h2>
                    <span className={`tv-court-status rounded-full px-4 py-1.5 text-base font-black uppercase ${
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
                    <div className="mt-3 flex min-h-0 flex-1 flex-col">
                      <PlayerNames ids={match.teamAPlayerIds} className="font-black leading-tight tracking-normal" showRanks tone="light" compact />
                      <p className="my-1 text-sm font-black uppercase tracking-[0.16em] text-brass">versus</p>
                      <PlayerNames ids={match.teamBPlayerIds} className="font-black leading-tight tracking-normal" showRanks tone="light" compact />
                      <CourtTimer matchId={match.id} size="large" />
                    </div>
                  ) : (
                    <div className="mt-6">
                      {court.status === "Reserved" && court.reservedPlayerIds?.length ? (
                        <>
                          <p className="text-xl font-black uppercase tracking-[0.16em] text-brass">Reserved for</p>
                          <PlayerNames ids={court.reservedPlayerIds} className="mt-3 text-[clamp(1.6rem,2.2vw,3rem)] font-black leading-tight tracking-normal" showRanks tone="light" />
                        </>
                      ) : court.status === "Maintenance" ? (
                        <p className="mt-12 text-4xl font-black tracking-normal text-clay uppercase">Under Maintenance</p>
                      ) : court.status === "Paused" ? (
                        <p className="mt-12 text-4xl font-black tracking-normal text-linen uppercase">Paused</p>
                      ) : court.status === "InUse" ? (
                        <p className="mt-12 text-4xl font-black tracking-normal text-amber-400 uppercase">Match Starting...</p>
                      ) : (
                        <p className="mt-12 text-4xl font-black tracking-normal text-brass uppercase">AVAILABLE</p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
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

  return stackOrder
    .filter((id) => eligibleIds.has(id))
    .map((id) => players.find((p) => p.id === id)!)
    .filter(Boolean);
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
  if (position < 0) {
    return {
      label: "Joining queue",
      reason: "Your check-in is active. The shared queue is updating now.",
      stackDetail: "You will appear in the next open stack slot.",
      estimatedSeconds: 0
    };
  }
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
  if (!showRanks) return <p className={className}>{ids.map((id) => players.find((player) => player.id === id)?.displayName.split(" ")[0]).join(" / ")}</p>;
  return (
    <div className={compact ? "space-y-1.5" : "space-y-2"}>
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
  const waitingGroups = getWaitingGroups(players, courts, matches, stackOrder);
  const waiting = getWaitingPlayers(players, matches, courts, stackOrder);
  const [draggingPlayerId, setDraggingPlayerId] = React.useState<string | null>(null);
  const canDrag = true;

  return (
    <Card className="bg-[#173f32] text-ivory">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-[0.24em] text-brass">Queue manager</p>
          <h2 className="font-display text-4xl leading-none">
            <span className="lg:hidden">Set the play order</span>
            <span className="hidden lg:inline">Drag players to reorder</span>
          </h2>
        </div>
        <p className="hidden max-w-xs text-right text-xs leading-5 text-linen/65 sm:block">
          On mobile, choose a position from the menu. On larger screens, drag names over others to insert them.
        </p>
      </div>
      <div 
        className="mt-5 grid min-w-0 gap-3 xl:grid-cols-2 2xl:grid-cols-3 min-h-32"
        onDragOver={(event) => event.preventDefault()}
        onDrop={(event) => {
          event.preventDefault();
          const droppedId = event.dataTransfer.getData("text/player-id") || draggingPlayerId;
          // If dropped outside a specific player, append to the end of the queue
          if (droppedId && waiting.findIndex(p => p.id === droppedId) === -1) {
             movePlayerToIndex(droppedId, waiting.length);
          }
          setDraggingPlayerId(null);
        }}
      >
        {waitingGroups.map((group, groupIndex) => (
          <div
            key={groupIndex}
            className={`min-w-0 min-h-32 rounded-[1.2rem] p-3 transition bg-ivory/8`}
          >
            <div className="mb-3 flex items-center justify-between">
              <p className="text-sm font-black uppercase tracking-normal text-brass">
                {groupIndex === 0 ? "Next Court" : `On Deck (${groupIndex + 1})`}
              </p>
              <span className="rounded-full bg-ivory/10 px-2 py-1 text-xs font-bold text-linen">
                Positions {groupIndex * 4 + 1}-{groupIndex * 4 + group.length}
              </span>
            </div>
            <div className="grid gap-2">
              {group.map((player, idxInGroup) => {
                const overallIndex = groupIndex * 4 + idxInGroup;
                return (
                  <div
                    key={player.id}
                    draggable={canDrag}
                    onDragStart={(event) => {
                      event.stopPropagation();
                      event.dataTransfer.setData("text/player-id", player.id);
                      setDraggingPlayerId(player.id);
                    }}
                    onDragEnd={() => setDraggingPlayerId(null)}
                    onDragOver={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                    }}
                    onDrop={(event) => {
                      event.preventDefault();
                      event.stopPropagation();
                      const droppedId = event.dataTransfer.getData("text/player-id") || draggingPlayerId;
                      if (droppedId && droppedId !== player.id) {
                        movePlayerToIndex(droppedId, overallIndex);
                      }
                      setDraggingPlayerId(null);
                    }}
                    className={`flex min-w-0 items-center gap-2 overflow-hidden rounded-xl bg-ivory px-2.5 py-2 text-forest shadow-[0_10px_26px_rgba(0,0,0,0.14)] ring-1 ring-forest/10 lg:cursor-grab lg:active:cursor-grabbing transition ${draggingPlayerId === player.id ? "opacity-50" : "hover:bg-white"}`}
                    title={canDrag ? "Drag player over another to insert" : "Choose a position"}
                  >
                    <GripVertical size={16} className="hidden shrink-0 text-forest/55 lg:block" />
                    <div className="min-w-0 flex-1 relative">
                      <div className="min-w-0">
                        <p className="truncate font-semibold">
                          <span className="text-forest/50 mr-1.5 text-xs">#{overallIndex + 1}</span>
                          {player.displayName}
                        </p>
                        {player.statusNote && (
                          <span className="mt-1 block max-w-full truncate text-[9px] font-bold text-forest/65" title={player.statusNote}>
                            Note: {player.statusNote}
                          </span>
                        )}
                      </div>
                      <RankBadge skillLevel={player.skillLevel} compact />
                    </div>
                    <label className="relative shrink-0 lg:hidden">
                      <span className="sr-only">Move {player.displayName} to position</span>
                      <select
                        aria-label={`Move ${player.displayName} to position`}
                        className="min-h-10 appearance-none rounded-lg bg-forest py-2 pl-3 pr-8 text-xs font-bold text-ivory outline-none focus:ring-2 focus:ring-brass"
                        onChange={(event) => {
                          const targetIndex = Number(event.target.value);
                          if (Number.isFinite(targetIndex)) movePlayerToIndex(player.id, targetIndex);
                        }}
                        value={overallIndex}
                      >
                        {waiting.map((_, optionIndex) => (
                          <option key={optionIndex} value={optionIndex}>Pos {optionIndex + 1}</option>
                        ))}
                      </select>
                      <ChevronDown aria-hidden="true" className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-ivory/75" size={14} />
                    </label>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
        {waitingGroups.length === 0 && (
          <div className="xl:col-span-2 2xl:col-span-3 rounded-2xl border border-dashed border-ivory/20 py-12 text-center">
            <p className="text-sm font-semibold text-ivory/60">No players waiting in queue</p>
          </div>
        )}
      </div>
    </Card>
  );
}

function AdminDetails() {
  return (
    <Card className="bg-[#173f32] text-ivory">
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

ReactDOM.createRoot(document.getElementById("root")!).render(
  <>
    <App />
    <Analytics />
  </>
);
