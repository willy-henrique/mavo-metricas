import { z } from "zod";

export const snapshotAgoraSchema = z.object({
  naFila: z.number().int().nonnegative(),
  emAtendimento: z.number().int().nonnegative(),
  pendenteCliente: z.number().int().nonnegative(),
  esperaMaisLongaSegundos: z.number().nonnegative().finite().nullable(),
  slaEmRisco: z.number().int().nonnegative(),
});

export type SnapshotAgora = z.infer<typeof snapshotAgoraSchema>;
