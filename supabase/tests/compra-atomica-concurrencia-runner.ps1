# ============================================================
# supabase/tests/compra-atomica-concurrencia-runner.ps1  (rev.5)
#
# Cinco escenarios, cada uno con dos procesos psql SIMULTANEOS:
#   SCN=1 documentos distintos, orden inverso -> ambos OK.
#   SCN=2 misma factura, op distintos -> 1 OK + 1 RA_INVOICE_DUPLICATE.
#   SCN=3 MISMO op + payload identico -> mismo compra.id, una
#         replayed:false y una replayed:true; 1 compra/1 cargo/1 kardex.
#   SCN=4 MISMO op + payload distinto -> 1 OK + 1 RA_IDEMPOTENCY_CONFLICT.
#   SCN=5 MISMO repair op + compra + motivo -> una ejecucion y un replay;
#         ambos conservan changed:true y existe una sola auditoria.
#
# Evidencia de concurrencia real: PIDs distintos + interseccion de
# [t0,t2] (t2 = fin de retencion pre-commit).
#
# Uso: $env:PGPASSWORD='...' ; .\compra-atomica-concurrencia-runner.ps1
# ============================================================

$ErrorActionPreference = 'Stop'

if (-not $env:PGPASSWORD) {
  throw "Define PGPASSWORD en el entorno antes de ejecutar el runner."
}

$common = "host=db.axcrubvtpqcyscizgoee.supabase.co port=5432 dbname=postgres user=postgres sslmode=require"
$sql    = Join-Path $PSScriptRoot 'compra-atomica-concurrencia.test.sql'
$tmp    = Join-Path $env:TEMP 'opencode'
New-Item -ItemType Directory -Force -Path $tmp | Out-Null

$runId       = [guid]::NewGuid().ToString('N')
$script:jobs = @()

Write-Host "RUN_ID=$runId"

function Parse-Result([string]$log) {
  # SQL emite: ses, pid, t0, t1, t2, outcome, operation_id,
  # compra_id (o "-"), replayed y changed. Los grupos con nombre
  # evitan desfasar silenciosamente el parser si se agregan campos.
  $uuid = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}'
  $ts = '\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}\.\d+(?:[+-]\d{2})?'
  $rx = "(?m)RESULT:(?<ses>A|B):(?<pid>\d+):(?<t0>$ts):(?<t1>$ts):(?<t2>$ts):(?<outcome>[^:\r\n]*):(?<op>$uuid):(?<cid>$uuid|-):(?<replayed>true|false|-):(?<changed>\w+|[-])\r?$"
  $m = [regex]::Match($log, $rx)
  if (-not $m.Success) { return $null }
  return @{
    Ses     = $m.Groups['ses'].Value
    Pid     = [int]$m.Groups['pid'].Value
    T0      = [datetime]::Parse($m.Groups['t0'].Value)
    T1      = [datetime]::Parse($m.Groups['t1'].Value)
    T2      = [datetime]::Parse($m.Groups['t2'].Value)
    Outcome = $m.Groups['outcome'].Value.Trim()
    Op      = $m.Groups['op'].Value.Trim()
    Cid     = $m.Groups['cid'].Value.Trim()
    Rep     = $m.Groups['replayed'].Value.Trim()
    Changed = $m.Groups['changed'].Value.Trim()
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
  $outA = Join-Path $tmp "concA.$scn.$runId.log"
  $outB = Join-Path $tmp "concB.$scn.$runId.log"

  $script:jobs = @(
    Start-Job -ScriptBlock {
      param($cs, $sqlPath, $outPath, $pw, $ses, $scnJ, $runJ)
      $env:PGPASSWORD = $pw
      psql $cs -v ON_ERROR_STOP=1 -v SES=$ses -v SCN=$scnJ -v RUN_ID=$runJ -f $sqlPath *> $outPath
      "PSQLEXIT=$LASTEXITCODE"
    } -ArgumentList $common, $sql, $outA, $env:PGPASSWORD, 'A', $scn, $runId

    Start-Job -ScriptBlock {
      param($cs, $sqlPath, $outPath, $pw, $ses, $scnJ, $runJ)
      $env:PGPASSWORD = $pw
      psql $cs -v ON_ERROR_STOP=1 -v SES=$ses -v SCN=$scnJ -v RUN_ID=$runJ -f $sqlPath *> $outPath
      "PSQLEXIT=$LASTEXITCODE"
    } -ArgumentList $common, $sql, $outB, $env:PGPASSWORD, 'B', $scn, $runId
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
      Write-Host "=== LOG A ==="
      Write-Host (Get-Content $outA -Raw -ErrorAction SilentlyContinue)
      Write-Host "=== LOG B ==="
      Write-Host (Get-Content $outB -Raw -ErrorAction SilentlyContinue)
      throw "FALLO SCN$scn`: psql termino con exit code $code"
    }
  }

  $rA = Parse-Result (Get-Content $outA -Raw)
  $rB = Parse-Result (Get-Content $outB -Raw)

  if (-not $rA -or -not $rB) {
    Write-Host "=== LOG A ==="
    Write-Host (Get-Content $outA -Raw -ErrorAction SilentlyContinue)
    Write-Host "=== LOG B ==="
    Write-Host (Get-Content $outB -Raw -ErrorAction SilentlyContinue)
    throw "FALLO SCN$scn`: no se parsearon lineas RESULT"
  }

  Write-Host ("[SCN{0}] A: PID={1} t0={2:HH:mm:ss.ffffff} t1={3:HH:mm:ss.ffffff} outcome={4} rep={5}" -f $scn, $rA.Pid, $rA.T0, $rA.T1, $rA.Outcome, $rA.Rep)
  Write-Host ("[SCN{0}] B: PID={1} t0={2:HH:mm:ss.ffffff} t1={3:HH:mm:ss.ffffff} outcome={4} rep={5}" -f $scn, $rB.Pid, $rB.T0, $rB.T1, $rB.Outcome, $rB.Rep)

  if ($rA.Pid -eq $rB.Pid) { throw "FALLO SCN$scn`: misma conexion" }

  $solape = ($rB.T0 -lt $rA.T2) -and ($rA.T0 -lt $rB.T2)
  if (-not $solape) { throw "FALLO SCN$scn`: transacciones NO solapadas; corrida secuencial" }
  Write-Host "[SCN$scn] SOLAPAMIENTO REAL CONFIRMADO"

  return @($rA, $rB)
}

