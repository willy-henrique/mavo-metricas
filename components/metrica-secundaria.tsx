import styles from "./metrica-secundaria.module.css";

export function MetricaSecundaria({
  rotulo,
  valor,
  apoio,
  tom = "padrao",
}: {
  rotulo: string;
  valor: string;
  apoio: string;
  tom?: "padrao" | "positivo" | "alerta";
}) {
  return (
    <article className={styles.card} data-tom={tom}>
      <p>{rotulo}</p>
      <strong className="numero">{valor}</strong>
      <span>{apoio}</span>
    </article>
  );
}
