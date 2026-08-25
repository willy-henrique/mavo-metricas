import { z } from "zod";

export const snapshotAgoraSchema = z.object({
  naFila: z.number().int().nonnegative(),
  emAtendimento: z.number().int().nonnegative(),
  pendenteCliente: z.number().int().nonnegative(),
  esperaMaisLongaSegundos: z.number().nonnegative().finite().nullable(),
  slaEmRisco: z.number().int().nonnegative(),
});

export type SnapshotAgora = z.infer<typeof snapshotAgoraSchema>;

const blocoPeriodoSchema = z.object({
  tickets: z.number().int().nonnegative(),
  encerrados: z.number().int().nonnegative(),
  taxaResolucao: z.number().min(0).max(1).nullable(),
  tmeSegundos: z.number().nonnegative().finite().nullable(),
  tmaSegundos: z.number().nonnegative().finite().nullable(),
  slaEstourado: z.number().int().nonnegative(),
  csat: z.number().min(1).max(5).nullable(),
  csatRespostas: z.number().int().nonnegative(),
  mensagensEnviadas: z.number().int().nonnegative(),
  mensagensRecebidas: z.number().int().nonnegative(),
});

export const overviewSchema = z.object({
  atual: blocoPeriodoSchema,
  anterior: blocoPeriodoSchema,
});

export const serieTemporalSchema = z.array(
  z.object({
    instante: z.string().datetime({ offset: true }),
    tickets: z.number().int().nonnegative(),
    mensagens: z.number().int().nonnegative(),
  }),
);

const janelaSchema = z.object({ from: z.string().datetime(), to: z.string().datetime() });

export const metricsMetaSchema = z.object({
  period: janelaSchema,
  comparison: janelaSchema.nullable(),
  timezone: z.string().min(1),
  generatedAt: z.string().datetime(),
  filters: z.record(z.string().nullable()),
});

export const serieMetaSchema = metricsMetaSchema.extend({
  granularity: z.enum(["hour", "day"]),
});

export const opcoesContextoSchema = z.object({
  filas: z.array(
    z.object({ id: z.string().min(1), nome: z.string().min(1), cor: z.string().min(1) }),
  ),
  atendentes: z.array(z.object({ id: z.string().min(1), nome: z.string().min(1) })),
});

export const agentesSchema = z.array(
  z.object({
    id: z.string().min(1),
    nome: z.string().min(1),
    tickets: z.number().int().nonnegative(),
    encerrados: z.number().int().nonnegative(),
    tmeSegundos: z.number().nonnegative().finite().nullable(),
    tmaSegundos: z.number().nonnegative().finite().nullable(),
    csat: z.number().min(1).max(5).nullable(),
    csatRespostas: z.number().int().nonnegative(),
    mensagensEnviadas: z.number().int().nonnegative(),
  }),
);

export const desempenhoBotSchema = z.object({
  conversas: z.number().int().nonnegative(),
  resolvidasSemHumano: z.number().int().nonnegative(),
  transferidas: z.number().int().nonnegative(),
  taxaTransferencia: z.number().min(0).max(1).nullable(),
  opcoesInvalidas: z.number().int().nonnegative(),
  triagemConcluida: z.number().int().nonnegative(),
});

export type BlocoPeriodo = z.infer<typeof blocoPeriodoSchema>;
export type Overview = z.infer<typeof overviewSchema>;
export type BaldeSerie = z.infer<typeof serieTemporalSchema>[number];
export type MetricsMeta = z.infer<typeof metricsMetaSchema>;
export type SerieMeta = z.infer<typeof serieMetaSchema>;
export type OpcoesContexto = z.infer<typeof opcoesContextoSchema>;
export type ProducaoAtendente = z.infer<typeof agentesSchema>[number];
export type DesempenhoBot = z.infer<typeof desempenhoBotSchema>;
