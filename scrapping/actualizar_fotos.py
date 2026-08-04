"""
actualizar_fotos.py — Reemplazo masivo de la foto repetida del catálogo.

Plan de referencia: ../scapping.md (secciones 5 y 7). La fuente de imágenes es
Serper.dev (endpoint /images) — ver decisión en scapping.md sección 3.

Uso:
    python actualizar_fotos.py --dry-run            # simulacro completo, no escribe nada
    python actualizar_fotos.py --limit 5            # real sobre los primeros 5
    python actualizar_fotos.py                      # lote completo (~349)

Pipeline por producto:
    1. Genera variantes de query (OEM crudo / normalizado / +nombre / alternos)
    2. Serper /images -> candidatos rankeados por heurísticas (dominio, tamaño)
    3. Descarga + validación real (PIL: formato jpg/png/webp, >=200px, <=8MB)
    4. Upload a R2 (boto3) con la MISMA convención de src/lib/r2.ts:
       key = productos/{catalogoId}.{ext}, url pública con ?v={timestamp}
    5. PATCH imagen_url en Supabase (PostgREST + service role)

Cada producto procesado deja una línea en manifiesto.jsonl con la URL vieja
y la nueva (auditoría + rollback). Al ser la foto repetida el filtro de
extracción, el script es idempotente: lo ya procesado no vuelve a aparecer.
"""

import argparse
import io
import json
import os
import re
import sys
import time
from datetime import datetime, timezone

import boto3
import requests
from dotenv import load_dotenv
from PIL import Image

# Consola Windows: evita UnicodeEncodeError con caracteres fuera de cp1252
sys.stdout.reconfigure(encoding="utf-8", errors="replace")

load_dotenv()

# ── Config ────────────────────────────────────────────────────────────────────
SUPABASE_URL = os.environ["NEXT_PUBLIC_SUPABASE_URL"].rstrip("/")
SUPABASE_KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
SERPER_KEY = os.environ["SERPER_API_KEY"]
R2_ACCOUNT_ID = os.environ["R2_ACCOUNT_ID"]
R2_ACCESS_KEY_ID = os.environ["R2_ACCESS_KEY_ID"]
R2_SECRET_ACCESS_KEY = os.environ["R2_SECRET_ACCESS_KEY"]
R2_BUCKET = os.environ["R2_BUCKET_NAME"]
R2_PUBLIC_URL = os.environ["R2_PUBLIC_URL"].rstrip("/")

FOTO_REPETIDA = "ffae9556"          # fragmento de la URL del amortiguador repetido
MAX_QUERIES_POR_PRODUCTO = 5        # protege los 2.500 créditos gratis de Serper
MAX_CANDIDATOS_DESCARGA = 4         # intentos de descarga por variante de query
PAUSA_SERPER_SEG = 0.4              # cortesía de rate limit
MAX_BYTES = 8 * 1024 * 1024
MIN_PX = 200

# Dominios que NO son fuente de foto de producto (redes sociales, blogs) ni
# confiables para códigos OEM (B2B multi-industria: un código corto tipo
# "66415" ahí puede ser una junta Kubota o un reloj, no un amortiguador).
DOMINIOS_BLACKLIST = (
    "pinterest", "facebook", "instagram", "youtube", "tiktok",
    "twitter", "x.com", "blogspot", "wordpress", "wikipedia", "wikimedia",
    "made-in-china", "alibaba", "aliexpress", "dhgate", "wish",
)

# Fabricantes / retailers de autopartes: bonus de confianza
DOMINIOS_BONUS = (
    "autodoc", "oscaro", "motointegrator", "daparto", "ebay", "mercadolibre",
    "skf", "bosch", "sachs", "febi", "meyle", "gates", "dayco", "continental",
    "ina", "fag", "koyo", "ntn", "nsk", "valeo", "mahle", "mann", "hengst",
    "mercedes-benz", "mercedesbenz", "sprinter",
)

