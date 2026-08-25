import { formatarNumero, formatarPorcentagem } from "@/lib/formato";
import type { DesempenhoBot } from "@/lib/metricas";
import styles from "./funil-bot.module.css";

function fracao(valor: number, total: number): number | null {
  return total > 0 ? valor / total : null;
}

function largura(valor: number, total: number): string {
  if (total === 0 || valor === 0) return "0%";
  return `${Math.max(4, Math.min(100, (valor / total) * 100))}%`;
}

export function FunilBot({ dados }: { dados: DesempenhoBot }) {
  const autonomia = fracao(dados.resolvidasSemHumano, dados.conversas);
  const triagem = fracao(dados.triagemConcluida, dados.conversas);
  const descricao = `${formatarNumero(dados.conversas)} conversas recebidas; ${formatarNumero(dados.triagemConcluida)} com triagem concluída; ${formatarNumero(dados.resolvidasSemHumano)} resolvidas sem humano; ${formatarNumero(dados.transferidas)} transferidas para atendimento humano.`;

  return (
    <div className={styles.grade}>
      <section className={styles.impacto} aria-labelledby="titulo-impacto-bot">
        <div>
          <p>Impacto do automático</p>
          <h2 id="titulo-impacto-bot">Conversas poupadas da equipe</h2>
        </div>
        <strong className="numero">{formatarNumero(dados.resolvidasSemHumano)}</strong>
        <span>{formatarPorcentagem(autonomia)} das conversas foram resolvidas sem uma pessoa assumir</span>
        <div className={styles.selo}>
          <span aria-hidden>↗</span>
          Autonomia medida no período
        </div>
      </section>

      <section className={styles.funil} role="img" aria-label={descricao}>
        <header>
          <div>
            <p>Jornada do atendimento</p>
            <h2>Do contato ao destino</h2>
          </div>
          <span>Os destinos são medidos separadamente</span>
        </header>

        <div className={styles.etapas}>
          <Etapa
            rotulo="Recebidas"
            valor={dados.conversas}
            porcentagem={dados.conversas > 0 ? "100%" : "—"}
            largura="100%"
          />
          <Etapa
            rotulo="Triagem concluída"
            valor={dados.triagemConcluida}
            porcentagem={formatarPorcentagem(triagem)}
            largura={largura(dados.triagemConcluida, dados.conversas)}
          />
        </div>

        <div className={styles.destinos}>
          <Destino
            rotulo="Resolvidas sem humano"
            valor={dados.resolvidasSemHumano}
            porcentagem={formatarPorcentagem(autonomia)}
            tom="automatico"
          />
          <Destino
            rotulo="Transferidas"
            valor={dados.transferidas}
            porcentagem={formatarPorcentagem(dados.taxaTransferencia)}
            tom="humano"
          />
        </div>

        <div className={styles.tentativas}>
          <span>Opções inválidas no menu</span>
          <strong className="numero">{formatarNumero(dados.opcoesInvalidas)}</strong>
          <small>tentativas que o bot precisou recuperar</small>
        </div>
      </section>
    </div>
  );
}

function Etapa({
  rotulo,
  valor,
  porcentagem,
  largura: larguraBarra,
}: {
  rotulo: string;
  valor: number;
  porcentagem: string;
  largura: string;
}) {
  return (
    <div className={styles.etapa}>
      <div>
        <span>{rotulo}</span>
        <strong className="numero">{formatarNumero(valor)}</strong>
        <small>{porcentagem}</small>
      </div>
      <div className={styles.trilho} aria-hidden>
        <span style={{ width: larguraBarra }} />
      </div>
    </div>
  );
}

function Destino({
  rotulo,
  valor,
  porcentagem,
  tom,
}: {
  rotulo: string;
  valor: number;
  porcentagem: string;
  tom: "automatico" | "humano";
}) {
  return (
    <div className={styles.destino} data-tom={tom}>
      <span>{rotulo}</span>
      <strong className="numero">{formatarNumero(valor)}</strong>
      <small>{porcentagem} das recebidas</small>
    </div>
  );
}
