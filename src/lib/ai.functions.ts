import { createServerFn } from "@tanstack/react-start";
import { generateText, Output } from "ai";
import { z } from "zod";
import { createLovableAiGatewayProvider } from "./ai-gateway";

const MODEL_ID = "google/gemini-3-flash-preview";

function getModel() {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) throw new Error("LOVABLE_API_KEY ausente");
  return createLovableAiGatewayProvider(key)(MODEL_ID);
}

export const gerarLegenda = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z
      .object({
        tema: z.string().min(1).max(500),
        tipo: z.enum(["feed", "story", "carrossel"]).default("feed"),
      })
      .parse(input)
  )
  .handler(async ({ data }) => {
    const { text } = await generateText({
      model: getModel(),
      system:
        "Você é um copywriter especialista em Instagram brasileiro. Gere legendas curtas, envolventes, com tom autêntico e CTA suave. Use no máximo 1-2 emojis bem colocados. Não use hashtags na legenda. Português do Brasil. Máximo 400 caracteres.",
      prompt: `Tema: ${data.tema}\nTipo de post: ${data.tipo}\n\nGere APENAS o texto da legenda, sem aspas, sem títulos, sem explicações.`,
    });
    return { legenda: text.trim().replace(/^["']|["']$/g, "") };
  });

export const gerarHashtags = createServerFn({ method: "POST" })
  .inputValidator((input: unknown) =>
    z.object({ contexto: z.string().min(1).max(2500) }).parse(input)
  )
  .handler(async ({ data }) => {
    const { experimental_output } = await generateText({
      model: getModel(),
      experimental_output: Output.object({
        schema: z.object({
          hashtags: z.array(z.string().regex(/^#?\w+$/)).min(8).max(20),
        }),
      }),
      system:
        "Você é especialista em SEO no Instagram brasileiro. Gere hashtags relevantes em português, mix de nicho e amplas, sem espaços ou caracteres especiais. NÃO use #ad #fy #foryou genéricas demais.",
      prompt: `Contexto do post:\n${data.contexto}\n\nGere de 10 a 15 hashtags relevantes.`,
    });
    const hashtags = experimental_output.hashtags
      .map((h) => (h.startsWith("#") ? h : `#${h}`))
      .join(" ");
    return { hashtags };
  });
