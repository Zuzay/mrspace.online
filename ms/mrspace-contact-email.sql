-- Central studio inbox. Does not change sender authentication or account login emails.
insert into public.ms_settings(key,value) values ('contact_email','mrspace.online1@gmail.com')
on conflict (key) do update set value=excluded.value;

update public.ms_notification_preferences
set delivery_email='mrspace.online1@gmail.com',updated_at=now()
where delivery_email in ('hello@mrspace.online','shop@rufcut.com','rufcut@mrspace.online');

create or replace function public.ms_mail_link(p_sub bigint, p_revised boolean)
returns void language plpgsql security definer set search_path = public, net as $$
declare s record; k text; n int; hi text; msg text; contact text;
begin
  select x.*, st.name as site_name into s from ms_submissions x join ms_sites st on st.slug = x.site where x.id = p_sub;
  if s.email is null then return; end if;
  select value into contact from public.ms_settings where key='contact_email';
  contact := coalesce(nullif(trim(contact),''),'mrspace.online1@gmail.com');
  begin
    select decrypted_secret into k from vault.decrypted_secrets where name = 'resend_key' limit 1;
  exception when others then k := null; end;
  if k is null then return; end if;
  select count(*) into n from ms_changes where submission_id = p_sub and status <> 'withdrawn';
  hi := coalesce(' ' || replace(replace(split_part(s.name, ' ', 1), '<', ''), '>', ''), '');
  msg := case when p_revised
    then 'Your update is saved. ' || n || case when n = 1 then ' change' else ' changes' end || ', version ' || s.version || '.'
    else 'We received ' || n || case when n = 1 then ' change' else ' changes' end || ' for your site. We will review them and get back to you.' end;
  perform net.http_post(
    url := 'https://api.resend.com/emails',
    headers := jsonb_build_object('Authorization', 'Bearer ' || k, 'Content-Type', 'application/json'),
    body := jsonb_build_object(
      'from', 'Mr. Space <hello@mrspace.online>',
      'to', jsonb_build_array(s.email),
      'reply_to', contact,
      'bcc', jsonb_build_array(contact),
      'subject', s.site_name || case when p_revised then ': your changes are updated' else ': we got your changes' end,
      'html', format(
        '<div style="font-family:system-ui,sans-serif;font-size:16px;line-height:1.5;color:#16181d;max-width:520px">'
        '<p>Hi%s,</p><p>%s</p>'
        '<p><a href="https://mrspace.online/request/?e=%s" style="display:inline-block;background:#16181d;color:#fff;padding:12px 20px;border-radius:999px;text-decoration:none">Open my changes</a></p>'
        '<p style="color:#5d636e;font-size:14px">This link is just for you. Use it any time to add, change or remove something before we get to it.</p>'
        '<p>Mr. Space</p></div>', hi, msg, s.edit_key)));
end $$;
