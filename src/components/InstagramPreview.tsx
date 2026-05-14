import { useState } from "react";
import { ChevronLeft, ChevronRight, Heart, MessageCircle, Send, Bookmark, MoreHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";
import type { PostTipo } from "@/lib/supabase";

interface Props {
  tipo: PostTipo;
  images: string[];
  legenda?: string;
  hashtags?: string;
}

export function InstagramPreview({ tipo, images, legenda, hashtags }: Props) {
  const [idx, setIdx] = useState(0);
  const imgs = images.filter(Boolean);
  const current = imgs[idx];

  if (tipo === "story") {
    return (
      <div className="mx-auto" style={{ width: 280 }}>
        <div className="rounded-2xl overflow-hidden bg-black border border-border" style={{ aspectRatio: "9/16" }}>
          {current ? (
            <img src={current} alt="story" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-muted-foreground text-xs">
              Sem imagem
            </div>
          )}
        </div>
        <p className="text-[10px] text-center text-muted-foreground mt-2">Preview Story</p>
      </div>
    );
  }

  return (
    <div className="mx-auto bg-card border border-border rounded-xl overflow-hidden" style={{ maxWidth: 380 }}>
      <div className="flex items-center justify-between px-3 py-2.5">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-full bg-gradient-to-tr from-primary to-pink-500" />
          <span className="text-sm font-medium">platnersystem</span>
        </div>
        <MoreHorizontal className="h-4 w-4" />
      </div>
      <div className="relative bg-black aspect-square">
        {current ? (
          <img src={current} alt="post" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-muted-foreground text-xs">
            Sem imagem
          </div>
        )}
        {tipo === "carrossel" && imgs.length > 1 && (
          <>
            <button
              type="button"
              onClick={() => setIdx((i) => Math.max(0, i - 1))}
              className="absolute left-2 top-1/2 -translate-y-1/2 h-7 w-7 rounded-full bg-black/60 text-white flex items-center justify-center disabled:opacity-30"
              disabled={idx === 0}
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setIdx((i) => Math.min(imgs.length - 1, i + 1))}
              className="absolute right-2 top-1/2 -translate-y-1/2 h-7 w-7 rounded-full bg-black/60 text-white flex items-center justify-center disabled:opacity-30"
              disabled={idx === imgs.length - 1}
            >
              <ChevronRight className="h-4 w-4" />
            </button>
            <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1">
              {imgs.map((_, i) => (
                <span key={i} className={cn("h-1.5 w-1.5 rounded-full", i === idx ? "bg-white" : "bg-white/50")} />
              ))}
            </div>
          </>
        )}
      </div>
      <div className="px-3 py-2.5 space-y-2">
        <div className="flex items-center gap-3">
          <Heart className="h-5 w-5" />
          <MessageCircle className="h-5 w-5" />
          <Send className="h-5 w-5" />
          <Bookmark className="h-5 w-5 ml-auto" />
        </div>
        {(legenda || hashtags) && (
          <p className="text-xs">
            <span className="font-semibold mr-1">platnersystem</span>
            <span className="whitespace-pre-wrap">{legenda}</span>
            {hashtags && <span className="text-info"> {hashtags}</span>}
          </p>
        )}
      </div>
    </div>
  );
}
