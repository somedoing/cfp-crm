-- CFP CRM Schema
-- Run this in your Supabase SQL editor

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ─── PROFILES (extends Supabase auth.users) ───────────────────────────────────
create table public.profiles (
  id uuid references auth.users on delete cascade primary key,
  email text,
  full_name text,
  role text not null default 'candidate' check (role in ('admin', 'candidate')),
  created_at timestamptz default now()
);

alter table public.profiles enable row level security;

create policy "Users can read own profile"
  on public.profiles for select using (auth.uid() = id);

create policy "Admins can read all profiles"
  on public.profiles for select using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, new.raw_user_meta_data->>'full_name');
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ─── CONTACTS ─────────────────────────────────────────────────────────────────
create table public.contacts (
  id uuid default uuid_generate_v4() primary key,
  display_id text unique, -- e.g. CFP-0042
  first_name text,
  last_name text,
  full_name text generated always as (
    trim(coalesce(first_name, '') || ' ' || coalesce(last_name, ''))
  ) stored,
  email text,
  phone text,
  town text,
  state text default 'NH',
  zip text,
  county text,
  congressional_district text,
  source text,
  original_source_form text,

  -- Opt-ins
  newsletter_subscriber boolean default false,
  email_opt_in boolean default false,
  text_opt_in boolean default false,

  -- Roles (Yes/No flags)
  in_discord boolean default false,
  discord_username text,
  is_supporter boolean default false,
  is_volunteer boolean default false,
  is_active_volunteer boolean default false,
  is_signature_collector boolean default false,
  collected_signatures boolean default false,
  has_petition_sheets boolean default false,
  returned_petition_sheets boolean default false,
  is_donor boolean default false,
  is_media_contact boolean default false,
  is_org_contact boolean default false,
  is_candidate_partner boolean default false,
  is_coalition_contact boolean default false,
  is_union_contact boolean default false,
  is_press_contact boolean default false,
  do_not_contact boolean default false,

  -- Pipeline stages
  volunteer_stage text default 'New' check (volunteer_stage in (
    'New','Contacted','Interested','Asked','Assigned','Active','Reliable','Lead','Paused','Inactive','Not a fit'
  )),
  signature_stage text check (signature_stage in (
    'New lead','Contacted','Needs training','Needs materials','Has petition sheets','Collecting','Sheets returned','Reviewed','Complete','Paused'
  )),
  discord_stage text check (discord_stage in (
    'Should invite','Invited','Joined','Needs welcome','Active','Quiet','Not applicable'
  )),
  donor_stage text check (donor_stage in (
    'Prospect','Not asked','Asked','Pledged','Donated','Thanked','Recurring','Lapsed','Do not solicit'
  )),
  media_stage text check (media_stage in (
    'Researching','Ready to pitch','Pitched','Follow-up needed','Covered','Relationship building','Not interested'
  )),
  org_outreach_stage text check (org_outreach_stage in (
    'Researching','Warm intro needed','Contacted','Meeting requested','Meeting scheduled','Supportive','Active partner','Declined','Dormant'
  )),
  partner_stage text check (partner_stage in (
    'Prospect','Contacted','Exploring alignment','Coordinating','Active partner','Needs follow-up','Paused','Declined'
  )),
  volunteer_circle text check (volunteer_circle in (
    'Not Yet Engaged','Supporter','First Action','Contributor','Reliable Volunteer','Volunteer Lead','Core Organizer'
  )),

  -- Meta
  support_level integer check (support_level between 1 and 5),
  assigned_owner text,
  priority text check (priority in ('High','Medium','Low')),
  last_contact_date date,
  last_contact_summary text,
  next_action text,
  next_action_due date,
  notes text,

  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.contacts enable row level security;

create policy "Admins full access to contacts"
  on public.contacts for all using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

-- Auto-increment display_id
create sequence if not exists contact_display_seq start 1;
create or replace function set_contact_display_id()
returns trigger as $$
begin
  new.display_id := 'CFP-' || nextval('contact_display_seq')::text;
  return new;
end;
$$ language plpgsql;

create trigger before_insert_contact
  before insert on public.contacts
  for each row when (new.display_id is null)
  execute procedure set_contact_display_id();

-- ─── ORGANIZATIONS ────────────────────────────────────────────────────────────
create table public.organizations (
  id uuid default uuid_generate_v4() primary key,
  name text not null,
  org_type text check (org_type in (
    'Union','Nonprofit','Business','Community Group','Media Outlet',
    'Political Organization','Allied Campaign','Coalition Partner','Other'
  )),
  website text,
  region text,
  town text,
  state text,
  primary_contact_id uuid references public.contacts(id),
  relationship_owner text,
  outreach_stage text check (outreach_stage in (
    'Researching','Warm intro needed','Contacted','Meeting requested',
    'Meeting scheduled','Supportive','Active partner','Declined','Dormant'
  )),
  current_ask text,
  last_contact_date date,
  next_action text,
  next_action_due date,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.organizations enable row level security;

create policy "Admins full access to organizations"
  on public.organizations for all using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

-- ─── ACTIONS ──────────────────────────────────────────────────────────────────
create table public.actions (
  id uuid default uuid_generate_v4() primary key,
  contact_id uuid references public.contacts(id),
  org_id uuid references public.organizations(id),
  action_area text check (action_area in (
    'Volunteers','Signature Collection','Discord','Donations','Media',
    'Organization Outreach','Candidate Partners','Events','General Supporter Follow-Up','Data Cleanup'
  )),
  action_type text check (action_type in (
    'Call','Text','Email','Discord DM','Ask','Follow-up','Thank-you',
    'Invite','Assign task','Check in','Pitch','Schedule meeting','Review','Data cleanup'
  )),
  title text,
  suggested_ask text,
  suggested_message text,
  owner text,
  assigned_to text check (assigned_to in ('admin', 'candidate')),
  priority text check (priority in ('High','Medium','Low')),
  status text default 'Not started' check (status in (
    'Not started','In progress','Contacted','Waiting on response',
    'Responded','Done','Blocked','Dropped','Skipped'
  )),
  due_date date,
  completed_date date,
  outcome text check (outcome in (
    'Yes','Maybe','No','No response','Needs more info','Wrong contact','Do not contact','Completed'
  )),
  follow_up_needed boolean default false,
  follow_up_date date,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

alter table public.actions enable row level security;

create policy "Admins full access to actions"
  on public.actions for all using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

create policy "Candidates can read and update assigned actions"
  on public.actions for select using (
    assigned_to = 'candidate' and
    exists (select 1 from public.profiles where id = auth.uid() and role = 'candidate')
  );

create policy "Candidates can update assigned actions"
  on public.actions for update using (
    assigned_to = 'candidate' and
    exists (select 1 from public.profiles where id = auth.uid() and role = 'candidate')
  );

-- ─── INTERACTIONS ─────────────────────────────────────────────────────────────
create table public.interactions (
  id uuid default uuid_generate_v4() primary key,
  contact_id uuid references public.contacts(id),
  action_id uuid references public.actions(id),
  interaction_date date default current_date,
  interaction_type text check (interaction_type in (
    'Email','Call','Text','Discord','In-person','Meeting','Event',
    'Form submission','Donation','Internal note'
  )),
  direction text check (direction in ('Outbound','Inbound')),
  owner text,
  summary text,
  result text,
  follow_up_needed boolean default false,
  follow_up_date date,
  notes text,
  created_at timestamptz default now()
);

alter table public.interactions enable row level security;

create policy "Admins full access to interactions"
  on public.interactions for all using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

create policy "Candidates can insert interactions"
  on public.interactions for insert with check (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'candidate')
  );

-- ─── DONATIONS ────────────────────────────────────────────────────────────────
create table public.donations (
  id uuid default uuid_generate_v4() primary key,
  contact_id uuid references public.contacts(id),
  donation_date date,
  amount numeric(10,2),
  method text,
  source text,
  transaction_id text,
  thank_you_sent boolean default false,
  treasurer_reviewed boolean default false,
  notes text,
  created_at timestamptz default now()
);

alter table public.donations enable row level security;

create policy "Admins full access to donations"
  on public.donations for all using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

-- ─── IMPORTS ──────────────────────────────────────────────────────────────────
create table public.imports (
  id uuid default uuid_generate_v4() primary key,
  filename text,
  source_form text,
  imported_by uuid references auth.users(id),
  row_count integer,
  processed_count integer default 0,
  status text default 'pending' check (status in ('pending','reviewing','processed','error')),
  created_at timestamptz default now()
);

create table public.import_rows (
  id uuid default uuid_generate_v4() primary key,
  import_id uuid references public.imports(id) on delete cascade,
  raw_data jsonb,
  matched_contact_id uuid references public.contacts(id),
  duplicate_confidence text check (duplicate_confidence in ('exact','likely','possible','none')),
  action text default 'pending' check (action in ('pending','create','merge','skip','flag')),
  processed boolean default false,
  created_at timestamptz default now()
);

alter table public.imports enable row level security;
alter table public.import_rows enable row level security;

create policy "Admins full access to imports"
  on public.imports for all using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

create policy "Admins full access to import_rows"
  on public.import_rows for all using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

-- ─── SIGNATURE BATCHES ────────────────────────────────────────────────────────
create table public.signature_batches (
  id uuid default uuid_generate_v4() primary key,
  collector_id uuid references public.contacts(id),
  collected_date date,
  town text,
  location text,
  raw_count integer,
  valid_count integer,
  rejected_count integer,
  sheet_status text default 'With collector' check (sheet_status in (
    'With collector','Received','Reviewed','Submitted','Accepted','Rejected'
  )),
  received_by text,
  date_received date,
  submitted_date date,
  notes text,
  created_at timestamptz default now()
);

alter table public.signature_batches enable row level security;

create policy "Admins full access to signature_batches"
  on public.signature_batches for all using (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
  );

-- ─── INDEXES ──────────────────────────────────────────────────────────────────
create index contacts_email_idx on public.contacts (lower(email));
create index contacts_phone_idx on public.contacts (phone);
create index contacts_volunteer_stage_idx on public.contacts (volunteer_stage);
create index contacts_signature_stage_idx on public.contacts (signature_stage);
create index contacts_donor_stage_idx on public.contacts (donor_stage);
create index actions_status_idx on public.actions (status);
create index actions_assigned_to_idx on public.actions (assigned_to);
create index actions_due_date_idx on public.actions (due_date);
create index actions_contact_id_idx on public.actions (contact_id);
