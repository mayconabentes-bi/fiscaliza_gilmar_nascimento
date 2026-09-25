#Requires -Version 5.1
<#
  FISCALIZE: backup local criptografado no Windows 11.
  Acoes: Doctor, Setup, Backup, Verify, Schedule.
  Credenciais sao armazenadas APENAS no computador, cifradas com DPAPI do usuario Windows.
#>
[CmdletBinding()]
param(
  [ValidateSet("Doctor","Setup","Backup","Verify","Schedule")] [string]$Action="Doctor",
  [ValidatePattern('^([01][0-9]|2[0-3]):[0-5][0-9]$')] [string]$At="21:00"
)
Set-StrictMode -Version Latest
$ErrorActionPreference="Stop"
$ProjectRef="jnlfmiwczpglojqytrbw"
$SecretsHome=Join-Path $env:LOCALAPPDATA "FiscalizeBackup"
$ConfigFile=Join-Path $SecretsHome "config.json"
$ScratchHome=Join-Path $SecretsHome "scratch"
$Exporter=Join-Path $PSScriptRoot "export-supabase-storage.mjs"
$DefaultHome=Join-Path $env:USERPROFILE "FISCALIZE-Backups"

function Info([string]$s) { Write-Host "[FISCALIZE] $s" }
function MustHave([string]$exe) {
  if (-not (Get-Command $exe -ErrorAction SilentlyContinue)) { throw "Instale $exe e abra outro PowerShell." }
}
function WindowsOnly {
  if ([Environment]::OSVersion.Platform -ne [PlatformID]::Win32NT) { throw "Este script exige Windows com DPAPI." }
}
function PrivateFolder([string]$folder) {
  $null=New-Item -Force -ItemType Directory -Path $folder
  $who=[Security.Principal.WindowsIdentity]::GetCurrent().Name
  & icacls.exe $folder /inheritance:r /grant:r "$($who):(OI)(CI)F" '*S-1-5-18:(OI)(CI)F' | Out-Null
  if ($LASTEXITCODE -ne 0) { throw "Nao foi possivel proteger o diretorio local." }
}
function StoreSecret([string]$name,[Security.SecureString]$value) {
  $value | ConvertFrom-SecureString | Set-Content -LiteralPath (Join-Path $SecretsHome "$name.dpapi") -Encoding ASCII
}
function RevealSecret([string]$name) {
  $file=Join-Path $SecretsHome "$name.dpapi"
  if (-not (Test-Path -LiteralPath $file)) { throw "Senha nao configurada: $name. Execute Setup." }
  $secure=(Get-Content -Raw -LiteralPath $file).Trim() | ConvertTo-SecureString
  return [PSCredential]::new("local", $secure).GetNetworkCredential().Password
}
function ClearProcessSecrets {
  foreach($name in @("PGHOST","PGPORT","PGUSER","PGPASSWORD","PGDATABASE","PGSSLMODE",
    "SUPABASE_URL","SUPABASE_SERVICE_ROLE_KEY","SUPABASE_EVIDENCE_BUCKET",
    "RESTIC_REPOSITORY","RESTIC_PASSWORD")) {
    Remove-Item ("Env:"+$name) -ErrorAction SilentlyContinue
  }
}
function Settings {
  if (-not (Test-Path -LiteralPath $ConfigFile)) { throw "Nao configurado: execute Setup." }
  $cfg=Get-Content -Raw -LiteralPath $ConfigFile | ConvertFrom-Json
  if ($cfg.project -ne $ProjectRef -or $cfg.apiUrl -ne "https://$ProjectRef.supabase.co") {
    throw "Projeto diferente do ambiente PRODUCAO definido neste kit."
  }
  if ([int]$cfg.dbPort -ne 5432 -or
    ($cfg.dbHost -notlike "*$ProjectRef*" -and $cfg.dbUser -notlike "*$ProjectRef*")) {
    throw "Confira o host, usuario e porta 5432 da producao."
  }
  return $cfg
}
function NativeOK([string]$label) {
  if ($LASTEXITCODE -ne 0) { throw "$label falhou. Nenhum backup foi aprovado." }
}
function ResticEnv($cfg) {
  $env:RESTIC_REPOSITORY=$cfg.repository
  $env:RESTIC_PASSWORD=RevealSecret "restic"
}
function ValidateDump([string]$file) {
  if (-not (Test-Path -LiteralPath $file) -or (Get-Item -LiteralPath $file).Length -lt 1024) {
    throw "Dump PostgreSQL ausente ou muito pequeno."
  }
  $listing=(& pg_restore --list $file | Out-String)
  NativeOK "pg_restore"
  if ($listing -notmatch 'TABLE DATA\s+public\s+usuarios\b' -or
      $listing -notmatch 'TABLE DATA\s+private\s+admins\b') {
    throw "Dump nao contem public.usuarios e private.admins. Verifique a conexao."
  }
}
function ValidateEvidence([string]$folder) {
  $file=Join-Path $folder "manifest.json"
  if (-not (Test-Path -LiteralPath $file)) { throw "Manifesto Storage ausente." }
  $m=Get-Content -Raw -LiteralPath $file | ConvertFrom-Json
  if ($m.bucket.public -ne $false) { throw "Storage nao privado ou manifesto invalido." }
  if (@($m.files).Count -ne [int]$m.objectCount) { throw "Contagem do manifesto invalida." }
  $sum=[long]0
  foreach($o in $m.files) {
    $parts=@([string]$o.path -split '/')
    foreach($part in $parts) {
      if ([string]::IsNullOrWhiteSpace($part) -or $part -eq "." -or $part -eq ".." -or
          $part.Contains("\") -or $part.Contains([char]0)) { throw "Nome de objeto inseguro." }
    }
    $localFile=Join-Path (Join-Path $folder "files") ($parts -join [IO.Path]::DirectorySeparatorChar)
    if (-not (Test-Path -LiteralPath $localFile -PathType Leaf)) { throw "Arquivo Storage nao encontrado." }
    if ((Get-Item -LiteralPath $localFile).Length -ne [long]$o.size) { throw "Tamanho de objeto invalido." }
    if ((Get-FileHash -LiteralPath $localFile -Algorithm SHA256).Hash.ToLowerInvariant() -cne $o.sha256) {
      throw "SHA-256 de objeto invalido."
    }
    $sum += [long]$o.size
  }
  if ($sum -ne [long]$m.totalBytes) { throw "Soma das evidencias nao confere." }
  Info ("Integridade das evidencias verificada: "+$m.objectCount+" arquivos.")
}
function Doctor {
  WindowsOnly
  foreach($exe in @("pg_dump","pg_restore","node","restic")) {
    if (Get-Command $exe -ErrorAction SilentlyContinue) { Info "Disponivel: $exe" }
    else { Info "FALTA INSTALAR: $exe" }
  }
  if (Test-Path -LiteralPath $ConfigFile) {
    $cfg=Settings
    Info ("Configurado para o projeto "+$cfg.project)
  } else { Info "Aguardando Setup." }
}
function Setup {
  WindowsOnly
  foreach($exe in @("pg_dump","pg_restore","node","restic")) { MustHave $exe }
  if (-not (Test-Path -LiteralPath $Exporter)) { throw "Coloque o arquivo JS do kit na mesma pasta." }
  if (Test-Path -LiteralPath $ConfigFile) { throw "Ja configurado. Nao sobrescreva as credenciais existentes." }
  Info "Use o projeto Supabase de PROducao: $ProjectRef. Nao envie chaves por chat."
  $hostName=(Read-Host "Host PostgreSQL de Supabase Connect (direto ou session pooler)").Trim()
  $dbUser=(Read-Host "Usuario PostgreSQL de Supabase Connect").Trim()
  $dbName=(Read-Host "Nome do database [postgres]").Trim()
  if (-not $dbName) { $dbName="postgres" }
  if (-not $hostName -or -not $dbUser -or
      ($hostName -notlike "*$ProjectRef*" -and $dbUser -notlike "*$ProjectRef*")) {
    throw "O host ou usuario precisa identificar o projeto correto: $ProjectRef."
  }
  $bucket=(Read-Host "ID exato do bucket PRIVADO em Supabase Storage").Trim()
  if ($bucket -notmatch '^[a-zA-Z0-9][a-zA-Z0-9_.-]{0,99}$') { throw "Bucket invalido." }
  $dest=(Read-Host "Pasta local [$DefaultHome]").Trim()
  if (-not $dest) { $dest=$DefaultHome }
  $dest=[IO.Path]::GetFullPath($dest)
  if ($dest.StartsWith("\\")) { throw "Use um disco LOCAL, nao compartilhamento de rede." }
  $leaf=[IO.Path]::GetFileName($dest.TrimEnd([IO.Path]::DirectorySeparatorChar,[IO.Path]::AltDirectorySeparatorChar))
  if ($leaf -ine "FISCALIZE-Backups") {
    throw "Para evitar alterar ACL de pastas existentes, escolha uma pasta dedicada chamada FISCALIZE-Backups."
  }
  if ((Test-Path -LiteralPath $dest) -and @(Get-ChildItem -LiteralPath $dest -Force).Count -gt 0) {
    throw "Pasta de backup ja contem arquivos. Escolha uma pasta FISCALIZE-Backups NOVA e vazia."
  }
  $dbPass=Read-Host "Senha PostgreSQL (campo oculto)" -AsSecureString
  $storageKey=Read-Host "Supabase service_role key (campo oculto)" -AsSecureString
  $restic=Read-Host "Nova senha FORTE (20+ caracteres) do backup criptografado" -AsSecureString
  $restic2=Read-Host "Repita a senha do backup" -AsSecureString
  $one=[PSCredential]::new("x",$restic).GetNetworkCredential().Password
  $two=[PSCredential]::new("x",$restic2).GetNetworkCredential().Password
  if ($one.Length -lt 20 -or $one -cne $two) { throw "Senhas diferentes ou menores que 20 caracteres." }
  $one=$null
  $two=$null
  PrivateFolder $SecretsHome
  PrivateFolder $dest
  StoreSecret "database" $dbPass
  StoreSecret "service" $storageKey
  StoreSecret "restic" $restic
  $cfg=@{
    project=$ProjectRef; dbHost=$hostName; dbUser=$dbUser; dbName=$dbName; dbPort=5432
    apiUrl="https://$ProjectRef.supabase.co"; bucket=$bucket
    repository=(Join-Path $dest "repository")
  }
  $cfg | ConvertTo-Json | Set-Content -LiteralPath $ConfigFile -Encoding UTF8
  try {
    ResticEnv $cfg
    & restic init
    NativeOK "restic init"
  } finally { ClearProcessSecrets }
  Info "Repositorio criptografado criado. Guarde a senha de recuperacao FORA do computador."
}
function Backup {
  WindowsOnly
  foreach($exe in @("pg_dump","pg_restore","node","restic")) { MustHave $exe }
  if (-not (Test-Path -LiteralPath $Exporter)) { throw "Arquivo JS do kit ausente." }
  $cfg=Settings
  PrivateFolder $ScratchHome
  $stage=Join-Path $ScratchHome ([guid]::NewGuid().ToString("N"))
  $null=New-Item -ItemType Directory -Path $stage
  try {
    $dbDir=Join-Path $stage "db"
    $storageDir=Join-Path $stage "storage"
    $null=New-Item -ItemType Directory -Path $dbDir
    $env:PGHOST=$cfg.dbHost
    $env:PGPORT=[string]$cfg.dbPort
    $env:PGUSER=$cfg.dbUser
    $env:PGDATABASE=$cfg.dbName
    $env:PGSSLMODE="require"
    $env:PGPASSWORD=RevealSecret "database"
    $dump=Join-Path $dbDir "application.dump"
    Info "Exportando PostgreSQL public + private (somente leitura)."
    & pg_dump --no-password --format=custom --no-owner --no-acl --schema=public --schema=private --file=$dump
    NativeOK "pg_dump"
    ValidateDump $dump
    (Get-FileHash -LiteralPath $dump -Algorithm SHA256).Hash.ToLowerInvariant() |
      Set-Content -LiteralPath (Join-Path $dbDir "application.sha256") -Encoding ASCII
    $env:SUPABASE_URL=$cfg.apiUrl
    $env:SUPABASE_SERVICE_ROLE_KEY=RevealSecret "service"
    $env:SUPABASE_EVIDENCE_BUCKET=$cfg.bucket
    Info "Exportando bucket privado de evidencias."
    & node $Exporter $storageDir
    NativeOK "Exportador Storage"
    ValidateEvidence $storageDir
    ResticEnv $cfg
    & restic backup --tag fiscalize-production -- $stage
    NativeOK "restic backup"
    & restic check
    NativeOK "restic check"
    Info "BACKUP ENCRIPTADO CONCLUIDO. Execute a acao Verify."
  } finally {
    ClearProcessSecrets
    if (Test-Path -LiteralPath $stage) { Remove-Item -LiteralPath $stage -Recurse -Force }
  }
}
function Verify {
  WindowsOnly
  foreach($exe in @("restic","pg_restore")) { MustHave $exe }
  $cfg=Settings
  PrivateFolder $ScratchHome
  $target=Join-Path $ScratchHome ("verify-"+[guid]::NewGuid().ToString("N"))
  $null=New-Item -ItemType Directory -Path $target
  try {
    ResticEnv $cfg
    & restic check --read-data
    NativeOK "restic check --read-data"
    # Evitar recriar C:/Users: localizar apenas a subpasta da copia.
    $json=(& restic snapshots --json --tag fiscalize-production | Out-String)
    NativeOK "restic snapshots"
    $snapshots=@($json | ConvertFrom-Json)
    if ($snapshots.Count -lt 1) { throw "Nenhum snapshot do FISCALIZE." }
    $snapshot=$snapshots | Sort-Object time -Descending | Select-Object -First 1
    $id=[string]$snapshot.id
    if ($id -notmatch '^[a-f0-9]{64}$') { throw "ID de snapshot invalido." }
    $lines=@(& restic ls --json $id)
    NativeOK "restic ls"
    $nodes=@($lines | ForEach-Object { $_ | ConvertFrom-Json } | Where-Object { $_.struct_type -eq "node" })
    $dumpsInside=@($nodes | Where-Object {
      $_.type -eq "file" -and $_.path -match '/db/application[.]dump$'
    })
    if ($dumpsInside.Count -ne 1) { throw "Arquivo dump ausente ou ambiguo." }
    $fullPath=[string]$dumpsInside[0].path
    $root=$fullPath.Substring(0,$fullPath.Length-("/db/application.dump").Length)
    if (@($nodes | Where-Object {
      $_.type -eq "file" -and $_.path -ceq ($root+"/storage/manifest.json")
    }).Count -ne 1) { throw "Manifesto de Storage nao corresponde ao dump." }
    $source=$id
    if ($root.Length -gt 0) { $source=$id+":"+$root }
    & restic restore $source --target $target --verify
    NativeOK "restic restore subarvore"
    $dumps=@(Get-ChildItem -LiteralPath $target -File -Recurse -Filter "application.dump")
    $manifests=@(Get-ChildItem -LiteralPath $target -File -Recurse -Filter "manifest.json")
    if ($dumps.Count -ne 1 -or $manifests.Count -ne 1) { throw "Restauracao incompleta." }
    $dump=$dumps[0].FullName
    ValidateDump $dump
    $hashFile=Join-Path $dumps[0].DirectoryName "application.sha256"
    if (-not (Test-Path -LiteralPath $hashFile)) { throw "Checksum PostgreSQL ausente." }
    if ((Get-FileHash -LiteralPath $dump -Algorithm SHA256).Hash.ToLowerInvariant() -cne
        (Get-Content -Raw -LiteralPath $hashFile).Trim()) { throw "Checksum PostgreSQL diferente." }
    ValidateEvidence $manifests[0].DirectoryName
    Info "RESTORE DE ARQUIVOS E HASH: OK. Ainda falta restaurar o SQL em banco isolado."
  } finally {
    ClearProcessSecrets
    if (Test-Path -LiteralPath $target) { Remove-Item -LiteralPath $target -Recurse -Force }
  }
}
function Schedule {
  WindowsOnly
  $null=Settings
  $when=[DateTime]::ParseExact($At,"HH:mm",[Globalization.CultureInfo]::InvariantCulture)
  $taskName="FISCALIZE Backup Local"
  if (Get-ScheduledTask -TaskName $taskName -ErrorAction SilentlyContinue) { throw "Agendamento ja existe." }
  $actor=[Security.Principal.WindowsIdentity]::GetCurrent().Name
  $principal=New-ScheduledTaskPrincipal -UserId $actor -LogonType Interactive -RunLevel Limited
  $arguments='-NoProfile -NonInteractive -ExecutionPolicy Bypass -File "'+$PSCommandPath+'" -Action Backup'
  $job=New-ScheduledTaskAction -Execute (Join-Path $PSHOME "powershell.exe") -Argument $arguments
  $trigger=New-ScheduledTaskTrigger -Daily -At $when
  $settings=New-ScheduledTaskSettingsSet -StartWhenAvailable -ExecutionTimeLimit (New-TimeSpan -Hours 3)
  $null=Register-ScheduledTask -TaskName $taskName -Description "Copia encriptada FISCALIZE" -Action $job -Trigger $trigger -Settings $settings -Principal $principal
  Info "Agendado diariamente as $At, horario do Windows. PC ligado, usuario logado."
}
try {
  switch ($Action) {
    "Doctor" { Doctor }
    "Setup" { Setup }
    "Backup" { Backup }
    "Verify" { Verify }
    "Schedule" { Schedule }
  }
} catch {
  Write-Error ("Backup interrompido: "+$_.Exception.Message)
  exit 1
}
