create extension if not exists pgcrypto;

create or replace function public.is_site_admin()
returns boolean language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1
    from auth.users as admin_user
    where admin_user.id = (select auth.uid())
      and admin_user.email_confirmed_at is not null
      and lower(coalesce(admin_user.email, '')) =
        lower(coalesce(current_setting('app.admin_email', true), 'Himanshuraj25102008@gmail.com'))
  )
$$;
revoke all on function public.is_site_admin() from public;
grant execute on function public.is_site_admin() to authenticated;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  current_streak integer not null default 0 check (current_streak >= 0),
  best_streak integer not null default 0 check (best_streak >= 0),
  created_at timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = ''
as $$
begin
  insert into public.profiles (id, email) values (new.id, coalesce(new.email, ''));
  return new;
end;
$$;
create trigger on_auth_user_created after insert on auth.users
for each row execute procedure public.handle_new_user();

create table public.quizzes (
  id uuid primary key default gen_random_uuid(),
  title text not null check (length(title) between 1 and 120),
  description text,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
create table public.quiz_questions (
  id uuid primary key default gen_random_uuid(),
  quiz_id uuid not null references public.quizzes(id) on delete cascade,
  prompt text not null check (length(prompt) between 1 and 1000),
  kind text not null check (kind in ('choice','integer','number')),
  options jsonb not null default '[]'::jsonb check (jsonb_typeof(options) = 'array'),
  created_at timestamptz not null default now()
);
create table public.question_keys (
  question_id uuid primary key references public.quiz_questions(id) on delete cascade,
  correct_answer text not null check (length(correct_answer) <= 128)
);
create table public.user_answers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  question_id uuid not null references public.quiz_questions(id) on delete cascade,
  answer text not null check (length(answer) <= 128),
  is_correct boolean not null,
  created_at timestamptz not null default now(),
  unique (user_id, question_id)
);

create or replace function public.submit_quiz_answer(p_question_id uuid, p_answer text)
returns table(is_correct boolean, current_streak integer, best_streak integer)
language plpgsql security definer set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_kind text;
  v_expected text;
  v_correct boolean;
  v_current integer;
  v_best integer;
begin
  if v_user_id is null then raise exception 'Sign in to submit an answer.'; end if;
  if p_answer is null or length(p_answer) > 128 then raise exception 'Answer must be 128 characters or fewer.'; end if;
  select q.kind, k.correct_answer into v_kind, v_expected
  from public.quiz_questions q
  join public.question_keys k on k.question_id = q.id
  join public.quizzes z on z.id = q.quiz_id and z.is_active
  where q.id = p_question_id;
  if not found then raise exception 'Question is not available.'; end if;

  if v_kind = 'integer' then
    if length(p_answer) <= 128 and p_answer ~ '^-?[0-9]+$' then
      v_correct := p_answer::numeric = v_expected::numeric;
    else
      v_correct := false;
    end if;
  elsif v_kind = 'number' then
    if length(p_answer) <= 128 and p_answer ~ '^-?([0-9]+(\.[0-9]+)?|\.[0-9]+)$' then
      v_correct := p_answer::numeric = v_expected::numeric;
    else
      v_correct := false;
    end if;
  else
    v_correct := btrim(p_answer) = btrim(v_expected);
  end if;
  insert into public.user_answers (user_id, question_id, answer, is_correct)
  values (v_user_id, p_question_id, p_answer, v_correct);
  update public.profiles
  set current_streak = case when v_correct then current_streak + 1 else 0 end,
      best_streak = greatest(best_streak, case when v_correct then current_streak + 1 else 0 end)
  where id = v_user_id
  returning profiles.current_streak, profiles.best_streak into v_current, v_best;
  return query select v_correct, v_current, v_best;
end;
$$;

create table public.note_folders (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(name) between 1 and 100),
  created_at timestamptz not null default now()
);
create table public.note_files (
  id uuid primary key default gen_random_uuid(),
  folder_id uuid not null references public.note_folders(id) on delete cascade,
  name text not null,
  storage_path text not null unique,
  created_at timestamptz not null default now()
);
create table public.helpdesk_queries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  subject text not null check (length(subject) between 1 and 120),
  message text not null check (length(message) between 1 and 4000),
  reply text,
  status text not null default 'open' check (status in ('open','resolved')),
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;
alter table public.quizzes enable row level security;
alter table public.quiz_questions enable row level security;
alter table public.question_keys enable row level security;
alter table public.user_answers enable row level security;
alter table public.note_folders enable row level security;
alter table public.note_files enable row level security;
alter table public.helpdesk_queries enable row level security;

