import { toast } from "sonner";

export const notify = {
  success: (msg: string, description?: string) => toast.success(msg, { description }),
  error: (msg: string, description?: string) => toast.error(msg, { description }),
  info: (msg: string, description?: string) => toast(msg, { description }),
  /** Shorthand: extract Supabase / Error message and show as error toast. */
  fail: (e: unknown, fallback = "Algo deu errado") => {
    const m = e instanceof Error ? e.message : (e as { message?: string } | null)?.message;
    toast.error(m || fallback);
  },
};
