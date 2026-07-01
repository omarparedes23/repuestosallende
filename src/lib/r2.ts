import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3'

function getClient() {
  return new S3Client({
    region: 'auto',
    endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: process.env.R2_ACCESS_KEY_ID!,
      secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
    },
  })
}

export const IMAGENES_TIPOS_PERMITIDOS = ['image/jpeg', 'image/png', 'image/webp']
export const IMAGEN_MAX_BYTES = 5 * 1024 * 1024 // 5MB

/**
 * Sube un archivo a R2 bajo la key dada y devuelve su URL pública.
 * La key es determinística (un solo archivo por producto, se sobreescribe en
 * cada subida), así que se agrega ?v=timestamp para invalidar la caché del
 * navegador/CDN — sin esto, reemplazar la foto de un producto que ya tenía
 * una no se refleja visualmente aunque el archivo en R2 sí haya cambiado.
 */
export async function subirImagen(file: File, key: string): Promise<string> {
  const buffer = Buffer.from(await file.arrayBuffer())

  await getClient().send(
    new PutObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME!,
      Key: key,
      Body: buffer,
      ContentType: file.type,
    })
  )

  return `${process.env.R2_PUBLIC_URL}/${key}?v=${Date.now()}`
}
