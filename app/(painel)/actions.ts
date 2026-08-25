"use server";

import { redirect } from "next/navigation";
import { encerrarSessao } from "@/lib/sessao";

export async function sair(): Promise<never> {
  await encerrarSessao();
  redirect("/login");
}
