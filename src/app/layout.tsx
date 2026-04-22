import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "Repuestos Allende E.I.R.L. | Expertos en Repuestos Mercedes Benz, Peugeot, Hyundai",
  description: "Repuestos Allende E.I.R.L. - Especialistas en repuestos para Mercedes Benz Sprinter, Actros, Atego, Peugeot, Hyundai, Renault e Iveco. Empresa formal en La Victoria, Lima.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className={`${inter.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col font-sans">{children}</body>
    </html>
  );
}
