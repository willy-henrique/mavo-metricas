import test from "node:test";
import assert from "node:assert/strict";
import { PERIODOS, periodoDaUrl, urlComFiltro } from "../lib/periodo";

test("a lista de periodos cobre a barra inteira", () => {
  assert.deepEqual(
    PERIODOS.map((periodo) => periodo.chave),
    ["hoje", "ontem", "semana", "mes", "7d", "30d", "90d", "custom"],
  );
});

test("periodo ausente na url vira hoje", () => {
  assert.equal(periodoDaUrl(new URLSearchParams()).chave, "hoje");
});

test("periodo desconhecido na url vira hoje em vez de quebrar", () => {
  assert.equal(periodoDaUrl(new URLSearchParams("periodo=trimestre")).chave, "hoje");
});

test("aplicar filtro preserva os outros parametros", () => {
  const url = urlComFiltro(new URLSearchParams("periodo=30d&fila=abc"), "atendente", "xyz");
  assert.match(url, /periodo=30d/);
  assert.match(url, /fila=abc/);
  assert.match(url, /atendente=xyz/);
});

test("filtro nulo some da url em vez de virar vazio", () => {
  const url = urlComFiltro(new URLSearchParams("periodo=30d&fila=abc"), "fila", null);
  assert.doesNotMatch(url, /fila=/);
});

test("periodo custom preserva os limites informados", () => {
  assert.deepEqual(periodoDaUrl(new URLSearchParams("periodo=custom&from=2026-08-01&to=2026-09-01")), {
    chave: "custom",
    from: "2026-08-01",
    to: "2026-09-01",
  });
});
