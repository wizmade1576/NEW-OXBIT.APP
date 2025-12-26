alter table public.paper_wallets enable row level security;

create policy "paper_wallets self or admin"
  on public.paper_wallets
  for all
  using (
    auth.uid() = user_id
    or exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.role = 'admin'
    )
  )
  with check (
    auth.uid() = user_id
    or exists (
      select 1
      from public.profiles p
      where p.id = auth.uid()
        and p.role = 'admin'
    )
  );
