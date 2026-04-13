alter table public.licenses
  add column if not exists updated_at timestamptz default now();
