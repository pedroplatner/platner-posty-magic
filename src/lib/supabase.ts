import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  throw new Error("Variáveis VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY são obrigatórias");
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    storage: typeof window !== "undefined" ? window.localStorage : undefined,
    storageKey: "platner-ig-auth",
  },
});

export const STORAGE_BUCKET = "posts-imagens";
export const TIMEZONE = "America/Sao_Paulo";

export type PostStatus =
  | "rascunho"
  | "agendado"
  | "processando"
  | "publicado"
  | "erro";
export type PostTipo = "feed" | "story" | "carrossel";

export interface PostInstagram {
  id: string;
  imagem_url: string | null;
  storage_path: string | null;
  legenda: string | null;
  hashtags: string | null;
  data_publicacao: string | null;
  status: PostStatus;
  tipo_post: PostTipo;
  tentativas: number | null;
  max_tentativas: number | null;
  proxima_tentativa_em: string | null;
  instagram_container_id: string | null;
  instagram_media_id: string | null;
  publicado_em: string | null;
  erro_msg: string | null;
  created_at: string;
}

export interface PostMidia {
  id: string;
  post_id: string;
  imagem_url: string;
  storage_path: string;
  ordem: number;
  created_at: string;
}
