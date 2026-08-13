import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceRoleKey) {
  console.warn("Supabase credentials missing. Storage functions will fail.");
}

export const supabaseAdmin = createClient(
  supabaseUrl || 'https://placeholder.supabase.co',
  supabaseServiceRoleKey || 'placeholder',
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

export async function getResumeSignedUrl(filePath: string): Promise<string | null> {
  if (!supabaseUrl || !supabaseServiceRoleKey) return null;
  
  const { data, error } = await supabaseAdmin
    .storage
    .from('resumes')
    .createSignedUrl(filePath, 60 * 5); // 5 minutes validity

  if (error) {
    console.error("Error creating signed URL:", error);
    return null;
  }

  return data.signedUrl;
}
