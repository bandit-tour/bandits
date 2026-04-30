-- Community-facing categorization for transparency feed (bandiTour / scam-alerts screen)
alter table public.scam_alerts
  add column if not exists category text not null default 'Other';

alter table public.scam_alerts
  add column if not exists severity smallint not null default 2;

-- 1 = lower concern, 2 = medium, 3 = higher concern (UI indicator only)
alter table public.scam_alerts
  drop constraint if exists scam_alerts_severity_check;

alter table public.scam_alerts
  add constraint scam_alerts_severity_check check (severity between 1 and 3);