create policy "Users read own profile; admin reads all" on public.profiles for select to authenticated
using (id = (select auth.uid()) or (select public.is_site_admin()));
create policy "Users read active quizzes; admin reads all" on public.quizzes for select to authenticated
using (is_active or (select public.is_site_admin()));
create policy "Visitors read active quizzes" on public.quizzes for select to anon using (is_active);
create policy "Admin manages quizzes" on public.quizzes for all to authenticated
using ((select public.is_site_admin())) with check ((select public.is_site_admin()));
create policy "Users read active quiz questions" on public.quiz_questions for select to authenticated
using (exists (select 1 from public.quizzes q where q.id = quiz_id and q.is_active) or (select public.is_site_admin()));
create policy "Visitors read active quiz questions" on public.quiz_questions for select to anon
using (exists (select 1 from public.quizzes q where q.id = quiz_id and q.is_active));
create policy "Admin manages questions" on public.quiz_questions for all to authenticated
using ((select public.is_site_admin())) with check ((select public.is_site_admin()));
create policy "Admin manages answer keys" on public.question_keys for all to authenticated
using ((select public.is_site_admin())) with check ((select public.is_site_admin()));
create policy "Users read own answers; admin reads all" on public.user_answers for select to authenticated
using (user_id = (select auth.uid()) or (select public.is_site_admin()));
create policy "Users read folders" on public.note_folders for select to authenticated using (true);
create policy "Visitors read folders" on public.note_folders for select to anon using (true);
create policy "Admin manages folders" on public.note_folders for all to authenticated
using ((select public.is_site_admin())) with check ((select public.is_site_admin()));
create policy "Users read file metadata" on public.note_files for select to authenticated using (true);
create policy "Visitors read file metadata" on public.note_files for select to anon using (true);
create policy "Admin manages file metadata" on public.note_files for all to authenticated
using ((select public.is_site_admin())) with check ((select public.is_site_admin()));
create policy "Users read own helpdesk queries; admin reads all" on public.helpdesk_queries for select to authenticated
using (user_id = (select auth.uid()) or (select public.is_site_admin()));
create policy "Users submit own helpdesk queries" on public.helpdesk_queries for insert to authenticated
with check (user_id = (select auth.uid()));
create policy "Admin updates helpdesk queries" on public.helpdesk_queries for update to authenticated
using ((select public.is_site_admin())) with check ((select public.is_site_admin()));

grant select on public.profiles, public.quizzes, public.quiz_questions, public.user_answers,
  public.note_folders, public.note_files, public.helpdesk_queries to authenticated;
grant select on public.quizzes, public.quiz_questions, public.note_folders, public.note_files to anon;
grant insert, update, delete on public.quizzes, public.quiz_questions, public.question_keys,
  public.note_folders, public.note_files to authenticated;
grant insert, update on public.helpdesk_queries to authenticated;
revoke all on function public.submit_quiz_answer(uuid, text) from public, anon;
grant execute on function public.submit_quiz_answer(uuid, text) to authenticated;

insert into storage.buckets (id,name,public,file_size_limit)
values ('study-files','study-files',false,20971520)
on conflict (id) do update set public = false, file_size_limit = 20971520;
create policy "Authenticated users read study files" on storage.objects for select to authenticated
using (bucket_id = 'study-files');
create policy "Admin uploads study files" on storage.objects for insert to authenticated
with check (bucket_id = 'study-files' and (select public.is_site_admin()));
create policy "Admin updates study files" on storage.objects for update to authenticated
using (bucket_id = 'study-files' and (select public.is_site_admin()))
with check (bucket_id = 'study-files' and (select public.is_site_admin()));
create policy "Admin deletes study files" on storage.objects for delete to authenticated
using (bucket_id = 'study-files' and (select public.is_site_admin()));
