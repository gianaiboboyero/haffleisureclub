import React from "react";
import { motion } from "framer-motion";
import { QrCode } from "lucide-react";

const playerImage =
  "https://images.unsplash.com/photo-1599474924187-334a4ae5bd3c?auto=format&fit=crop&w=500&q=80";
const courtImage =
  "https://images.unsplash.com/photo-1626224583764-f87db24ac4ea?auto=format&fit=crop&w=500&q=80";

const ArrowSageLeft = () => (
  <svg viewBox="0 0 100 100" className="h-full w-full overflow-visible text-[#EAF5E4] stroke-current drop-shadow-[0_8px_20px_rgba(0,0,0,0.28)]" fill="none" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M10,82 C 16,42 45,24 63,48 C 72,61 82,69 95,64" />
    <path d="M81,50 L95,64 L86,80" />
  </svg>
);

const ArrowBrassRight = () => (
  <svg viewBox="0 0 100 100" className="h-full w-full overflow-visible text-brass stroke-current drop-shadow-[0_8px_20px_rgba(0,0,0,0.28)]" fill="none" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M90,16 C 80,54 58,76 39,58 C 21,41 40,25 60,33 C 77,40 70,66 50,76" />
    <path d="M66,70 L50,76 L56,61" />
  </svg>
);

const CircularBadge = () => (
  <div className="relative flex h-24 w-24 rotate-6 cursor-pointer items-center justify-center rounded-full bg-brass text-ink shadow-xl transition-transform hover:scale-[1.03] md:h-32 md:w-32">
    <div className="absolute inset-1">
      <svg viewBox="0 0 100 100" className="h-full w-full">
        <path id="haffPlayerCirclePath" d="M 50, 50 m -36, 0 a 36,36 0 1,1 72,0 a 36,36 0 1,1 -72,0" fill="none" />
        <text className="fill-forest text-[10px] font-black uppercase tracking-[0.16em]">
          <textPath href="#haffPlayerCirclePath" startOffset="0%">
            LEISURE CLUB • LEISURE CLUB •
          </textPath>
        </text>
      </svg>
    </div>
    <QrCode className="h-9 w-9" strokeWidth={2.6} />
  </div>
);

function GlassPlayerCard({
  align = "left",
  delay = 0,
  image,
  label,
  value
}: {
  align?: "left" | "right";
  delay?: number;
  image: string;
  label: string;
  value: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12, rotate: align === "left" ? -8 : 8 }}
      animate={{ opacity: 1, y: 0, rotate: align === "left" ? -8 : 8 }}
      transition={{ duration: 0.55, delay, ease: "easeOut" }}
      whileHover={{ rotate: 0, y: -4 }}
      className={`absolute z-30 pointer-events-auto ${align === "left" ? "bottom-[6%] left-[3%] md:left-[11%]" : "right-[2%] top-[14%] md:right-[12%]"}`}
    >
      <div className="flex aspect-[3/3.55] w-36 flex-col items-center justify-center rounded-[1.6rem] bg-[#FFF8EA] p-4 text-center text-ink shadow-2xl md:w-48">
        <div className="mb-4 h-16 w-16 overflow-hidden rounded-full bg-brass p-1 shadow-inner md:h-24 md:w-24">
          <img src={image} alt="" className="h-full w-full object-cover" />
        </div>
        <p className="text-sm font-black text-ink md:text-lg">{label}</p>
        <p className="mt-1 text-[11px] font-semibold text-ink/70 md:text-xs">{value}</p>
      </div>
    </motion.div>
  );
}

