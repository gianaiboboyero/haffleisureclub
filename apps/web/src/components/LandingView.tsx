import React from "react";
import { motion } from "framer-motion";
import { useClubStore } from "../store/useClubStore";
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
  MessageCircle,
  LogIn,
  UserPlus,
  Plus,
  Trash2,
  Megaphone,
  Instagram,
  Facebook
} from "lucide-react";

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

const CircularBadge = () => (
  <motion.div 
    animate={{ rotate: 360 }}
    transition={{ duration: 15, repeat: Infinity, ease: "linear" }}
    className="relative flex h-24 w-24 items-center justify-center rounded-full bg-brass text-ink shadow-2xl md:h-28 md:w-28"
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
  setView: (view: "landing" | "admin" | "player" | "parking" | "tv" | "community") => void;
  signedIn: boolean;
}

export function LandingView({ setView, signedIn }: LandingViewProps) {
  const { 
    players, courts, stackOrder, clubStatus,
    testimonials, announcements, achievements,
    addTestimonial, deleteTestimonial,
    addAnnouncement, deleteAnnouncement,
    addAchievement, deleteAchievement
  } = useClubStore();
  const [logoFailed, setLogoFailed] = React.useState(false);
  const [showSocialsModal, setShowSocialsModal] = React.useState(false);
  const [feedback, setFeedback] = React.useState({ category: "App", message: "", contact: "" });
  const [feedbackNotice, setFeedbackNotice] = React.useState("");

  const isAdmin = localStorage.getItem("haff_admin_authenticated") === "true";

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
  const checkedInCount = players.filter(p => p.checkedIn && !p.parked).length;
  const parkedCount = players.filter(p => p.checkedIn && p.parked).length;
  const activeCourtsCount = courts.filter(c => c.status === "InUse").length;
  const totalCourtsCount = courts.length;
  
  // Next 2 stacks waiting
  const waitingStacks = React.useMemo(() => {
    if (!stackOrder || stackOrder.length === 0) return [];
    
    // Group waiting checked-in players that are not on court
    const waitingPlayers = players.filter(p => p.checkedIn && !p.parked && !courts.some(c => c.reservedPlayerIds?.includes(p.id)));
    // Sort them by stackOrder
    const sortedWaiting = [...waitingPlayers].sort((a, b) => {
      const idxA = stackOrder.indexOf(a.id);
      const idxB = stackOrder.indexOf(b.id);
      if (idxA === -1 && idxB === -1) return 0;
      if (idxA === -1) return 1;
      if (idxB === -1) return -1;
      return idxA - idxB;
    });

    const stacks: string[][] = [];
    for (let i = 0; i < sortedWaiting.length; i += 4) {
      stacks.push(sortedWaiting.slice(i, i + 4).map(p => p.displayName));
    }
    return stacks.slice(0, 2);
  }, [players, courts, stackOrder]);

  const toggleSound = () => {
    const next = !window.localStorage.getItem("haff-sound-enabled") || window.localStorage.getItem("haff-sound-enabled") === "false";
    window.localStorage.setItem("haff-sound-enabled", next ? "true" : "false");
    window.dispatchEvent(new CustomEvent("haff-sound-change", { detail: next }));
  };

  return (
    <div className="relative min-h-screen w-full overflow-hidden bg-forest font-sans text-ivory selection:bg-brass selection:text-forest">
      
      {/* Background aesthetics */}
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
      <main className="relative z-20 mx-auto max-w-7xl px-6 pb-24 pt-4">
        
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
              <button 
                onClick={() => setView("calendar")} 
                className="flex items-center gap-2 rounded-full bg-brass px-6 py-3.5 text-sm font-black text-ink shadow-lg shadow-brass/15 transition hover:scale-[1.02] hover:bg-brass/90 active:scale-[0.98]"
              >
                <span>Reserve a Court</span>
                <ArrowRight className="h-4 w-4" />
              </button>
              <button 
                onClick={() => setView("player")} 
                className="flex items-center gap-2 rounded-full border border-ivory/20 bg-ivory/6 px-5 py-3.5 text-sm font-bold text-ivory backdrop-blur-sm transition hover:bg-ivory/12"
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
              initial={{ opacity: 0, x: -50, rotate: -8 }}
              animate={{ opacity: 1, x: 0, rotate: -6 }}
              transition={{ duration: 0.8, delay: 0.1 }}
              whileHover={{ rotate: -2, y: -8, scale: 1.02 }}
              className="absolute z-10 left-[4%] md:left-[10%] top-[10%] aspect-[3/3.6] w-36 md:w-44 rounded-2xl bg-[#FFF8EA] p-4 text-center text-ink shadow-2xl"
            >
              <div className="mx-auto mb-3 h-14 w-14 overflow-hidden rounded-full bg-brass p-1 shadow-inner md:h-18 md:w-18">
                <img src={playerImage} alt="Player" className="h-full w-full object-cover rounded-full" />
              </div>
              <h3 className="text-sm font-black md:text-base">Rent a Court</h3>
              <p className="mt-1 text-[10px] md:text-xs font-semibold text-ink/60">₱300 per hour</p>
            </motion.div>

            {/* Glass Court Card Right */}
            <motion.div 
              initial={{ opacity: 0, x: 50, rotate: 8 }}
              animate={{ opacity: 1, x: 0, rotate: 6 }}
              transition={{ duration: 0.8, delay: 0.2 }}
              whileHover={{ rotate: 2, y: -8, scale: 1.02 }}
              className="absolute z-10 right-[4%] md:right-[10%] bottom-[12%] aspect-[3/3.6] w-36 md:w-44 rounded-2xl bg-[#FFF8EA] p-4 text-center text-ink shadow-2xl"
            >
              <div className="mx-auto mb-3 h-14 w-14 overflow-hidden rounded-full bg-brass p-1 shadow-inner md:h-18 md:w-18">
                <img src={courtImage} alt="Court" className="h-full w-full object-cover rounded-full" />
              </div>
              <h3 className="text-sm font-black md:text-base">₱150 per player</h3>
              <p className="mt-1 text-[10px] md:text-xs font-semibold text-ink/60">3PM ONWARDS</p>
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
              <CircularBadge />
            </div>
          </div>

        </section>

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
                  {parkedCount > 0 ? `${parkedCount} players parked/stepping away` : "All checked-in ready to play"}
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
                  <span>Maximum players per game apply</span>
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
                  <p className="text-[11px] text-ink/65 mt-0.5">Sta. Cruz Heights, Barangay Banquerohan 6121 Cadiz City, Philippines</p>
                </div>
              </div>
            </div>
            <div className="text-[10px] text-ink/50 italic pt-4 mt-2">
              * Records and bookings are updated live by the club desk.
            </div>
          </div>

        </section>

        {/* DETAILS: HOW IT WORKS & VENUE INFO */}
        <section className="mt-24 border-t border-ivory/10 pt-16">
          <div className="grid grid-cols-1 gap-12 lg:grid-cols-12">
            
            {/* Left Column: Venue highlights */}
            <div className="lg:col-span-5 space-y-6">
              <span className="text-xs font-black uppercase tracking-wider text-brass">Club Lifestyle</span>
              <h3 className="font-display text-3xl font-bold text-ivory">The Leisure Experience</h3>
              <p className="text-sm text-ivory/80 leading-relaxed">
                HAFF Leisure Club isn't just about matches; it's a social hub designed for premium recreation. Rest, connect, and re-energize in our beautiful modern spaces.
              </p>
              
              <div className="space-y-4 pt-2">
                <div className="flex items-start gap-4">
                  <div className="h-9 w-9 rounded-full bg-brass/10 flex items-center justify-center text-brass shrink-0">
                    <Coffee className="h-4.5 w-4.5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-ivory">The Cafe & Kitchen</h4>
                    <p className="text-xs text-ivory/60 mt-1">Specialty coffee, iced matchas, fresh visual plates, and cold craft pints on draft.</p>
                  </div>
                </div>
                <div className="flex items-start gap-4">
                  <div className="h-9 w-9 rounded-full bg-brass/10 flex items-center justify-center text-brass shrink-0">
                    <MapPin className="h-4.5 w-4.5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-ivory">Premium Spaces</h4>
                    <p className="text-xs text-ivory/60 mt-1">Climate-controlled indoor court lounges, acoustic panels, and premium leather seating.</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column: Steps explanation */}
            <div className="lg:col-span-7 bg-ivory/5 border border-ivory/10 p-8 rounded-3xl space-y-6">
              <h4 className="font-display text-2xl font-bold text-brass">How Open Play Works</h4>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-2">
                <div className="space-y-2">
                  <div className="h-8 w-8 rounded-full bg-brass text-ink font-black text-sm flex items-center justify-center">1</div>
                  <h5 className="text-xs font-bold uppercase tracking-wider text-ivory">Check In</h5>
                  <p className="text-xs text-ivory/70">Sign in or check in via your mobile portal to join the queue pool.</p>
                </div>
                <div className="space-y-2">
                  <div className="h-8 w-8 rounded-full bg-brass text-ink font-black text-sm flex items-center justify-center">2</div>
                  <h5 className="text-xs font-bold uppercase tracking-wider text-ivory">Form Stacks</h5>
                  <p className="text-xs text-ivory/70">The coordinator aggregates players into stacks of four based on matching skill levels.</p>
                </div>
                <div className="space-y-2">
                  <div className="h-8 w-8 rounded-full bg-brass text-ink font-black text-sm flex items-center justify-center">3</div>
                  <h5 className="text-xs font-bold uppercase tracking-wider text-ivory">Play Rotation</h5>
                  <p className="text-xs text-ivory/70">When a court clears, the next stack is assigned instantly and starts their game timer.</p>
                </div>
              </div>

              <div className="border-t border-ivory/10 pt-4 text-xs text-ivory/55 flex items-center justify-between">
                <span>* Play timer defaults to 12 minutes per rotation</span>
                <span>* Keep track of live alerts on the TV monitor</span>
              </div>
            </div>

          </div>
        </section>

        <section className="mt-24 grid gap-6 border-t border-ivory/10 pt-16 lg:grid-cols-2">
          <div className="rounded-3xl bg-ivory p-7 text-forest">
            <span className="text-xs font-black uppercase tracking-wider text-clay">Community voice</span>
            <h3 className="mt-2 font-display text-3xl font-black">Help us improve HAFF</h3>
            <p className="mt-2 text-sm text-forest/65">Send an anonymous suggestion. Contact details are always optional.</p>
            <form className="mt-5 space-y-3" onSubmit={async (event) => {
              event.preventDefault();
              setFeedbackNotice("");
              const response = await fetch("/api/feedback?action=submit", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(feedback)
              });
              const data = await response.json();
              if (!response.ok) {
                setFeedbackNotice(data.error ?? "Unable to send your report.");
                return;
              }
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
            <button onClick={() => setView("community")} className="mt-5 flex min-h-12 w-full items-center justify-center gap-2 rounded-full bg-brass px-5 font-black text-forest">
              <MessageCircle size={18} /> Open community
            </button>
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
