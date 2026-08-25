import test from "node:test";
import assert from "node:assert/strict";
import {
  formatarDuracao,
  formatarDecimal,
  formatarNumero,
  formatarPorcentagem,
  formatarVariacao,
} from "../lib/formato";

test("duracao vira minuto e hora legiveis", () => {
  assert.equal(formatarDuracao(45), "45s");
  assert.equal(formatarDuracao(240), "4min");
  assert.equal(formatarDuracao(5400), "1h30");
  assert.equal(formatarDuracao(null), "—");
});

test("duracao faz o carry de sessenta minutos", () => {
  assert.equal(formatarDuracao(3599), "1h");
  assert.equal(formatarDuracao(7170), "2h");
  assert.equal(formatarDuracao(-1), "—");
});

test("porcentagem arredonda e trata ausencia", () => {
  assert.equal(formatarPorcentagem(0.8734), "87%");
  assert.equal(formatarPorcentagem(null), "—");
});

test("numero usa separador brasileiro", () => {
  assert.equal(formatarNumero(1234), "1.234");
  assert.equal(formatarDecimal(4.56), "4,6");
  assert.equal(formatarDecimal(null), "—");
});

test("variacao contra zero nao vira infinito", () => {
  assert.equal(formatarVariacao(5, 0).sentido, "alta");
  assert.doesNotMatch(formatarVariacao(5, 0).texto, /Infinity|NaN/);
  assert.equal(formatarVariacao(0, 0).sentido, "estavel");
});

test("variacao de queda e marcada como baixa", () => {
  const variacao = formatarVariacao(8, 10);
  assert.equal(variacao.sentido, "baixa");
  assert.match(variacao.texto, /20%/);
});