UA = {"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"}


# ── Supabase (PostgREST directo, service role -> bypasea RLS) ─────────────────
def sb_headers():
    return {
        "apikey": SUPABASE_KEY,
        "Authorization": f"Bearer {SUPABASE_KEY}",
        "Content-Type": "application/json",
        "Prefer": "return=minimal",
    }


def get_modelos_activos():
    """IDs de ra_modelos_auto activos (los 10 Sprinter navegables del catálogo)."""
    r = requests.get(
        f"{SUPABASE_URL}/rest/v1/ra_modelos_auto",
        headers=sb_headers(),
        params={"select": "id,slug", "activo": "eq.true"},
        timeout=30,
    )
    r.raise_for_status()
    return r.json()


def get_productos(modelo_ids):
    """
    Productos visibles en el catálogo público con la foto repetida.
    Misma regla de visibilidad que src/app/catalogo/[modelo]/page.tsx:
    activo + compatibilidad con algún modelo activo. Dedupe por id.
    """
    ids = ",".join(modelo_ids)
    r = requests.get(
        f"{SUPABASE_URL}/rest/v1/ra_catalogo_repuestos",
        headers=sb_headers(),
        params={
            "select": "id,nombre,codigo_oem,codigos_alternos,imagen_url,"
                      "ra_compatibilidades!inner(modelo_id)",
            "activo": "eq.true",
            "or": f"(imagen_url.is.null,imagen_url.eq.,imagen_url.like.*{FOTO_REPETIDA}*)",
            "ra_compatibilidades.modelo_id": f"in.({ids})",
            "order": "nombre",
        },
        timeout=60,
    )
    r.raise_for_status()
    vistos, productos = set(), []
    for row in r.json():
        if row["id"] not in vistos:
            vistos.add(row["id"])
            row.pop("ra_compatibilidades", None)
            productos.append(row)
    return productos


def patch_imagen_url(catalogo_id, nueva_url):
    r = requests.patch(
        f"{SUPABASE_URL}/rest/v1/ra_catalogo_repuestos",
        headers=sb_headers(),
        params={"id": f"eq.{catalogo_id}"},
        json={"imagen_url": nueva_url},
        timeout=30,
    )
    r.raise_for_status()


# ── Variantes de query (scapping.md sección 5: datos sucios verificados) ──────
SUFIJOS_RUIDO = re.compile(
    r"\s*[-–]?\s*(CP|TW|MD|NTN|KOYO|NSK|SKF|INA|FAG)$", re.IGNORECASE
)


def normalizar(codigo):
    return re.sub(r"[^A-Za-z0-9]", "", codigo or "")


def limpiar_nombre(nombre):
    return re.sub(r"\s+", " ", re.sub(r"[^A-Za-z0-9ñÑáéíóúÁÉÍÓÚ ]", " ", nombre or "")).strip()


def parece_codigo(norm):
    """Descarta valores que no son códigos ('BOLSA TIPO 1', etc.)."""
    return bool(re.search(r"\d{4,}", norm))


