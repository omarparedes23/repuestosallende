# ============================================================
# supabase/tests/compra-atomica-fase5-conc-runner.ps1
# Fase 5 - concurrencia real con dos procesos psql simultaneos.
#
#   SCN1: MISMO operation_id + payload identico -> una confirmed
#         y una replayed:true; misma compra; 1 compra/1 cargo/1 kardex.
#   SCN2: ops distintos, mismos productos en orden inverso -> ambos OK
#         sin deadlock; invariante de stock exacta.
#
# Uso: $env:PGPASSWORD='...' ; .\compra-atomica-fase5-conc-runner.ps1 [-RunId <guid>]
# ============================================================

param(
  [string]$RunId = [guid]::NewGuid().ToString('N')
)

$ErrorActionPreference = 'Stop'

if (-not $env:PGPASSWORD) {
  throw "Define PGPASSWORD en el entorno antes de ejecutar el runner."
}

$common = "host=db.axcrubvtpqcyscizgoee.supabase.co port=5432 dbname=postgres user=postgres sslmode=require"
$sql    = Join-Path $PSScriptRoot 'compra-atomica-fase5-conc.test.sql'
$tmp    = Join-Path $env:TEMP 'opencode'
New-Item -ItemType Directory -Force -Path $tmp | Out-Null

Write-Host "RUN_ID=$RunId"
$script:jobs = @()

# Semilla idempotente previa: el proveedor debe existir ANTES de lanzar
# las dos sesiones (si cada una lo creara, usarian ids distintos y el
# hash canonico diferiria => RA_IDEMPOTENCY_CONFLICT falso positivo).
$seed = @"
INSERT INTO ra_proveedores (empresa_id, nombre)
SELECT p.empresa_id, 'F5E2E:$RunId`:PROV'
  FROM ra_perfiles p JOIN auth.users u ON u.id=p.id
 WHERE u.email LIKE '%test.admin.idempotencia@%' AND p.activo
   AND NOT EXISTS (
        SELECT 1 FROM ra_proveedores WHERE nombre = 'F5E2E:$RunId`:PROV');
"@
psql $common -tA -v ON_ERROR_STOP=1 -c $seed | Out-Null
if ($LASTEXITCODE -ne 0) { throw "FALLO semilla de proveedor" }
Write-Host "Semilla OK (proveedor F5E2E:$RunId`:PROV)"

function Parse-Result([string]$log) {
  # RESULT:<ses>:<pid>:<t0>:<t1>:<t2>:<outcome>:<op>:<cid|->:<replayed|->
  $uuid = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}'
  $ts = '\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\.\d+(?:[+-]\d{2})?'
  $rx = "RESULT:(?<ses>A|B):(?<pid>\d+):(?<t0>$ts):(?<t1>$ts):(?<t2>$ts|-):(?<outcome>[^:\r\n]*):(?<op>$uuid|-):(?<cid>$uuid|-):(?<rep>true|false|-)"
  $m = [regex]::Match($log, $rx)
  if (-not $m.Success) { return $null }
  return @{
    Ses     = $m.Groups['ses'].Value
    Pid     = [int]$m.Groups['pid'].Value
    T0      = [datetime]::Parse($m.Groups['t0'].Value)
    T1      = [datetime]::Parse($m.Groups['t1'].Value)
    T2      = if ($m.Groups['t2'].Value -ne '-') { [datetime]::Parse($m.Groups['t2'].Value) } else { [datetime]::MaxValue }
    Outcome = $m.Groups['outcome'].Value.Trim()
    Op      = $m.Groups['op'].Value.Trim()
    Cid     = $m.Groups['cid'].Value.Trim()
    Rep     = $m.Groups['rep'].Value.Trim()
  }
}

