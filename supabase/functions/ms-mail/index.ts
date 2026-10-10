import {createClient} from 'npm:@supabase/supabase-js@2.45.4';
import {mailHandler} from '../_shared/mail-handler.ts';
const db=createClient(Deno.env.get('SUPABASE_URL')!,Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
// Kendi yetkilendirmesi: admin JWT, zamanlayıcı sırrı veya imzalı Resend webhook.
Deno.serve(mailHandler(db,{RESEND_API_KEY:Deno.env.get('RESEND_API_KEY'),RESEND_WEBHOOK_SECRET:Deno.env.get('RESEND_WEBHOOK_SECRET')}));
