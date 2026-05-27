create extension if not exists citext with schema public;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username citext not null unique,
  email citext not null unique,
  full_name text not null,
  location text not null,
  role text not null default 'player' check (role in ('player', 'admin')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.wallet_balances (
  user_id uuid primary key references auth.users(id) on delete cascade,
  balance numeric(18, 6) not null default 0,
  updated_at timestamptz not null default now()
);

create table if not exists public.deposits (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  amount numeric(18, 6) not null check (amount > 0),
  wallet_address text not null,
  tx_hash text unique,
  status text not null check (status in ('pending', 'detecting', 'confirming', 'completed', 'failed', 'expired')),
  confirmations integer not null default 0,
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.transactions (
  id text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  type text not null check (type in ('deposit', 'withdrawal', 'bonus', 'adjustment')),
  amount numeric(18, 6) not null,
  status text not null,
  tx_hash text unique,
  deposit_id text references public.deposits(id),
  created_at timestamptz not null default now()
);

alter table public.wallet_balances enable row level security;
alter table public.deposits enable row level security;
alter table public.transactions enable row level security;
alter table public.profiles enable row level security;

drop policy if exists "Players can read own profile" on public.profiles;
create policy "Players can read own profile"
  on public.profiles for select
  to authenticated
  using (auth.uid() = id);

drop policy if exists "Players can update own profile" on public.profiles;
create policy "Players can update own profile"
  on public.profiles for update
  to authenticated
  using (auth.uid() = id)
  with check (auth.uid() = id);

drop policy if exists "Players can read own balance" on public.wallet_balances;
create policy "Players can read own balance"
  on public.wallet_balances for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Players can read own deposits" on public.deposits;
create policy "Players can read own deposits"
  on public.deposits for select
  to authenticated
  using (auth.uid() = user_id);

drop policy if exists "Players can read own transactions" on public.transactions;
create policy "Players can read own transactions"
  on public.transactions for select
  to authenticated
  using (auth.uid() = user_id);

create or replace function public.apply_transaction_balance()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.status <> 'completed' then
    return new;
  end if;

  insert into public.wallet_balances (user_id, balance)
  values (
    new.user_id,
    case
      when new.type in ('deposit', 'bonus', 'adjustment') then new.amount
      when new.type = 'withdrawal' then -new.amount
      else 0
    end
  )
  on conflict (user_id)
  do update set
    balance = public.wallet_balances.balance + excluded.balance,
    updated_at = now();

  return new;
end;
$$;

drop trigger if exists on_transaction_completed_credit_balance on public.transactions;

create trigger on_transaction_completed_credit_balance
  after insert on public.transactions
  for each row
  execute function public.apply_transaction_balance();