export const Component = ({
  onLogin,
  onQuickCheckIn
}: {
  onLogin?: () => void;
  onQuickCheckIn?: () => void;
}) => {
  const wordMotion = {
    hidden: { opacity: 0, y: 26 },
    visible: { opacity: 1, y: 0 }
  };

  return (
    <div className="relative flex min-h-[400px] w-full flex-col overflow-hidden rounded-[1.5rem] bg-forest font-sans text-ivory selection:bg-brass selection:text-forest shadow-[0_30px_90px_rgba(6,36,27,0.38)] sm:rounded-[2rem] md:min-h-[450px]">
      <div className="absolute inset-0 bg-[linear-gradient(to_right,#fff8ea1f_1px,transparent_1px),linear-gradient(to_bottom,#fff8ea1f_1px,transparent_1px)] bg-[size:3.75rem_3.75rem] pointer-events-none" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(244,201,93,0.34),transparent_34%),radial-gradient(circle_at_80%_18%,rgba(127,182,154,0.35),transparent_28%),linear-gradient(180deg,rgba(14,90,67,0.2),rgba(6,36,27,0.84))] pointer-events-none" />

      <nav className="relative z-20 mx-auto flex w-full max-w-6xl items-center justify-between px-4 py-4 md:px-6">
        <div className="flex items-center gap-2">
          <div className="rounded-full bg-linen px-3 py-1.5 text-xs font-black text-ink shadow-sm">PLAYER</div>
          <div className="rounded-full bg-brass px-3 py-1.5 text-xs font-black text-ink shadow-sm">HAFF</div>
        </div>
        <div className="hidden items-center gap-2 md:flex">
          {["Open Play", "Cafe", "Courts", "Leisure"].map((item) => (
            <span key={item} className="rounded-full bg-ivory/18 px-4 py-1.5 text-xs font-bold text-ivory">
              {item}
            </span>
          ))}
        </div>
        <button onClick={onLogin} className="rounded-full bg-ivory px-5 py-2 text-xs font-bold text-forest transition hover:bg-linen md:text-sm">
          Sign in
        </button>
      </nav>

      <main className="relative z-10 mx-auto flex w-full max-w-6xl flex-1 flex-col items-center justify-center px-4 pb-8 pt-1 text-center md:pb-10">
        <motion.div
          initial="hidden"
          animate="visible"
          transition={{ staggerChildren: 0.1 }}
          className="relative mx-auto mb-6 mt-1 flex w-full max-w-5xl flex-col items-center justify-center"
        >
          <div className="relative z-10 flex w-full flex-col items-center space-y-1.5 md:space-y-2.5">
            <motion.div
              variants={wordMotion}
              transition={{ duration: 0.56, ease: [0.16, 1, 0.3, 1] }}
              className="flex w-full justify-start pl-[8%] md:pl-[20%]"
            >
              <h1 className="m-0 p-0 text-[clamp(3.05rem,8.5vw,112px)] font-black uppercase leading-[0.86] tracking-normal text-brass [text-shadow:0_12px_34px_rgba(0,0,0,0.34)]">
                HAFF
              </h1>
            </motion.div>
            <motion.div
              variants={wordMotion}
              transition={{ duration: 0.56, ease: [0.16, 1, 0.3, 1] }}
              className="flex w-full justify-center"
            >
              <h1 className="m-0 p-0 text-[clamp(3.6rem,11vw,150px)] font-black uppercase leading-[0.86] tracking-normal text-ivory [text-shadow:0_14px_42px_rgba(0,0,0,0.38)]">
                LEISURE
              </h1>
            </motion.div>
            <motion.div
              variants={wordMotion}
              transition={{ duration: 0.56, ease: [0.16, 1, 0.3, 1] }}
              className="flex w-full justify-start pl-[13%] md:pl-[30%]"
            >
              <h1 className="m-0 p-0 text-[clamp(3.05rem,8.5vw,112px)] font-black uppercase leading-[0.86] tracking-normal text-[#EAF5E4] [text-shadow:0_12px_34px_rgba(0,0,0,0.34)]">
                CLUB
              </h1>
            </motion.div>
          </div>

          <div className="absolute inset-0 h-full w-full pointer-events-none">
            <GlassPlayerCard image={playerImage} label="Player Portal" value="Check in from your phone" />
            <GlassPlayerCard align="right" delay={0.12} image={courtImage} label="Open Play" value="Courts, cafe, and leisure" />
            <motion.div
              initial={{ opacity: 0, x: -18, rotate: -8 }}
              animate={{ opacity: 1, x: 0, rotate: 0 }}
              transition={{ duration: 0.6, delay: 0.34, ease: "easeOut" }}
              className="absolute bottom-[-3%] left-[2%] z-20 h-24 w-24 md:left-[8%] md:h-32 md:w-32"
            >
              <ArrowSageLeft />
            </motion.div>
            <motion.div
              initial={{ opacity: 0, x: 18, rotate: 8 }}
              animate={{ opacity: 1, x: 0, rotate: 0 }}
              transition={{ duration: 0.6, delay: 0.42, ease: "easeOut" }}
              className="absolute right-[1%] top-[3%] z-20 h-24 w-24 md:right-[8%] md:h-32 md:w-32"
            >
              <ArrowBrassRight />
            </motion.div>
            <motion.div
              initial={{ opacity: 0, scale: 0.88, rotate: -8 }}
              animate={{ opacity: 1, scale: 1, rotate: 0 }}
              transition={{ duration: 0.55, delay: 0.5, ease: [0.16, 1, 0.3, 1] }}
              className="absolute bottom-[-8%] right-[2%] z-40 pointer-events-auto md:right-[14%]"
            >
              <CircularBadge />
            </motion.div>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45, delay: 0.58, ease: "easeOut" }}
          className="relative z-30 flex flex-col items-center gap-2.5 sm:flex-row"
        >
          <button onClick={onLogin} className="min-h-12 rounded-full bg-linen px-6 text-sm font-black text-forest shadow-xl ring-1 ring-ivory/40 transition hover:bg-ivory">
            Sign in to player profile
          </button>
          <button onClick={onQuickCheckIn} className="min-h-12 rounded-full border border-linen/35 bg-linen/10 px-6 text-sm font-bold text-linen backdrop-blur transition hover:bg-linen/16">
            Check me in
          </button>
        </motion.div>
      </main>
    </div>
  );
};
