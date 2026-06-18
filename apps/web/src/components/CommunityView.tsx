import React from "react";
import { dicebearAvatar, isUsableAvatarUrl } from "../lib/utils";
import { ArrowLeft, CalendarDays, Copy, Download, Eye, EyeOff, LogIn, LogOut, MessageCircle, MoreHorizontal, Send, Share2, ShieldCheck, Star, UserPlus } from "lucide-react";
import { AiLoader } from "./ui/ai-loader";
import { ReactionTray } from "./ui/ReactionTray";
import { subscribeToChannel } from "../lib/realtime";
import { COMMUNITY_POLL_MS, shouldPollCommunity } from "../lib/syncPolicy";
import { apiJson } from "../lib/api";
import { useSupabaseData } from "../lib/dataSource";
import { fetchCommunityMessages } from "../lib/supabase/community";

const api = (url: string, options?: RequestInit): Promise<any> => apiJson(url, options);

export type CommunityMember = {
  id: string;
  email: string;
  role: "ADMIN" | "MEMBER";
  displayName: string;
  playerId?: string | null;
  avatarUrl?: string | null;
  skillLevel?: string | null;
};

type Member = CommunityMember;

type Message = {
  id: string;
  body: string;
  deleted: boolean;
  editedAt?: string;
  createdAt: string;
  author: { id: string; displayName: string; avatarUrl?: string | null; role: string };
  replyTo?: { id: string; body: string; displayName: string };
  reactions: Array<{ emoji: string; count: number; userIds: string[] }>;
};

export function CommunityView({
  member,
  sessionReady,
  onAuth,
  onLogout
}: {
  member: CommunityMember | null;
  sessionReady: boolean;
  onAuth: (member: CommunityMember) => void;
  onLogout: () => void;
}) {
  const [mode, setMode] = React.useState<"login" | "register">(() =>
    sessionStorage.getItem("haff-auth-mode") === "register" ? "register" : "login"
  );

  React.useEffect(() => {
    sessionStorage.removeItem("haff-auth-mode");
  }, []);

  if (!sessionReady) return <AiLoader />;
  if (!member) return <AuthPanel mode={mode} setMode={setMode} onAuth={onAuth} />;
  return <CommunityHub member={member} onLogout={onLogout} />;
}

function CommunityShell({ children, actions }: { children: React.ReactNode; actions?: React.ReactNode }) {
  return (
    <section className="mx-auto min-h-[calc(100dvh-5rem)] max-w-7xl px-4 py-6 pb-32 text-ivory">
      <div className="mb-5 flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.18em] text-brass">HAFF Leisure Club - Cadiz City</p>
          <h1 className="font-display text-3xl font-black sm:text-4xl">Community</h1>
        </div>
        {actions}
      </div>
      {children}
    </section>
  );
}

