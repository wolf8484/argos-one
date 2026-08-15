import { z } from 'zod'

const publicEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(20),
})

const serverEnvSchema = publicEnvSchema.extend({
  GROQ_API_KEY: z.string().min(20).optional(),
  SERPER_API_KEY: z.string().min(20).optional(),
})

export function publicEnv() {
  return publicEnvSchema.parse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  })
}

export function serverEnv() {
  return serverEnvSchema.parse({
    ...publicEnv(),
    GROQ_API_KEY: process.env.GROQ_API_KEY,
    SERPER_API_KEY: process.env.SERPER_API_KEY,
  })
}
