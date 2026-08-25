import "server-only";
import { z } from "zod";

const schema = z.object({
  TALK_BASE_URL: z
    .string()
    .trim()
    .url()
    .refine((valor) => valor.startsWith("https://") || valor.startsWith("http://"))
    .transform((valor) => valor.replace(/\/$/, "")),
  MAVO_METRICS_TOKEN: z.string().trim().min(1),
  SESSION_COOKIE_NAME: z.string().trim().min(1).default("mavo_gerenciamento"),
});

type Ambiente = {
  talkBaseUrl: string;
  metricsToken: string;
  cookieName: string;
};

let ambienteMemoizado: Ambiente | Error | undefined;

function carregarAmbiente(): Ambiente {
  if (ambienteMemoizado instanceof Error) throw ambienteMemoizado;
  if (ambienteMemoizado) return ambienteMemoizado;

  const resultado = schema.safeParse({
    TALK_BASE_URL: process.env.TALK_BASE_URL,
    MAVO_METRICS_TOKEN: process.env.MAVO_METRICS_TOKEN,
    SESSION_COOKIE_NAME: process.env.SESSION_COOKIE_NAME || undefined,
  });
  if (!resultado.success) {
    const nomes = [...new Set(resultado.error.issues.map((item) => String(item.path[0])))];
    ambienteMemoizado = new Error(`Variáveis de ambiente inválidas ou ausentes: ${nomes.join(", ")}`);
    throw ambienteMemoizado;
  }

  ambienteMemoizado = {
    talkBaseUrl: resultado.data.TALK_BASE_URL,
    metricsToken: resultado.data.MAVO_METRICS_TOKEN,
    cookieName: resultado.data.SESSION_COOKIE_NAME,
  };
  return ambienteMemoizado;
}

export const env = {
  get talkBaseUrl() {
    return carregarAmbiente().talkBaseUrl;
  },
  get metricsToken() {
    return carregarAmbiente().metricsToken;
  },
  get cookieName() {
    return carregarAmbiente().cookieName;
  },
};