function AuthPanel({
  mode,
  setMode,
  onAuth
}: {
  mode: "login" | "register";
  setMode: (mode: "login" | "register") => void;
  onAuth: (member: Member) => void;
}) {
  const [form, setForm] = React.useState({ displayName: "", email: "", password: "", skillLevel: "Beginner" });
  const [error, setError] = React.useState("");
  const [showPassword, setShowPassword] = React.useState(false);
  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError("");
    try {
      const data = await api(`/api/auth?action=${mode}`, { method: "POST", body: JSON.stringify(form) });
      if (mode === "register") {
        alert("Registration successful! Welcome to the HAFF Leisure Club community.");
      }
      onAuth(data.user);
      window.dispatchEvent(new Event("haff-auth-change"));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Unable to continue");
    }
  };
  return (
    <CommunityShell actions={
      <div className="flex items-center gap-2">
        <button className={`flex min-h-11 items-center gap-2 rounded-full px-4 text-sm font-black ${mode === "login" ? "bg-brass text-forest" : "bg-ivory/10 text-ivory"}`} onClick={() => setMode("login")}><LogIn size={16} /> <span className="hidden sm:inline">Sign in</span></button>
        <button className={`flex min-h-11 items-center gap-2 rounded-full px-4 text-sm font-black ${mode === "register" ? "bg-brass text-forest" : "bg-ivory/10 text-ivory"}`} onClick={() => setMode("register")}><UserPlus size={16} /> <span className="hidden sm:inline">Register</span></button>
      </div>
    }>
      <div className="mx-auto max-w-md rounded-3xl bg-ivory p-6 text-forest shadow-2xl">
        <h2 className="font-display text-2xl font-black">{mode === "register" ? "Join HAFF Community" : "Member sign in"}</h2>
        <p className="mt-1 text-sm text-forest/65">Register from the club QR to chat, share feedback, and view your play recap.</p>
        <form className="mt-6 space-y-3" onSubmit={submit}>
          {mode === "register" && (
            <>
              <input className="haff-auth-input w-full rounded-xl border border-forest/15 bg-white px-4 py-3 text-forest" placeholder="Display name" required value={form.displayName} onChange={(e) => setForm({ ...form, displayName: e.target.value })} />
              <select className="w-full rounded-xl border border-forest/15 bg-white px-4 py-3" value={form.skillLevel} onChange={(e) => setForm({ ...form, skillLevel: e.target.value })}>
                {["Newbie", "Beginner", "Novice", "Low Intermediate", "Intermediate", "Pro"].map((level) => <option key={level}>{level}</option>)}
              </select>
            </>
          )}
          <input className="haff-auth-input w-full rounded-xl border border-forest/15 bg-white px-4 py-3 text-forest" type="email" autoComplete="email" placeholder="Email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          <div className="relative">
            <input className="haff-auth-input w-full rounded-xl border border-forest/15 bg-white px-4 py-3 pr-12 text-forest" type={showPassword ? "text" : "password"} autoComplete={mode === "register" ? "new-password" : "current-password"} placeholder="Password" required value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
            <button aria-label={showPassword ? "Hide password" : "Show password"} className="absolute inset-y-0 right-0 grid w-12 place-items-center text-forest/55 hover:text-forest" onClick={() => setShowPassword((visible) => !visible)} type="button">
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
          {error && <p className="rounded-xl bg-red-50 p-3 text-sm font-bold text-red-700">{error}</p>}
          <button className="w-full rounded-xl bg-forest px-4 py-3 font-black text-ivory">{mode === "register" ? "Create member account" : "Sign in"}</button>
        </form>
        <button className="mt-4 w-full min-h-11 text-sm font-bold text-forest/65" onClick={() => setMode(mode === "register" ? "login" : "register")}>
          {mode === "register" ? "Already registered? Sign in" : "New member? Register"}
        </button>
      </div>
    </CommunityShell>
  );
}

function CommunityHub({ member }: { member: Member; onLogout: () => void }) {
  const [tab, setTab] = React.useState<"chat" | "feedback" | "recap" | "admin">("chat");
  return (
    <CommunityShell>
      <div className="mb-4 flex items-center gap-3 rounded-2xl border border-ivory/10 bg-ivory/5 p-3">
        <Avatar name={member.displayName} url={member.avatarUrl} size="large" />
        <div><p className="font-black">{member.displayName}</p><p className="text-xs text-ivory/55">{member.role === "ADMIN" ? "Administrator" : "Member"} · {member.skillLevel}</p></div>
      </div>
      <div className="mb-4 flex gap-2 overflow-x-auto pb-1">
        {[
          ["chat", "Chat"],
          ["feedback", "Feedback"],
          ["recap", "Play recap"],
          ...(member.role === "ADMIN" ? [["admin", "Admin review"]] : [])
        ].map(([id, label]) => (
          <button key={id} onClick={() => setTab(id as typeof tab)} className={`min-h-11 shrink-0 rounded-full px-5 text-sm font-black ${tab === id ? "bg-brass text-forest" : "bg-ivory/10 text-ivory"}`}>{label}</button>
        ))}
      </div>
      {tab === "chat" && <ChatRoom member={member} />}
      {tab === "feedback" && <FeedbackPanel />}
      {tab === "recap" && <RecapPanel />}
      {tab === "admin" && <AdminReview />}
    </CommunityShell>
  );
}

