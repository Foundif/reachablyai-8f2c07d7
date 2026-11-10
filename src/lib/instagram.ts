import { supabase } from '@/integrations/supabase/client';
import { FunctionsHttpError } from '@supabase/supabase-js';
export type { IgSettings } from '../../supabase/functions/_shared/instagramRules';
export async function instagramCall(body: Record<string, unknown>, signal?: AbortSignal) {
 const timeout = AbortSignal.timeout(body.action === 'followup' ? 120000 : 45000);
 const {data,error} = await supabase.functions.invoke('instagram-manage', {body,signal:signal || timeout});
 if(error) {
  if(error instanceof FunctionsHttpError) { const detail = await error.context.json().catch(()=>null); throw new Error(detail?.error || error.message); }
  throw error;
 }
 if(data?.error) throw new Error(data.error);
 return data;
}
