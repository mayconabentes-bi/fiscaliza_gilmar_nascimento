# FISCALIZE — Backup local criptografado no Windows 11

**Objetivo:** cópia somente de leitura do banco PostgreSQL do projeto de PRODUÇÃO e de todos os objetos do bucket privado de evidências, armazenada **criptografada no seu próprio computador**, sem contratar Supabase Pro, S3 nem Cloudflare R2.

**Estado:** a rotina só é instalada no Windows do operador. Não rodou no PC nem fez backup real antes das etapas abaixo. Esta rotina não migra dados, não escreve no Supabase, não desativa o serviço e não apaga registros de produção.

**Atenção:** a única cópia no mesmo computador não protege contra defeito do disco, incêndio, furto ou ransomware. Proteja o disco com BitLocker, mantenha a senha restic fora do PC e, assim que possível, faça segunda cópia criptografada em HD externo desconectado.

## 1 — Pré-requisitos, somente no seu PC

- Windows 11 atualizado; Windows PowerShell 5.1 (já incluído).
- Instale Node.js LTS: https://nodejs.org/en/download ou no PowerShell: winget install -e --id OpenJS.NodeJS.LTS.
- Instale restic: winget install -e --id restic.restic. Guia oficial: https://restic.readthedocs.io/en/stable/020_installation.html
- Instale os utilitários PostgreSQL pg_dump.exe **da versão igual ou mais recente que a versão do PostgreSQL remoto**, incluindo pg_restore.exe, via https://www.postgresql.org/download/windows/. Não é necessário instalar outro serviço de banco no seu computador para exportar. Adicione a pasta bin (por exemplo C:\Program Files\PostgreSQL\17\bin) ao PATH do usuário. Se o servidor for mais novo que 17, instale a versão correspondente.
- Feche e abra novamente o PowerShell após as instalações.

**Não instale software de fontes aleatórias.**

## 2 — Baixar o kit sem publicar segredos

Baixe o ZIP da branch do PR de backup Windows, extraia o repositório para uma pasta local e abra o PowerShell nessa pasta scripts\backups. Os três arquivos necessários permanecem juntos:

- Fiscalize-Backup.ps1
- export-supabase-storage.mjs
- export-supabase-storage.test.mjs (somente testes)

Depois da revisão/merge, baixe a versão aprovada de main. Até lá, use exclusivamente o ZIP do PR, que ainda não foi incluído em produção.

Para executar no PowerShell, substitua CAMINHO pela pasta extraída e use:

~~~powershell
cd "CAMINHO\scripts\backups"
powershell.exe -NoProfile -ExecutionPolicy Bypass -File ".\Fiscalize-Backup.ps1" -Action Doctor
~~~

Doctor **não precisa de senha** e informa quais programas faltam.

## 3 — Configuração interativa (uma vez)

Na interface Supabase do projeto CiviTech_Proj_Manaus (ID: jnlfmiwczpglojqytrbw):
1. Abra **Connect** e obtenha HOST e USUÁRIO PostgreSQL. Use preferencialmente Session Pooler na porta 5432. Não use Transaction Pooler na porta 6543. Use sempre o ambiente de produção correto.
2. Em **Storage**, copie o nome **exato** do bucket privado de fotografias (o kit falha se ele estiver público).
3. No painel de credenciais Supabase, tenha em mãos a senha PostgreSQL e a chave **service_role**. Não copie essas senhas para arquivos .env, e-mail, GitHub, esta conversa ou histórico do terminal.

No PowerShell aberto na pasta scripts\backups:

~~~powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File ".\Fiscalize-Backup.ps1" -Action Setup
~~~

Responda aos prompts no computador. A senha do banco, a chave de Storage e a senha restic são entradas ocultas, armazenadas com **DPAPI no perfil do mesmo usuário Windows**. A senha restic deve ter pelo menos 20 caracteres e deve ser guardada **fora do computador**; sem ela não há recuperação. Por padrão, os arquivos criptografados ficam em C:\Users\SEU_USUARIO\FISCALIZE-Backups\repository. Os arquivos temporários não criptografados, enquanto a rotina executa, ficam em %LOCALAPPDATA%\FiscalizeBackup\scratch, com controle de acesso limitado ao usuário e SYSTEM; são removidos ao final, mas desligamento forçado pode deixar temporários (nesse caso, elimine-os após investigar). Proteja o disco com BitLocker.

