import React from "react";
import { motion } from "framer-motion";
import { useClubStore } from "../store/useClubStore";
import { sortCourts, getStackDisplayGroups } from "../lib/utils";
import { SKIP_ADMIN_LOGIN } from "../lib/devFlags";
import { CALENDAR_PAGE_ENABLED } from "../lib/featureFlags";
import { apiJson } from "../lib/api";
import { 
  Users, 
  Tv, 
  Settings, 
  Coffee, 
  ArrowRight, 
  ChevronRight, 
  Calendar,
  Sparkles,
  MapPin,
  Clock,
  Volume2,
  LogIn,
  UserPlus,
  Plus,
  Trash2,
  Megaphone,
  Instagram,
  Facebook,
  X
} from "lucide-react";
import { PhotoStackCard } from "./ui/image-showcase";
import { InteractiveImageBentoGallery } from "./ui/bento-gallery";

const playerImage = "/court-2.jpg";
const courtImage = "/court-4.jpg";
const loungeImage = "/court-3.jpg";

const ArrowSageLeft = () => (
  <svg viewBox="0 0 100 100" className="h-full w-full overflow-visible text-ivy stroke-current drop-shadow-[0_8px_20px_rgba(0,0,0,0.28)]" fill="none" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M10,82 C 16,42 45,24 63,48 C 72,61 82,69 95,64" />
    <path d="M81,50 L95,64 L86,80" />
  </svg>
);

const ArrowBrassRight = () => (
  <svg viewBox="0 0 100 100" className="h-full w-full overflow-visible text-brass stroke-current drop-shadow-[0_8px_20px_rgba(0,0,0,0.28)]" fill="none" strokeWidth="4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M90,16 C 80,54 58,76 39,58 C 21,41 40,25 60,33 C 77,40 70,66 50,76" />
    <path d="M66,70 L50,76 L56,61" />
  </svg>
);

const CircularBadge = ({ onClick }: { onClick: () => void }) => (
  <motion.div 
    onClick={onClick}
    animate={{ rotate: 360 }}
    transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
    className="relative flex h-24 w-24 items-center justify-center rounded-full bg-brass text-ink shadow-2xl md:h-28 md:w-28 cursor-pointer active:scale-95 transition-transform"
  >
    <div className="absolute inset-1">
      <svg viewBox="0 0 100 100" className="h-full w-full">
        <path id="haffCirclePath" d="M 50, 50 m -36, 0 a 36,36 0 1,1 72,0 a 36,36 0 1,1 -72,0" fill="none" />
        <text className="fill-ink text-[10px] font-black uppercase tracking-[0.18em]">
          <textPath href="#haffCirclePath" startOffset="0%">
            HAFF LEISURE CLUB • SOCIAL MEDIA •
          </textPath>
        </text>
      </svg>
    </div>
    <Instagram className="h-8 w-8 text-ink" strokeWidth={2.4} />
  </motion.div>
);

interface LandingViewProps {
  setView: (view: "landing" | "admin" | "player" | "tv" | "calendar" | "finance") => void;
  signedIn: boolean;
  isAdmin?: boolean;
}

const TOURNAMENT_EVENTS = [
  {
    title: "Movemend Pickleball Tournament",
    location: "Victorias City",
    achievements: [
      {
        image: "/achievements/movemend-1.png",
        medal: "🥇",
        category: "Mixed Doubles (Beginners Category)",
        placement: "Champions",
        winners: "Florelin Kaye Negosa & Izzy Chua",
        rotation: "-rotate-1"
      },
      {
        image: "/achievements/movemend-2.jpg",
        medal: "🥈",
        category: "Men’s Doubles (Novice Category)",
        placement: "1st Runner-Up",
        winners: "Lanz Aguila & Jabie Pabilona",
        rotation: "rotate-1"
      },
      {
        image: "/achievements/movemend-3.jpg",
        medal: "🥈",
        category: "Mixed Doubles (Novice Category)",
        placement: "1st Runner-Up",
        winners: "Zeny Pabilona & Jabie Pabilona",
        rotation: "-rotate-2"
      },
      {
        image: "/achievements/movemend-4.jpg",
        medal: "🥉",
        category: "Mixed Doubles (Novice Category)",
        placement: "2nd Runner-Up",
        winners: "Lanz Aguila & Rave Irish Villamejor",
        rotation: "rotate-2"
      }
    ]
  },
  {
    title: "PaddleNet Pickleball Tournament",
    location: "Ikthus Bacolod City",
    achievements: [
      {
        image: "/achievements/paddlenet-1.png",
        medal: "🥈",
        category: "Men's Doubles (Novice Category)",
        placement: "1st Runner-Up",
        winners: "Lanz Aguila & Jabie Pabilona",
        rotation: "rotate-1"
      }
    ]
  },
  {
    title: "HAFF Leisure Club 1st In-House Pickleball Tournament",
    location: "Cadiz City",
    achievements: [
      {
        image: "/achievements/inhouse-1.jpg",
        medal: "🥇",
        category: "Men’s Doubles Novice Category",
        placement: "Champion",
        winners: "Lanz Aguila & Jabie Pabilona",
        rotation: "-rotate-1"
      },
      {
        image: "/achievements/inhouse-2.jpg",
        medal: "🥈",
        category: "Men’s Doubles Novice Category",
        placement: "1st Runner Up",
        winners: "John Marwen Batain & Wendell Batain",
        rotation: "rotate-2"
      },
      {
        image: "/achievements/inhouse-3.jpg",
        medal: "🥈",
        category: "Men’s Doubles Beginner Category",
        placement: "1st Runner Up",
        winners: "Sean Sonir & John Francis Sarabia",
        rotation: "-rotate-2"
      },
      {
        image: "/achievements/inhouse-5.jpg",
        medal: "🥈",
        category: "Mixed Doubles Novice & Beginner",
        placement: "1st Runner Up",
        winners: "Florelin Kaye Negosa & Jabie Pabilona",
        rotation: "-rotate-1"
      },
      {
        image: "/achievements/inhouse-4.jpg",
        medal: "🥉",
        category: "Men’s Doubles Beginner Category",
        placement: "2nd Runner Up",
        winners: "Florentino Negosa & Botchoy Fernandez",
        rotation: "rotate-1"
      },
      {
        image: "/achievements/inhouse-6.jpg",
        medal: "🥉",
        category: "Mixed Doubles Novice & Beginner",
        placement: "2nd Runner Up",
        winners: "Katie Angel Negosa & Wendell Ben Batain",
        rotation: "rotate-2"
      }
    ]
  },
  {
    title: "DUPR Night",
    location: "Cadiz City",
    achievements: [
      {
        image: "/achievements/dupr-1.jpg",
        medal: "🥇",
        category: "Men's Novice Category",
        placement: "Champion",
        winners: "Lanz Aguila & Izzy Chua",
        rotation: "rotate-1"
      }
    ]
  },
  {
    title: "One Pickleball Hub Inhouse Tournament",
    location: "Bacolod City",
    achievements: [
      {
        image: "/achievements/onehub-1.jpg",
        medal: "🥇",
        category: "Mixed Doubles Novice Category",
        placement: "Champion",
        winners: "Zeny Pabilona & Jabie Pabilona",
        rotation: "-rotate-1"
      }
    ]
  },
  {
    title: "PaddleGround Tournament",
    location: "Bacolod City",
    achievements: [
      {
        image: "/achievements/paddleground-1.png",
        medal: "🥈",
        category: "Mixed Doubles Novice Category",
        placement: "1st Runner-Up",
        winners: "Zeny Pabilona & Jabie Pabilona",
        rotation: "rotate-1"
      }
    ]
  }
];