def variantes_query(nombre, oem, alternos):
    variantes = []
    oem_raw = (oem or "").strip()
    oem_base = SUFIJOS_RUIDO.sub("", oem_raw).strip()
    oem_norm = normalizar(oem_base)
    nombre_limpio = limpiar_nombre(nombre)

    if parece_codigo(oem_norm):
        # El contexto "sprinter" en la query reduce colisiones de códigos
        # cortos con otras industrias (verificado en dry-run: "SA1306" solo
        # devolvía un reloj; "SA1306 sprinter" devuelve el amortiguador).
        variantes.append(f"{oem_norm} sprinter")       # 1. normalizado + contexto
        if re.search(r"[ .\-\u2013]", oem_base):
            variantes.append(f'"{oem_base}"')          # 2. crudo con separadores
        if not oem_norm.upper().startswith("A"):
            variantes.append(f"A{oem_norm} sprinter")  # 3. prefijo Mercedes
        if nombre_limpio:
            variantes.append(f"{oem_norm} {nombre_limpio}")  # 4. código + nombre

    for alt in re.split(r"[,;/\s]+", alternos or ""):
        alt_norm = normalizar(SUFIJOS_RUIDO.sub("", alt))
        if parece_codigo(alt_norm):
            variantes.append(f"{alt_norm} sprinter")   # 5. códigos alternos

    if nombre_limpio:
        variantes.append(f"{nombre_limpio} mercedes sprinter repuesto")  # 6. último recurso

    # dedupe preservando orden, tope para proteger créditos
    vistas, resultado = set(), []
    for v in variantes:
        if v and v not in vistas:
            vistas.add(v)
            resultado.append(v)
    return resultado[:MAX_QUERIES_POR_PRODUCTO]


# ── Serper ────────────────────────────────────────────────────────────────────
def serper_images(query, reintentos=3):
    url = "https://google.serper.dev/images"
    for intento in range(reintentos):
        try:
            r = requests.post(
                url,
                headers={"X-API-KEY": SERPER_KEY, "Content-Type": "application/json"},
                json={"q": query, "gl": "pe", "hl": "es", "num": 10},
                timeout=20,
            )
            if r.status_code == 429:
                espera = 2 * (intento + 1)
                print(f"      rate limit, esperando {espera}s...")
                time.sleep(espera)
                continue
            r.raise_for_status()
            time.sleep(PAUSA_SERPER_SEG)
            return r.json().get("images", [])
        except requests.RequestException as e:
            if intento == reintentos - 1:
                print(f"      ERROR Serper: {e}")
            time.sleep(1)
    return []


# ── Validación de contexto por título ────────────────────────────────────────
# Red de seguridad que reemplaza (parcialmente) a la revisión humana: un
# candidato solo se acepta si el TÍTULO asociado a la imagen confirma que es
# el repuesto. Sin esto, códigos cortos ("66415", "SA1306") traen juntas de
# cosechadora, relojes o parrillas — verificado en dry-run 2026-07-31.
STOPWORDS_NOMBRE = {
    "mercedes", "benz", "para", "con", "sin", "del", "los", "las",
    "the", "and", "with", "original", "repuesto",
}

# Tokens que identifican el VEHÍCULO pero no el repuesto. No bastan para
# validar vía dominio de confianza: un eje de dirección "Mercedes Sprinter"
# de eBay NO es un amortiguador aunque el dominio sea confiable (falso
# positivo real detectado en dry-run 2026-07-31).
TOKENS_VEHICULO = {"sprinter", "dodge", "freightliner", "volkswagen", "crafter"}


def tokens_nombre(nombre):
    """Tokens significativos del nombre del producto (normalizados, >=4 chars)."""
    norm = re.sub(r"[^a-z0-9 ]", " ", (nombre or "").lower())
    tokens = {t for t in norm.split() if len(t) >= 4 and t not in STOPWORDS_NOMBRE}
    # "AM."/"AMORT" (amortiguador) matchea ES y PT por prefijo de substring
    if re.search(r"\bam\b|\bamort", norm):
        tokens.add("amort")
    return tokens


def norm_texto(s):
    return re.sub(r"[^a-z0-9]", "", (s or "").lower())