Use sempre o mesmo usuário Windows, inclusive para o agendamento: DPAPI não consegue decifrar segredos se a execução ocorrer sob outro usuário.

## 4 — Primeiro backup manual

~~~powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File ".\Fiscalize-Backup.ps1" -Action Backup
~~~

A rotina usa pg_dump/pg_restore sobre public + private, valida a presença das tabelas de cidadãos/assessores, exporta o bucket privado de evidências com manifesto SHA-256, criptografa o conjunto com restic em repositório local e verifica a integridade do repositório. **Falha em qualquer etapa interrompe a operação, sem afirmar que o backup está íntegro.**

As consultas são somente de leitura no Supabase; pare atividades de migração de schema/remoção em massa durante esse primeiro backup. Banco e Storage são capturados sequencialmente, **não atomicamente**.

## 5 — Ensaiar a recuperação dos arquivos

~~~powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File ".\Fiscalize-Backup.ps1" -Action Verify
~~~

O comando faz restic check --read-data, **restaura o snapshot criptografado para uma pasta temporária isolada do seu PC** e valida as duas tabelas críticas no dump, o hash do banco e os hashes/contagens de todos os objetos Storage. Nenhum dado é restaurado no Supabase de produção.

O resultado esperado é **RESTORE DE ARQUIVOS E HASH: OK**. Isso comprova a recuperabilidade dos arquivos, **não** a restauração integral do PostgreSQL. Para fechar esse último controle, será necessário restaurar o dump em um PostgreSQL/Supabase **isolado** compatível e executar smoke tests. Documentação: https://supabase.com/docs/guides/platform/migrating-within-supabase/backup-restore

Para uma nova instância Supabase, também recriar o bucket privado e suas políticas de acesso, configurar as extensões/roles e aplicar/revisar as migrations de hardening. Este kit copia apenas os schemas da aplicação public/private e os arquivos de evidências; não representa um clone físico de toda infraestrutura Supabase.

## 6 — Agendar diariamente (só depois de Backup e Verify aprovados)

~~~powershell
powershell.exe -NoProfile -ExecutionPolicy Bypass -File ".\Fiscalize-Backup.ps1" -Action Schedule -At "21:00"
~~~

Às 21h **do relógio configurado no Windows**, o Agendador executará o backup com a conta Windows que preparou o kit, desde que esse usuário esteja logado e o computador ligado/acordado. Horários ignorados podem ser executados quando o Windows voltar a ficar disponível; **verifique diariamente o histórico do Agendador e a existência de snapshots**. Não confiar no agendamento como substituto do primeiro backup validado.

O kit **não exclui backups antigos automaticamente** nesta fase. Verifique regularmente o espaço livre. Definir retenção e exclusão só depois de medir volume e comprovar recuperação.

## Critério emergencial de lançamento

- [ ] Doctor sem pendências.
- [ ] Setup concluído e senha restic guardada separadamente.
- [ ] Backup manual sem erro, snapshot do restic visível no computador.
- [ ] Verify mostra RESTORE DE ARQUIVOS E HASH: OK.
- [ ] Restaurar o dump em banco **não produtivo** e testar login/consulta, como exercício posterior obrigatório para afirmar recuperação integral.
- [ ] Monitorar espaço livre, status dos backups e cópia secundária em outro dispositivo para reduzir risco de perda física.

**O lançamento de 300 cidadãos + 50 assessores ainda depende de ensaio de carga, verificação móvel e decisão explícita de risco operacional.** Não confundir o backup no mesmo PC com estratégia offsite. A automação agendada depende do seu equipamento e sua presença no Windows; nunca roda nos nossos servidores.
