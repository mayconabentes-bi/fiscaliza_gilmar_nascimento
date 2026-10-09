# Backup externo de PostgreSQL — FISCALIZE

## Estado

Procedimento **preparado, não executado em produção**. O backup SQLite que já existe é exclusivo de desenvolvimento e **não protege** o banco Supabase Postgres. O Supabase Free não oferece os backups automáticos de projeto exibidos no Dashboard.

Este novo fluxo faz `pg_dump` somente de leitura dos schemas `public` e `private` do projeto de produção `jnlfmiwczpglojqytrbw`, transmitindo diretamente para criptografia **age**. Nunca grava dump descriptografado em disco. O backup contém dados sensíveis: guardar fora da pasta do repositório em mídia de acesso restrito e manter a chave privada age separada. Não envia conteúdo para GitHub, CI ou serviços terceiros.

## Diagnóstico Windows — antes de configurar credenciais

O script `scripts/backup_preflight_windows.ps1` foi criado para execução no computador do operador. Ele é estritamente local, **não lê** `PG_BACKUP_URL`, `AGE_RECIPIENT`, chaves privadas ou senhas, e **não** instala software, cria arquivos, consulta banco ou executa backup. Os testes funcionais incluem execução sem segredos no runner Windows da CI.

No PowerShell na raiz do repositório, baixe o arquivo da branch revisada e execute:

```powershell
# Baixe a versão fixada por commit; atualize o SHA conforme o PR #98.
Invoke-WebRequest -Uri "https://raw.githubusercontent.com/mayconabentes-bi/fiscaliza_gilmar_nascimento/c24f8a6f55eaeb6e8debae0cc4113f962fa2697c/scripts/backup_preflight_windows.ps1" -OutFile ".\scripts\backup_preflight_windows.ps1"
powershell.exe -NoProfile -NonInteractive -File ".\scripts\backup_preflight_windows.ps1"
```

O primeiro diagnóstico apresenta `BACKUP_PYTHON`, `BACKUP_PG_DUMP_17`, `BACKUP_AGE`, `BACKUP_AGE_KEYGEN` e `BACKUP_DESTINO`. Se o destino ainda não estiver definido, `BACKUP_DESTINO=NAO_CONFIGURADO` e `BACKUP_PREFLIGHT=PENDENTE` são resultados normais. **Não escolha pasta dentro do GitHub/repositório**; quando existir uma pasta protegida fora dele, utilize:

```powershell
powershell.exe -NoProfile -NonInteractive -File ".\scripts\backup_preflight_windows.ps1" -BackupDir "E:\FiscalizeBackups\Postgres"
```

A segunda chamada só verifica a existência do destino e pelo menos 1 GiB livre, **não** confirma que o volume é externo, criptografado ou possui permissões restritas. O operador deve comprovar esses controles separadamente. Compartilhar com a equipe apenas linhas `BACKUP_*`, nunca variáveis `PG_*` ou chaves.

## Ferramenta instalada mas bloqueada pelo Windows

O Windows pode localizar `age.exe` e `age-keygen.exe` pelo PATH, mas impedir a execução devido a App Control / Smart App Control / AppLocker. O diagnóstico **exige executar `--version`** e deve retornar `EXECUCAO_BLOQUEADA_OU_FALHOU` ou `EXECUCAO_FALHOU` quando não puder abrir o executável. Não prosseguir com backup enquanto não estiver `BACKUP_AGE=OK` **e** `BACKUP_AGE_KEYGEN=OK`.

Consultar *Visualizador de Eventos > Logs de Aplicativos e Serviços > Microsoft > Windows > CodeIntegrity > Operational* (bloqueios de executáveis ID 3077) ou *AppLocker > EXE and DLL* (ID 8004). Solicitar ao administrador autorizado análise e, quando justificável, política de permissão para o binário oficial, após verificar origem e assinatura/hash. **Não** desabilitar proteção, alterar política, mover o executável para contornar regras ou renomear o arquivo.

Referência: https://learn.microsoft.com/en-us/windows/security/application-security/application-control/app-control-for-business/operations/event-id-explanations

## Preparar no Windows (PowerShell)