function ChatRoom({ member }: { member: Member }) {
  const [messages, setMessages] = React.useState<Message[]>([]);
  const [body, setBody] = React.useState("");
  const [replyTo, setReplyTo] = React.useState<Message | null>(null);
  const [sortOrder, setSortOrder] = React.useState<"oldest" | "newest">("oldest");
  const [sending, setSending] = React.useState(false);
  const [nextCursor, setNextCursor] = React.useState<string | null>(null);
  const [notice, setNotice] = React.useState("");
  const [activeTray, setActiveTray] = React.useState<{ message: Message; anchor: HTMLElement } | null>(null);
  const holdRef = React.useRef<{ timer: number; x: number; y: number } | null>(null);
  const scrollerRef = React.useRef<HTMLDivElement>(null);
  const lastMessageAtRef = React.useRef<string | null>(null);
  const load = React.useCallback(async () => {
    if (useSupabaseData()) {
      const data = await fetchCommunityMessages({
        limit: 30,
        since: lastMessageAtRef.current ?? undefined
      });
      if (data.unchanged === true) return;
      setMessages(data.messages as Message[]);
      setNextCursor(data.nextCursor);
      const latest = data.messages?.at(-1)?.createdAt;
      if (typeof latest === "string") lastMessageAtRef.current = latest;
      return;
    }
    const sinceQuery = lastMessageAtRef.current
      ? `&since=${encodeURIComponent(lastMessageAtRef.current)}`
      : "";
    const data = await api(`/api/community?action=messages&limit=30${sinceQuery}`);
    if (data.unchanged === true) return;
    setMessages(data.messages);
    setNextCursor(data.nextCursor);
    const latest = data.messages?.at(-1)?.createdAt;
    if (typeof latest === "string") lastMessageAtRef.current = latest;
  }, []);
  const loadOlder = async () => {
    if (!nextCursor) return;
    if (useSupabaseData()) {
      const data = await fetchCommunityMessages({ limit: 30, before: nextCursor });
      setMessages((current) => [...data.messages as Message[], ...current.filter((message) => !data.messages.some((older) => older.id === message.id))]);
      setNextCursor(data.nextCursor);
      return;
    }
    const data = await api(`/api/community?action=messages&limit=30&before=${encodeURIComponent(nextCursor)}`);
    setMessages((current) => [...data.messages, ...current.filter((message) => !data.messages.some((older: Message) => older.id === message.id))]);
    setNextCursor(data.nextCursor);
  };
  React.useEffect(() => {
    void load();
    if (!shouldPollCommunity()) return;
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void load();
    }, COMMUNITY_POLL_MS);
    return () => window.clearInterval(timer);
  }, [load]);
  React.useEffect(() => subscribeToChannel("haff:community:general", () => void load()), [load]);
  React.useEffect(() => {
    if (sortOrder === "oldest") scrollerRef.current?.scrollTo({ top: scrollerRef.current.scrollHeight, behavior: "smooth" });
  }, [messages.length, sortOrder]);
  const send = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!body.trim()) return;
    const text = body.trim();
    const tempId = `sending-${Date.now()}`;
    setSending(true);
    setBody("");
    setReplyTo(null);
    setMessages((current) => [...current, {
      id: tempId, body: text, deleted: false, createdAt: new Date().toISOString(),
      author: { id: member.id, displayName: member.displayName, avatarUrl: member.avatarUrl, role: member.role },
      reactions: []
    }]);
    try {
      const data = await api("/api/community?action=send", { method: "POST", body: JSON.stringify({ body: text, replyToId: replyTo?.id }) });
      setMessages((current) => current.map((item) => item.id === tempId ? data.message : item));
    } catch {
      setMessages((current) => current.filter((item) => item.id !== tempId));
      setBody(text);
    } finally {
      setSending(false);
    }
  };
  const react = async (messageId: string, emoji: string) => {
    const previous = messages;
    setMessages((current) => current.map((message) => {
      if (message.id !== messageId) return message;
      const existing = message.reactions.find((item) => item.emoji === emoji);
      const active = existing?.userIds.includes(member.id);
      const reactions = existing
        ? message.reactions
            .map((item) => item.emoji === emoji ? {
              ...item,
              count: item.count + (active ? -1 : 1),
              userIds: active ? item.userIds.filter((id) => id !== member.id) : [...item.userIds, member.id]
            } : item)
            .filter((item) => item.count > 0)
        : [...message.reactions, { emoji, count: 1, userIds: [member.id] }];
      return { ...message, reactions };
    }));
    try {
      const data = await api("/api/community?action=react", { method: "POST", body: JSON.stringify({ messageId, emoji }) });
      if (data.message) setMessages((current) => current.map((item) => item.id === messageId ? data.message : item));
    } catch {
      setMessages(previous);
      setNotice("Reaction was not saved. Please try again.");
    }
  };
  const editMessage = async (message: Message) => {
    const nextBody = window.prompt("Edit your message", message.body)?.trim();
    if (!nextBody || nextBody === message.body) return;
    await api("/api/community?action=edit", { method: "PATCH", body: JSON.stringify({ messageId: message.id, body: nextBody }) });
    await load();
  };
  const removeMessage = async (messageId: string) => {
    if (!window.confirm("Remove this message?")) return;
    await api("/api/community?action=delete", { method: "DELETE", body: JSON.stringify({ messageId }) });
    await load();
  };
  const orderedMessages = [...messages].sort((a, b) => sortOrder === "oldest"
    ? new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    : new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  let previousDay = "";
  const openTray = (message: Message, anchor: HTMLElement) => {
    setActiveTray({ message, anchor });
    if ("vibrate" in navigator) navigator.vibrate(12);
  };
  const startHold = (event: React.PointerEvent<HTMLElement>, message: Message) => {
    if (event.pointerType === "mouse") return;
    holdRef.current = {
      x: event.clientX,
      y: event.clientY,
      timer: window.setTimeout(() => openTray(message, event.currentTarget), 400)
    };
  };
  const moveHold = (event: React.PointerEvent<HTMLElement>) => {
    const hold = holdRef.current;
    if (hold && Math.hypot(event.clientX - hold.x, event.clientY - hold.y) > 10) {
      window.clearTimeout(hold.timer);
      holdRef.current = null;
    }
  };
  const cancelHold = () => {
    if (holdRef.current) window.clearTimeout(holdRef.current.timer);
    holdRef.current = null;
  };
  return (
    <div className="overflow-hidden rounded-3xl border border-ivory/10 bg-[#061f18]">
      <div className="flex items-center justify-between gap-3 border-b border-ivory/10 px-4 py-3 sm:px-5"><div><p className="flex items-center gap-2 font-display text-xl font-black"><MessageCircle className="text-brass" /> General chat</p><p className="text-xs text-ivory/55">Club-wide conversation · live when available</p></div><button onClick={() => setSortOrder(sortOrder === "oldest" ? "newest" : "oldest")} className="flex min-h-11 shrink-0 items-center gap-2 rounded-full bg-ivory/10 px-3 text-xs font-black"><CalendarDays size={15} /> {sortOrder === "oldest" ? "Newest first" : "Oldest first"}</button></div>
      <div ref={scrollerRef} className="h-[58dvh] min-h-[380px] space-y-2 overflow-y-auto p-3 sm:p-4">
        {nextCursor && <button className="mx-auto block min-h-11 rounded-full bg-ivory/10 px-4 text-xs font-black" onClick={() => void loadOlder()}>Load earlier messages</button>}
        {orderedMessages.map((message) => {
          const own = message.author.id === member.id;
          const date = new Date(message.createdAt);
          const dayKey = date.toDateString();
          const showDay = dayKey !== previousDay;
          previousDay = dayKey;
          return (
            <React.Fragment key={message.id}>
              {showDay && <div className="sticky top-2 z-10 mx-auto w-fit rounded-full bg-[#173f32]/95 px-3 py-1 text-[11px] font-black text-ivory/70 backdrop-blur">{formatChatDate(date)}</div>}
              <div className={`flex items-end gap-2 ${own ? "justify-end" : "justify-start"}`}>
              {!own && <Avatar name={message.author.displayName} url={message.author.avatarUrl} />}
              <div
                tabIndex={0}
                onPointerDown={(event) => startHold(event, message)}
                onPointerMove={moveHold}
                onPointerUp={cancelHold}
                onPointerCancel={cancelHold}
                className={`group relative max-w-[78%] rounded-2xl px-3.5 py-2.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brass ${own ? "rounded-br-md bg-brass text-forest" : "rounded-bl-md bg-ivory/10 text-ivory"}`}
              >
                {!message.deleted && <button type="button" aria-label={`Actions for message from ${message.author.displayName}`} className={`absolute -right-11 top-1 grid h-10 w-10 place-items-center rounded-full opacity-60 transition hover:bg-ivory/10 hover:opacity-100 focus:opacity-100 sm:opacity-0 sm:group-hover:opacity-100 ${own ? "text-ivory" : ""}`} onClick={(event) => openTray(message, event.currentTarget)}><MoreHorizontal size={18} /></button>}
                {!own && <div className="mb-1 flex items-center gap-1.5 text-xs font-black"><span>{message.author.displayName}</span>{message.author.role === "ADMIN" && <ShieldCheck size={13} />}</div>}
                {message.replyTo && <div className="mb-2 rounded-lg border-l-2 border-current bg-black/10 px-2 py-1 text-xs opacity-75">{message.replyTo.displayName}: {message.replyTo.body}</div>}
                <p className="whitespace-pre-wrap text-sm">{message.deleted ? "Message removed" : message.body}</p>
                <p className={`mt-1 text-right text-[10px] ${own ? "text-forest/55" : "text-ivory/45"}`}>{formatChatTime(date)}{message.editedAt ? " · edited" : ""}{message.id.startsWith("sending-") ? " · sending" : ""}</p>
                {message.reactions.length > 0 && <div className="mt-2 flex flex-wrap gap-1">{message.reactions.map((reaction) => <button key={reaction.emoji} className={`rounded-full border px-2 py-1 text-xs ${reaction.userIds.includes(member.id) ? "border-current bg-black/15" : "border-transparent bg-black/10"}`} aria-label={`${reaction.emoji}, ${reaction.count} reactions`} onClick={() => void react(message.id, reaction.emoji)}>{reaction.emoji} {reaction.count}</button>)}</div>}
              </div>
            </div>
            </React.Fragment>
          );
        })}
      </div>
      <form className="border-t border-ivory/10 p-3" onSubmit={send}>
        {replyTo && <div className="mb-2 flex justify-between rounded-xl bg-ivory/10 px-3 py-2 text-xs">Replying to {replyTo.author.displayName}<button type="button" onClick={() => setReplyTo(null)}>Cancel</button></div>}
        <div className="flex items-end gap-2"><textarea className="min-h-12 flex-1 resize-none rounded-2xl bg-ivory px-4 py-3 text-sm text-forest" placeholder="Message everyone..." maxLength={2000} value={body} onChange={(e) => setBody(e.target.value)} onKeyDown={(event) => { if (event.key === "Enter" && !event.shiftKey) { event.preventDefault(); event.currentTarget.form?.requestSubmit(); } }} /><button disabled={sending || !body.trim()} className="grid h-12 w-12 place-items-center rounded-full bg-brass text-forest disabled:opacity-40" aria-label="Send message"><Send size={19} /></button></div>
      </form>
      {notice && <div role="status" className="border-t border-red-300/20 bg-red-900/30 px-4 py-2 text-sm text-red-100">{notice}</div>}
      {activeTray && <ReactionTray
        anchor={activeTray.anchor}
        own={activeTray.message.author.id === member.id}
        canRemove={activeTray.message.author.id === member.id || member.role === "ADMIN"}
        onClose={() => setActiveTray(null)}
        onReact={(emoji) => void react(activeTray.message.id, emoji)}
        onReply={() => { setReplyTo(activeTray.message); setActiveTray(null); }}
        onEdit={() => { void editMessage(activeTray.message); setActiveTray(null); }}
        onRemove={() => { void removeMessage(activeTray.message.id); setActiveTray(null); }}
        onReport={() => { void api("/api/community?action=report", { method: "POST", body: JSON.stringify({ messageId: activeTray.message.id }) }); setActiveTray(null); }}
      />}
    </div>
  );
}

