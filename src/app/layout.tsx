import type { Metadata } from "next";
import { Inter, Outfit } from "next/font/google";
import "./globals.css";

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
  metadataBase: new URL("https://repuestosallende.com"), // Ajustar a la URL real en producción
  title: "Repuestos Sprinter Mercedes Benz | Repuestos Allende E.I.R.L.",
  description: "Repuestos Mercedes Benz Sprinter en Lima | Repuestos Allende E.I.R.L. Especialistas en repuestos originales y alternativos para Mercedes-Benz Sprinter en La Victoria.",
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
    "repuestos comerciales"
  ],
  authors: [{ name: "Repuestos Allende" }],
  creator: "Repuestos Allende",
  publisher: "Repuestos Allende E.I.R.L.",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    locale: "es_PE",
    url: "https://repuestosallende.com",
    siteName: "Repuestos Allende",
    title: "Repuestos Sprinter Mercedes Benz | Repuestos Allende E.I.R.L.",
    description: "Especialistas en repuestos originales y alternativos para Mercedes Benz Sprinter en La Victoria, Lima, Perú.",
    images: [
      {
        url: "/images/portada.jpg", // Asegurarse de tener una buena imagen genérica
        width: 1200,
        height: 630,
        alt: "Repuestos Allende E.I.R.L.",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Repuestos Sprinter Mercedes Benz | Repuestos Allende E.I.R.L.",
    description: "Especialistas en repuestos originales y alternativos para Mercedes Benz Sprinter en La Victoria, Lima, Perú.",
    images: ["/images/portada.jpg"],
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
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "AutoPartsStore",
    "name": "Repuestos Allende E.I.R.L.",
    "description": "Especialistas en repuestos originales y alternativos para Mercedes Benz Sprinter, Actros, Atego, Peugeot, Hyundai, Renault e Iveco en La Victoria, Lima, Perú.",
    "knowsAbout": [
      "Repuestos Mercedes Benz Sprinter",
      "Repuestos Sprinter Mercedes Benz",
      "Autopartes Mercedes Benz Sprinter",
      "Repuestos Peugeot",
      "Repuestos Hyundai",
      "Repuestos comerciales",
      "Repuestos de línea pesada"
    ],
    "image": "https://repuestosallende.com/images/repuestosallendelogo.png",
    "@id": "https://repuestosallende.com",
    "url": "https://repuestosallende.com",
    "telephone": "+51975167682",
    "email": "ventas@repuestosallende.com",
    "address": {
      "@type": "PostalAddress",
      "streetAddress": "Av. Manco Cápac 316",
      "addressLocality": "La Victoria",
      "addressRegion": "Lima",
      "postalCode": "15018",
      "addressCountry": "PE"
    },
    "geo": {
      "@type": "GeoCoordinates",
      "latitude": -12.0641667,
      "longitude": -77.0138889
    },
    "openingHoursSpecification": {
      "@type": "OpeningHoursSpecification",
      "dayOfWeek": [
        "Monday",
        "Tuesday",
        "Wednesday",
        "Thursday",
        "Friday",
        "Saturday"
      ],
      "opens": "09:00",
      "closes": "18:00"
    },
    "sameAs": [
      "https://www.facebook.com/repuestosallendeeirl",
      "https://www.tiktok.com/@repuestos_allende"
    ]
  };

  return (
    <html lang="es" className={`${inter.variable} ${outfit.variable} h-full antialiased`}>
      <head>
        {/* Etiquetas meta clásicas para GEO SEO por si los crawlers antiguos las necesitan */}
        <meta name="geo.region" content="PE-LMA" />
        <meta name="geo.placename" content="La Victoria, Lima" />
        <meta name="geo.position" content="-12.0641667;-77.0138889" />
        <meta name="ICBM" content="-12.0641667, -77.0138889" />
      </head>
      <body className="min-h-full flex flex-col font-sans">
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
