param(
  [Parameter(Mandatory)][string]$RunId,
  [Parameter(Mandatory)][string]$AdminEmail,
  [Parameter(Mandatory)][string]$BranchSaleFirst,
  [Parameter(Mandatory)][string]$ProductSaleFirst,
  [Parameter(Mandatory)][string]$CajaSaleFirst,
  [Parameter(Mandatory)][string]$BranchCloseFirst,
  [Parameter(Mandatory)][string]$ProductCloseFirst,
  [Parameter(Mandatory)][string]$CajaCloseFirst
)
# Solo TEST. Cada caso usa una sucursal/caja fixture distinta ya abierta, para
# demostrar los dos órdenes. No crea fixtures ni apunta a sucursales operativas.
$ErrorActionPreference='Stop'
if (-not $env:DATABASE_URL) { throw 'Define DATABASE_URL de Supabase TEST.' }
$sql=Join-Path $PSScriptRoot 'tesoreria-venta-cierre.test.sql'
$holdMs=5000

function Get-SessionApplicationName([string]$branch,[string]$session) {
  $source="$RunId`:$branch`:$session"
  $md5=[System.Security.Cryptography.MD5]::Create()
  try {
    $bytes=[System.Text.Encoding]::UTF8.GetBytes($source)
    $hash=$md5.ComputeHash($bytes)
    return 'ra-vc:'+([System.BitConverter]::ToString($hash).Replace('-','').ToLowerInvariant())
  } finally { $md5.Dispose() }
}

function Start-CaseSession([string]$session,[string]$branch,[string]$product,[string]$caja) {
  Start-Job -ScriptBlock {
    param($db,$file,$ses,$run,$email,$b,$p,$c,$hold)
    $output=& psql $db -X -v ON_ERROR_STOP=1 -v SES=$ses -v DELAY_MS=0 -v HOLD_MS=$hold -v RUN_ID=$run -v ADMIN_EMAIL=$email -v BRANCH_ID=$b -v PRODUCT_ID=$p -v CAJA_ID=$c -f $file 2>&1
    [pscustomobject]@{ Session=$ses; Exit=$LASTEXITCODE; Output=($output|Out-String) }
  } -ArgumentList $env:DATABASE_URL,$sql,$session,$RunId,$AdminEmail,$branch,$product,$caja,$holdMs
}

function Wait-OperationLock([string]$branch,[string]$session) {
  $app=Get-SessionApplicationName $branch $session
  for($i=0;$i -lt 50;$i++) {
    $ready=& psql $env:DATABASE_URL -X -tA -v ON_ERROR_STOP=1 -c "SELECT count(*) FROM pg_stat_activity WHERE application_name='$app' AND wait_event_type='Timeout';"
    if($LASTEXITCODE -eq 0 -and $ready.Trim() -eq '1'){ return }
    Start-Sleep -Milliseconds 100
  }
  throw "La sesion $session no alcanzo el punto de sincronizacion; no se prueba un orden determinista."
}

function Invoke-Case([string]$name,[string]$branch,[string]$product,[string]$caja,[string]$first) {
  $second=if($first -eq 'SALE'){'CLOSE'}else{'SALE'}
  $jobs=@(Start-CaseSession $first $branch $product $caja)
  Wait-OperationLock $branch $first
  $jobs+=Start-CaseSession $second $branch $product $caja
  if (-not (Wait-Job $jobs -Timeout 90)) { $jobs|Stop-Job; throw "timeout $name" }
  $out=@($jobs|Receive-Job); $jobs|Remove-Job -Force
  foreach($r in $out) { if($r.Exit -ne 0 -or $r.Output -notmatch 'RESULT:VC:') { throw "FALLO ${name}: $($r.Output)" } }
  $sale=($out|Where-Object {$_.Session -eq 'SALE'}).Output
  $close=($out|Where-Object {$_.Session -eq 'CLOSE'}).Output
  if($first -eq 'SALE') {
    if($sale -notmatch 'RESULT:VC:SALE:\d+:OK:[^:]+:[0-9a-f-]{36}' -or $close -notmatch 'RESULT:VC:CLOSE:\d+:OK:') {
      throw "FALLO ${name}: se esperaba venta confirmada antes del cierre. $sale $close"
    }
  } elseif($sale -notmatch 'RESULT:VC:SALE:\d+:RA_CASHBOX_NOT_OPEN:[^:]+:-' -or $close -notmatch 'RESULT:VC:CLOSE:\d+:OK:') {
    throw "FALLO ${name}: se esperaba cierre antes de venta rechazada. $sale $close"
  }
  Write-Host "PASS $name"; $out.Output | Write-Host
}

Invoke-Case 'SALE_FIRST'  $BranchSaleFirst  $ProductSaleFirst  $CajaSaleFirst  'SALE'
Invoke-Case 'CLOSE_FIRST' $BranchCloseFirst $ProductCloseFirst $CajaCloseFirst 'CLOSE'
$ids=@($BranchSaleFirst,$BranchCloseFirst) -join "','"
$check=& psql $env:DATABASE_URL -X -tA -v ON_ERROR_STOP=1 -c "WITH b AS (SELECT id FROM ra_sucursales WHERE id IN ('$ids')), x AS (SELECT count(*) FILTER (WHERE c.estado='cerrada') AS cerradas, count(DISTINCT l.id) AS liquidaciones, count(DISTINCT v.id) AS ventas, count(DISTINCT m.id) FILTER (WHERE c.fecha_cierre IS NOT NULL AND m.created_at>c.fecha_cierre) AS posteriores FROM b JOIN ra_cajas c ON c.sucursal_id=b.id LEFT JOIN ra_liquidaciones l ON l.caja_id=c.id LEFT JOIN ra_ventas v ON v.sucursal_id=b.id LEFT JOIN ra_movimientos_caja m ON m.caja_id=c.id) SELECT cerradas||'|'||liquidaciones||'|'||ventas||'|'||posteriores FROM x;"
if ($LASTEXITCODE -ne 0 -or $check.Trim() -ne '2|2|1|0') { throw "Invariantes venta-cierre fallaron: $check" }
Write-Host 'PASS invariantes: 2 cajas cerradas, 2 liquidaciones, 1 venta (solo SALE_FIRST), 0 movimientos posteriores.'
