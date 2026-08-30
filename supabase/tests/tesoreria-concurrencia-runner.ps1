param(
  [string]$RunId = [guid]::NewGuid().ToString('N'),
  [string]$AdminEmail = $env:TESORERIA_TEST_ADMIN_EMAIL
)

$ErrorActionPreference='Stop'
if (-not $env:DATABASE_URL) { throw 'Define DATABASE_URL para Supabase TEST.' }
if (-not $AdminEmail) { throw 'Define TESORERIA_TEST_ADMIN_EMAIL.' }

$sql=Join-Path $PSScriptRoot 'tesoreria-concurrencia.test.sql'
$tmp=Join-Path $env:TEMP 'repuestosallende-tesoreria-tests'
New-Item -ItemType Directory -Path $tmp -Force | Out-Null
$branch="md5('tesoreria-branch-$RunId')::uuid"

function Query([string]$q) {
  $out=& psql $env:DATABASE_URL -X -tA -v ON_ERROR_STOP=1 -c $q 2>&1
  if ($LASTEXITCODE -ne 0) { throw "psql fallo: $out" }
  return ([string]$out).Trim()
}

function Pair([string]$scn) {
  $jobs=@()
  foreach($ses in @('A','B')) {
    $log=Join-Path $tmp "tesoreria-$RunId-$scn-$ses.log"
    $jobs+=Start-Job -ScriptBlock {
      param($db,$file,$s,$scenario,$run,$email,$path)
      & psql $db -X -v ON_ERROR_STOP=1 -v SES=$s -v SCN=$scenario -v RUN_ID=$run -v ADMIN_EMAIL=$email -f $file *> $path
      [pscustomobject]@{Exit=$LASTEXITCODE;Log=$path}
    } -ArgumentList $env:DATABASE_URL,$sql,$ses,$scn,$RunId,$AdminEmail,$log
  }
  if (-not (Wait-Job $jobs -Timeout 90)) { $jobs|Stop-Job; throw "timeout SCN$scn" }
  $results=@($jobs|Receive-Job); $jobs|Remove-Job -Force
  foreach($r in $results) {
    $body=Get-Content -LiteralPath $r.Log -Raw
    Write-Host $body
    if ($r.Exit -ne 0 -or $body -notmatch "RESULT:${scn}:") { throw "FALLO SCN$scn" }
  }
  return $results
}

$admin=(Query "SELECT p.id||'|'||p.empresa_id FROM ra_perfiles p JOIN auth.users u ON u.id=p.id WHERE lower(u.email)=lower('$($AdminEmail.Replace("'","''"))') AND p.activo AND p.rol IN ('administrador','superadmin') LIMIT 1;")
if (-not $admin) { throw 'Admin TEST no encontrado.' }
$empresa=$admin.Split('|')[1]
Query "INSERT INTO ra_sucursales(id,empresa_id,nombre) VALUES($branch,'$empresa','TESORERIA-CONC:$RunId') ON CONFLICT(id) DO NOTHING;" | Out-Null

try {
  $r1=Pair '1'
  $openCount=[int](Query "SELECT count(*) FROM ra_cajas WHERE sucursal_id=$branch AND estado='abierta';")
  $repFalse=0; $repTrue=0
  foreach($r in $r1) {
    $body=Get-Content -LiteralPath $r.Log -Raw
    if($body -match 'RESULT:1:[AB]:\d+:OK:[^:]+:false'){ $repFalse++ }
    if($body -match 'RESULT:1:[AB]:\d+:OK:[^:]+:true'){ $repTrue++ }
  }
  if($openCount-ne 1 -or $repFalse-ne 1 -or $repTrue-ne 1){ throw 'SCN1 no produjo una apertura y un replay.' }

  Pair '2' | Out-Null
  $bad=[int](Query "SELECT count(*) FROM ra_movimientos_caja m JOIN ra_cajas c ON c.id=m.caja_id WHERE c.sucursal_id=$branch AND c.fecha_cierre IS NOT NULL AND m.created_at>c.fecha_cierre;")
  $liq=[int](Query "SELECT count(*) FROM ra_liquidaciones l JOIN ra_cajas c ON c.id=l.caja_id WHERE c.sucursal_id=$branch;")
  if($bad-ne 0 -or $liq-ne 1){ throw "SCN2 invariante violada: posteriores=$bad liquidaciones=$liq" }
  Write-Host "PASS tesoreria concurrencia RUN_ID=$RunId"
  Write-Host "Retiro posterior (solo TEST): psql <TEST_URL> -v RUN_ID=$RunId -v ALLOW_TEST_FIXTURE_RETIRE=YES -f supabase/tests/tesoreria-concurrencia-retire-fixture.sql"
}
finally {
  # Los ledgers son append-only: nunca se borran desde el runner. El retiro
  # administrativo desactiva la sucursal tras verificar que no haya caja abierta.
}
