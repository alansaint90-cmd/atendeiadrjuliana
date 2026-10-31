import test from "node:test";
import assert from "node:assert/strict";
import { ordenarVagasParaOferta } from "../src/lib/consultas/calendario";
test("oferta prioriza datas próximas e horários finais sem modificar as vagas", () => {
 const vagas = [
  {id:"cedo",inicio:"2026-11-05T11:00:00Z"},
  {id:"depois",inicio:"2026-11-12T14:20:00Z"},
  {id:"tarde",inicio:"2026-11-05T14:20:00Z"},
  {id:"meio",inicio:"2026-11-05T13:00:00Z"},
 ];
 assert.deepEqual(ordenarVagasParaOferta(vagas).map(v=>v.id),["tarde","meio","cedo","depois"]);
 assert.equal(vagas[0].id,"cedo");
 assert.deepEqual(ordenarVagasParaOferta([]),[]);
});
