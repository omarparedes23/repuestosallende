-- 027_chatbot_logs.sql
-- Logs del chatbot para depuracion: que pregunto el usuario, que le respondio
-- el bot, con que termino/filtros busco, y cuantos productos encontro. Pensado
-- como temporal mientras se afina la busqueda (Etapa 1/2) - se puede apagar
-- despues con la variable de entorno CHATBOT_LOGGING_ENABLED, sin tocar codigo.
--
-- Reemplaza el intento anterior de loguear a un archivo chat-log.txt en
-- route.ts, que solo corria en NODE_ENV=development y de todos modos no
-- hubiera funcionado en Vercel (filesystem efimero en funciones serverless).

CREATE TABLE ra_chatbot_logs (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  pregunta_usuario    TEXT NOT NULL,
  respuesta_bot       TEXT NOT NULL,
  search_term         TEXT,
  filtros             JSONB,
  cantidad_resultados INT NOT NULL DEFAULT 0
);

CREATE INDEX idx_chatbot_logs_created_at ON ra_chatbot_logs (created_at DESC);
CREATE INDEX idx_chatbot_logs_sin_resultados ON ra_chatbot_logs (created_at DESC) WHERE cantidad_resultados = 0;

ALTER TABLE ra_chatbot_logs ENABLE ROW LEVEL SECURITY;

-- Solo el backend (service role, bypassa RLS) inserta. Nadie mas escribe.
-- Lectura: administrador/superadmin, para revisar los logs desde el panel a futuro.
CREATE POLICY "chatbot_logs_select" ON ra_chatbot_logs
  FOR SELECT TO authenticated
  USING (
    (SELECT rol FROM ra_perfiles WHERE id = auth.uid())
      = ANY (ARRAY['administrador'::ra_rol, 'superadmin'::ra_rol])
  );
