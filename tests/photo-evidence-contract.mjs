import fs from "node:fs";

const expect = (condition, message) => { if (!condition) throw new Error(message); };
const form = fs.readFileSync("src/pages/NovaDemanda.tsx", "utf8");
const image = fs.readFileSync("src/lib/mobileImage.ts", "utf8");
const demand = fs.readFileSync("src/server/citizenDemandPostgres.ts", "utf8");
const admin = fs.readFileSync("src/server/privateAdminPostgresRoutes.ts", "utf8");
const migration = fs.readFileSync("supabase/migrations/20260918110000_demand_multi_evidence.sql", "utf8");
const app = fs.readFileSync("src/server/app.ts", "utf8");
const packageJson = fs.readFileSync("package.json", "utf8");

expect(form.includes("const MAX_PHOTOS = 7"), "Formulário deve limitar a 7 fotos.");
expect(form.includes('capture="environment"') && form.includes("multiple"), "Câmera e galeria devem possuir seletores independentes.");
expect(form.includes('name="camera_photo"') && form.includes('name="gallery_photos"'), "Câmera e galeria devem ter inputs nativos identificáveis.");
expect(form.includes('absolute inset-0 z-10 h-full w-full cursor-pointer opacity-0'), "O input file real deve cobrir toda a área clicável no mobile.");
expect(!form.includes('type="file" accept="image/*" capture="environment" onChange={handleCameraPhoto} disabled={photoBusy') && !form.includes('className="sr-only" />'), "Seletores de foto não devem depender de input sr-only acionado indiretamente.");
expect(form.includes("handleCameraPhoto") && form.includes("handleGalleryPhotos"), "Fluxos de câmera e galeria devem ser independentes.");
expect(form.includes("foto_evidencias_base64: photos.map"), "Payload deve enviar a coleção de fotos.");
expect(form.includes("removePhoto"), "Usuário deve conseguir remover foto antes do envio.");
expect(image.includes("createImageBitmap") && image.includes("new Image()") && image.includes("URL.createObjectURL"), "Decodificação deve combinar API moderna e fallback compatível.");
expect(image.includes("MAX_OUTPUT_BYTES = 300 * 1024"), "Cada foto deve ser otimizada para o orçamento serverless.");
expect(image.includes('ascii(bytes, 4, 4) === "ftyp"') && image.includes('bytes[0] === 0xff'), "Formato deve ser identificado pelos bytes reais do arquivo.");
expect(image.includes('import("@discourse/heic")') && packageJson.includes('"@discourse/heic"'), "HEIC/HEIF deve possuir conversão local sob demanda.");
expect(image.includes("armazenamento em nuvem") && image.includes("arquivo está corrompido"), "Falhas devem orientar arquivo incompleto, incompatível ou corrompido.");
expect(form.includes("failedMessages") && form.includes("preparedPhotos.length"), "Lote deve preservar fotos válidas quando outra imagem falhar.");
expect(demand.includes("fotoEvidenciasBase64.length > 7"), "Backend deve rejeitar mais de 7 fotos.");
expect(demand.includes("Promise.allSettled") && demand.includes("public.demanda_evidencias"), "Backend deve persistir múltiplas evidências e limpar uploads parciais.");
expect(admin.includes("/api/admin/demandas/:id/evidencias"), "Admin deve listar todas as fotos da demanda.");
expect(migration.includes("ordem between 1 and 7") && migration.includes("enable row level security"), "Migration deve limitar 7 fotos e manter RLS.");
expect(app.includes('express.json({ limit: "4mb" })'), "API deve aceitar payload otimizado de até 7 fotos.");
expect(app.includes("'wasm-unsafe-eval'"), "CSP deve permitir somente a compilação WebAssembly exigida pelo conversor HEIC local.");

console.log("photo-evidence-contract: ok");
