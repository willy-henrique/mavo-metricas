"use client";

import Link from "next/link";
import { useActionState } from "react";
import {
  solicitarRecuperacao,
  type EstadoPedidoRecuperacao,
} from "./actions";
import styles from "../login/login.module.css";

const inicial: EstadoPedidoRecuperacao = { estado: "inicial", erro: null };

export function FormularioRecuperacao() {
  const [estado, acao, pendente] = useActionState(solicitarRecuperacao, inicial);

  if (estado.estado === "sucesso") {
    return (
      <div className={styles.sucesso} role="status">
        <span aria-hidden>✓</span>
        <h2>Confira seu WhatsApp</h2>
        <p>
          Se a conta estiver habilitada e tiver um telefone de recuperação, enviaremos um link
          válido por 30 minutos.
        </p>
        <div className={styles.acoesConta}>
          <Link href="/login">Voltar para entrar</Link>
          <button className={styles.acaoSecundaria} type="button" onClick={() => window.location.reload()}>
            Fazer outro pedido
          </button>
        </div>
      </div>
    );
  }

  return (
    <form action={acao} className={styles.formulario} noValidate>
      <div className={styles.campo}>
        <label htmlFor="email-recuperacao">E-mail da conta</label>
        <input
          id="email-recuperacao"
          name="email"
          type="email"
          inputMode="email"
          required
          autoComplete="email"
          autoCapitalize="none"
          spellCheck={false}
          placeholder="voce@empresa.com.br"
          aria-describedby={estado.erro ? "erro-recuperacao" : undefined}
        />
      </div>

      {estado.erro ? (
        <p id="erro-recuperacao" className={styles.erro} role="alert">
          {estado.erro}
        </p>
      ) : null}

      <button className={styles.entrar} type="submit" disabled={pendente}>
        {pendente ? <span className={styles.spinner} aria-hidden /> : null}
        {pendente ? "Enviando…" : "Enviar link pelo WhatsApp"}
      </button>
      <Link className={styles.voltar} href="/login">
        <span aria-hidden>←</span> Voltar para o login
      </Link>
    </form>
  );
}