const COURT_GALLERY_IMAGES = [
  {
    id: "court-1",
    title: "HAFF venue photo 1",
    desc: "",
    url: "/court-1.jpg",
    span: "lg:col-span-7 lg:row-span-2",
  },
  {
    id: "court-2",
    title: "HAFF venue photo 2",
    desc: "",
    url: "/court-2.jpg",
    span: "lg:col-span-5",
  },
  {
    id: "court-3",
    title: "HAFF venue photo 3",
    desc: "",
    url: "/court-3.jpg",
    span: "lg:col-span-5",
  },
  {
    id: "court-4",
    title: "HAFF venue photo 4",
    desc: "",
    url: "/court-4.jpg",
    span: "lg:col-span-5",
  },
  {
    id: "court-5",
    title: "HAFF venue photo 5",
    desc: "",
    url: "/court-5.jpg",
    span: "lg:col-span-7",
  },
];

const MANILA_TZ = "Asia/Manila";
const scheduleDateKey = (date: Date) =>
  new Intl.DateTimeFormat("en-CA", { timeZone: MANILA_TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(date);

export function LandingView({ setView, signedIn, isAdmin: isServerAdmin = false }: LandingViewProps) {
  const { 
    players, courts, matches, stackOrder, clubStatus, reservations,
    testimonials, announcements, achievements,
    addTestimonial, deleteTestimonial,
    addAnnouncement, deleteAnnouncement,
    addAchievement, deleteAchievement
  } = useClubStore();
  const [logoFailed, setLogoFailed] = React.useState(false);
  const [activeEventIndex, setActiveEventIndex] = React.useState<number | null>(null);
  const [showSocialsModal, setShowSocialsModal] = React.useState(false);
  const [feedback, setFeedback] = React.useState({ category: "App", message: "", contact: "" });
  const [feedbackNotice, setFeedbackNotice] = React.useState("");

  const isAdmin = SKIP_ADMIN_LOGIN || isServerAdmin;

  // Modal display states for Admin
  const [showAddAnnouncement, setShowAddAnnouncement] = React.useState(false);
  const [annTitle, setAnnTitle] = React.useState("");
  const [annContent, setAnnContent] = React.useState("");

  const [showAddAchievement, setShowAddAchievement] = React.useState(false);
  const [achTitle, setAchTitle] = React.useState("");
  const [achValue, setAchValue] = React.useState("");
  const [achDesc, setAchDesc] = React.useState("");

  const [showAddTestimonial, setShowAddTestimonial] = React.useState(false);
  const [testQuote, setTestQuote] = React.useState("");
  const [testRating, setTestRating] = React.useState(5);
  const [testAuthor, setTestAuthor] = React.useState("");

  // Live Stats calculations
  const checkedInCount = players.filter(p => p.checkedIn).length;
  const activeCourtsCount = courts.filter(c => c.status === "InUse").length;
  const totalCourtsCount = courts.length;
  
  // Next 2 stacks waiting
  const waitingStacks = React.useMemo(() => {
    if (!stackOrder || stackOrder.length === 0) return [];
    const activeIds = new Set(
      matches
        .filter((match) => match.status === "InProgress")
        .flatMap((match) => [...match.teamAPlayerIds, ...match.teamBPlayerIds])
    );
    return getStackDisplayGroups(stackOrder, players, matches, courts, 2)
      .map((group) =>
        group
          .filter((player) => !player.isVacant && !activeIds.has(player.id))
          .map((player) => player.displayName)
      )
      .filter((group) => group.length > 0);
  }, [players, courts, matches, stackOrder]);

  const todaySchedule = React.useMemo(() => {
    const today = scheduleDateKey(new Date());
    return reservations
      .filter((reservation) =>
        !["Cancelled", "Rejected", "NoShow"].includes(reservation.status)
        && scheduleDateKey(new Date(reservation.startTime)) === today
      )
      .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime());
  }, [reservations]);

  const pendingReservationCount = reservations.filter((reservation) => reservation.status === "Requested").length;
  const upcomingConfirmedCount = reservations.filter((reservation) =>
    reservation.status === "Confirmed" && new Date(reservation.startTime).getTime() > Date.now()
  ).length;

  const resolveHostName = (reservation: (typeof reservations)[number]) =>
    reservation.hostDisplayName
    ?? players.find((player) => player.id === reservation.hostPlayerId)?.displayName
    ?? (reservation.hostPlayerId === "admin" ? "Admin" : "Member");

  const toggleSound = () => {
    const next = !window.localStorage.getItem("haff-sound-enabled") || window.localStorage.getItem("haff-sound-enabled") === "false";
    window.localStorage.setItem("haff-sound-enabled", next ? "true" : "false");
    window.dispatchEvent(new CustomEvent("haff-sound-change", { detail: next }));
  };

  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-forest font-sans text-ivory selection:bg-brass selection:text-forest">
      <div className="absolute inset-0 texture pointer-events-none" />
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#fff8ea0c_1px,transparent_1px),linear-gradient(to_bottom,#fff8ea0c_1px,transparent_1px)] bg-[size:4rem_4rem] pointer-events-none" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(244,201,93,0.18),transparent_50%),radial-gradient(circle_at_100%_40%,rgba(127,182,154,0.15),transparent_40%),linear-gradient(180deg,rgba(14,90,67,0.1),rgba(6,36,27,0.9))] pointer-events-none" />

      {/* Brand Header */}
      <header className="relative z-30 mx-auto flex w-full max-w-7xl items-center justify-between px-6 py-6">
        <button className="flex items-center gap-3 text-left" onClick={() => setView("landing")} aria-label="HAFF Leisure Club home">
          {!logoFailed ? (
            <img 
              src="/haff-logo.jpg" 
              alt="HAFF Logo" 
              onError={() => setLogoFailed(true)}
              className="h-12 w-12 rounded-lg bg-forest object-cover shadow-lg border border-ivory/15"
            />
          ) : (
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-brass text-xs font-black text-forest">HLC</div>
          )}
          <div className="flex flex-col sm:flex-row sm:items-baseline sm:gap-2" aria-label="HAFF Leisure Club, Cadiz City">
            <span className="font-display text-base font-bold leading-none text-ivory sm:text-xl">HAFF LEISURE CLUB</span>
            <span className="hidden h-px w-5 bg-ivory/35 sm:block" aria-hidden="true" />
            <span className="mt-1 text-[10px] font-black uppercase tracking-[0.16em] text-brass sm:mt-0">CADIZ CITY</span>
          </div>
        </button>

        <div className="flex items-center gap-3">
          {!signedIn && (
            <>
              <button
                onClick={() => {
                  sessionStorage.setItem("haff-auth-mode", "login");
                  setView("player");
                }}
                className="hidden min-h-10 items-center gap-2 rounded-full bg-ivory/10 px-4 text-xs font-black text-ivory transition hover:bg-ivory/15 sm:flex"
              >
                <LogIn size={15} /> Sign in
              </button>
              <button
                onClick={() => {
                  sessionStorage.setItem("haff-auth-mode", "register");
                  setView("player");
                }}
                className="flex min-h-10 items-center gap-2 rounded-full bg-brass px-4 text-xs font-black text-forest transition hover:bg-linen"
              >
                <UserPlus size={15} /> <span className="hidden sm:inline">Register</span><span className="sm:hidden">Join</span>
              </button>
            </>
          )}
          <button 
            onClick={toggleSound}
            className="flex h-10 w-10 items-center justify-center rounded-full bg-ivory/8 border border-ivory/10 hover:bg-ivory/15 text-ivory/80 transition"
            title="Toggle Sound"
          >
            <Volume2 className="h-4.5 w-4.5" />
          </button>
          
          <div className="hidden items-center gap-1.5 rounded-full bg-ivory/8 px-3 py-1.5 border border-ivory/10 text-xs md:flex">
            <span className={`h-2 w-2 rounded-full ${clubStatus === "Session Active" || activeCourtsCount > 0 ? "bg-green-400" : "bg-brass animate-pulse"}`} />
            <span className="font-semibold text-ivory/90">
              {clubStatus === "Session Active" || activeCourtsCount > 0 ? "Rotation Active" : "Club Open"}
            </span>
          </div>
        </div>
      </header>

      {/* MAIN CONTAINER */}
      <main className="relative z-20 mx-auto max-w-7xl px-6 pb-36 pt-4">
        
        {/* HERO HERO SECTION */}
        <section className="grid grid-cols-1 gap-12 lg:grid-cols-12 lg:items-center">
          
          {/* Hero text */}
          <div className="flex flex-col text-left lg:col-span-6 space-y-6">
            <div className="inline-flex items-center gap-2 rounded-full bg-brass/10 px-3.5 py-1 text-xs font-semibold text-brass border border-brass/20 w-fit">
              <Sparkles className="h-3.5 w-3.5" />
              <span>Premium Venue Experience</span>
            </div>
            
            <h1 className="font-display text-5xl font-black leading-[1.08] text-ivory md:text-7xl">
              Where the <br/>
              <span className="text-brass">City Plays.</span>
            </h1>
            
            <p className="text-base text-ivory/75 max-w-xl leading-relaxed">
              Step onto the courts at HAFF Leisure Club in Cadiz City. With smart court rotation, players flow seamlessly through games, view wait estimates, and coordinate matching skill pools automatically.
            </p>

            <div className="flex flex-wrap gap-3 pt-2">
              {CALENDAR_PAGE_ENABLED && (
                <button 
                  onClick={() => setView("calendar")} 
                  className="flex items-center gap-2 rounded-full bg-brass px-6 py-3.5 text-sm font-black text-ink shadow-lg shadow-brass/15 transition hover:scale-[1.02] hover:bg-brass/90 active:scale-[0.98]"
                >
                  <span>Reserve a Court</span>
                  <ArrowRight className="h-4 w-4" />
                </button>
              )}
              <button 
                onClick={() => setView("player")} 
                className={
                  CALENDAR_PAGE_ENABLED
                    ? "flex items-center gap-2 rounded-full border border-ivory/20 bg-ivory/6 px-5 py-3.5 text-sm font-bold text-ivory backdrop-blur-sm transition hover:bg-ivory/12"
                    : "flex items-center gap-2 rounded-full border border-brass/30 bg-brass px-5 py-3.5 text-sm font-black text-forest shadow-lg shadow-brass/15 transition hover:scale-[1.02] hover:bg-brass/90 active:scale-[0.98]"
                }
              >
                <Users className="h-4.5 w-4.5" />
                <span>Go Open Play</span>
              </button>
            </div>
          </div>

          {/* Hero Visuals (Overlapping premium cards) */}
          <div className="relative flex items-center justify-center lg:col-span-6 h-[340px] md:h-[400px]">
            {/* Background glowing circle */}
            <div className="absolute h-64 w-64 rounded-full bg-brass/10 blur-3xl pointer-events-none" />

            {/* Glass Player Card Left */}
            <motion.div
              role="button"
              tabIndex={0}
              initial={{ opacity: 0, x: -50, rotate: -8 }}
              animate={{ opacity: 1, x: 0, rotate: -6 }}
              transition={{ duration: 0.8, delay: 0.1 }}
              whileHover={{ rotate: -2, y: -8, scale: 1.02 }}
              onClick={() => setView(CALENDAR_PAGE_ENABLED ? "calendar" : "player")}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") setView(CALENDAR_PAGE_ENABLED ? "calendar" : "player");
              }}
              className="absolute z-10 left-[4%] md:left-[10%] top-[10%] aspect-[3/3.6] w-36 md:w-44 rounded-2xl bg-[#FFF8EA] p-4 text-center text-ink shadow-2xl cursor-pointer"
            >
              <div className="mx-auto mb-3 h-14 w-14 overflow-hidden rounded-full bg-brass p-1 shadow-inner md:h-18 md:w-18">
                <img src={playerImage} alt="Player" className="h-full w-full object-cover rounded-full" />
              </div>
              <h3 className="text-sm font-black text-forest md:text-base">{CALENDAR_PAGE_ENABLED ? "Rent a Court" : "Join Open Play"}</h3>
              <p className="mt-1 text-[10px] md:text-xs font-semibold text-ink/60">
                {CALENDAR_PAGE_ENABLED ? "₱300 per hour" : "₱150 per player"}
              </p>
            </motion.div>

            {/* Glass Court Card Right */}
            <motion.div
              role="button"
              tabIndex={0}
              initial={{ opacity: 0, x: 50, rotate: 8 }}
              animate={{ opacity: 1, x: 0, rotate: 6 }}
              transition={{ duration: 0.8, delay: 0.2 }}
              whileHover={{ rotate: 2, y: -8, scale: 1.02 }}
              onClick={() => setView("player")}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") setView("player");
              }}
              className="absolute z-10 right-[4%] md:right-[10%] bottom-[12%] aspect-[3/3.6] w-36 md:w-44 rounded-2xl bg-[#FFF8EA] p-4 text-center text-ink shadow-2xl cursor-pointer"
            >
              <div className="mx-auto mb-3 h-14 w-14 overflow-hidden rounded-full bg-brass p-1 shadow-inner md:h-18 md:w-18">
                <img src={courtImage} alt="Court" className="h-full w-full object-cover rounded-full" />
              </div>
              <h3 className="text-sm font-black text-forest md:text-base">Open Play</h3>
              <p className="mt-1 text-[10px] md:text-xs font-semibold text-ink/60">₱150 per player</p>
              <p className="text-[9px] md:text-[10px] font-bold text-ink/40 mt-1">3 PM ONWARDS</p>
            </motion.div>

            {/* SVGs & Badges */}
            <div className="absolute left-[28%] top-[40%] z-20 h-16 w-16 md:h-22 md:w-22 opacity-70 pointer-events-none">
              <ArrowSageLeft />
            </div>
            <div className="absolute right-[28%] top-[25%] z-20 h-16 w-16 md:h-22 md:w-22 opacity-70 pointer-events-none">
              <ArrowBrassRight />
            </div>

            {/* Floating Circular QR badge */}
            <div className="absolute right-[8%] top-[2%] z-20 hover:scale-105 transition-transform">
              <CircularBadge onClick={() => setShowSocialsModal(true)} />
            </div>
          </div>

        </section>

        {/* COURT SCHEDULE & RESERVATIONS */}
        {CALENDAR_PAGE_ENABLED && (
        <section className="mt-16">
          <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
            <div>
              <span className="text-xs font-black uppercase tracking-wider text-brass">Bookings</span>
              <h2 className="font-display text-3xl font-bold mt-1 text-ivory">Court Schedule & Reservations</h2>
            </div>
            <button
              type="button"
              onClick={() => setView("calendar")}
              className="flex items-center gap-2 rounded-full border border-brass/30 bg-brass/10 px-4 py-2 text-xs font-black uppercase tracking-wider text-brass transition hover:bg-brass hover:text-forest"
            >
              View full schedule <ChevronRight className="h-4 w-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* Court Schedule — today */}
            <div className="rounded-3xl border border-ivory/10 bg-ivory/5 p-6 backdrop-blur-sm shadow-md">
              <div className="flex items-center justify-between border-b border-ivory/10 pb-3">
                <div className="flex items-center gap-2">
                  <Calendar className="h-5 w-5 text-brass" />
                  <h3 className="font-display text-xl font-bold text-ivory">Today&apos;s Court Schedule</h3>
                </div>
                <span className="text-[10px] font-black uppercase tracking-wider text-ivory/50">
                  {new Date().toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" })}
                </span>
              </div>
              <div className="mt-4 space-y-3 max-h-72 overflow-y-auto pr-1">
                {todaySchedule.length === 0 ? (
                  <p className="text-sm text-ivory/50 italic">No court bookings scheduled for today yet.</p>
                ) : (
                  todaySchedule.map((reservation) => {
                    const court = courts.find((item) => item.id === reservation.courtId);
                    const isPending = reservation.status === "Requested";
                    return (
                      <article
                        key={reservation.id}
                        className={`rounded-2xl border p-3 ${isPending ? "border-amber-400/30 bg-amber-400/10" : "border-brass/20 bg-forest/30"}`}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-xs font-black uppercase tracking-wider text-brass">{court?.name ?? "Court"}</p>
                            <p className="mt-0.5 font-bold text-ivory truncate">{resolveHostName(reservation)}</p>
                            <p className="text-[11px] text-ivory/65">
                              {new Date(reservation.startTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                              {" – "}
                              {new Date(reservation.endTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                            </p>
                            {reservation.notes && (
                              <p className="mt-1.5 text-[11px] text-ivory/75 line-clamp-2 rounded-lg bg-black/15 px-2 py-1">
                                {reservation.notes}
                              </p>
                            )}
                          </div>
                          <span className={`shrink-0 rounded-full px-2 py-0.5 text-[9px] font-black uppercase ${isPending ? "bg-amber-400/20 text-amber-200" : "bg-brass/20 text-brass"}`}>
                            {isPending ? "Pending" : reservation.status}
                          </span>
                        </div>
                      </article>
                    );
                  })
                )}
              </div>
              <button
                type="button"
                onClick={() => setView("calendar")}
                className="mt-4 w-full rounded-xl border border-ivory/15 bg-ivory/5 py-2.5 text-xs font-black uppercase tracking-wider text-ivory transition hover:bg-ivory/10"
              >
                Open court calendar
              </button>
            </div>

            {/* Reserve a Court CTA */}
            <div className="rounded-3xl border border-brass/25 bg-gradient-to-br from-brass/15 to-forest/40 p-6 shadow-md flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-brass" />
                  <h3 className="font-display text-xl font-bold text-ivory">Reserve a Court</h3>
                </div>
                <p className="mt-2 text-sm text-ivory/75 leading-relaxed">
                  Pick a day and time slot, add notes for staff, and submit your request. Admin approval is required before your booking is confirmed.
                </p>
                <div className="mt-4 flex flex-wrap gap-2">
                  {pendingReservationCount > 0 && (
                    <span className="rounded-full bg-amber-400/20 border border-amber-400/30 px-3 py-1 text-[10px] font-black uppercase text-amber-200">
                      {pendingReservationCount} pending request{pendingReservationCount === 1 ? "" : "s"}
                    </span>
                  )}
                  {upcomingConfirmedCount > 0 && (
                    <span className="rounded-full bg-brass/20 border border-brass/30 px-3 py-1 text-[10px] font-black uppercase text-brass">
                      {upcomingConfirmedCount} upcoming confirmed
                    </span>
                  )}
                </div>
                {sortCourts(courts).length > 0 && (
                  <p className="mt-4 text-xs font-bold text-ivory/60 uppercase tracking-wider">
                    {sortCourts(courts).length} courts available · from ₱300/hr
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => setView("calendar")}
                className="mt-6 flex w-full items-center justify-center gap-2 rounded-2xl bg-brass px-5 py-3.5 text-sm font-black text-forest shadow-lg transition hover:scale-[1.01] active:scale-[0.99]"
              >
                Book a court now <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        </section>
        )}

        {/* BENTO STATS & INFRASTRUCTURE GRID (Live Stats) */}
        <section className="mt-20">
          <div className="mb-8">
            <span className="text-xs font-black uppercase tracking-wider text-brass">Real-time status</span>
            <h2 className="font-display text-3xl font-bold mt-1 text-ivory">Welcome Dashboard</h2>
          </div>

          <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
            
            {/* Live Courts status card */}
            <div className="relative overflow-hidden rounded-3xl bg-ivory/5 border border-ivory/10 p-6 flex flex-col justify-between min-h-[160px] backdrop-blur-sm shadow-md">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-ivory/60 uppercase tracking-wider">Courts Status</span>
                <div className="h-8 w-8 rounded-full bg-green-500/10 flex items-center justify-center text-green-400">
                  <Tv className="h-4.5 w-4.5" />
                </div>
              </div>
              <div>
                <span className="block font-display text-4xl font-extrabold text-brass">{activeCourtsCount} <span className="text-xl font-sans text-ivory/70 font-normal">/ {totalCourtsCount}</span></span>
                <span className="text-xs text-ivory/70 mt-1 block">Courts currently in use</span>
              </div>
            </div>

            {/* Players rotation card */}
            <div className="relative overflow-hidden rounded-3xl bg-ivory/5 border border-ivory/10 p-6 flex flex-col justify-between min-h-[160px] backdrop-blur-sm shadow-md">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-ivory/60 uppercase tracking-wider">Checked In</span>
                <div className="h-8 w-8 rounded-full bg-brass/10 flex items-center justify-center text-brass">
                  <Users className="h-4.5 w-4.5" />
                </div>
              </div>
              <div>
                <span className="block font-display text-4xl font-extrabold text-ivory">{checkedInCount} <span className="text-sm font-sans text-ivory/50 font-normal">Active</span></span>
                <span className="text-xs text-ivory/70 mt-1 block">
                  All checked-in players are ready to play
                </span>
              </div>
            </div>

            {/* Next Up Queue Preview */}
            <div className="relative overflow-hidden rounded-3xl bg-ivory/5 border border-ivory/10 p-6 flex flex-col justify-between min-h-[160px] backdrop-blur-sm shadow-md">
              <div className="flex items-center justify-between border-b border-ivory/10 pb-2">
                <span className="text-xs font-bold text-ivory/60 uppercase tracking-wider">Next Up</span>
                <div className="flex items-center gap-1.5 rounded-full bg-brass/10 px-2 py-0.5 text-[10px] text-brass font-bold">
                  <Clock className="h-3 w-3" />
                  <span>On Deck</span>
                </div>
              </div>
              <div className="flex-1 flex flex-col justify-center gap-1.5 mt-2 min-h-0">
                {waitingStacks.length > 0 ? (
                  waitingStacks.map((stack, idx) => (
                    <div key={idx} className="flex items-center gap-2 text-[11px] bg-forest/40 border border-ivory/5 p-1.5 rounded-xl">
                      <span className="font-bold text-brass shrink-0">S{idx + 1}:</span>
                      <span className="truncate text-ivory/90">{stack.join(", ")}</span>
                    </div>
                  ))
                ) : (
                  <p className="text-[11px] text-ivory/50 italic">No waiting stacks yet.</p>
                )}
              </div>
            </div>

            {/* Club Announcements card */}
            <div className="relative overflow-hidden rounded-3xl bg-ivory/5 border border-ivory/10 p-6 flex flex-col justify-between min-h-[160px] backdrop-blur-sm shadow-md">
              <div className="flex items-center justify-between border-b border-ivory/10 pb-2">
                <span className="text-xs font-bold text-ivory/60 uppercase tracking-wider">Announcements</span>
                <div className="flex items-center gap-2">
                  {isAdmin && (
                    <button 
                      onClick={() => setShowAddAnnouncement(true)}
                      className="text-[10px] font-black uppercase text-brass hover:text-white transition"
                    >
                      + Add
                    </button>
                  )}
                  <div className="h-2 w-2 rounded-full bg-brass animate-pulse" />
                </div>
              </div>
              <div className="flex-1 overflow-y-auto max-h-24 mt-2 pr-1 space-y-1.5 scrollbar-none">
                {announcements.length > 0 ? (
                  announcements.map((a) => (
                    <div key={a.id} className="text-[11px] bg-forest/30 border border-ivory/5 p-2 rounded-xl relative group">
                      <div className="flex justify-between items-baseline gap-2">
                        <span className="font-black text-brass truncate">{a.title}</span>
                        <span className="text-[9px] text-ivory/40 shrink-0">{a.date}</span>
                      </div>
                      <p className="text-ivory/80 mt-1 leading-normal">{a.content}</p>
                      {isAdmin && (
                        <button 
                          onClick={() => deleteAnnouncement(a.id)}
                          className="absolute top-2 right-2 text-red-400 hover:text-red-600 font-bold text-[10px] opacity-0 group-hover:opacity-100 transition"
                        >
                          ✕
                        </button>
                      )}
                    </div>
                  ))
                ) : (
                  <p className="text-[11px] text-ivory/50 italic">No news postings.</p>
                )}
              </div>
            </div>

          </div>
        </section>

        {/* CLUB POLICIES, FAQs & LOCATION DETAILS */}
        <section className="mt-16 grid grid-cols-1 gap-8 md:grid-cols-3 text-forest">
          
          {/* Card 1: Booking Policy */}
          <div className="group relative overflow-hidden rounded-3xl bg-[#FFF8EA] border border-ivory/10 p-6 shadow-md transition duration-300 flex flex-col justify-between min-h-[300px]">
            <div>
              <div className="h-12 w-12 rounded-2xl bg-forest/10 flex items-center justify-center text-forest mb-4">
                <Sparkles className="h-6 w-6" />
              </div>
              <span className="text-[10px] font-bold text-clay uppercase tracking-[0.2em]">Guidelines</span>
              <h3 className="font-display text-2xl font-bold text-ink mt-1">Our Booking Policy</h3>
              <ul className="mt-4 space-y-2.5 text-xs text-ink/80 leading-relaxed font-semibold">
                <li className="flex items-start gap-2">
                  <span className="text-forest">🎾</span>
                  <span>Each slot is reserved for the specified game duration</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-forest">👥</span>
                  <span>Maximum of 4 players per court booking (Extra ₱100/hr per additional player)</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-forest">🏓</span>
                  <span>Equipment is provided (Additional paddles available for rent)</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-forest">🚫</span>
                  <span>No cancellations</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-forest">⛅</span>
                  <span>Reschedule allowed only for bad weather, subject to availability</span>
                </li>
              </ul>
            </div>
          </div>

          {/* Card 2: How to Book / FAQs */}
          <div className="group relative overflow-hidden rounded-3xl bg-[#FFF8EA] border border-ivory/10 p-6 shadow-md transition duration-300 flex flex-col justify-between min-h-[300px]">
            <div>
              <div className="h-12 w-12 rounded-2xl bg-forest/10 flex items-center justify-center text-forest mb-4">
                <Users className="h-6 w-6" />
              </div>
              <span className="text-[10px] font-bold text-clay uppercase tracking-[0.2em]">Support</span>
              <h3 className="font-display text-2xl font-bold text-ink mt-1">How-To & FAQs</h3>
              <div className="mt-4 space-y-3.5 text-xs text-ink/80 leading-relaxed">
                <div>
                  <h4 className="font-bold text-forest">Q: How do I book a court?</h4>
                  <p className="text-[11px] text-ink/70 mt-0.5">Click "Reserve a Court" at the top of this page, select an empty time slot, sign in or register, and submit your request for approval.</p>
                </div>
                <div>
                  <h4 className="font-bold text-forest">Q: Can we walk in for open play?</h4>
                  <p className="text-[11px] text-ink/70 mt-0.5">Yes! Click "Go Open Play" to register/login and check in at the desk to join the queue rotation stack.</p>
                </div>
                <div>
                  <h4 className="font-bold text-forest">Q: Do we need to bring paddles?</h4>
                  <p className="text-[11px] text-ink/70 mt-0.5">We provide basic paddles and balls, but premium custom paddles are also available for rent at the counter.</p>
                </div>
              </div>
            </div>
          </div>

          {/* Card 3: Location and Details */}
          <div className="group relative overflow-hidden rounded-3xl bg-[#FFF8EA] border border-ivory/10 p-6 shadow-md transition duration-300 flex flex-col justify-between min-h-[300px]">
            <div>
              <div className="h-12 w-12 rounded-2xl bg-forest/10 flex items-center justify-center text-forest mb-4">
                <MapPin className="h-6 w-6" />
              </div>
              <span className="text-[10px] font-bold text-clay uppercase tracking-[0.2em]">Our Club</span>
              <h3 className="font-display text-2xl font-bold text-ink mt-1">Negros Occidental</h3>
              <div className="mt-4 space-y-2 text-xs text-ink/80 leading-relaxed font-semibold">
                <p className="text-forest font-bold">✧ The city’s premier leisure club.</p>
                <p className="text-[11px] text-ink/75">Cafe • Pickleball • Billiards • Table Tennis • Darts</p>
                <div className="pt-2 border-t border-forest/10 mt-2">
                  <p className="font-bold text-forest">📍 Cadiz City, Negros Occidental</p>
                  <p className="text-[11px] text-ink/65 mt-0.5">Sta. Cruz Heights Subd., Barangay Banquerohan (Near Banquerohan Covered Court), 6121 Cadiz City, Philippines</p>
                  <p className="text-[11px] text-ink/75 mt-1">📞 Phone: <span className="font-bold text-forest">099423574222</span></p>
                </div>
              </div>
            </div>
            <div className="text-[10px] text-ink/50 italic pt-4 mt-2">
              * Records and bookings are updated live by the club desk.
            </div>
          </div>

        </section>



        {/* HLC MEMBERSHIP BENEFITS SECTION */}
        <section className="mt-24 rounded-3xl bg-ivory p-8 text-forest relative overflow-hidden border border-brass/25 shadow-xl">
          <div className="absolute top-0 right-0 w-64 h-64 bg-brass/10 rounded-full blur-3xl pointer-events-none" />
          <div className="grid grid-cols-1 md:grid-cols-12 gap-8 items-center">
            
            {/* Left Column: Title & Fee */}
            <div className="md:col-span-5 space-y-4">
              <div className="inline-flex items-center gap-2 rounded-full bg-forest/10 px-3 py-1 text-xs font-bold text-forest border border-forest/15 w-fit">
                <span>Join the Club</span>
              </div>
              <h3 className="font-display text-3xl md:text-4xl font-black leading-tight text-forest">HLC Membership</h3>
              
              <div className="pt-2">
                <span className="text-[10px] font-black uppercase tracking-wider text-forest/50">Membership Fee</span>
                <div className="flex items-baseline gap-1 mt-0.5">
                  <span className="text-3xl font-black text-forest">₱2,500.00</span>
                  <span className="text-xs font-bold text-forest/70">/ one-time fee</span>
                </div>
              </div>
              
              <p className="text-xs text-forest/70 leading-relaxed font-semibold">
                Visit on site or message us through our social media for more inquiries. Ready to join? Click the button below to apply online.
              </p>

              <div className="pt-2">
                <a 
                  href="https://docs.google.com/forms/d/e/1FAIpQLSe0ueRCiKdg669mkG79Z3JQMLWwR9ObHHqZDxmbhH0cYBiVNw/viewform?usp=send_form" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-full bg-forest text-ivory px-6 py-3 text-xs font-black transition hover:scale-[1.02] hover:bg-forest/90 active:scale-[0.98] shadow-md shadow-forest/10"
                >
                  Apply for Membership
                  <ArrowRight className="h-4 w-4" />
                </a>
              </div>
            </div>

            {/* Right Column: Benefits list */}
            <div className="md:col-span-7 bg-[#FFF8EA]/60 rounded-2xl p-6 border border-forest/10">
              <h4 className="font-display text-base font-bold text-forest mb-4 uppercase tracking-wider text-clay">HLC Membership Benefits:</h4>
              <ul className="space-y-3.5 text-xs text-forest/90 leading-relaxed font-semibold">
                <li className="flex items-center gap-3">
                  <span className="text-brass font-black">✦</span>
                  <span>1 month free open play</span>
                </li>
                <li className="flex items-center gap-3">
                  <span className="text-brass font-black">✦</span>
                  <span>8 hours court rental (up to 4 players)</span>
                </li>
                <li className="flex items-center gap-3">
                  <span className="text-brass font-black">✦</span>
                  <span>Official Membership card</span>
                </li>
                <li className="flex items-center gap-3">
                  <span className="text-brass font-black">✦</span>
                  <span>1 exclusive HLC t-shirt</span>
                </li>
                <li className="flex items-center gap-3">
                  <span className="text-brass font-black">✦</span>
                  <span>Free game balls during matches</span>
                </li>
              </ul>
            </div>

          </div>
        </section>

        {/* CLUB ACHIEVEMENTS SECTION */}
        <section className="mt-24 border-t border-ivory/10 pt-16 relative z-30">
          <div className="text-center max-w-2xl mx-auto mb-12">
            <span className="text-xs font-black uppercase tracking-[0.2em] text-brass">Our Achievements</span>
            <h2 className="mt-2 font-display text-4xl font-black text-ivory">Tournament Winners</h2>
            <p className="mt-3 text-sm text-linen/70 leading-relaxed">
              Celebrating the outstanding performance and victories of the HAFF Leisure Club players. Click on a folder card to explore tournament achievements.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-y-12 gap-x-8 justify-items-center mt-8">
            {TOURNAMENT_EVENTS.map((event, idx) => {
              const stackImages = event.achievements.map((ach) => ach.image);
              return (
                <PhotoStackCard
                  key={idx}
                  images={stackImages}
                  category="TOURNAMENT"
                  title={event.title}
                  subtitle={`${event.location} • ${event.achievements.length} Medal${event.achievements.length > 1 ? "s" : ""}`}
                  isActive={activeEventIndex === idx}
                  onClick={() => setActiveEventIndex(idx)}
                />
              );
            })}
          </div>
        </section>

        {/* ACHIEVEMENTS DETAILS MODAL */}
        {activeEventIndex !== null && (
          <div 
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-md"
            onClick={(e) => {
              if (e.target === e.currentTarget) setActiveEventIndex(null);
            }}
          >
            <div className="bg-forest border border-ivory/15 text-ivory rounded-3xl p-6 md:p-8 max-w-4xl w-full max-h-[85vh] overflow-y-auto space-y-6 shadow-2xl relative">
              <button 
                onClick={() => setActiveEventIndex(null)}
                className="absolute right-4 top-4 text-ivory/60 hover:text-ivory hover:bg-ivory/5 p-1.5 rounded-full transition"
              >
                <X className="h-6 w-6" />
              </button>
              
              <div className="space-y-1">
                <span className="text-[10px] font-black uppercase tracking-wider text-brass">
                  {TOURNAMENT_EVENTS[activeEventIndex].location}
                </span>
                <h4 className="font-display text-2xl md:text-3xl font-black text-ivory">
                  {TOURNAMENT_EVENTS[activeEventIndex].title}
                </h4>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6 justify-items-center pt-2">
                {TOURNAMENT_EVENTS[activeEventIndex].achievements.map((ach, achIdx) => (
                  <div 
                    key={achIdx} 
                    className={`w-[230px] shrink-0 bg-[#FAF9F6] p-4 pb-6 shadow-xl border border-black/5 hover:scale-[1.03] transition-all duration-300 flex flex-col ${ach.rotation}`}
                  >
                    <div className="aspect-[4/5] w-full overflow-hidden bg-slate-100 border border-black/5">
                      <img 
                        src={ach.image} 
                        alt={ach.winners} 
                        className="w-full h-full object-cover object-top grayscale-[10%] hover:grayscale-0 transition-all duration-300"
                      />
                    </div>
                    <div className="mt-4 flex-grow flex flex-col justify-end text-center">
                      <div className="text-lg font-black text-[#1E293B] flex items-center justify-center gap-1">
                        <span>{ach.medal}</span>
                        <span className="uppercase tracking-wide text-xs">{ach.placement}</span>
                      </div>
                      <p className="text-[9px] font-bold text-slate-500 uppercase mt-1 tracking-wider leading-tight">
                        {ach.category}
                      </p>
                      <p className="font-display text-sm font-bold text-forest mt-3 font-serif italic border-t border-slate-200/60 pt-2.5">
                        {ach.winners}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* COURT SHOWCASE BENTO GALLERY */}
        <InteractiveImageBentoGallery
          imageItems={COURT_GALLERY_IMAGES}
          title="Explore Our Premium Venue"
          description="HAFF Leisure Club · Cadiz City"
        />

        {/* FEEDBACK & TESTIMONIALS SECTION */}
        <section className="mt-20 grid gap-6 border-t border-ivory/10 pt-16 lg:grid-cols-2">
          {/* Left Column: Member stories */}
          <div className="rounded-3xl border border-ivory/10 bg-ivory/5 p-7">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div>
                <span className="text-xs font-black uppercase tracking-wider text-brass">Member stories</span>
                <h3 className="mt-1 font-display text-3xl font-black text-ivory font-bold">From the HAFF community</h3>
              </div>
              {isAdmin && (
                <button 
                  onClick={() => setShowAddTestimonial(true)}
                  className="rounded-full bg-brass text-forest px-4 py-1.5 text-xs font-black uppercase hover:bg-linen transition"
                >
                  + Add Story
                </button>
              )}
            </div>
            <div className="mt-5 space-y-3 max-h-96 overflow-y-auto pr-1 scrollbar-none">
              {testimonials.length === 0 && <p className="rounded-2xl bg-black/10 p-5 text-sm text-ivory/60">Member stories will appear here after approval.</p>}
              {testimonials.map((item) => (
                <blockquote className="rounded-2xl bg-black/15 p-5 relative group" key={item.id}>
                  <p className="text-sm leading-relaxed text-ivory">“{item.quote}”</p>
                  <footer className="mt-3 text-xs font-black uppercase tracking-wide text-brass">{item.displayName} · {"★".repeat(item.rating)}</footer>
                  {isAdmin && (
                    <button 
                      onClick={() => deleteTestimonial(item.id)}
                      className="absolute top-3 right-3 text-red-400 hover:text-red-600 font-bold text-xs opacity-0 group-hover:opacity-100 transition"
                    >
                      ✕ Delete
                    </button>
                  )}
                </blockquote>
              ))}
            </div>
          </div>

          {/* Right Column: Community voice */}
          <div className="rounded-3xl bg-ivory p-7 text-forest">
            <span className="text-xs font-black uppercase tracking-wider text-clay">Community voice</span>
            <h3 className="mt-2 font-display text-3xl font-black">Help us improve HAFF</h3>
            <p className="mt-2 text-sm text-forest/65">Send an anonymous suggestion. Contact details are always optional.</p>
            <form className="mt-5 space-y-3" onSubmit={async (event) => {
              event.preventDefault();
              setFeedbackNotice("");
              const data = await apiJson("/api/feedback?action=submit", {
                method: "POST",
                body: JSON.stringify(feedback)
              });
              setFeedback({ category: "App", message: "", contact: "" });
              setFeedbackNotice("Thank you. Your anonymous report was sent.");
            }}>
              <select className="w-full rounded-xl border border-forest/15 bg-white px-4 py-3" value={feedback.category} onChange={(event) => setFeedback({ ...feedback, category: event.target.value })}>
                {["Facilities", "Courts", "Scheduling", "App", "Staff/Service", "Safety", "Other"].map((item) => <option key={item}>{item}</option>)}
              </select>
              <textarea className="min-h-32 w-full rounded-xl border border-forest/15 bg-white px-4 py-3" minLength={20} required placeholder="What should we improve?" value={feedback.message} onChange={(event) => setFeedback({ ...feedback, message: event.target.value })} />
              <input className="w-full rounded-xl border border-forest/15 bg-white px-4 py-3" placeholder="Optional email or phone" value={feedback.contact} onChange={(event) => setFeedback({ ...feedback, contact: event.target.value })} />
              <button className="w-full rounded-xl bg-forest px-5 py-3 font-black text-ivory">Send anonymously</button>
              {feedbackNotice && <p className="text-sm font-bold text-forest/70">{feedbackNotice}</p>}
            </form>
          </div>
        </section>

      </main>

      {/* FOOTER */}
      <footer className="border-t border-ivory/5 bg-ink py-10 text-xs text-ivory/40">
        <div className="mx-auto max-w-7xl px-6 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2">
            <span className="font-display font-bold text-ivory/80 text-sm">HLC</span>
            <span>· © 2026 HAFF Leisure Club. All rights reserved.</span>
          </div>
          <div className="flex gap-4">
            <span className="hover:text-ivory/70 transition cursor-pointer">Privacy Policy</span>
            <span className="hover:text-ivory/70 transition cursor-pointer">Terms of Play</span>
            <span className="hover:text-ivory/70 transition cursor-pointer">Contact Desk</span>
            <button className="transition hover:text-brass text-brass font-bold flex items-center gap-1" onClick={() => setShowSocialsModal(true)}>Social Media</button>
            <button className="transition hover:text-ivory/70" onClick={() => setView("admin")}>Staff access</button>
          </div>
        </div>
      </footer>

      {/* SOCIAL MEDIA MODAL */}
      {showSocialsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="bg-ivory text-ink rounded-3xl p-6 max-w-sm w-full text-center space-y-6 shadow-2xl relative">
            <button 
              onClick={() => setShowSocialsModal(false)}
              className="absolute right-4 top-4 text-ink/40 hover:text-ink hover:bg-ink/5 p-1.5 rounded-full transition"
            >
              ✕
            </button>
            
            <div className="space-y-1">
              <span className="text-[10px] font-black uppercase tracking-wider text-clay">Connect With Us</span>
              <h4 className="font-display text-2xl font-black">Follow HAFF Leisure Club</h4>
              <p className="text-xs text-ink/60">Stay updated with matches, events, tournaments, and specialty kitchen announcements.</p>
            </div>

            <div className="space-y-3">
              <a 
                href="https://facebook.com/haffleisureclub" 
                target="_blank" 
                rel="noopener noreferrer"
                className="flex items-center justify-between p-4 rounded-2xl bg-forest text-ivory border border-forest/10 hover:bg-forest/90 transition shadow-md w-full"
              >
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-full bg-white/10 flex items-center justify-center text-white">
                    <Facebook className="h-5 w-5" />
                  </div>
                  <div className="text-left">
                    <p className="text-xs font-black">Facebook Page</p>
                    <p className="text-[10px] text-ivory/60">@haffleisureclub</p>
                  </div>
                </div>
                <ArrowRight className="h-4 w-4" />
              </a>

              <a 
                href="https://instagram.com/haffleisureclub" 
                target="_blank" 
                rel="noopener noreferrer"
                className="flex items-center justify-between p-4 rounded-2xl bg-[#0b3a2c] text-ivory border border-white/10 hover:bg-forest/90 transition shadow-md w-full"
              >
                <div className="flex items-center gap-3">
                  <div className="h-9 w-9 rounded-full bg-white/10 flex items-center justify-center text-white">
                    <Instagram className="h-5 w-5" />
                  </div>
                  <div className="text-left">
                    <p className="text-xs font-black">Instagram Feed</p>
                    <p className="text-[10px] text-ivory/60">@haffleisureclub</p>
                  </div>
                </div>
                <ArrowRight className="h-4 w-4" />
              </a>
            </div>

            <button 
              onClick={() => setShowSocialsModal(false)}
              className="w-full bg-forest text-ivory font-black py-3 rounded-full hover:bg-forest/90 active:scale-[0.98] transition"
            >
              Back to Portal
            </button>
          </div>
        </div>
      )}

      {/* ADD ANNOUNCEMENT MODAL */}
      {showAddAnnouncement && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="bg-[#0b3a2c] text-ivory border border-white/10 rounded-3xl p-6 max-w-sm w-full space-y-4 shadow-2xl relative">
            <button onClick={() => setShowAddAnnouncement(false)} className="absolute right-4 top-4 text-white/60 hover:text-white">✕</button>
            <h4 className="font-display text-2xl font-black text-brass">Add Announcement</h4>
            <div className="space-y-3">
              <div>
                <label className="text-[10px] font-black uppercase tracking-wider text-brass block mb-1 font-bold">Title</label>
                <input 
                  type="text" 
                  value={annTitle} 
                  onChange={(e) => setAnnTitle(e.target.value)} 
                  placeholder="Announcement title" 
                  className="w-full rounded-xl bg-forest/50 text-white border border-white/10 px-3 py-2 text-sm focus:outline-none"
                />
              </div>
              <div>
                <label className="text-[10px] font-black uppercase tracking-wider text-brass block mb-1 font-bold">Content</label>
                <textarea 
                  value={annContent} 
                  onChange={(e) => setAnnContent(e.target.value)} 
                  placeholder="Details of announcement..." 
                  className="w-full rounded-xl bg-forest/50 text-white border border-white/10 px-3 py-2 text-sm min-h-24 focus:outline-none"
                />
              </div>
            </div>
            <button 
              onClick={async () => {
                if (!annTitle.trim() || !annContent.trim()) return;
                await addAnnouncement(annTitle.trim(), annContent.trim());
                setAnnTitle("");
                setAnnContent("");
                setShowAddAnnouncement(false);
              }}
              className="w-full bg-brass text-forest font-black py-3 rounded-xl hover:bg-linen transition"
            >
              Post Announcement
            </button>
          </div>
        </div>
      )}

      {/* ADD ACHIEVEMENT MODAL */}
      {showAddAchievement && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="bg-[#0b3a2c] text-ivory border border-white/10 rounded-3xl p-6 max-w-sm w-full space-y-4 shadow-2xl relative">
            <button onClick={() => setShowAddAchievement(false)} className="absolute right-4 top-4 text-white/60 hover:text-white">✕</button>
            <h4 className="font-display text-2xl font-black text-brass">Add Club Milestone</h4>
            <div className="space-y-3">
              <div>
                <label className="text-[10px] font-black uppercase tracking-wider text-brass block mb-1 font-bold">Milestone Name</label>
                <input 
                  type="text" 
                  value={achTitle} 
                  onChange={(e) => setAchTitle(e.target.value)} 
                  placeholder="e.g. Games Logged Today" 
                  className="w-full rounded-xl bg-forest/50 text-white border border-white/10 px-3 py-2 text-sm focus:outline-none"
                />
              </div>
              <div>
                <label className="text-[10px] font-black uppercase tracking-wider text-brass block mb-1 font-bold">Value / Counter</label>
                <input 
                  type="text" 
                  value={achValue} 
                  onChange={(e) => setAchValue(e.target.value)} 
                  placeholder="e.g. 42 matches" 
                  className="w-full rounded-xl bg-forest/50 text-white border border-white/10 px-3 py-2 text-sm focus:outline-none"
                />
              </div>
              <div>
                <label className="text-[10px] font-black uppercase tracking-wider text-brass block mb-1 font-bold">Brief Description</label>
                <input 
                  type="text" 
                  value={achDesc} 
                  onChange={(e) => setAchDesc(e.target.value)} 
                  placeholder="e.g. Active open-play courts" 
                  className="w-full rounded-xl bg-forest/50 text-white border border-white/10 px-3 py-2 text-sm focus:outline-none"
                />
              </div>
            </div>
            <button 
              onClick={async () => {
                if (!achTitle.trim() || !achValue.trim() || !achDesc.trim()) return;
                await addAchievement(achTitle.trim(), achValue.trim(), achDesc.trim());
                setAchTitle("");
                setAchValue("");
                setAchDesc("");
                setShowAddAchievement(false);
              }}
              className="w-full bg-brass text-forest font-black py-3 rounded-xl hover:bg-linen transition"
            >
              Save Milestone
            </button>
          </div>
        </div>
      )}

      {/* ADD TESTIMONIAL MODAL */}
      {showAddTestimonial && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm">
          <div className="bg-[#0b3a2c] text-ivory border border-white/10 rounded-3xl p-6 max-w-sm w-full space-y-4 shadow-2xl relative">
            <button onClick={() => setShowAddTestimonial(false)} className="absolute right-4 top-4 text-white/60 hover:text-white">✕</button>
            <h4 className="font-display text-2xl font-black text-brass">Add Player Story</h4>
            <div className="space-y-3">
              <div>
                <label className="text-[10px] font-black uppercase tracking-wider text-brass block mb-1 font-bold">Author Name / Nickname</label>
                <input 
                  type="text" 
                  value={testAuthor} 
                  onChange={(e) => setTestAuthor(e.target.value)} 
                  placeholder="e.g. Ace" 
                  className="w-full rounded-xl bg-forest/50 text-white border border-white/10 px-3 py-2 text-sm focus:outline-none"
                />
              </div>
              <div>
                <label className="text-[10px] font-black uppercase tracking-wider text-brass block mb-1 font-bold">Rating (1-5)</label>
                <select 
                  value={testRating} 
                  onChange={(e) => setTestRating(Number(e.target.value))} 
                  className="w-full rounded-xl bg-[#0b3a2c] text-white border border-white/10 px-3 py-2 text-sm focus:outline-none"
                >
                  {[5, 4, 3, 2, 1].map(num => <option key={num} value={num} className="text-forest">{"★".repeat(num)}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[10px] font-black uppercase tracking-wider text-brass block mb-1 font-bold">Quote</label>
                <textarea 
                  value={testQuote} 
                  onChange={(e) => setTestQuote(e.target.value)} 
                  placeholder="Write player testimonial here..." 
                  className="w-full rounded-xl bg-forest/50 text-white border border-white/10 px-3 py-2 text-sm min-h-24 focus:outline-none"
                />
              </div>
            </div>
            <button 
              onClick={async () => {
                if (!testQuote.trim() || !testAuthor.trim()) return;
                await addTestimonial(testQuote.trim(), testRating, testAuthor.trim());
                setTestQuote("");
                setTestAuthor("");
                setTestRating(5);
                setShowAddTestimonial(false);
              }}
              className="w-full bg-brass text-forest font-black py-3 rounded-xl hover:bg-linen transition"
            >
              Add Testimonial
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
