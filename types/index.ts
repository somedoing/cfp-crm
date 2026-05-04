export type Role = 'admin' | 'candidate'

export type Profile = {
  id: string
  email: string
  full_name: string
  role: Role
}

export type Contact = {
  id: string
  display_id: string
  first_name: string
  last_name: string
  full_name: string
  email: string
  phone: string
  town: string
  state: string
  zip: string
  source: string
  original_source_form: string
  newsletter_subscriber: boolean
  email_opt_in: boolean
  text_opt_in: boolean
  in_discord: boolean
  discord_username: string
  is_supporter: boolean
  is_volunteer: boolean
  is_active_volunteer: boolean
  is_signature_collector: boolean
  is_donor: boolean
  is_media_contact: boolean
  is_org_contact: boolean
  is_candidate_partner: boolean
  is_coalition_contact: boolean
  do_not_contact: boolean
  volunteer_stage: string
  signature_stage: string
  discord_stage: string
  donor_stage: string
  media_stage: string
  org_outreach_stage: string
  partner_stage: string
  volunteer_circle: string
  support_level: number
  assigned_owner: string
  priority: string
  last_contact_date: string
  last_contact_summary: string
  next_action: string
  next_action_due: string
  notes: string
  created_at: string
  updated_at: string
}

export type Action = {
  id: string
  contact_id: string
  org_id: string
  action_area: string
  action_type: string
  title: string
  suggested_ask: string
  suggested_message: string
  owner: string
  assigned_to: 'admin' | 'candidate'
  priority: string
  status: string
  due_date: string
  completed_date: string
  outcome: string
  follow_up_needed: boolean
  follow_up_date: string
  notes: string
  created_at: string
  contact?: Contact
}

export type Interaction = {
  id: string
  contact_id: string
  action_id: string
  interaction_date: string
  interaction_type: string
  direction: string
  owner: string
  summary: string
  result: string
  follow_up_needed: boolean
  follow_up_date: string
  notes: string
  created_at: string
}

export type ImportRow = {
  id: string
  import_id: string
  raw_data: Record<string, string>
  matched_contact_id: string | null
  duplicate_confidence: 'exact' | 'likely' | 'possible' | 'none'
  action: 'pending' | 'create' | 'merge' | 'skip' | 'flag'
  processed: boolean
}
