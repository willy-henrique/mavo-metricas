import styles from "./painel.module.css";

export default function CarregandoPainel() {
  return (
    <div className={styles.conteudo}>
      <section className={styles.carregando} aria-live="polite" aria-busy="true">
        <span className={styles.pulso} aria-hidden />
        <div>
          <p className={styles.sobretitulo}>Carregando dados</p>
          <h1>Abrindo o painel…</h1>
          <p>Consultando as informações mais recentes da sua operação.</p>
        </div>
      </section>
    </div>
  );
}