function Avatar({ name, url, size = "small" }: { name: string; url?: string | null; size?: "small" | "large" }) {
  const fallback = dicebearAvatar(name, "fun-emoji");
  return <img className={`${size === "large" ? "h-12 w-12" : "h-9 w-9"} shrink-0 rounded-full border border-ivory/15 bg-brass object-cover`} src={isUsableAvatarUrl(url) ? url : fallback} alt={`${name} avatar`} loading="lazy" />;
}

const formatChatTime = (date: Date) => date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
const formatChatDate = (date: Date) => {
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (date.toDateString() === today.toDateString()) return "Today";
  if (date.toDateString() === yesterday.toDateString()) return "Yesterday";
  return date.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric", year: date.getFullYear() !== today.getFullYear() ? "numeric" : undefined });
};

function FeedbackPanel() {
  const [category, setCategory] = React.useState("App");
  const [message, setMessage] = React.useState("");
  const [contact, setContact] = React.useState("");
  const [testimonial, setTestimonial] = React.useState("");
  const [notice, setNotice] = React.useState("");
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <form className="rounded-3xl bg-ivory p-5 text-forest" onSubmit={async (e) => { e.preventDefault(); await api("/api/feedback?action=submit", { method: "POST", body: JSON.stringify({ category, message, contact }) }); setMessage(""); setContact(""); setNotice("Anonymous improvement report sent."); }}>
        <h2 className="font-display text-2xl font-black">Suggest an improvement</h2><p className="text-sm text-forest/65">Anonymous unless you add contact details.</p>
        <select className="mt-4 w-full rounded-xl border border-forest/15 px-4 py-3" value={category} onChange={(e) => setCategory(e.target.value)}>{["Facilities", "Courts", "Scheduling", "App", "Staff/Service", "Safety", "Other"].map((item) => <option key={item}>{item}</option>)}</select>
        <textarea className="mt-3 min-h-36 w-full rounded-xl border border-forest/15 px-4 py-3" minLength={20} required placeholder="What should we improve?" value={message} onChange={(e) => setMessage(e.target.value)} />
        <input className="mt-3 w-full rounded-xl border border-forest/15 px-4 py-3" placeholder="Optional email or phone" value={contact} onChange={(e) => setContact(e.target.value)} />
        <button className="mt-3 rounded-xl bg-forest px-5 py-3 font-black text-ivory">Send anonymously</button>
      </form>
      <form className="rounded-3xl border border-ivory/10 bg-ivory/5 p-5" onSubmit={async (e) => { e.preventDefault(); await api("/api/testimonials?action=submit", { method: "POST", body: JSON.stringify({ quote: testimonial, rating: 5 }) }); setTestimonial(""); setNotice("Testimonial sent for approval."); }}>
        <h2 className="font-display text-2xl font-black">Share your HAFF story</h2><p className="text-sm text-ivory/60">Approved testimonials may appear on the public landing page.</p>
        <textarea className="mt-4 min-h-40 w-full rounded-xl bg-ivory px-4 py-3 text-forest" minLength={20} maxLength={500} required placeholder="What do you enjoy about HAFF?" value={testimonial} onChange={(e) => setTestimonial(e.target.value)} />
        <button className="mt-3 flex items-center gap-2 rounded-xl bg-brass px-5 py-3 font-black text-forest"><Star size={17} /> Submit testimonial</button>
      </form>
      {notice && <p className="lg:col-span-2 rounded-xl bg-brass/15 p-3 font-bold text-brass">{notice}</p>}
    </div>
  );
}

