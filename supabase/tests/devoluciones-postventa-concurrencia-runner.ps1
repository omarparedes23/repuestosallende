param(
  [Parameter(Mandatory=$true)][string]$ConnectionString,
  [string]$RunId = [guid]::NewGuid().ToString('N'),
  [string]$PsqlPath = 'D:\software\PostgreSQL\18\bin\psql.exe'
)

$ErrorActionPreference = 'Stop'
if ($RunId -notmatch '^[0-9a-f]{32}$') { throw 'RunId debe contener exactamente 32 hexadecimales.' }
if (-not (Test-Path -LiteralPath $PsqlPath)) { throw "psql no encontrado: $PsqlPath" }
if (-not $env:PGPASSWORD) { throw 'Define PGPASSWORD temporalmente para Supabase TEST.' }

$root = $PSScriptRoot
$tmp = Join-Path $env:TEMP "repuestosallende-postventa-concurrencia-$RunId"
New-Item -ItemType Directory -Path $tmp -Force | Out-Null

function Invoke-Query([string]$Query) {
  $output = & $PsqlPath $ConnectionString -X -tA -v ON_ERROR_STOP=1 -c $Query 2>&1
  if ($LASTEXITCODE -ne 0) { throw "psql falló: $output" }
  return ([string]$output).Trim()
}

function Invoke-File([string]$File, [string[]]$Variables) {
  & $PsqlPath $ConnectionString -X -v ON_ERROR_STOP=1 @Variables -f $File
  if ($LASTEXITCODE -ne 0) { throw "psql falló al ejecutar $File" }
}

$stockBefore = $null
$serieBefore = $null
try {
  $stockBefore = Invoke-Query "SELECT stock_actual FROM public.ra_productos WHERE id='90000000-0000-4000-8000-000000000001'::uuid;"
  $serieBefore = Invoke-Query "SELECT s.siguiente_correlativo FROM public.ra_series_documento s JOIN public.ra_ventas v ON v.empresa_id=s.empresa_id AND v.sucursal_id=s.sucursal_id WHERE v.id='90000000-0000-4000-8000-000000000010'::uuid AND s.tipo_documento='nota_credito_boleta' AND s.serie='BCTST';"
  if (-not $stockBefore -or -not $serieBefore) { throw 'Fixture postventa o serie BCTST ausente; ejecute primero el seed.' }
  Invoke-File (Join-Path $root 'devoluciones-postventa-concurrencia-setup.sql') @('-v',"RUN_ID=$RunId")

  $actors = Invoke-Query "SELECT (SELECT p.id FROM public.ra_perfiles p JOIN public.ra_ventas v ON v.empresa_id=p.empresa_id AND v.sucursal_id=p.sucursal_id WHERE v.id='90000000-0000-4000-8000-000000000010'::uuid AND p.activo AND p.rol IN ('administrador','superadmin') ORDER BY p.id LIMIT 1)::text || '|' || string_agg(d.id::text,'|' ORDER BY d.created_at) FROM public.ra_devoluciones d WHERE d.motivo='CONCURRENCIA:$RunId' AND d.estado='aprobada';"
  $parts = $actors.Split('|')
  if ($parts.Count -ne 3) { throw "Setup inválido: se esperaban admin y dos devoluciones aprobadas; recibido '$actors'." }
  $adminId,$returnA,$returnB = $parts
  $logA = Join-Path $tmp 'session-a.log'; $logB = Join-Path $tmp 'session-b.log'
  $opA = [guid]::NewGuid().ToString(); $opB = [guid]::NewGuid().ToString()
  # Start-Process concatena ArgumentList; se conserva la cadena libpq como un único argumento.
  $quotedConnection = '"' + $ConnectionString + '"'
  $argsA = @($quotedConnection,'-X','-v','ON_ERROR_STOP=1','-v',"ADMIN_ID=$adminId",'-v',"DEVOLUCION_ID=$returnA",'-v',"OPERATION_ID=$opA",'-f',(Join-Path $root 'devoluciones-postventa-concurrencia-sesion-a.sql'))
  $argsB = @($quotedConnection,'-X','-v','ON_ERROR_STOP=1','-v',"ADMIN_ID=$adminId",'-v',"DEVOLUCION_ID=$returnB",'-v',"OPERATION_ID=$opB",'-f',(Join-Path $root 'devoluciones-postventa-concurrencia-sesion-b.sql'))
  $a = Start-Process -FilePath $PsqlPath -ArgumentList $argsA -RedirectStandardOutput $logA -RedirectStandardError "$logA.err" -NoNewWindow -PassThru
  Start-Sleep -Seconds 1
  $b = Start-Process -FilePath $PsqlPath -ArgumentList $argsB -RedirectStandardOutput $logB -RedirectStandardError "$logB.err" -NoNewWindow -PassThru
  $a.WaitForExit(); $b.WaitForExit()
  $outA = (Get-Content -LiteralPath $logA -Raw) + (Get-Content -LiteralPath "$logA.err" -Raw)
  $outB = (Get-Content -LiteralPath $logB -Raw) + (Get-Content -LiteralPath "$logB.err" -Raw)
  if ($a.ExitCode -ne 0 -or $outA -notmatch 'RESULT:CONCURRENCIA:A:COMMITTED') { throw "Sesión A no liquidó correctamente.`n$outA" }
  if ($b.ExitCode -eq 0 -or $outB -notmatch 'RA_RETURN_QUANTITY_EXCEEDED') { throw "Sesión B no fue rechazada por cantidad.`n$outB" }
  $state = Invoke-Query "SELECT string_agg(estado::text,'|' ORDER BY estado) FROM public.ra_devoluciones WHERE id IN ('$returnA'::uuid,'$returnB'::uuid);"
  if ($state -ne 'aprobada|liquidada') { throw "Estados finales inesperados: $state" }
  Write-Host "PASS concurrencia postventa RUN_ID=$RunId (A liquidada, B RA_RETURN_QUANTITY_EXCEEDED)"
}
finally {
  if ($null -ne $stockBefore -and $null -ne $serieBefore) {
    Invoke-File (Join-Path $root 'devoluciones-postventa-concurrencia-retire-fixture.sql') @('-v',"RUN_ID=$RunId",'-v',"STOCK_BEFORE=$stockBefore",'-v',"SERIE_BEFORE=$serieBefore")
    $remaining = Invoke-Query "SELECT count(*) FROM public.ra_devoluciones WHERE motivo='CONCURRENCIA:$RunId';"
    $stockAfter = Invoke-Query "SELECT stock_actual FROM public.ra_productos WHERE id='90000000-0000-4000-8000-000000000001'::uuid;"
    $serieAfter = Invoke-Query "SELECT s.siguiente_correlativo FROM public.ra_series_documento s JOIN public.ra_ventas v ON v.empresa_id=s.empresa_id AND v.sucursal_id=s.sucursal_id WHERE v.id='90000000-0000-4000-8000-000000000010'::uuid AND s.tipo_documento='nota_credito_boleta' AND s.serie='BCTST';"
    if ($remaining -ne '0' -or $stockAfter -ne $stockBefore -or $serieAfter -ne $serieBefore) { throw "Retiro incompleto: devoluciones=$remaining stock=$stockAfter serie=$serieAfter" }
    Write-Host 'Limpieza verificada: residuo cero.'
  }
}