1. Instalar PostgreSQL **client 17** (`pg_dump --version`), Python 3 e ferramenta `age` (`age --version`). Utilizar binários oficiais; não instalar por scripts de terceiros não auditados.
2. Criar uma pasta privada de backup em disco externo ou outro destino fora do repositório, com permissões restritas ao operador (ex.: `E:\FiscalizeBackups\Postgres`).
3. Gerar **offline** um par de chaves age (`age-keygen -o <ARQUIVO_PRIVADO>`); manter a chave privada em mídia segura diferente do backup. Usar apenas a **chave pública** age1... como `AGE_RECIPIENT`.
4. Obter do Supabase Dashboard da produção o **Session Pooler** na porta **5432** (não usar Transaction Pooler 6543). Guardar a URL/credenciais como variável de ambiente local `PG_BACKUP_URL` sem copiar para chat, GitHub, comando shell com o segredo em texto ou log. `PG_BACKUP_URL` deve corresponder ao projeto `jnlfmiwczpglojqytrbw`. Forçar TLS; para validação de certificado configure `PGSSLROOTCERT` com certificado CA confiável.
5. Definir `AGE_RECIPIENT` para a chave pública e `BACKUP_OUTPUT_DIR` para pasta externa. Exemplo com **valores fictícios**, não copiar credenciais:
   ```powershell
   $env:BACKUP_OUTPUT_DIR = 'E:\FiscalizeBackups\Postgres'
   $env:AGE_RECIPIENT = '<CHAVE_PUBLICA_AGE>'
   # Configure PG_BACKUP_URL localmente, sem imprimir seu conteúdo.
   python scripts/backup_postgres_encrypted.py
   ```
   O comando anterior realiza apenas preflight. Retorno esperado: `BACKUP_GUARD=OK` e `BACKUP_MODE=DRY_RUN_NO_DATABASE_ACCESS`.
6. Somente quando a identidade de produção, ferramentas e mídia segura estiverem confirmadas, executar `python scripts/backup_postgres_encrypted.py --execute`. O comando lê PostgreSQL produção, criptografa em trânsito local e gera o arquivo `.dump.age` e manifesto `.manifest.json` com SHA256 do *arquivo criptografado*. Ele **não restaura** nem altera linhas. Não enviar backup ou manifesto para GitHub.
7. Conferir manifesto, tamanho e hash do arquivo cifrado. Fazer teste de descriptografia e `pg_restore` **em PostgreSQL 17 local/isolado e vazio**, com banco sem acesso à produção. O backup ainda não será considerado recuperável antes desse teste; `pg_restore --list` sozinho não comprova restauração.
8. Configurar rotação e alerta de falhas **apenas após a primeira restauração validada**. Não apagar cópias antigas sem política formal aprovada, nem deixar cópias cifradas apenas no mesmo disco do computador.

## Limites e cuidados

- Cópia focada nos schemas **public/private**; objetos/roles gerenciados do Supabase e instâncias de Auth precisam ser verificados separadamente. O processo não cobre todos os componentes para reconstruir um projeto Supabase inteiro.
- **Supabase Storage**: os arquivos binários de evidências/fotos não estão incluídos no `pg_dump`. É necessária cópia segura e restaurável dos objetos privados e verificação de integridade separada.
- Backup criptografado exige duas coisas: **artefato e chave privada de descriptografia**. Se qualquer um for perdido, a recuperação pode falhar.
- A operação `pg_dump` consome recursos e pode produzir pico de carga; evitar horários críticos e monitorar.
- Confirmar restauração isolada, permissões, RLS, índices, integridade e contagens antes de declarar GO para produção.
- Não é recomendável automatizar no GitHub Actions com credenciais pessoais de banco enquanto o armazenamento seguro dos backups não estiver formalmente preparado.

## Critério GO/NO-GO

Até existir cópia cifrada externa com manifesto verificado, chave privada recuperável, restauração isolada testada e estratégia das evidências Storage, **NO-GO para merge que provoque deploy automático**.

Referência: https://supabase.com/docs/guides/platform/migrating-to-supabase/postgres (pg_dump/restore com Session Pooler) e https://docs.railway.com/deployments/github-autodeploys (desativar deploy automático antes do merge).
