param(
  [Parameter(Mandatory)][string]$RunId,
  [Parameter(Mandatory)][string]$AdminEmail,
  [Parameter(Mandatory)][string]$BranchId,
  [Parameter(Mandatory)][string]$VentaId,
  [Parameter(Mandatory)][decimal]$MontoVenta,
  [Parameter(Mandatory)][string]$CompraId,
  [Parameter(Mandatory)][decimal]$MontoCompra
)
# Solo TEST: VentaId y CompraId deben ser fixtures comprometidos con saldo
# exactamente MontoVenta/MontoCompra. Nunca pasar documentos operativos.
$ErrorActionPreference='Stop'
if (-not $env:DATABASE_URL) { throw 'Define DATABASE_URL de Supabase TEST.' }
$sql=Join-Path $PSScriptRoot 'tesoreria-abonos-concurrencia.test.sql'
$mv=$MontoVenta.ToString('0.00',[Globalization.CultureInfo]::InvariantCulture)
$mc=$MontoCompra.ToString('0.00',[Globalization.CultureInfo]::InvariantCulture)
$preflight=& psql $env:DATABASE_URL -X -tA -v ON_ERROR_STOP=1 -c "WITH b AS (SELECT id FROM ra_sucursales WHERE id='$BranchId' AND activo AND nombre='TESORERIA-ABONOS-CONC:$RunId'), cxc AS (SELECT COALESCE(sum(CASE WHEN tipo='cargo' THEN monto ELSE -monto END),0) s FROM ra_cuenta_corriente_movimientos WHERE venta_id='$VentaId'), cxp AS (SELECT COALESCE(sum(CASE WHEN tipo='cargo' THEN monto ELSE -monto END),0) s FROM ra_cuentas_por_pagar_movimientos WHERE compra_id='$CompraId') SELECT (SELECT count(*) FROM b)||'|'||(SELECT s FROM cxc)||'|'||(SELECT s FROM cxp);"
if($LASTEXITCODE -ne 0 -or $preflight.Trim() -ne "1|$mv|$mc"){throw "Fixture invalido: se requiere sucursal etiquetada y saldos exactos. Resultado: $preflight"}
function Invoke-Pair([string]$kind,[string]$document,[decimal]$amount) {
  $jobs=@(); foreach($ses in 'A','B') {
    $jobs+=Start-Job -ScriptBlock { param($db,$file,$k,$s,$run,$email,$branch,$doc,$amt)
      $output=& psql $db -X -v ON_ERROR_STOP=1 -v KIND=$k -v SES=$s -v RUN_ID=$run -v ADMIN_EMAIL=$email -v BRANCH_ID=$branch -v DOCUMENT_ID=$doc -v AMOUNT=$amt -f $file 2>&1
      [pscustomobject]@{Exit=$LASTEXITCODE;Output=($output|Out-String)}
    } -ArgumentList $env:DATABASE_URL,$sql,$kind,$ses,$RunId,$AdminEmail,$BranchId,$document,$amount
  }
  if(-not (Wait-Job $jobs -Timeout 90)){$jobs|Stop-Job;throw "timeout $kind"}
  $out=@($jobs|Receive-Job);$jobs|Remove-Job -Force
  foreach($r in $out){if($r.Exit -ne 0 -or $r.Output -notmatch "RESULT:ABONO:${kind}:"){throw "FALLO ${kind}: $($r.Output)"}}
  if((@($out|Where-Object {$_.Output -match ':OK:'})).Count -ne 1){throw "$kind debe confirmar exactamente un abono"}
  Write-Host "PASS ${kind}: un abono confirmado y uno rechazado por saldo."; $out.Output|Write-Host
}
Invoke-Pair CXC $VentaId $MontoVenta
Invoke-Pair CXP $CompraId $MontoCompra
