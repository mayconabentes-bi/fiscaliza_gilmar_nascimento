#requires -Version 5.1
<#
  Diagnostico estritamente local e somente leitura para backup PostgreSQL FISCALIZE.
  Nao examina PG_BACKUP_URL, senhas ou chaves. Nao instala pacotes nem faz conexao de rede.
#>
param(
    [string]$BackupDir = $env:BACKUP_OUTPUT_DIR
)
$ErrorActionPreference = 'Stop'

function Get-ToolStatus {
    param([string]$Name, [string]$MinVersion = '')
    $cmd = Get-Command -Name $Name -CommandType Application -ErrorAction SilentlyContinue |
        Select-Object -First 1
    if (-not $cmd) { return 'AUSENTE' }
    # Get-Command confirma somente existencia. Executar --version verifica se
    # a politica de Controle de Aplicativos do Windows permite a ferramenta.
    # Nenhuma chave, arquivo de dados ou rede e acessada aqui.
    try {
        $versionText = (& $cmd.Source --version 2>$null | Out-String).Trim()
        if ($LASTEXITCODE -ne 0 -or [string]::IsNullOrWhiteSpace($versionText)) {
            return 'EXECUCAO_FALHOU'
        }
        if ($MinVersion) {
            if ($versionText -notmatch '(\d+)(?:\.\d+)?') { return 'VERSAO_INCONCLUSIVA' }
            $major = [int]$Matches[1]
            if ($major -lt [int]$MinVersion) { return 'VERSAO_INCOMPATIVEL' }
        }
        return 'OK'
    }
    catch {
        return 'EXECUCAO_BLOQUEADA_OU_FALHOU'
    }
}

$pythonStatus = Get-ToolStatus -Name 'python.exe' -MinVersion '3'
$pgDumpStatus = Get-ToolStatus -Name 'pg_dump.exe' -MinVersion '17'
$ageStatus = Get-ToolStatus -Name 'age.exe'
$keygenStatus = Get-ToolStatus -Name 'age-keygen.exe'
$destinationStatus = 'NAO_CONFIGURADO'
$diskStatus = 'NAO_VERIFICADO'

if (-not [string]::IsNullOrWhiteSpace($BackupDir)) {
    try {
        $dest = [System.IO.Path]::GetFullPath($BackupDir).TrimEnd([char[]]@('\', '/'))
        $repo = [System.IO.Path]::GetFullPath((Get-Location).Path).TrimEnd([char[]]@('\', '/'))
        $insideRepo = $dest.Equals($repo, [System.StringComparison]::OrdinalIgnoreCase) -or
            $dest.StartsWith($repo + [System.IO.Path]::DirectorySeparatorChar, [System.StringComparison]::OrdinalIgnoreCase)
        if ($insideRepo) {
            $destinationStatus = 'BLOQUEADO_DENTRO_REPOSITORIO'
        }
        elseif (-not (Test-Path -LiteralPath $dest -PathType Container)) {
            $destinationStatus = 'DIRETORIO_INEXISTENTE'
        }
        else {
            $destinationStatus = 'OK_FORA_REPOSITORIO'
            try {
                $root = [System.IO.Path]::GetPathRoot($dest)
                $driveName = $root.TrimEnd([char[]]@('\', '/')).TrimEnd(':')
                $drive = Get-PSDrive -Name $driveName -PSProvider FileSystem -ErrorAction Stop
                if ($null -ne $drive.Free) {
                    $diskStatus = if ([long]$drive.Free -ge 1073741824) { 'PELO_MENOS_1_GB' } else { 'MENOS_DE_1_GB' }
                }
            }
            catch { $diskStatus = 'INCONCLUSIVO' }
        }
    }
    catch { $destinationStatus = 'CAMINHO_INVALIDO' }
}

Write-Output "BACKUP_PYTHON=$pythonStatus"
Write-Output "BACKUP_PG_DUMP_17=$pgDumpStatus"
Write-Output "BACKUP_AGE=$ageStatus"
Write-Output "BACKUP_AGE_KEYGEN=$keygenStatus"
Write-Output "BACKUP_DESTINO=$destinationStatus"
Write-Output "BACKUP_ESPACO=$diskStatus"

$ready = $pythonStatus -eq 'OK' -and $pgDumpStatus -eq 'OK' -and
    $ageStatus -eq 'OK' -and $keygenStatus -eq 'OK' -and
    $destinationStatus -eq 'OK_FORA_REPOSITORIO' -and
    $diskStatus -eq 'PELO_MENOS_1_GB'
Write-Output "BACKUP_PREFLIGHT=$(if ($ready) { 'OK' } else { 'PENDENTE' })"
Write-Output 'BACKUP_DADOS_COPIADOS=NAO'
Write-Output 'BACKUP_PRODUCAO_ACESSADA=NAO'