try {
  Write-Host "`n===== ESCENARIO 1: orden inverso ====="
  $s1 = Invoke-Pair -scn '1'
  foreach ($r in $s1) {
    if ($r.Outcome -ne 'OK') { throw "FALLO SCN1: outcome $($r.Ses)=$($r.Outcome)" }
  }
  Write-Host "[SCN1] ambas OK (sin deadlock)"
  $ops1 = ($s1 | ForEach-Object { "'" + $_.Op + "'" }) -join ','
  Assert-Q "SELECT count(*) FROM ra_compras WHERE operation_id IN ($ops1);" 2 "SCN1 compras"
  Assert-Q "SELECT count(*) FROM ra_cuentas_por_pagar_movimientos m JOIN ra_compras c ON c.id=m.compra_id WHERE c.operation_id IN ($ops1) AND m.tipo='cargo';" 2 "SCN1 cargos"
  Assert-Q "SELECT count(*) FROM ra_kardex k JOIN ra_compras c ON c.id=k.referencia_id WHERE c.operation_id IN ($ops1);" 4 "SCN1 kardex"
  $inv = (psql $common -tA -c @"
SELECT count(*) FROM ra_productos p
WHERE p.catalogo_id IN (SELECT catalogo_id FROM ra_kardex WHERE referencia_id IN (SELECT id FROM ra_compras WHERE operation_id IN ($ops1)))
  AND p.sucursal_id = (SELECT sucursal_id FROM ra_compras WHERE operation_id = '$($s1[0].Op)')
  AND (
    p.stock_actual <> COALESCE((SELECT max(stock_nuevo) FROM ra_kardex k
        WHERE k.catalogo_id = p.catalogo_id AND k.sucursal_id = p.sucursal_id), p.stock_actual)
    OR EXISTS (SELECT 1 FROM ra_kardex k
        WHERE k.catalogo_id = p.catalogo_id AND k.sucursal_id = p.sucursal_id AND k.stock_nuevo < 0)
  );
"@).Trim()
  if ([int]$inv -ne 0) { throw "FALLO SCN1: invariante de stock violada en $inv productos" }
  Write-Host "[SCN1] efectos: 2 compras / 2 cargos / 4 kardex"

  Write-Host "`n===== ESCENARIO 2: carrera de factura ====="
  $s2 = Invoke-Pair -scn '2'
  $ok2  = @($s2 | Where-Object { $_.Outcome -eq 'OK' }).Count
  $dup2 = @($s2 | Where-Object { $_.Outcome -like '*RA_INVOICE_DUPLICATE*' }).Count
  if ($ok2 -ne 1 -or $dup2 -ne 1) { throw "FALLO SCN2: OK=$ok2 DUP=$dup2" }
  Write-Host "[SCN2] 1 OK + 1 RA_INVOICE_DUPLICATE"
  $ops2 = ($s2 | ForEach-Object { "'" + $_.Op + "'" }) -join ','
  Assert-Q "SELECT count(*) FROM ra_compras WHERE operation_id IN ($ops2);" 1 "SCN2 compras"
  Assert-Q "SELECT count(*) FROM ra_cuentas_por_pagar_movimientos m JOIN ra_compras c ON c.id=m.compra_id WHERE c.operation_id IN ($ops2) AND m.tipo='cargo';" 1 "SCN2 cargos"
  Assert-Q "SELECT count(*) FROM ra_kardex k JOIN ra_compras c ON c.id=k.referencia_id WHERE c.operation_id IN ($ops2);" 2 "SCN2 kardex"

  Write-Host "`n===== ESCENARIO 3: mismo op, payload identico ====="
  $s3 = Invoke-Pair -scn '3'
  foreach ($r in $s3) {
    if ($r.Outcome -ne 'OK') { throw "FALLO SCN3: outcome $($r.Ses)=$($r.Outcome)" }
    if ($r.Cid -eq '-')     { throw "FALLO SCN3: $($r.Ses) sin compra id" }
  }
  $repFalse = @($s3 | Where-Object { $_.Rep -eq 'false' }).Count
  $repTrue  = @($s3 | Where-Object { $_.Rep -eq 'true' }).Count
  if ($repFalse -ne 1 -or $repTrue -ne 1) {
    throw "FALLO SCN3: replayed split incorrecto (false=$repFalse true=$repTrue)"
  }
  if ($s3[0].Cid -ne $s3[1].Cid) { throw "FALLO SCN3: compra ids distintos" }
  Write-Host ("[SCN3] misma compra {0}: una confirmed + una replayed:true" -f $s3[0].Cid)
  $op3 = "'" + $s3[0].Op + "'"
  Assert-Q "SELECT count(*) FROM ra_compras WHERE operation_id = $op3;" 1 "SCN3 compras"
  Assert-Q "SELECT count(*) FROM ra_cuentas_por_pagar_movimientos m JOIN ra_compras c ON c.id=m.compra_id WHERE c.operation_id = $op3;" 1 "SCN3 cargos"
  Assert-Q "SELECT count(*) FROM ra_kardex k JOIN ra_compras c ON c.id=k.referencia_id WHERE c.operation_id = $op3;" 1 "SCN3 kardex"
  Write-Host "[SCN3] efectos: 1 compra / 1 cargo / 1 kardex - IDEMPOTENCIA CONCURRENTE DEMOSTRADA"

  Write-Host "`n===== ESCENARIO 4: mismo op, payload distinto ====="
  $s4 = Invoke-Pair -scn '4'
  $ok4  = @($s4 | Where-Object { $_.Outcome -eq 'OK' }).Count
  $con4 = @($s4 | Where-Object { $_.Outcome -eq 'RA_IDEMPOTENCY_CONFLICT' }).Count
  if ($ok4 -ne 1 -or $con4 -ne 1) { throw "FALLO SCN4: OK=$ok4 CONFLICT=$con4" }
  Write-Host "[SCN4] 1 confirmacion + 1 RA_IDEMPOTENCY_CONFLICT"
  $op4 = "'" + $s4[0].Op + "'"
  Assert-Q "SELECT count(*) FROM ra_compras WHERE operation_id = $op4;" 1 "SCN4 compras"
  Assert-Q "SELECT count(*) FROM ra_cuentas_por_pagar_movimientos m JOIN ra_compras c ON c.id=m.compra_id WHERE c.operation_id = $op4;" 1 "SCN4 cargos"
  Assert-Q "SELECT count(*) FROM ra_kardex k JOIN ra_compras c ON c.id=k.referencia_id WHERE c.operation_id = $op4;" 1 "SCN4 kardex"
  Write-Host "[SCN4] efectos del perdedor: cero"


  # ============================================================
  # ESCENARIO 5 - reparacion concurrente (mismo repair op/compra/motivo)
  # ============================================================
  Write-Host "`n===== ESCENARIO 5: reparacion concurrente ====="
  $s5 = Invoke-Pair -scn '5'
  foreach ($r in $s5) {
    if ($r.Outcome -ne 'OK') { throw "FALLO SCN5: outcome $($r.Ses)=$($r.Outcome)" }
    if ($r.Cid -eq '-')     { throw "FALLO SCN5: $($r.Ses) sin compra" }
  }
  $executed = @($s5 | Where-Object { $_.Changed -eq 'true' -and $_.Rep -eq 'false' }).Count
  $replayed = @($s5 | Where-Object { $_.Changed -eq 'true' -and $_.Rep -eq 'true'  }).Count
  if ($executed -ne 1 -or $replayed -ne 1) {
    throw "FALLO SCN5: combinaciones incorrectas (ejecuto=$executed replay=$replayed)"
  }
  if ($s5[0].Cid -ne $s5[1].Cid) { throw "FALLO SCN5: compras distintas" }
  Write-Host ("[SCN5] misma compra {0}: una ejecuta y una hace replay; ambas conservan changed:true" -f $s5[0].Cid)
  $op5 = "'" + $s5[0].Op + "'"
  Assert-Q "SELECT count(*) FROM ra_auditoria_estado_pago_compras WHERE operation_id = $op5;" 1 "SCN5 auditorias"
  Assert-Q "SELECT count(*) FROM ra_compras c WHERE c.id = $($s5[0].Cid)::uuid AND c.estado_pago = 'pagado';" 1 "SCN5 estado final"
  Write-Host "[SCN5] una sola fila de auditoria + estado final pagado"

  Write-Host "`nCONCURRENCIA REAL VERIFICADA EN LOS 5 ESCENARIOS."
}
finally {
  foreach ($j in $script:jobs) {
    Stop-Job $j -ErrorAction SilentlyContinue
    Remove-Job $j -Force -ErrorAction SilentlyContinue
  }
}
