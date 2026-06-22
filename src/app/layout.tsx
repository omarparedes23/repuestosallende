import type { Metadata } from "next";
import { Inter, Outfit } from "next/font/google";
import "./globals.css";
import { siteConfig } from "@/lib/site.config";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  metadataBase: new URL(siteConfig.dominio),
  title: "Repuestos Sprinter Mercedes Benz | Repuestos Allende E.I.R.L.",
  description:
    "Repuestos Mercedes Benz Sprinter en Lima | Repuestos Allende E.I.R.L. Especialistas en repuestos originales y alternativos para Mercedes-Benz Sprinter en La Victoria.",
  keywords: [
    "repuestos sprinter mercedes benz",
    "repuestos mercedes benz sprinter",
    "repuestos sprinter",
    "repuestos sprinter lima",
    "repuestos sprinter la victoria",
    "repuestos mercedes benz sprinter lima",
    "repuestos mercedes benz sprinter la victoria",
    "mercedes benz sprinter repuestos",
    "repuestos sprinter peru",
    "tienda de repuestos sprinter",
    "autopartes sprinter mercedes benz",
    "accesorios mercedes benz sprinter",
    "repuestos mercedes benz",
    "mercedes benz sprinter",
    "repuestos allende sprinter",
    "la victoria",
    "lima",
    "peru",
    "repuestos peugeot",
    "repuestos hyundai",
    "repuestos renault",
    "repuestos iveco",
    "repuestos de linea pesada",
    "repuestos comerciales",
  ],
  authors: [{ name: siteConfig.marcaCorta }],
  creator: siteConfig.marcaCorta,
  publisher: siteConfig.razonSocial,
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    locale: "es_PE",
    url: siteConfig.dominio,
    siteName: siteConfig.marcaCorta,
    title: "Repuestos Sprinter Mercedes Benz | Repuestos Allende E.I.R.L.",
    description:
      "Especialistas en repuestos originales y alternativos para Mercedes Benz Sprinter en La Victoria, Lima, Perú.",
    images: [
      {
        url: siteConfig.imagenes.portada,
        width: 1200,
        height: 630,
        alt: siteConfig.razonSocial,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Repuestos Sprinter Mercedes Benz | Repuestos Allende E.I.R.L.",
    description:
      "Especialistas en repuestos originales y alternativos para Mercedes Benz Sprinter en La Victoria, Lima, Perú.",
    images: [siteConfig.imagenes.portada],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-video-preview": -1,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  // Schema JSON-LD: AutoPartsStore (SEO Local con datos geo).
  // El schema FAQPage se inyecta desde src/app/home/FAQ.tsx (sección por sección).
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "AutoPartsStore",
    name: siteConfig.razonSocial,
    description:
      "Especialistas en repuestos originales y alternativos para Mercedes Benz Sprinter, Actros, Atego, Peugeot, Hyundai, Renault e Iveco en La Victoria, Lima, Perú.",
    knowsAbout: [
      "Repuestos Mercedes Benz Sprinter",
      "Repuestos Sprinter Mercedes Benz",
      "Autopartes Mercedes Benz Sprinter",
      "Repuestos Peugeot",
      "Repuestos Hyundai",
      "Repuestos comerciales",
      "Repuestos de línea pesada",
    ],
    image: `${siteConfig.dominio}${siteConfig.imagenes.logo}`,
    "@id": siteConfig.dominio,
    url: siteConfig.dominio,
    telephone: `+${siteConfig.telefonoIntl}`,
    email: siteConfig.email,
    address: {
      "@type": "PostalAddress",
      streetAddress: siteConfig.direccion.linea,
      addressLocality: siteConfig.direccion.distrito,
      addressRegion: siteConfig.direccion.ciudad,
      postalCode: "15018",
      addressCountry: "PE",
    },
    geo: {
      "@type": "GeoCoordinates",
      latitude: siteConfig.geo.lat,
      longitude: siteConfig.geo.lng,
    },
    openingHoursSpecification: {
      "@type": "OpeningHoursSpecification",
      dayOfWeek: [
        "Monday",
        "Tuesday",
        "Wednesday",
        "Thursday",
        "Friday",
        "Saturday",
      ],
      opens: "09:00",
      closes: "18:00",
    },
    sameAs: [siteConfig.redes.facebook.url, siteConfig.redes.tiktok.url],
  };

  return (
    <html lang="es" className={`${inter.variable} ${outfit.variable} h-full antialiased`}>
      <head>
        {/* Etiquetas meta clásicas para GEO SEO por si los crawlers antiguos las necesitan */}
        <meta name="geo.region" content="PE-LMA" />
        <meta name="geo.placename" content={`${siteConfig.direccion.distrito}, ${siteConfig.direccion.ciudad}`} />
        <meta name="geo.position" content={`${siteConfig.geo.lat};${siteConfig.geo.lng}`} />
        <meta name="ICBM" content={`${siteConfig.geo.lat}, ${siteConfig.geo.lng}`} />
      </head>
      <body className="min-h-full flex flex-col font-sans">
        {/* Skip-link de accesibilidad */}
        <a href="#contenido" className="skip-link">
          Saltar al contenido
        </a>

        {/* Inject JSON-LD Schema Markup para SEO Local (Geo) */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
        {children}
      </body>
    </html>
  );
}
