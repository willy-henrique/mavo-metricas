"use client";

import { useSyncExternalStore } from "react";
import styles from "./tema-toggle.module.css";

type Tema = "light" | "dark";

function temaAtual(): Tema {
  if (typeof document === "undefined") return "light";
  return document.documentElement.dataset.theme === "dark" ? "dark" : "light";
}

function assinarTema(atualizar: () => void): () => void {
  const observador = new MutationObserver(atualizar);
  observador.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  window.addEventListener("storage", atualizar);
  return () => {
    observador.disconnect();
    window.removeEventListener("storage", atualizar);
  };
}

export function TemaToggle({ flutuante = false }: { flutuante?: boolean }) {
  const tema = useSyncExternalStore(assinarTema, temaAtual, () => "light");

  function alternar() {
    const proximo: Tema = temaAtual() === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = proximo;
    localStorage.setItem("mavo-theme", proximo);
  }

  const escuro = tema === "dark";
  return (
    <button
      className={styles.botao}
      data-flutuante={flutuante || undefined}
      type="button"
      onClick={alternar}
      aria-label={escuro ? "Ativar tema claro" : "Ativar tema escuro"}
      title={escuro ? "Ativar tema claro" : "Ativar tema escuro"}
      aria-pressed={escuro}
    >
      <svg viewBox="0 0 24 24" aria-hidden data-sol={!escuro || undefined}>
        <circle cx="12" cy="12" r="3.7" />
        <path d="M12 2.3v2M12 19.7v2M2.3 12h2M19.7 12h2M5.1 5.1l1.4 1.4M17.5 17.5l1.4 1.4M18.9 5.1l-1.4 1.4M6.5 17.5l-1.4 1.4" />
      </svg>
      <svg viewBox="0 0 24 24" aria-hidden data-lua={escuro || undefined}>
        <path d="M20.2 15.1A8.4 8.4 0 0 1 8.9 3.8 8.5 8.5 0 1 0 20.2 15.1Z" />
      </svg>
      <span className={styles.texto}>{escuro ? "Claro" : "Escuro"}</span>
    </button>
  );
}
