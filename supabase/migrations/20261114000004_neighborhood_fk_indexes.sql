-- Covering indexes for neighborhood foreign keys (Supabase performance advisor)
create index if not exists alerts_neighborhood_idx   on public.emergency_alerts(neighborhood_id);
create index if not exists events_neighborhood_idx   on public.events(neighborhood_id);
create index if not exists help_neighborhood_idx     on public.help_requests(neighborhood_id);
create index if not exists lf_neighborhood_idx       on public.lost_found_items(neighborhood_id);
create index if not exists listings_neighborhood_idx on public.marketplace_listings(neighborhood_id);
create index if not exists services_neighborhood_idx on public.services(neighborhood_id);
