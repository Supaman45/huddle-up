-- Hourly calendar sync. Run after deploying the ics-sync function.
-- Store the service role key once: select vault.create_secret('<service_role_key>', 'service_role_key');
create extension if not exists pg_cron;
create extension if not exists pg_net;

select cron.schedule(
  'ics-sync-hourly',
  '7 * * * *',
  $$
  select net.http_post(
    url := 'https://ftaxrqwsscitsqrqedxm.supabase.co/functions/v1/ics-sync',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'service_role_key')
    ),
    body := '{}'::jsonb
  );
  $$
);
