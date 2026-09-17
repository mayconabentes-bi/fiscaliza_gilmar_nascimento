# FISCALIZE — manifesto do pacote de publicação controlada

Pacote validado para aplicação atômica na branch `feat/ethical-engagement-progress`.

## Pré-condições remotas

- PR #30 head esperado antes do push: `7e880a58f760444b6529e391d017b5213b47a616`
- `main` esperada: `447895345517d22ca5dfb98867a115e60ea5d5c2`
- árvore-base Git: `18d3b4b3a81f25417889699e96343162ec90b537`

## Arquivos do commit

- `.gitignore` — SHA-256 `2fcdf8515b4d5bbf88f05be7caca5b75f561fd2461eed9d2d8855f213d8c990e` — Git blob `30bd57028627756ed1f8e3fe81ffa6955076f68f`
- `.github/workflows/ci.yml` — SHA-256 `026551daa3d334ef5b5828dbd3bc33052e2382c0c6bdd5f405ce2e11bae5caaf` — Git blob `218eb131472271c8db1130b9c8059019aa056fdf`
- `.github/workflows/visual-qa.yml` — SHA-256 `869ad5795627f60c0484958eb752e8b345be2006b5ae5741f1b587a95cdcdf89` — Git blob `ba2abd471f6f31694ad15e830246da3a0fc218b1`
- `playwright.visual.config.ts` — SHA-256 `5d6f8cd21b161a3cd462bb399e3737e3cc9f05dd5df66cacbcfed0860ac6afdd` — Git blob `e7eb015b544977159793e7a7a1ec7fe8e394613a`
- `src/lib/safeDemandDraft.ts` — SHA-256 `9a8cbb3cc1e65d19fb678c61bf8b3c74f02dc24354d87d1cf211b93c8d84acec` — Git blob `844c530cd87a53d546ff36186da2004b7da7a502`
- `src/pages/Home.tsx` — SHA-256 `b2718adc72f3eb36fbde21d0bfef2c79bbc9ee80b011bdabf3a309c1e8abcd42` — Git blob `ac645a93ca48b2f767df29d7181b22a23d8fbf7c`
- `src/pages/NovaDemanda.tsx` — SHA-256 `b33ac16228a721e649aaa730f25250aba2a343c985ad62ad222a7dc71dcd9c98` — Git blob `17784b9466c34ba3c8bde11b95e51cc1c10dc883`
- `src/pages/ConsultaProtocolo.tsx` — SHA-256 `82b7516b8d3b4d44f23aaa5427d7ce2b009202dc5789217f288637f9ec371909` — Git blob `95119a548739124a0e6b978e04a22acd5dcbf245`
- `tests/home-refinement-contract.mjs` — SHA-256 `be50e0a5cbf2c298da79d2514d39944ad812d6d3b91485841c5aa437a24f3e59` — Git blob `a42a1338c821007d547727c0716fe1dc530ace73`
- `tests/protocol-followup-contract.mjs` — SHA-256 `4e8377357809a31d448a8dd60a60a1b1c5f7bdc8203dcee98b6368224e7656c1` — Git blob `d81be3ab4dbde820a7cbbc2835e4b918c493fbee`
- `tests/safe-draft-contract.mjs` — SHA-256 `63b8d0f4a6a94848dc3bfb49f0d1ea13f79db884b5478286965bdfe8402449b6` — Git blob `b196a90e921569f16d7ff963d620d026f7909515`
- `tests/visual-qa-contract.mjs` — SHA-256 `46b118cc80d182a8c134dc0822798035efd1e94c816fe5302ac43d9f3cc5b41b` — Git blob `ac9b1936e836682ecf400b792854ac1af37f3df4`
- `tests/visual/public-journey.visual.spec.ts` — SHA-256 `3c753d14cf48600f84d31619410a179d01a9db38c7043c18459687d621a23d73` — Git blob `1fcb8d9a806f159b240a3079d370cef200206607`
- `docs/visual-qa-matrix.md` — SHA-256 `5410532dcddffba1edb5d4b3ff79f522aa3705a225c95541bc2f096c42d2fa2b` — Git blob `7915426d0513edc502f16e872528f16eb896c236`

## Guardrails

- `package.json` e `package-lock.json` permanecem inalterados.
- nenhum novo campo de backend, banco ou autenticação é introduzido.
- o rascunho local persiste somente bairro/localidade e categoria, por até 6 horas e mediante ação explícita.
- a consulta de protocolo deriva orientação apenas dos estados reais e do histórico retornado pela API.
- o QA visual instala Playwright apenas no job dedicado e publica screenshots como artefato.
- nenhum objeto Git temporário/corrompido criado durante a preparação é referenciado pela árvore final.

## Gate de publicação

1. Confirmar novamente que o head do PR ainda é `7e880a58...`.
2. Criar uma única árvore e um único commit a partir desse head.
3. Atualizar o ref da branch uma única vez.
4. Aguardar CI principal, Visual QA e Preview Vercel antes de qualquer merge em `main`.
