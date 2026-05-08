-- ─── SENDER PERMISSIONS ──────────────────────────────────────────────────────
-- Run this in Supabase SQL editor to give senders access to their assigned actions and contacts.

-- Actions: senders can read actions assigned to them
create policy "Senders can read assigned actions"
  on public.actions for select using (
    assigned_user_id = auth.uid() and
    exists (select 1 from public.profiles where id = auth.uid() and role = 'sender')
  );

-- Actions: senders can update actions assigned to them (log results)
create policy "Senders can update assigned actions"
  on public.actions for update using (
    assigned_user_id = auth.uid() and
    exists (select 1 from public.profiles where id = auth.uid() and role = 'sender')
  );

-- Actions: senders can insert new follow-up actions
create policy "Senders can insert actions"
  on public.actions for insert with check (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'sender')
  );

-- Contacts: senders can read contacts for their assigned actions
create policy "Senders can read contacts"
  on public.contacts for select using (
    exists (
      select 1 from public.actions
      where contact_id = contacts.id
        and assigned_user_id = auth.uid()
    ) and
    exists (select 1 from public.profiles where id = auth.uid() and role = 'sender')
  );

-- Contacts: senders can update contacts (e.g., set do_not_contact)
create policy "Senders can update contacts"
  on public.contacts for update using (
    exists (
      select 1 from public.actions
      where contact_id = contacts.id
        and assigned_user_id = auth.uid()
    ) and
    exists (select 1 from public.profiles where id = auth.uid() and role = 'sender')
  );

-- Interactions: senders can insert interaction records
create policy "Senders can insert interactions"
  on public.interactions for insert with check (
    exists (select 1 from public.profiles where id = auth.uid() and role = 'sender')
  );

-- Interactions: senders can read interactions for their contacts
create policy "Senders can read interactions"
  on public.interactions for select using (
    exists (
      select 1 from public.actions
      where contact_id = interactions.contact_id
        and assigned_user_id = auth.uid()
    ) and
    exists (select 1 from public.profiles where id = auth.uid() and role = 'sender')
  );

-- ─── FIX assigned_to CONSTRAINT ──────────────────────────────────────────────
-- The original constraint only allowed 'admin' and 'candidate'.
-- 'sender' needs to be added for actions assigned to senders.
alter table public.actions drop constraint if exists actions_assigned_to_check;
alter table public.actions add constraint actions_assigned_to_check
  check (assigned_to in ('admin', 'candidate', 'sender'));

-- ─── FIX interaction_type CONSTRAINT ─────────────────────────────────────────
-- Add 'Volunteer Signup' and 'Sig Collector Signup' for import tracking.
alter table public.interactions drop constraint if exists interactions_interaction_type_check;
alter table public.interactions add constraint interactions_interaction_type_check
  check (interaction_type in (
    'Email', 'Call', 'Text', 'Discord', 'In-person', 'Meeting', 'Event',
    'Form submission', 'Donation', 'Internal note',
    'Volunteer Signup', 'Sig Collector Signup'
  ));
