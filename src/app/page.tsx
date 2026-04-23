"use client";

import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Phone,
  MapPin,
  Mail,
  Facebook,
  Menu,
  X,
  ChevronLeft,
  ChevronRight,
  Truck,
  Settings,
  ShieldCheck,
  Wrench,
  Clock,
  Package,
  Cog,
  MoveRight,
  Play,
  Video,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

/* ============================================================
   ANIMATION VARIANTS
   ============================================================ */
const fadeInUp = {
  hidden: { opacity: 0, y: 40 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.25, 0.1, 0.25, 1] as const } },
} as const;

const staggerContainer = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.15 } },
};

/* ============================================================
   NAVBAR
   ============================================================ */
function Navbar() {
  const [isOpen, setIsOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const navLinks = [
    { label: "Inicio", href: "#hero" },
    { label: "Marcas", href: "#marcas" },
    { label: "Especialidades", href: "#especialidades" },
    { label: "Productos", href: "#productos" },
    { label: "Tienda", href: "#tienda" },
    { label: "Contacto", href: "#contacto" },
    { label: "Ubicación", href: "#ubicacion" },
  ];

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled
          ? "bg-[#002D62]/95 backdrop-blur-md shadow-lg"
          : "bg-transparent"
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-20">
          {/* Logo */}
          <a href="#hero" className="flex items-center gap-3">
            <div className="w-10 h-10 bg-[#FFD700] rounded-lg flex items-center justify-center">
              <Truck className="w-6 h-6 text-[#002D62]" />
            </div>
            <div className="hidden sm:block">
              <h1 className="text-white font-bold text-lg leading-tight">
                REPUESTOS ALLENDE
              </h1>
              <p className="text-[#FFD700] text-[10px] font-semibold tracking-wider">
                E.I.R.L.
              </p>
            </div>
          </a>

          {/* Desktop Nav */}
          <div className="hidden md:flex items-center gap-8">
            {navLinks.map((link) => (
              <a
                key={link.href}
                href={link.href}
                className="text-white/90 hover:text-[#FFD700] text-sm font-medium transition-colors"
              >
                {link.label}
              </a>
            ))}
          </div>

          {/* CTA Button */}
          <div className="hidden md:flex items-center gap-4">
            <a
              href="https://wa.me/51935034586?text=Hola%20Repuestos%20Allende%2C%20estoy%20interesado%20en%20sus%20repuestos."
              target="_blank"
              rel="noopener noreferrer"
            >
              <Button className="bg-[#FFD700] text-[#002D62] hover:bg-[#e6c200] font-bold rounded-full px-6 shadow-lg transition-transform hover:scale-105">
                <Phone className="w-4 h-4 mr-2" />
                WhatsApp
              </Button>
            </a>
          </div>

          {/* Mobile Menu Button */}
          <button
            className="md:hidden text-white p-2"
            onClick={() => setIsOpen(!isOpen)}
            aria-label="Toggle menu"
          >
            {isOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="md:hidden bg-[#002D62] border-t border-white/10 overflow-hidden"
          >
            <div className="px-4 py-4 space-y-3">
              {navLinks.map((link) => (
                <a
                  key={link.href}
                  href={link.href}
                  onClick={() => setIsOpen(false)}
                  className="block text-white/90 hover:text-[#FFD700] py-2 text-sm font-medium transition-colors"
                >
                  {link.label}
                </a>
              ))}
              <a
                href="https://wa.me/51935034586?text=Hola%20Repuestos%20Allende%2C%20estoy%20interesado%20en%20sus%20repuestos."
                target="_blank"
                rel="noopener noreferrer"
                className="block pt-2"
              >
                <Button className="w-full bg-[#FFD700] text-[#002D62] hover:bg-[#e6c200] font-bold rounded-full">
                  <Phone className="w-4 h-4 mr-2" />
                  Escríbenos por WhatsApp
                </Button>
              </a>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </nav>
  );
}

/* ============================================================
   HERO
   ============================================================ */
function Hero() {
  return (
    <section
      id="hero"
      className="relative min-h-[90vh] flex items-center justify-center overflow-hidden"
    >
      {/* Background Image */}
      <div className="absolute inset-0 z-0">
        <img
          src="https://pub-ffd42694eda64a2f8f58d0f4b85d68be.r2.dev/portada.jpg"
          alt="Repuestos Allende - Tienda"
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-[#002D62]/95 via-[#002D62]/80 to-[#002D62]/60" />
      </div>

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-32">
        <motion.div
          initial="hidden"
          animate="visible"
          variants={staggerContainer}
          className="max-w-3xl"
        >
          <motion.div variants={fadeInUp} className="inline-flex items-center gap-2 bg-[#FFD700]/20 border border-[#FFD700]/40 rounded-full px-4 py-1.5 mb-6">
            <ShieldCheck className="w-4 h-4 text-[#FFD700]" />
            <span className="text-[#FFD700] text-sm font-semibold tracking-wide">
              EMPRESA FORMAL Y HABIDA
            </span>
          </motion.div>

          <motion.h1
            variants={fadeInUp}
            className="text-4xl sm:text-5xl lg:text-6xl font-extrabold text-white leading-tight mb-6"
          >
            Expertos en Repuestos para{" "}
            <span className="text-[#FFD700]">Línea Pesada</span> y{" "}
            <span className="text-[#FFD700]">Comercial</span>
          </motion.h1>

          <motion.p
            variants={fadeInUp}
            className="text-lg sm:text-xl text-white/80 mb-8 max-w-2xl leading-relaxed"
          >
            Somos especialistas en repuestos originales y certificados para
            Mercedes Benz, Peugeot, Hyundai, Renault e Iveco. Más de una década
            brindando soluciones a transportistas y flotas del Perú.
          </motion.p>

          <motion.div
            variants={fadeInUp}
            className="flex flex-col sm:flex-row gap-4"
          >
            <a
              href="https://wa.me/51935034586?text=Hola%20Repuestos%20Allende%2C%20estoy%20interesado%20en%20sus%20repuestos."
              target="_blank"
              rel="noopener noreferrer"
            >
              <Button className="bg-[#FFD700] text-[#002D62] hover:bg-[#e6c200] font-bold rounded-full px-8 py-6 text-base shadow-xl transition-transform hover:scale-105">
                <Phone className="w-5 h-5 mr-2" />
                Cotiza por WhatsApp
              </Button>
            </a>
            <a href="#especialidades">
              <Button
                variant="outline"
                className="border-white/30 text-white hover:bg-white/10 hover:text-white rounded-full px-8 py-6 text-base [&>*]:text-white"
              >
                <span className="text-white">Ver Especialidades</span>
                <ChevronRight className="w-5 h-5 ml-2 text-white" />
              </Button>
            </a>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}

/* ============================================================
   TRUST BAR
   ============================================================ */
function TrustBar() {
  return (
    <section className="bg-[#002D62] border-y border-[#FFD700]/20">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-10 text-center"
        >
          <div className="flex items-center gap-3">
            <ShieldCheck className="w-6 h-6 text-[#FFD700] flex-shrink-0" />
            <div className="text-left">
              <p className="text-white font-bold text-sm sm:text-base">
                RUC: 20610105280
              </p>
              <p className="text-white/60 text-xs">REPUESTOS ALLENDE E.I.R.L.</p>
            </div>
          </div>
          <div className="hidden sm:block w-px h-10 bg-white/20" />
          <div className="flex items-center gap-3">
            <ShieldCheck className="w-6 h-6 text-[#FFD700] flex-shrink-0" />
            <p className="text-white font-semibold text-sm sm:text-base">
              Empresa Formal Activa y Habida
            </p>
          </div>
          <div className="hidden sm:block w-px h-10 bg-white/20" />
          <div className="flex items-center gap-3">
            <MapPin className="w-6 h-6 text-[#FFD700] flex-shrink-0" />
            <p className="text-white/90 text-sm sm:text-base">
              La Victoria, Lima — Perú
            </p>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

/* ============================================================
   MARCAS
   ============================================================ */
function Marcas() {
  const CDN_IMG = "https://pub-ffd42694eda64a2f8f58d0f4b85d68be.r2.dev";
  const brands = [
    { name: "Mercedes-Benz", logo: `${CDN_IMG}/mercedesbenz.png` },
    { name: "Sprinter", logo: `${CDN_IMG}/sprinter.jpg` },
    { name: "Peugeot", logo: `${CDN_IMG}/peugeot.webp` },
    { name: "Hyundai", logo: `${CDN_IMG}/hyundailogo.jpg` },
    { name: "Renault", logo: `${CDN_IMG}/renaultlogo.svg` },
    { name: "Iveco", logo: `${CDN_IMG}/iveco.jpg` },
  ];

  return (
    <section id="marcas" className="py-20 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center mb-14"
        >
          <h2 className="text-3xl sm:text-4xl font-extrabold text-[#002D62] mb-4">
            Marcas que <span className="text-[#FFD700]">Trabajamos</span>
          </h2>
          <p className="text-[#64748b] max-w-2xl mx-auto text-lg">
            Repuestos originales y de alta calidad para las principales marcas
            del mercado peruano.
          </p>
        </motion.div>

        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          variants={staggerContainer}
          className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-6"
        >
          {brands.map((brand) => (
            <motion.div
              key={brand.name}
              variants={fadeInUp}
              whileHover={{ y: -6, transition: { duration: 0.2 } }}
            >
              <Card className="h-full border border-slate-200 hover:border-[#002D62]/30 hover:shadow-xl transition-all duration-300 cursor-default">
                <CardContent className="flex flex-col items-center justify-center py-8 px-4">
                  <div className="w-20 h-20 rounded-xl flex items-center justify-center mb-4 bg-white border border-slate-100 shadow-sm overflow-hidden p-2">
                    <img
                      src={brand.logo}
                      alt={`Logo ${brand.name}`}
                      className="w-full h-full object-contain"
                      onError={(e) => {
                        (e.currentTarget as HTMLImageElement).style.display = "none";
                      }}
                    />
                  </div>
                  <h3 className="text-[#002D62] font-bold text-center text-sm">
                    {brand.name}
                  </h3>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}

/* ============================================================
   ESPECIALIDADES
   ============================================================ */
function Especialidades() {
  const specs = [
    {
      icon: Truck,
      title: "Línea Sprinter",
      description:
        "Especialistas en modelos 313, 415 y 515. Repuestos de motor, transmisión, frenos y suspensión con disponibilidad inmediata.",
      features: ["Sprinter 313 CDI", "Sprinter 415 CDI", "Sprinter 515 CDI"],
      image:
        "https://pub-ffd42694eda64a2f8f58d0f4b85d68be.r2.dev/sprinter-camioneta.jpg",
    },
    {
      icon: Cog,
      title: "Camiones Actros / Atego",
      description:
        "Componentes de alta resistencia para camiones de carga pesada. Motores, cajas de cambio, ejes y sistemas de frenado.",
      features: ["Actros MP4 / MP5", "Atego 1726 / 1730", "Sistemas OM926 / OM470"],
      image:
        "https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?auto=format&fit=crop&w=800&q=80",
    },
    {
      icon: Settings,
      title: "Motores Diesel y Suspensión",
      description:
        "Repuestos certificados con garantía de calidad. Bujes, amortiguadores, fuelles, turbos, inyectores y más.",
      features: ["Repuestos certificados", "Garantía de calidad", "Stock permanente"],
      image:
        "https://images.unsplash.com/photo-1486262715619-67b85e0b08d3?auto=format&fit=crop&w=800&q=80",
    },
  ];

  return (
    <section id="especialidades" className="py-24 bg-[#f1f5f9]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center mb-16"
        >
          <h2 className="text-3xl sm:text-4xl font-extrabold text-[#002D62] mb-4">
            Nuestras <span className="text-[#FFD700]">Especialidades</span>
          </h2>
          <p className="text-[#64748b] max-w-2xl mx-auto text-lg">
            Más de 10 años de experiencia nos respaldan como líderes en repuestos
            para vehículos comerciales e industriales.
          </p>
        </motion.div>

        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          variants={staggerContainer}
          className="grid md:grid-cols-3 gap-8"
        >
          {specs.map((spec) => (
            <motion.div key={spec.title} variants={fadeInUp}>
              <Card className="h-full overflow-hidden border-0 shadow-lg hover:shadow-2xl transition-shadow duration-300 group">
                <div className="relative h-48 overflow-hidden">
                  <img
                    src={spec.image}
                    alt={spec.title}
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-[#002D62]/80 to-transparent" />
                  <div className="absolute bottom-4 left-4 flex items-center gap-2">
                    <div className="w-10 h-10 bg-[#FFD700] rounded-lg flex items-center justify-center">
                      <spec.icon className="w-5 h-5 text-[#002D62]" />
                    </div>
                    <h3 className="text-white font-bold text-lg">{spec.title}</h3>
                  </div>
                </div>
                <CardContent className="p-6">
                  <p className="text-[#64748b] mb-5 leading-relaxed">
                    {spec.description}
                  </p>
                  <ul className="space-y-2">
                    {spec.features.map((feat) => (
                      <li
                        key={feat}
                        className="flex items-center gap-2 text-sm text-[#002D62] font-medium"
                      >
                        <Package className="w-4 h-4 text-[#FFD700] flex-shrink-0" />
                        {feat}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}

/* ============================================================
   PRODUCTOS DESTACADOS
   ============================================================ */
function ProductosDestacados() {
  const CDN_IMG = "https://pub-ffd42694eda64a2f8f58d0f4b85d68be.r2.dev";
  const productos = [
    {
      nombre: "Intercooler Mercedes-Benz",
      descripcion:
        "Intercooler original MAHLE para Mercedes-Benz. Repuesto de alta calidad con garantía de fábrica.",
      imagen: `${CDN_IMG}/intercooler-mercedes-etiqueta.jpg`,
      partNumber: "MAHLE / Mercedes-Benz OEM",
      features: [
        "Original MAHLE",
        "Aluminio soldado",
        "Con mangueras y abrazaderas",
      ],
    },
    {
      nombre: "Sincronizador Piñón 1ra y 2da",
      descripcion:
        "Sincronizador para caja de cambios de modelos Sprinter 415 y 515. Disponible para entrega inmediata.",
      imagen: `${CDN_IMG}/sincronizador-caja-415-515.jpg`,
      partNumber: "Caja 415 – 515",
      features: ["Para Sprinter 415 CDI", "Para Sprinter 515 CDI", "Stock disponible"],
    },
    {
      nombre: "Emblema Mercedes-Benz Original",
      descripcion:
        "Emblema frontal original Mercedes-Benz con número de parte certificado. Empaque sellado de fábrica.",
      imagen: `${CDN_IMG}/emblema-mercedes-9067580058.jpg`,
      partNumber: "A 906 758 00 58",
      features: ["100% Original", "Número de parte visible", "Empaque sellado"],
    },
  ];

  return (
    <section id="productos" className="py-24 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center mb-16"
        >
          <h2 className="text-3xl sm:text-4xl font-extrabold text-[#002D62] mb-4">
            Productos <span className="text-[#FFD700]">Destacados</span>
          </h2>
          <p className="text-[#64748b] max-w-2xl mx-auto text-lg">
            Repuestos reales fotografiados en nuestro local. Cotiza hoy mismo y
            recibe atención personalizada por WhatsApp.
          </p>
        </motion.div>

        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          variants={staggerContainer}
          className="grid md:grid-cols-3 gap-8"
        >
          {productos.map((prod) => (
            <motion.div key={prod.nombre} variants={fadeInUp}>
              <Card className="h-full overflow-hidden border-0 shadow-lg hover:shadow-2xl transition-shadow duration-300 flex flex-col">
                <div className="relative h-56 overflow-hidden bg-slate-100 flex items-center justify-center">
                  <img
                    src={prod.imagen}
                    alt={prod.nombre}
                    className="w-full h-full object-contain p-4"
                    loading="lazy"
                  />
                </div>
                <CardContent className="p-6 flex flex-col flex-1">
                  {prod.partNumber && (
                    <span className="inline-block self-start bg-[#002D62]/5 text-[#002D62] text-xs font-bold px-3 py-1 rounded-full mb-3">
                      Parte: {prod.partNumber}
                    </span>
                  )}
                  <h3 className="text-xl font-bold text-[#002D62] mb-2">
                    {prod.nombre}
                  </h3>
                  <p className="text-[#64748b] mb-4 text-sm leading-relaxed">
                    {prod.descripcion}
                  </p>
                  <ul className="space-y-2 mb-6">
                    {prod.features.map((feat) => (
                      <li
                        key={feat}
                        className="flex items-center gap-2 text-sm text-[#002D62] font-medium"
                      >
                        <Package className="w-4 h-4 text-[#FFD700] flex-shrink-0" />
                        {feat}
                      </li>
                    ))}
                  </ul>
                  <div className="mt-auto">
                    <a
                      href={`https://wa.me/51935034586?text=Hola%20Repuestos%20Allende%2C%20estoy%20interesado%20en%20${encodeURIComponent(
                        prod.nombre
                      )}`}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <Button className="w-full bg-[#FFD700] text-[#002D62] hover:bg-[#e6c200] font-bold rounded-full">
                        <Phone className="w-4 h-4 mr-2" />
                        Cotizar por WhatsApp
                      </Button>
                    </a>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}

/* ============================================================
   TIENDA / VIDEOS — CARRUSEL
   ============================================================ */
function Tienda() {
  const CDN_URL = "https://pub-ffd42694eda64a2f8f58d0f4b85d68be.r2.dev";

  const videos = [
    { src: `${CDN_URL}/recorrido-local-01.mp4`, label: "Recorrido del local" },
    { src: `${CDN_URL}/recorrido-local-02.mp4`, label: "Recorrido del local" },
    { src: `${CDN_URL}/recorrido-local-03.mp4`, label: "Recorrido del local" },
    { src: `${CDN_URL}/producto-demostracion-01.mp4`, label: "Demostración de producto" },
    { src: `${CDN_URL}/producto-demostracion-02.mp4`, label: "Demostración de producto" },
    { src: `${CDN_URL}/producto-demostracion-03.mp4`, label: "Demostración de producto" },
    { src: `${CDN_URL}/producto-demostracion-04.mp4`, label: "Demostración de producto" },
    { src: `${CDN_URL}/tienda-atencion-cliente-01.mp4`, label: "Atención al cliente" },
    { src: `${CDN_URL}/tienda-exterior-01.mp4`, label: "Exterior de la tienda" },
  ];

  const [current, setCurrent] = useState(0);

  const next = () => setCurrent((prev) => (prev + 1) % videos.length);
  const prev = () => setCurrent((prev) => (prev - 1 + videos.length) % videos.length);

  return (
    <section id="tienda" className="py-24 bg-[#f1f5f9]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center mb-12"
        >
          <div className="inline-flex items-center gap-2 bg-[#002D62]/5 border border-[#002D62]/10 rounded-full px-4 py-1.5 mb-4">
            <Video className="w-4 h-4 text-[#002D62]" />
            <span className="text-[#002D62] text-sm font-semibold tracking-wide">
              CONOCE NUESTRO LOCAL
            </span>
          </div>
          <h2 className="text-3xl sm:text-4xl font-extrabold text-[#002D62] mb-4">
            Mira Nuestra <span className="text-[#FFD700]">Tienda</span> en Video
          </h2>
          <p className="text-[#64748b] max-w-2xl mx-auto text-lg">
            Recorre nuestro local, conoce nuestro stock y la atención que
            brindamos a cada cliente. ¡Visítanos en La Victoria!
          </p>
        </motion.div>

        {/* Carrusel */}
        <div className="relative max-w-4xl mx-auto">
          {/* Flecha izquierda */}
          <button
            onClick={prev}
            className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-2 sm:-translate-x-6 z-10 w-10 h-10 sm:w-12 sm:h-12 bg-[#002D62] hover:bg-[#001a3a] text-[#FFD700] rounded-full flex items-center justify-center shadow-lg transition-colors"
            aria-label="Video anterior"
          >
            <ChevronLeft className="w-5 h-5 sm:w-6 sm:h-6" />
          </button>

          {/* Contenedor del video */}
          <Card className="overflow-hidden border-0 shadow-2xl mx-8 sm:mx-14">
            <div className="relative bg-black flex items-center justify-center max-h-[60vh] sm:max-h-[520px]">
              <AnimatePresence mode="wait">
                <motion.div
                  key={current}
                  initial={{ opacity: 0, x: 50 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -50 }}
                  transition={{ duration: 0.3 }}
                  className="w-full h-full flex items-center justify-center"
                >
                  <video
                    src={videos[current].src}
                    controls
                    preload="metadata"
                    className="w-full h-full max-h-[60vh] sm:max-h-[520px] object-contain"
                  />
                </motion.div>
              </AnimatePresence>
            </div>
            <CardContent className="p-4 sm:p-5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Play className="w-4 h-4 text-[#FFD700]" />
                <span className="text-[#002D62] font-semibold text-sm sm:text-base">
                  {videos[current].label} {current + 1} / {videos.length}
                </span>
              </div>
            </CardContent>
          </Card>

          {/* Flecha derecha */}
          <button
            onClick={next}
            className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-2 sm:translate-x-6 z-10 w-10 h-10 sm:w-12 sm:h-12 bg-[#002D62] hover:bg-[#001a3a] text-[#FFD700] rounded-full flex items-center justify-center shadow-lg transition-colors"
            aria-label="Video siguiente"
          >
            <ChevronRight className="w-5 h-5 sm:w-6 sm:h-6" />
          </button>
        </div>

        {/* Dots */}
        <div className="flex items-center justify-center gap-2 mt-8">
          {videos.map((_, idx) => (
            <button
              key={idx}
              onClick={() => setCurrent(idx)}
              className={`w-2.5 h-2.5 rounded-full transition-all duration-300 ${
                idx === current
                  ? "bg-[#002D62] w-8"
                  : "bg-[#002D62]/30 hover:bg-[#002D62]/50"
              }`}
              aria-label={`Ir al video ${idx + 1}`}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

/* ============================================================
   SOCIAL MEDIA & CONTACTO
   ============================================================ */
function SocialMedia() {
  return (
    <section id="contacto" className="py-24 bg-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center mb-14"
        >
          <h2 className="text-3xl sm:text-4xl font-extrabold text-[#002D62] mb-4">
            Síguenos en <span className="text-[#FFD700]">Redes Sociales</span>
          </h2>
          <p className="text-[#64748b] max-w-2xl mx-auto text-lg">
            Conéctate con nosotros y conoce nuestro stock diario, promociones y
            novedades del mundo automotriz.
          </p>
        </motion.div>

        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          variants={staggerContainer}
          className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto"
        >
          {/* Facebook */}
          <motion.a
            variants={fadeInUp}
            href="https://www.facebook.com/repuestosallendeeirl"
            target="_blank"
            rel="noopener noreferrer"
            whileHover={{ scale: 1.02 }}
            className="group"
          >
            <Card className="h-full border-2 border-[#1877F2]/20 hover:border-[#1877F2] transition-all duration-300 hover:shadow-xl overflow-hidden">
              <CardContent className="p-8 flex flex-col items-center text-center">
                <div className="w-20 h-20 bg-[#1877F2]/10 rounded-2xl flex items-center justify-center mb-6 group-hover:bg-[#1877F2] transition-colors duration-300">
                  <Facebook className="w-10 h-10 text-[#1877F2] group-hover:text-white transition-colors duration-300" />
                </div>
                <h3 className="text-2xl font-bold text-[#002D62] mb-2">
                  Facebook
                </h3>
                <p className="text-[#64748b] mb-4">
                  @repuestosallendeeirl
                </p>
                <span className="inline-flex items-center text-[#1877F2] font-semibold group-hover:underline">
                  Visitar página
                  <MoveRight className="w-4 h-4 ml-2 transition-transform group-hover:translate-x-1" />
                </span>
              </CardContent>
            </Card>
          </motion.a>

          {/* TikTok */}
          <motion.a
            variants={fadeInUp}
            href="https://www.tiktok.com/@repuestos_allende"
            target="_blank"
            rel="noopener noreferrer"
            whileHover={{ scale: 1.02 }}
            className="group"
          >
            <Card className="h-full border-2 border-black/10 hover:border-black transition-all duration-300 hover:shadow-xl overflow-hidden">
              <CardContent className="p-8 flex flex-col items-center text-center">
                <div className="w-20 h-20 bg-black/5 rounded-2xl flex items-center justify-center mb-6 group-hover:bg-black transition-colors duration-300">
                  <svg
                    className="w-10 h-10 text-black group-hover:text-white transition-colors duration-300"
                    viewBox="0 0 24 24"
                    fill="currentColor"
                  >
                    <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z" />
                  </svg>
                </div>
                <h3 className="text-2xl font-bold text-[#002D62] mb-2">
                  TikTok
                </h3>
                <p className="text-[#64748b] mb-4">
                  @repuestos_allende
                </p>
                <span className="inline-flex items-center text-black font-semibold group-hover:underline">
                  Ver perfil
                  <MoveRight className="w-4 h-4 ml-2 transition-transform group-hover:translate-x-1" />
                </span>
              </CardContent>
            </Card>
          </motion.a>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="mt-12 text-center"
        >
          <div className="inline-flex items-center gap-2 bg-[#002D62]/5 border border-[#002D62]/10 rounded-full px-6 py-3">
            <Clock className="w-5 h-5 text-[#002D62]" />
            <span className="text-[#002D62] font-semibold">
              Síguenos para ver nuestro stock diario y promociones exclusivas
            </span>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

/* ============================================================
   UBICACIÓN
   ============================================================ */
function Ubicacion() {
  return (
    <section id="ubicacion" className="py-24 bg-[#f1f5f9]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center mb-14"
        >
          <h2 className="text-3xl sm:text-4xl font-extrabold text-[#002D62] mb-4">
            Nuestra <span className="text-[#FFD700]">Ubicación</span>
          </h2>
          <p className="text-[#64748b] max-w-2xl mx-auto text-lg">
            Visítanos en nuestro local en La Victoria, Lima. Estamos al lado del
            BBVA, fácil acceso desde toda la ciudad.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="grid lg:grid-cols-3 gap-8"
        >
          {/* Info Card */}
          <Card className="border-0 shadow-xl h-full">
            <CardContent className="p-8 flex flex-col justify-center h-full">
              <div className="space-y-8">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-[#002D62] rounded-xl flex items-center justify-center flex-shrink-0">
                    <MapPin className="w-6 h-6 text-[#FFD700]" />
                  </div>
                  <div>
                    <h3 className="font-bold text-[#002D62] mb-1">
                      Dirección
                    </h3>
                    <p className="text-[#64748b] leading-relaxed">
                      Av. Manco Cápac 316, La Victoria, Lima, Perú
                      <br />
                      <span className="text-sm text-[#002D62] font-medium">
                        (Al lado del BBVA)
                      </span>
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-[#002D62] rounded-xl flex items-center justify-center flex-shrink-0">
                    <Phone className="w-6 h-6 text-[#FFD700]" />
                  </div>
                  <div>
                    <h3 className="font-bold text-[#002D62] mb-1">
                      Teléfono / WhatsApp
                    </h3>
                    <p className="text-[#64748b]">+51 935 034 586</p>
                  </div>
                </div>

                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-[#002D62] rounded-xl flex items-center justify-center flex-shrink-0">
                    <Mail className="w-6 h-6 text-[#FFD700]" />
                  </div>
                  <div>
                    <h3 className="font-bold text-[#002D62] mb-1">
                      Correo electrónico
                    </h3>
                    <p className="text-[#64748b]">ventas@repuestosallende.com</p>
                  </div>
                </div>

                <div className="pt-4">
                  <a
                    href="https://wa.me/51935034586?text=Hola%20Repuestos%20Allende%2C%20estoy%20interesado%20en%20sus%20repuestos."
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <Button className="w-full bg-[#FFD700] text-[#002D62] hover:bg-[#e6c200] font-bold rounded-full py-6 shadow-lg transition-transform hover:scale-[1.02]">
                      <Phone className="w-5 h-5 mr-2" />
                      Escríbenos ahora
                    </Button>
                  </a>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Map */}
          <div className="lg:col-span-2 h-[400px] lg:h-auto rounded-2xl overflow-hidden shadow-xl border border-slate-200">
            <iframe
              src="https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3901.757758805028!2d-77.0138889!3d-12.0641667!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x9105c8db1e1e1e1f%3A0x1e1e1e1e1e1e1e1e!2sAv.%20Manco%20C%C3%A1pac%20316%2C%20La%20Victoria%2015018%2C%20Per%C3%BA!5e0!3m2!1ses!2sus!4v1713800000000!5m2!1ses!2sus"
              width="100%"
              height="100%"
              style={{ border: 0 }}
              allowFullScreen
              loading="lazy"
              referrerPolicy="no-referrer-when-downgrade"
              title="Ubicación Repuestos Allende"
            />
          </div>
        </motion.div>
      </div>
    </section>
  );
}

/* ============================================================
   FOOTER
   ============================================================ */
function Footer() {
  return (
    <footer className="bg-[#002D62] text-white">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid md:grid-cols-4 gap-10">
          {/* Brand */}
          <div className="md:col-span-2">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 bg-[#FFD700] rounded-xl flex items-center justify-center">
                <Truck className="w-7 h-7 text-[#002D62]" />
              </div>
              <div>
                <h3 className="text-xl font-bold leading-tight">
                  REPUESTOS ALLENDE
                </h3>
                <p className="text-[#FFD700] text-xs font-semibold tracking-wider">
                  E.I.R.L.
                </p>
              </div>
            </div>
            <p className="text-white/70 leading-relaxed mb-6 max-w-md">
              Especialistas en repuestos para Mercedes Benz, Peugeot, Hyundai,
              Renault e Iveco. Más de una década brindando confianza y calidad
              al sector transporte y comercial del Perú.
            </p>
            <div className="flex gap-4">
              <a
                href="https://www.facebook.com/repuestosallendeeirl"
                target="_blank"
                rel="noopener noreferrer"
                className="w-10 h-10 bg-white/10 hover:bg-[#FFD700] rounded-lg flex items-center justify-center transition-colors group"
                aria-label="Facebook"
              >
                <Facebook className="w-5 h-5 text-white group-hover:text-[#002D62]" />
              </a>
              <a
                href="https://www.tiktok.com/@repuestos_allende"
                target="_blank"
                rel="noopener noreferrer"
                className="w-10 h-10 bg-white/10 hover:bg-[#FFD700] rounded-lg flex items-center justify-center transition-colors group"
                aria-label="TikTok"
              >
                <svg
                  className="w-5 h-5 text-white group-hover:text-[#002D62]"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
                  <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z" />
                </svg>
              </a>
              <a
                href="mailto:ventas@repuestosallende.com"
                className="w-10 h-10 bg-white/10 hover:bg-[#FFD700] rounded-lg flex items-center justify-center transition-colors group"
                aria-label="Email"
              >
                <Mail className="w-5 h-5 text-white group-hover:text-[#002D62]" />
              </a>
            </div>
          </div>

          {/* Links */}
          <div>
            <h4 className="font-bold text-lg mb-5 text-[#FFD700]">Secciones</h4>
            <ul className="space-y-3">
              {[
                { label: "Inicio", href: "#hero" },
                { label: "Marcas", href: "#marcas" },
                { label: "Especialidades", href: "#especialidades" },
                { label: "Productos", href: "#productos" },
                { label: "Tienda", href: "#tienda" },
                { label: "Contacto", href: "#contacto" },
                { label: "Ubicación", href: "#ubicacion" },
              ].map((link) => (
                <li key={link.href}>
                  <a
                    href={link.href}
                    className="text-white/70 hover:text-[#FFD700] transition-colors"
                  >
                    {link.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Contact Info */}
          <div>
            <h4 className="font-bold text-lg mb-5 text-[#FFD700]">Contacto</h4>
            <ul className="space-y-4">
              <li className="flex items-start gap-3">
                <MapPin className="w-5 h-5 text-[#FFD700] flex-shrink-0 mt-0.5" />
                <span className="text-white/70 text-sm">
                  Av. Manco Cápac 316, La Victoria, Lima, Perú
                </span>
              </li>
              <li className="flex items-start gap-3">
                <Phone className="w-5 h-5 text-[#FFD700] flex-shrink-0 mt-0.5" />
                <span className="text-white/70 text-sm">+51 935 034 586</span>
              </li>
              <li className="flex items-start gap-3">
                <Mail className="w-5 h-5 text-[#FFD700] flex-shrink-0 mt-0.5" />
                <span className="text-white/70 text-sm">
                  ventas@repuestosallende.com
                </span>
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t border-white/10 mt-12 pt-8 flex flex-col md:flex-row items-center justify-between gap-4">
          <p className="text-white/50 text-sm text-center md:text-left">
            &copy; {new Date().getFullYear()} Repuestos Allende E.I.R.L. Todos los
            derechos reservados. RUC: 20610105280.
          </p>
          <p className="text-white/50 text-sm">
            Empresa Formal Activa y Habida — Perú
          </p>
        </div>
      </div>
    </footer>
  );
}

/* ============================================================
   WHATSAPP FLOAT
   ============================================================ */
function WhatsAppFloat() {
  return (
    <motion.a
      href="https://wa.me/51935034586?text=Hola%20Repuestos%20Allende%2C%20estoy%20interesado%20en%20sus%20repuestos."
      target="_blank"
      rel="noopener noreferrer"
      className="fixed bottom-6 right-6 z-50 bg-[#25D366] hover:bg-[#128C7E] text-white rounded-full p-4 shadow-2xl transition-colors"
      initial={{ scale: 0 }}
      animate={{ scale: 1 }}
      whileHover={{ scale: 1.1 }}
      whileTap={{ scale: 0.95 }}
      aria-label="Contactar por WhatsApp"
    >
      <Phone className="w-7 h-7" />
    </motion.a>
  );
}

/* ============================================================
   MAIN PAGE
   ============================================================ */
export default function Home() {
  return (
    <>
      <Navbar />
      <main className="flex-1">
        <Hero />
        <TrustBar />
        <Marcas />
        <Especialidades />
        <ProductosDestacados />
        <Tienda />
        <SocialMedia />
        <Ubicacion />
      </main>
      <Footer />
      <WhatsAppFloat />
    </>
  );
}