function RecapPanel() {
  const [recap, setRecap] = React.useState<any>(null);
  React.useEffect(() => { void api("/api/recap").then((data) => setRecap(data.recap)); }, []);
  if (!recap) return <div className="rounded-3xl bg-ivory/5 p-8 text-center text-ivory/65">Complete matches to build your first play recap.</div>;
  const hours = `${Math.floor(recap.activeSeconds / 3600)}h ${Math.floor((recap.activeSeconds % 3600) / 60)}m`;
  const summary = `HAFF Leisure Club - Cadiz City\n${hours} played · ${recap.totalGames} games · ${recap.wins} wins\n${recap.uniquePlayers} players encountered · ${recap.courtsPlayed} courts\n\nhaffleisureclub.com`;
  const share = async () => {
    if (navigator.share) await navigator.share({ title: "My HAFF Play Recap", text: summary, url: "https://haffleisureclub.com" });
    else await navigator.clipboard.writeText(summary);
  };
  const downloadCard = () => {
    const canvas = document.createElement("canvas");
    canvas.width = 1080;
    canvas.height = 1350;
    const context = canvas.getContext("2d");
    if (!context) return;
    context.fillStyle = "#061f18";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.fillStyle = "#d9ad5b";
    context.font = "700 34px sans-serif";
    context.fillText("HAFF PLAY RECAP", 80, 110);
    context.fillStyle = "#f7f2e8";
    context.font = "800 72px sans-serif";
    context.fillText(recap.displayName.slice(0, 22), 80, 215);
    const stats = [[hours, "ACTIVE PLAY"], [String(recap.totalGames), "GAMES"], [String(recap.wins), "WINS"], [String(recap.uniquePlayers), "PLAYERS MET"]];
    stats.forEach(([value, label], index) => {
      const x = 80 + (index % 2) * 500;
      const y = 390 + Math.floor(index / 2) * 330;
      context.fillStyle = "#123d30";
      context.fillRect(x, y, 440, 250);
      context.fillStyle = "#d9ad5b";
      context.font = "800 72px sans-serif";
      context.fillText(value, x + 40, y + 105);
      context.fillStyle = "#f7f2e8";
      context.font = "700 25px sans-serif";
      context.fillText(label, x + 40, y + 165);
    });
    context.fillStyle = "#f7f2e8";
    context.font = "700 28px sans-serif";
    context.fillText("HAFF LEISURE CLUB - CADIZ CITY", 80, 1160);
    context.fillStyle = "#d9ad5b";
    context.font = "600 25px sans-serif";
    context.fillText("haffleisureclub.com", 80, 1210);
    const link = document.createElement("a");
    link.download = `haff-recap-${recap.displayName.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.png`;
    link.href = canvas.toDataURL("image/png");
    link.click();
  };
  return (
    <div className="mx-auto max-w-xl">
      <div className="rounded-[2rem] border border-brass/25 bg-[#061f18] p-7 shadow-2xl">
        <p className="text-xs font-black uppercase tracking-[0.2em] text-brass">HAFF Play Recap</p><h2 className="mt-2 font-display text-4xl font-black">{recap.displayName}</h2>
        <div className="mt-8 grid grid-cols-2 gap-3">
          {[[hours, "Active play"], [recap.totalGames, "Games"], [recap.wins, "Wins"], [recap.uniquePlayers, "Players met"]].map(([value, label]) => <div key={label} className="rounded-2xl bg-ivory/8 p-4"><p className="font-display text-3xl font-black text-brass">{value}</p><p className="text-xs uppercase tracking-wide text-ivory/55">{label}</p></div>)}
        </div>
        <p className="mt-8 text-xs font-black uppercase tracking-[0.18em] text-ivory/45">HAFF LEISURE CLUB - CADIZ CITY</p>
      </div>
      <div className="mt-4 grid gap-2 sm:grid-cols-3"><button className="flex items-center justify-center gap-2 rounded-xl bg-ivory px-4 py-3 font-black text-forest" onClick={() => navigator.clipboard.writeText(summary)}><Copy size={17} /> Copy</button><button className="flex items-center justify-center gap-2 rounded-xl bg-ivory/10 px-4 py-3 font-black text-ivory" onClick={downloadCard}><Download size={17} /> Card</button><button className="flex items-center justify-center gap-2 rounded-xl bg-brass px-4 py-3 font-black text-forest" onClick={share}><Share2 size={17} /> Share</button></div>
    </div>
  );
}

