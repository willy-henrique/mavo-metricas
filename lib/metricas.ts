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

export const metricasFilasSchema = z.array(
  z.object({
    id: z.string().min(1),
    nome: z.string().min(1),
    cor: z.string().regex(/^#[0-9a-f]{6}$/i),
    tickets: z.number().int().nonnegative(),
    tmeSegundos: z.number().nonnegative().finite().nullable(),
    slaEstourado: z.number().int().nonnegative(),
  }),
);

export const linhaRelatorioTicketSchema = z.object({
  id: z.string().min(1),
  criadoEm: z.string().datetime(),
  encerradoEm: z.string().datetime().nullable(),
  contatoNome: z.string().min(1),
  contatoTelefone: z.string().min(1),
  fila: z.string().min(1),
  atendente: z.string().min(1),
  status: z.string().min(1),
  motivoEncerramento: z.string().nullable(),
  tmeSegundos: z.number().nonnegative().finite().nullable(),
  tmaSegundos: z.number().nonnegative().finite().nullable(),
  slaEstourado: z.boolean(),
  csat: z.number().min(1).max(5).nullable(),
});

export const relatorioTicketsSchema = z.object({
  linhas: z.array(linhaRelatorioTicketSchema),
  total: z.number().int().min(0).max(5_000),
  proximoCursor: z.string().min(1).max(512).nullable(),
});

export const usuarioGerenciadoSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  email: z.string().email(),
  role: z.enum(["admin", "gestor", "atendente"]),
  isActive: z.boolean(),
  recoveryPhone: z.string().regex(/^[0-9]{10,15}$/).nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  lastLoginAt: z.string().datetime().nullable(),
});

export const usuariosGerenciadosSchema = z.object({
  users: z.array(usuarioGerenciadoSchema),
});

export type BlocoPeriodo = z.infer<typeof blocoPeriodoSchema>;
export type Overview = z.infer<typeof overviewSchema>;
export type BaldeSerie = z.infer<typeof serieTemporalSchema>[number];
export type MetricsMeta = z.infer<typeof metricsMetaSchema>;
export type SerieMeta = z.infer<typeof serieMetaSchema>;
export type OpcoesContexto = z.infer<typeof opcoesContextoSchema>;
export type ProducaoAtendente = z.infer<typeof agentesSchema>[number];
export type DesempenhoBot = z.infer<typeof desempenhoBotSchema>;
export type MetricasFila = z.infer<typeof metricasFilasSchema>[number];
export type LinhaRelatorioTicket = z.infer<typeof linhaRelatorioTicketSchema>;
export type RelatorioTickets = z.infer<typeof relatorioTicketsSchema>;
export type UsuarioGerenciado = z.infer<typeof usuarioGerenciadoSchema>;