def candidato_valido(c, oem_norm, tokens):
    """
    Regla de aceptación (conservadora: ante la duda, rechaza — es mejor dejar
    un producto sin foto nueva que ponerle una foto EQUIVOCADA):
      - dominio blacklisteado -> nunca
      - código en el título Y algún token del nombre (el código da la
        identidad; el token confirma que no colisionó con otra industria)
      - token FUERTE (tipo de repuesto, no vehículo) Y dominio de confianza
        (para títulos que no muestran el código)
      - sin código OEM válido -> token fuerte requerido
    """
    dominio = (c.get("domain") or "").lower()
    if any(b in dominio for b in DOMINIOS_BLACKLIST):
        return False
    titulo = norm_texto(c.get("title"))
    link = norm_texto(c.get("link"))
    texto = titulo + link
    bonus = any(b in dominio for b in DOMINIOS_BONUS)
    token_match = any(t in texto for t in tokens)
    fuerte_match = any(t in texto for t in (tokens - TOKENS_VEHICULO))

    if oem_norm and parece_codigo(oem_norm):
        code_match = norm_texto(oem_norm) in texto
        return (code_match and token_match) or (fuerte_match and bonus)
    return fuerte_match or (token_match and bonus)


# ── Ranking por heurísticas (tamaño, proporción, dominio) ────────────────────
def score_candidato(c):
    dominio = (c.get("domain") or "").lower()
    if any(b in dominio for b in DOMINIOS_BLACKLIST):
        return -100
    w, h = c.get("imageWidth") or 0, c.get("imageHeight") or 0
    s = 0
    if w >= 400:
        s += 2
    if w >= 800:
        s += 1
    if w and h:
        ratio = w / h
        if 0.7 <= ratio <= 1.5:
            s += 2          # cuadrada: típica de foto de catálogo
        elif not 0.4 <= ratio <= 2.5:
            s -= 5          # banner / franja: casi seguro no es el repuesto
    if any(b in dominio for b in DOMINIOS_BONUS):
        s += 3
    return s


def descargar_validar(url):
    """Devuelve (bytes, ext) si la imagen es válida, o None."""
    try:
        r = requests.get(url, headers=UA, timeout=20, stream=True)
        if r.status_code != 200:
            return None
        content_type = (r.headers.get("Content-Type") or "").lower()
        if "image" not in content_type:
            return None
        data = r.content
        if len(data) > MAX_BYTES or len(data) < 5 * 1024:  # <5KB: sospechoso
            return None
        with Image.open(io.BytesIO(data)) as img:
            img.verify()
        with Image.open(io.BytesIO(data)) as img:
            w, h = img.size
            fmt = (img.format or "").upper()
        if w < MIN_PX or h < MIN_PX:
            return None
        ext = {"JPEG": "jpg", "PNG": "png", "WEBP": "webp"}.get(fmt)
        if not ext:
            return None
        return data, ext
    except Exception:
        return None


# ── R2 (misma convención que src/lib/r2.ts) ──────────────────────────────────
def subir_r2(data, ext, catalogo_id):
    key = f"productos/{catalogo_id}.{ext}"
    content_type = {"jpg": "image/jpeg", "png": "image/png", "webp": "image/webp"}[ext]
    s3 = boto3.client(
        "s3",
        region_name="auto",
        endpoint_url=f"https://{R2_ACCOUNT_ID}.r2.cloudflarestorage.com",
        aws_access_key_id=R2_ACCESS_KEY_ID,
        aws_secret_access_key=R2_SECRET_ACCESS_KEY,
    )
    s3.put_object(Bucket=R2_BUCKET, Key=key, Body=data, ContentType=content_type)
    ts = int(time.time() * 1000)  # Date.now() — invalida caché como en r2.ts
    return f"{R2_PUBLIC_URL}/{key}?v={ts}"


# ── Manifiesto (auditoría / rollback) ─────────────────────────────────────────
MANIFIESTO = os.path.join(os.path.dirname(__file__), "manifiesto.jsonl")


def registrar(registro):
    registro["ts"] = datetime.now(timezone.utc).isoformat()
    with open(MANIFIESTO, "a", encoding="utf-8") as f:
        f.write(json.dumps(registro, ensure_ascii=False) + "\n")