function Assert-Q([string]$q, [int]$esperado, [string]$etiqueta) {
  $v = $null
  for ($k = 0; $k -lt 3; $k++) {
    $out = psql $common -tA -v ON_ERROR_STOP=1 -c $q 2>&1
    $s = ([string]$out).Trim()
    if ($LASTEXITCODE -eq 0 -and $s -match '^\d+$') { $v = [int]$s; break }
    Start-Sleep -Seconds 1
  }
  if ($null -eq $v) { throw "FALLO verificacion ($etiqueta): psql fallo tras reintentos" }
  if ($v -ne $esperado) { throw "FALLO verificacion ($etiqueta): obtenido $v, esperaba $esperado" }
}

function Invoke-Pair([string]$scn) {
  $outA = Join-Path $tmp "f5concA.$scn.$RunId.log"
  $outB = Join-Path $tmp "f5concB.$scn.$RunId.log"

  $script:jobs = @(
    Start-Job -ScriptBlock {
      param($cs, $sqlPath, $outPath, $pw, $ses, $scnJ, $runJ)
      $env:PGPASSWORD = $pw
      psql $cs -v ON_ERROR_STOP=1 -v SES=$ses -v SCN=$scnJ -v RUN_ID=$runJ -f $sqlPath *> $outPath
      "PSQLEXIT=$LASTEXITCODE"
    } -ArgumentList $common, $sql, $outA, $env:PGPASSWORD, 'A', $scn, $RunId

    Start-Job -ScriptBlock {
      param($cs, $sqlPath, $outPath, $pw, $ses, $scnJ, $runJ)
      $env:PGPASSWORD = $pw
      psql $cs -v ON_ERROR_STOP=1 -v SES=$ses -v SCN=$scnJ -v RUN_ID=$runJ -f $sqlPath *> $outPath
      "PSQLEXIT=$LASTEXITCODE"
    } -ArgumentList $common, $sql, $outB, $env:PGPASSWORD, 'B', $scn, $RunId
  )

  try {
    if (-not (Wait-Job $script:jobs -Timeout 180)) {
      throw "FALLO SCN$scn`: timeout de 180s esperando las sesiones"
    }
  }
  finally {
    foreach ($j in $script:jobs) { Stop-Job $j -ErrorAction SilentlyContinue }
  }

  $exitLines = Receive-Job $script:jobs -ErrorAction SilentlyContinue
  foreach ($j in $script:jobs) { Remove-Job $j -Force -ErrorAction SilentlyContinue }

  foreach ($line in @($exitLines | Where-Object { $_ -like 'PSQLEXIT=*' })) {
    $code = [int]($line -replace 'PSQLEXIT=', '')
    if ($code -ne 0) {
      Write-Host "=== LOG A ==="; Get-Content $outA -Raw -ErrorAction SilentlyContinue
      Write-Host "=== LOG B ==="; Get-Content $outB -Raw -ErrorAction SilentlyContinue
      throw "FALLO SCN$scn`: psql termino con exit code $code"
    }
  }

  $rA = Parse-Result (Get-Content $outA -Raw)
  $rB = Parse-Result (Get-Content $outB -Raw)
  if (-not $rA -or -not $rB) {
    Write-Host "=== LOG A ==="; Get-Content $outA -Raw -ErrorAction SilentlyContinue
    Write-Host "=== LOG B ==="; Get-Content $outB -Raw -ErrorAction SilentlyContinue
    throw "FALLO SCN$scn`: no se parsearon lineas RESULT"
  }

  Write-Host ("[SCN{0}] A: PID={1} outcome={2} rep={3}" -f $scn, $rA.Pid, $rA.Outcome, $rA.Rep)
  Write-Host ("[SCN{0}] B: PID={1} outcome={2} rep={3}" -f $scn, $rB.Pid, $rB.Outcome, $rB.Rep)

  if ($rA.Pid -eq $rB.Pid) { throw "FALLO SCN$scn`: misma conexion" }
  # solapamiento sobre [t0,t2] con t2 = fin de retencion post-commit
  $solape = ($rB.T0 -lt $rA.T2) -and ($rA.T0 -lt $rB.T2)
  if (-not $solape) { throw "FALLO SCN$scn`: transacciones NO solapadas" }
  Write-Host "[SCN$scn] SOLAPAMIENTO REAL CONFIRMADO"

  return @($rA, $rB)
}

