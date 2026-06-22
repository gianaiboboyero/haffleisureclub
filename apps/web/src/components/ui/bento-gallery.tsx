import React, { useState } from "react";
import {
  motion,
  AnimatePresence,
} from "framer-motion";
import { cn } from "../../lib/utils";
import { X } from "lucide-react";

type ImageItem = {
  id: number | string;
  title: string;
  desc: string;
  url: string;
  span: string; // Tailwind CSS grid span classes (e.g., "md:col-span-2")
};

interface InteractiveImageBentoGalleryProps {
  imageItems: ImageItem[];
  title: string;
  description: string;
}

const containerVariants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.1,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20, scale: 0.95 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { type: "spring", stiffness: 100, damping: 15 },
  },
};

const ImageModal = ({
  item,
  onClose,
}: {
  item: ImageItem;
  onClose: () => void;
}) => {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.9, y: 20 }}
        className="relative w-full max-w-4xl"
        onClick={(e) => e.stopPropagation()}
      >
        <img
          src={item.url}
          alt={item.title}
          className="h-auto max-h-[90vh] w-full rounded-2xl object-contain border border-white/10 shadow-2xl"
        />
      </motion.div>
      <button
        onClick={onClose}
        className="absolute right-6 top-6 text-white/80 transition-colors hover:text-white bg-black/40 hover:bg-black/60 p-2 rounded-full backdrop-blur-sm"
        aria-label="Close image view"
      >
        <X size={24} />
      </button>
    </motion.div>
  );
};

export const InteractiveImageBentoGallery: React.FC<
  InteractiveImageBentoGalleryProps
> = ({ imageItems, title, description }) => {
  const [selectedItem, setSelectedItem] = useState<ImageItem | null>(null);
  return (
    <section
      className="relative z-30 w-full overflow-hidden border-t border-ivory/10 bg-forest/5 py-16 sm:py-24"
    >
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true, amount: 0.4 }}
        className="mx-auto flex max-w-7xl flex-col gap-3 px-6 lg:flex-row lg:items-end lg:justify-between"
      >
        <div>
          <span className="text-xs font-black uppercase tracking-[0.2em] text-brass">{description}</span>
          <h2 className="mt-2 max-w-3xl font-display text-4xl font-black leading-none text-ivory sm:text-5xl lg:text-6xl">{title}</h2>
        </div>
        <p className="max-w-sm text-sm leading-relaxed text-ivory/55">
          Five views of the courts, lounge, and play spaces—tap any image for a closer look.
        </p>
      </motion.div>

      <div className="mx-auto mt-10 max-w-7xl px-6">
        <motion.div
          className="grid auto-rows-[14rem] grid-cols-1 gap-3 sm:grid-cols-2 lg:auto-rows-[15rem] lg:grid-cols-12"
          variants={containerVariants}
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, amount: 0.15 }}
        >
            {imageItems.map((item) => (
              <motion.button
                type="button"
                key={item.id}
                variants={itemVariants}
                className={cn(
                  "group relative min-h-[14rem] overflow-hidden rounded-[1.4rem] border border-ivory/10 bg-ivory/5 text-left shadow-[0_20px_60px_rgba(0,0,0,0.18)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brass",
                  item.span
                )}
                whileHover={{ y: -3 }}
                transition={{ type: "spring", stiffness: 300, damping: 20 }}
                onClick={() => setSelectedItem(item)}
                aria-label={`View ${item.title}`}
              >
                <img
                  src={item.url}
                  alt={item.title}
                  className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                />
                <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/25 via-transparent to-white/5 opacity-70" />
              </motion.button>
            ))}
        </motion.div>
      </div>

      <AnimatePresence>
        {selectedItem && (
          <ImageModal item={selectedItem} onClose={() => setSelectedItem(null)} />
        )}
      </AnimatePresence>
    </section>
  );
};

export default InteractiveImageBentoGallery;
