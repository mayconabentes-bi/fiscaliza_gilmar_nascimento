import { validateEvidenceObjectPath } from "../src/server/evidenceStorage.js";

function expect(condition: unknown, message: string) {
  if (!condition) throw new Error(message);
}

for (const valid of [
  "demanda-1/foto.jpg",
  "a/b/c.webp",
  "uuid/arquivo.png",
]) {
  expect(validateEvidenceObjectPath(valid) === valid, `Caminho válido rejeitado: ${valid}`);
}

for (const invalid of [
  "",
  "/absoluto.jpg",
  "../segredo.jpg",
  "a/../segredo.jpg",
  "a/./foto.jpg",
  "a//foto.jpg",
  "a\\foto.jpg",
]) {
  let rejected = false;
  try {
    validateEvidenceObjectPath(invalid);
  } catch {
    rejected = true;
  }
  expect(rejected, `Caminho inseguro deveria ser recusado: ${invalid}`);
}

console.log("T3 evidence integrity runtime: ok");