try {
  Write-Host "`n===== F5-SCN1: mismo operation_id, payload identico ====="
  $s1 = Invoke-Pair -scn '1'
  foreach ($r in $s1) {
    if ($r.Outcome -ne 'OK') { throw "FALLO SCN1: outcome $($r.Ses)=$($r.Outcome)" }
    if ($r.Cid -eq '-')     { throw "FALLO SCN1: $($r.Ses) sin compra id" }
  }
  if ($s1[0].Cid -ne $s1[1].Cid) { throw "FALLO SCN1: compras distintas" }
  $repFalse = @($s1 | Where-Object { $_.Rep -eq 'false' }).Count
  $repTrue  = @($s1 | Where-Object { $_.Rep -eq 'true' }).Count
  if ($repFalse -ne 1 -or $repTrue -ne 1) {
    throw "FALLO SCN1: split replayed incorrecto (false=$repFalse true=$repTrue)"
  }
  $op1 = "'" + $s1[0].Op + "'"
  Assert-Q "SELECT count(*) FROM ra_compras WHERE operation_id=$op1;" 1 "SCN1 compras"
  # contado con abono total => cargo + abono = 2 movimientos
  Assert-Q "SELECT count(*) FROM ra_cuentas_por_pagar_movimientos m JOIN ra_compras c ON c.id=m.compra_id WHERE c.operation_id=$op1;" 2 "SCN1 cargos"
  Assert-Q "SELECT count(*) FROM ra_kardex k JOIN ra_compras c ON c.id=k.referencia_id WHERE c.operation_id=$op1;" 1 "SCN1 kardex"
  Write-Host "[SCN1] misma compra $($s1[0].Cid): una confirmed + una replayed:true; 1 compra/1 cargo/1 kardex"

  Write-Host "`n===== F5-SCN2: ops distintos, productos en orden inverso ====="
  $s2 = Invoke-Pair -scn '2'
  foreach ($r in $s2) {
    if ($r.Outcome -ne 'OK') { throw "FALLO SCN2: outcome $($r.Ses)=$($r.Outcome)" }
  }
  $ops2 = ($s2 | ForEach-Object { "'" + $_.Op + "'" }) -join ','
  Assert-Q "SELECT count(*) FROM ra_compras WHERE operation_id IN ($ops2);" 2 "SCN2 compras"
  Assert-Q "SELECT count(*) FROM ra_kardex k JOIN ra_compras c ON c.id=k.referencia_id WHERE c.operation_id IN ($ops2);" 4 "SCN2 kardex"
  $inv = (psql $common -tA -v ON_ERROR_STOP=1 -c @"
SELECT count(*) FROM ra_productos p
WHERE p.catalogo_id IN (SELECT catalogo_id FROM ra_kardex WHERE referencia_id IN (SELECT id FROM ra_compras WHERE operation_id IN ($ops2)))
  AND (
    p.stock_actual <> COALESCE((SELECT max(stock_nuevo) FROM ra_kardex k
        WHERE k.catalogo_id = p.catalogo_id AND k.sucursal_id = p.sucursal_id), p.stock_actual)
    OR EXISTS (SELECT 1 FROM ra_kardex k
        WHERE k.catalogo_id = p.catalogo_id AND k.sucursal_id = p.sucursal_id AND k.stock_nuevo < 0)
  );
"@).Trim()
  if ([int]$inv -ne 0) { throw "FALLO SCN2: invariante de stock violada en $inv productos" }
  Write-Host "[SCN2] ambos OK sin deadlock; stock final consistente"

  Write-Host "`nF5 CONCURRENCIA REAL VERIFICADA EN LOS 2 ESCENARIOS. RUN_ID=$RunId"
}
finally {
  foreach ($j in $script:jobs) {
    Stop-Job $j -ErrorAction SilentlyContinue
    Remove-Job $j -Force -ErrorAction SilentlyContinue
  }
}
