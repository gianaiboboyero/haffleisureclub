import React from "react";
import { createPortal } from "react-dom";
import { Edit3, Flag, Reply, Trash2, type LucideIcon } from "lucide-react";

const reactions = [
  ["👍", "Like"],
  ["❤️", "Love"],
  ["😂", "Laugh"],
  ["😮", "Wow"],
  ["😢", "Sad"],
  ["🎉", "Celebrate"]
] as const;

type ReactionTrayProps = {
  anchor: HTMLElement;
  own: boolean;
  canRemove: boolean;
  onClose: () => void;
  onReact: (emoji: string) => void;
  onReply: () => void;
  onEdit: () => void;
  onRemove: () => void;
  onReport: () => void;
};

export function ReactionTray({
  anchor,
  own,
  canRemove,
  onClose,
  onReact,
  onReply,
  onEdit,
  onRemove,
  onReport
}: ReactionTrayProps) {
  const trayRef = React.useRef<HTMLDivElement>(null);
  const [position, setPosition] = React.useState({ left: 12, top: 12 });

  React.useLayoutEffect(() => {
    const place = () => {
      const rect = anchor.getBoundingClientRect();
      const tray = trayRef.current;
      const width = tray?.offsetWidth ?? 310;
      const height = tray?.offsetHeight ?? 104;
      const left = Math.min(window.innerWidth - width - 12, Math.max(12, rect.left + rect.width / 2 - width / 2));
      const above = rect.top - height - 10;
      setPosition({ left, top: above > 8 ? above : Math.min(window.innerHeight - height - 8, rect.bottom + 10) });
    };
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    requestAnimationFrame(() => trayRef.current?.querySelector<HTMLButtonElement>("button")?.focus());
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
      anchor.focus();
    };
  }, [anchor]);

  React.useEffect(() => {
    const closeOutside = (event: PointerEvent) => {
      if (!trayRef.current?.contains(event.target as Node) && !anchor.contains(event.target as Node)) onClose();
    };
    const closeWithKeyboard = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      if (event.key === "ArrowRight" || event.key === "ArrowLeft") {
        const buttons = [...(trayRef.current?.querySelectorAll<HTMLButtonElement>("button") ?? [])];
        const current = buttons.indexOf(document.activeElement as HTMLButtonElement);
        const step = event.key === "ArrowRight" ? 1 : -1;
        buttons[(current + step + buttons.length) % buttons.length]?.focus();
      }
    };
    document.addEventListener("pointerdown", closeOutside);
    document.addEventListener("keydown", closeWithKeyboard);
    return () => {
      document.removeEventListener("pointerdown", closeOutside);
      document.removeEventListener("keydown", closeWithKeyboard);
    };
  }, [anchor, onClose]);

  return createPortal(
    <div
      ref={trayRef}
      role="toolbar"
      aria-label="Message actions"
      className="fixed z-[100] w-[min(22rem,calc(100vw-1.5rem))] rounded-2xl border border-ivory/15 bg-[#173f32]/95 p-2 text-ivory shadow-2xl backdrop-blur-xl"
      style={position}
    >
      <div className="grid grid-cols-6 gap-1">
        {reactions.map(([emoji, label]) => (
          <button
            key={emoji}
            type="button"
            className="grid min-h-11 place-items-center rounded-xl text-xl transition hover:bg-ivory/10 focus-visible:outline focus-visible:outline-2 focus-visible:outline-brass"
            aria-label={label}
            onClick={() => { onReact(emoji); onClose(); }}
          >
            {emoji}
          </button>
        ))}
      </div>
      <div className="mt-1 grid grid-cols-4 gap-1 border-t border-ivory/10 pt-1">
        <Action icon={Reply} label="Reply" onClick={onReply} />
        {own ? <Action icon={Edit3} label="Edit" onClick={onEdit} /> : <Action icon={Flag} label="Report" onClick={onReport} />}
        {canRemove && <Action icon={Trash2} label="Remove" onClick={onRemove} danger />}
      </div>
    </div>,
    document.body
  );
}

function Action({
  icon: Icon,
  label,
  onClick,
  danger = false
}: {
  icon: LucideIcon;
  label: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      type="button"
      className={`col-span-1 flex min-h-11 items-center justify-center gap-1 rounded-xl px-2 text-xs font-black ${danger ? "text-red-200 hover:bg-red-500/15" : "hover:bg-ivory/10"}`}
      onClick={onClick}
    >
      <Icon size={15} /> {label}
    </button>
  );
}
