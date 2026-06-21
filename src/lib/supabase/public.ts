import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/types/database'

// Cliente sin cookies — para datos públicos y generateStaticParams
export function createPublicClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