function AdminReview() {
  const [testimonials, setTestimonials] = React.useState<any[]>([]);
  const [reports, setReports] = React.useState<any[]>([]);
  const [chatReports, setChatReports] = React.useState<any[]>([]);
  const load = () => Promise.all([api("/api/testimonials?action=pending"), api("/api/feedback?action=list"), api("/api/community?action=reports")]).then(([a, b, c]) => { setTestimonials(a.testimonials); setReports(b.reports); setChatReports(c.reports); });
  React.useEffect(() => { void load(); }, []);
  return <div className="grid gap-4 lg:grid-cols-2">
    <div className="rounded-3xl bg-ivory p-5 text-forest"><h2 className="font-display text-2xl font-black">Pending testimonials</h2>{testimonials.map((item) => <div className="mt-3 rounded-xl border border-forest/10 p-3" key={item.id}><p className="text-sm">“{item.quote}”</p><p className="mt-1 text-xs font-bold">{item.player?.displayName}</p><div className="mt-2 flex gap-2"><button className="rounded-lg bg-forest px-3 py-2 text-xs font-black text-ivory" onClick={async () => { await api("/api/testimonials?action=moderate", { method: "POST", body: JSON.stringify({ id: item.id, status: "APPROVED" }) }); await load(); }}>Approve</button><button className="rounded-lg bg-red-100 px-3 py-2 text-xs font-black text-red-700" onClick={async () => { await api("/api/testimonials?action=moderate", { method: "POST", body: JSON.stringify({ id: item.id, status: "REJECTED" }) }); await load(); }}>Reject</button></div></div>)}</div>
    <div className="rounded-3xl border border-ivory/10 bg-ivory/5 p-5"><h2 className="font-display text-2xl font-black">Improvement reports</h2>{reports.map((item) => <div className="mt-3 rounded-xl bg-black/15 p-3" key={item.id}><p className="text-xs font-black uppercase text-brass">{item.category} · {item.status}</p><p className="mt-1 text-sm">{item.message}</p>{item.contact && <p className="mt-1 text-xs text-ivory/55">Contact: {item.contact}</p>}</div>)}</div>
    <div className="rounded-3xl border border-ivory/10 bg-ivory/5 p-5 lg:col-span-2"><h2 className="font-display text-2xl font-black">Reported chat messages</h2>{chatReports.length === 0 && <p className="mt-2 text-sm text-ivory/55">No reported messages.</p>}{chatReports.map((item) => <div className="mt-3 flex flex-wrap items-center justify-between gap-3 rounded-xl bg-black/15 p-3" key={item.id}><div><p className="text-sm">{item.message?.body}</p><p className="mt-1 text-xs text-ivory/55">Reported by {item.reporter?.email}</p></div><button className="rounded-lg bg-red-100 px-3 py-2 text-xs font-black text-red-700" onClick={async () => { await api("/api/community?action=delete", { method: "DELETE", body: JSON.stringify({ messageId: item.messageId }) }); await load(); }}>Remove message</button></div>)}</div>
  </div>;
}
