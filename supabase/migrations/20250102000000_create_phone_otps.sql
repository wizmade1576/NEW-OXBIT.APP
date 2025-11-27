-- Phone OTP storage for Aligo-based signup
create table if not exists public.phone_otps (
  phone text primary key,
  code text not null,
  expires_at timestamptz not null,
  attempts int not null default 0,
  verification_token text,
  verification_expires_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_phone_otps_expires_at on public.phone_otps (expires_at);