# ── Main ──────────────────────────────────────────────────────────────────────
def main():
    parser = argparse.ArgumentParser(description="Reemplaza la foto repetida del catálogo (scapping.md)")
    parser.add_argument("--dry-run", action="store_true", help="solo busca y muestra, no escribe nada")
    parser.add_argument("--limit", type=int, default=0, help="procesa solo N productos")
    parser.add_argument("--offset", type=int, default=0, help="salta los primeros N")
    args = parser.parse_args()

    modelos = get_modelos_activos()
    print(f"Modelos activos: {len(modelos)} ({', '.join(m['slug'] for m in modelos)})")

    productos = get_productos([m["id"] for m in modelos])
    total = len(productos)
    productos = productos[args.offset: args.offset + args.limit or None]
    print(f"Con foto repetida (visibles): {total} | a procesar ahora: {len(productos)}")
    if args.dry_run:
        print("*** DRY-RUN: no se subirá ni actualizará nada ***\n")

    resumen = {"ok": 0, "sin_resultados": 0, "errores": 0, "dry_run": 0}

    for i, p in enumerate(productos, 1):
        cid, nombre, oem = p["id"], p["nombre"], p.get("codigo_oem")
        print(f"[{i}/{len(productos)}] {nombre} (OEM: {oem or '-'})")
        registro = {
            "catalogo_id": cid, "nombre": nombre, "oem": oem,
            "imagen_url_anterior": p.get("imagen_url"),
        }
        try:
            elegido = None
            oem_base = SUFIJOS_RUIDO.sub("", (oem or "").strip())
            oem_norm = normalizar(oem_base)
            tokens = tokens_nombre(nombre)
            for query in variantes_query(nombre, oem, p.get("codigos_alternos")):
                print(f"    query: {query}")
                imagenes = serper_images(query)
                if not imagenes:
                    print("      0 resultados")
                    continue
                validos = sorted(
                    (c for c in imagenes if candidato_valido(c, oem_norm, tokens)),
                    key=score_candidato, reverse=True,
                )
                rechazados = len(imagenes) - len(validos)
                if rechazados:
                    print(f"      {rechazados} rechazados por validación de título")
                if not validos:
                    continue
                if args.dry_run:
                    top = validos[0]
                    print(f"      -> elegiría: {top.get('imageUrl')} "
                          f"({top.get('imageWidth')}x{top.get('imageHeight')}, {top.get('domain')})\n"
                          f"         título: {(top.get('title') or '')[:100]}")
                    elegido = {"url": top.get("imageUrl"), "query": query}
                    break
                for c in validos[:MAX_CANDIDATOS_DESCARGA]:
                    resultado = descargar_validar(c.get("imageUrl", ""))
                    if resultado:
                        elegido = {"url": c["imageUrl"], "query": query, "data_ext": resultado}
                        print(f"      -> OK: {c['imageUrl']} ({c.get('domain')})")
                        break
                if elegido:
                    break

            if not elegido:
                print("    SIN RESULTADOS")
                resumen["sin_resultados"] += 1
                registrar({**registro, "status": "sin_resultados"})
                continue

            if args.dry_run:
                resumen["dry_run"] += 1
                registrar({**registro, "status": "dry_run",
                           "query_ganadora": elegido["query"], "url_origen": elegido["url"]})
                continue

            data, ext = elegido["data_ext"]
            nueva_url = subir_r2(data, ext, cid)
            patch_imagen_url(cid, nueva_url)
            resumen["ok"] += 1
            registrar({**registro, "status": "ok", "query_ganadora": elegido["query"],
                       "url_origen": elegido["url"], "imagen_url_nueva": nueva_url})
        except Exception as e:
            print(f"    ERROR: {e}")
            resumen["errores"] += 1
            registrar({**registro, "status": "error", "detalle": str(e)})

    print("\n── Resumen ─────────────────────────────")
    for k, v in resumen.items():
        print(f"  {k}: {v}")
    print(f"Manifiesto: {MANIFIESTO}")
    if resumen["errores"] or resumen["sin_resultados"]:
        sys.exit(1)


if __name__ == "__main__":
    main()
