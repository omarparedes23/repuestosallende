# Repuestos Allende

Plataforma web de **Repuestos Allende E.I.R.L.** (repuestos automotrices, especialidad Sprinter). Incluye landing pública con catálogo y chatbot de búsqueda, un POS para tablet en tienda física, y un panel administrativo de backoffice.

## Stack

- **Next.js 16** (App Router) · **React 19**
- **Supabase** (Postgres + Auth + RLS) como base de datos
- **Tailwind CSS 4** + `class-variance-authority` + `tailwind-merge`
- **Zustand 5** (estado del POS)
- **decimal.js** (cálculos monetarios exactos)
- **Zod 4** (validación)
- **OpenAI SDK** (chatbot con function calling / búsqueda semántica)
- **AWS S3 SDK** contra **Cloudflare R2** (almacenamiento de imágenes)
- `framer-motion`, `lucide-react`

## Módulos

### Landing pública (`/`)
Catálogo de repuestos por modelo (`/catalogo/[modelo]`) y por producto, con datos servidos desde Supabase (`ra_catalogo_repuestos`, `ra_categorias`). Incluye un chatbot de IA (`/api/chat`) que responde consultas de clientes con stock y precios reales en tiempo real.

### Tablet POS (`/tablet/*`)
Punto de venta para tablet en tienda:
- `/tablet/login` — autenticación
- `/tablet/pos` — venta (búsqueda de productos, carrito, cobro con split payment)
- `/tablet/caja` — apertura/cierre y movimientos de caja
- `/tablet/ventas` — historial de ventas del día
- `/tablet/clientes` — gestión de clientes

### Panel administrativo (`/panel/*`)
Backoffice de gestión:
- `articulos` — catálogo de productos
- `clientes` — gestión de clientes
- `proveedores` — gestión de proveedores
- `compras` — órdenes de compra
- `guias` — guías de remisión
- `liquidacion` — liquidaciones

## Requisitos previos

- Node.js 20+
- Un proyecto de Supabase (con las migraciones en `supabase/migrations/` aplicadas)
- Credenciales de Cloudflare R2 (almacenamiento de imágenes)
- API key de OpenAI o DeepSeek (chatbot)

## Variables de entorno

Crear `.env.local` en la raíz con:

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=

# Chatbot IA
AI_PROVIDER=          # "openai" o "deepseek"
OPENAI_API_KEY=
DEEPSEEK_API_KEY=
CHATBOT_LOGGING_ENABLED=

# Cloudflare R2 (imágenes)
R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_BUCKET_NAME=
R2_PUBLIC_URL=

# Facturación electrónica (OSE)
OSE_SUNAT_URL=
OSE_SUNAT_API_KEY=
```

## Desarrollo

```bash
npm install
npm run dev
```

Abrir [http://localhost:3000](http://localhost:3000).

```bash
npm run build   # build de producción
npm run start   # servir el build
npm run lint    # eslint
```

## Base de datos

Las migraciones SQL están en `supabase/migrations/`, numeradas secuencialmente. Todas las tablas propias del dominio usan el prefijo `ra_` (ej. `ra_productos`, `ra_catalogo_repuestos`, `ra_ventas`).

## Estructura del proyecto

```
src/
  app/
    (páginas públicas: home, catalogo)
    api/chat/        # endpoint del chatbot IA
    tablet/           # POS de tablet (route groups (auth) y (kiosk))
    panel/            # backoffice administrativo
  lib/
    supabase/         # clientes de Supabase (browser, server, middleware)
    calc/             # cálculos monetarios (totales, vuelto)
    facturacion/       # integración OSE/SUNAT
    r2.ts             # subida de imágenes a Cloudflare R2
    site.config.ts    # datos de contacto/marca (fuente única de verdad)
supabase/
  migrations/         # historial de migraciones SQL
```
