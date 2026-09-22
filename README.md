# FISCALIZE - VOCÊ CUIDANDO DA CIDADE
Plataforma cívica independente para registrar problemas dos bairros, acompanhar demandas por protocolo e produzir leitura territorial agregada de Manaus.

O projeto é privado, desenvolvido por um cidadão e não representa, integra ou presta acesso administrativo a órgãos públicos, gabinetes ou instituições governamentais.

## Arquitetura de acesso

O FISCALIZE possui dois contextos claramente separados:

- **Experiência pública:** cidadãos podem registrar demandas, acompanhar protocolos e consultar as informações públicas disponibilizadas pela plataforma.
- **Núcleo privado:** somente a conta `ADMIN` criada diretamente no ambiente do projeto pode acessar triagem, Radar Territorial, Estratégia, Governança, Auditoria e Relatórios.

Não existe cadastro público de administrador. Não existe perfil de órgão, gabinete, gestor institucional ou domínio `.gov.br` como requisito de acesso.

## Segurança do núcleo privado

A autorização real é feita no backend. O estado armazenado no navegador serve apenas para apresentação da interface e não concede acesso a dados privados.

O núcleo exige um JWT em cookie HttpOnly contendo:

```text
type=admin
status=ativo
perfil_acesso=ADMIN
```

Visitantes e cidadãos autenticados recebem bloqueio nas APIs privadas. Identidades legadas também são rejeitadas.

Conteúdo estratégico não deve ser incorporado ao bundle público do React. Dados e conteúdo privados são entregues por endpoints protegidos e com política `no-store` quando aplicável.

## Funcionalidades

### Público

- registro de problemas e demandas;
- protocolo imediato;
- acompanhamento do histórico disponível ao cidadão;
- evidência fotográfica e contexto territorial;
- privacidade e consentimento aplicados ao fluxo de coleta.

### Privado — ADMIN

- central de inteligência;
- triagem de demandas;
- Radar Territorial de Manaus;
- núcleo estratégico;
- governança e moderação;
- auditoria de segurança;
- relatórios e exportações privadas.

O Radar pode consumir **fontes públicas de dados** para análise territorial. Isso não cria vínculo, integração administrativa ou representação das entidades que publicam essas bases.

## Tecnologias

- React + TypeScript + Vite;
- Tailwind CSS;
- Express + Node.js;
- PostgreSQL + Supabase Storage em produção;
- SQLite / Better-SQLite3 em desenvolvimento e testes locais;
- Docker + Railway para hospedagem;
- JWT em cookie HttpOnly;
- bcrypt para senhas;
- Helmet, CORS, rate limiting e validações de origem;
- GitHub Actions para typecheck, build, QA mobile, testes de isolamento do ADMIN e auditoria de dependências.

## Desenvolvimento local

Instale as dependências:

```bash
npm ci
```

Crie `.env` a partir de `.env.example` e defina seus próprios segredos. Para o administrador privado, configure:

```text
ADMIN_EMAIL=
ADMIN_PASSWORD=
ADMIN_NAME=
```

A senha administrativa deve ser forte e não deve ser versionada.

Provisione ou atualize a conta privada:

```bash
npm run admin:setup
```

Inicie o projeto:

```bash
npm run dev
```

## Testes principais

```bash
npm run lint
npm run build
npm run test:internal-access
npm run test:smoke
npm run audit:high
```

O contrato `test:internal-access` existe para impedir regressões que permitam acesso ao núcleo privado por cidadão, visitante ou identidade legada.

## Produção (Railway)

A produção roda no Railway como serviço Docker, construído pelo `Dockerfile` da raiz. Banco e evidências ficam no Supabase (PostgreSQL + Storage privado); o disco do container é efêmero e não guarda dados.

- URL pública: https://fiscalizagilmarnascimento-production.up.railway.app
- Verificação de saúde: `/health` (processo) e `/ready` (Postgres, Storage e flags públicas).
- O Railway define `PORT` e `RAILWAY_PUBLIC_DOMAIN`; o domínio gerado já é aceito como origem confiável. Domínios personalizados devem ser incluídos em `APP_ORIGIN` (separados por vírgula, sem barra final).
- Variáveis obrigatórias em produção (o servidor não sobe sem elas): `JWT_SECRET`, `DATABASE_URL`, `APP_ORIGIN`, `DPO_CONTACT_EMAIL`, `LGPD_CONSENT_VERSION`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_EVIDENCE_BUCKET`.
- Se o domínio de produção mudar, atualize também as tags `og:image`/`twitter:image` do `index.html`.

## Independência

O FISCALIZE é uma iniciativa cívica independente. O uso da plataforma não significa apoio a candidatura, partido, governo, órgão público ou instituição.
