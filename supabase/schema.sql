create extension if not exists pgcrypto;

create table if not exists public.quiz_attempts (
  id uuid primary key default gen_random_uuid(),
  student_name text not null check (char_length(student_name) <= 64),
  quiz_set_title text not null,
  score integer not null check (score >= 0),
  scored_questions integer not null check (scored_questions >= 0),
  percent integer not null check (percent >= 0 and percent <= 100),
  created_at timestamptz not null default now()
);

alter table public.quiz_attempts enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'quiz_attempts' and policyname = 'quiz_attempts_insert_anon'
  ) then
    create policy quiz_attempts_insert_anon
      on public.quiz_attempts
      for insert
      to anon, authenticated
      with check (true);
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'quiz_attempts' and policyname = 'quiz_attempts_select_anon'
  ) then
    create policy quiz_attempts_select_anon
      on public.quiz_attempts
      for select
      to anon, authenticated
      using (true);
  end if;
end $$;

create index if not exists quiz_attempts_set_percent_idx
  on public.quiz_attempts (quiz_set_title, percent desc, created_at asc);
