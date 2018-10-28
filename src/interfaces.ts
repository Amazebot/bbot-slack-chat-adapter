export interface IUser {
  id: string
  team_id: string
  name: string
  deleted: boolean
  color: string
  real_name: string
  tz: string
  tz_label: string
  tz_offset: number
  profile: IProfile
  is_admin: boolean
  is_owner: boolean
  is_primary_owner: boolean
  is_restricted: boolean
  is_ultra_restricted: boolean
  is_bot: boolean
  is_stranger: boolean
  updated: number
  is_app_user: boolean
  has_2fa: boolean
  locale: string
}
export function isUser (arg: any): arg is IUser {
  return arg.profile !== undefined
}

export interface IProfile {
  avatar_hash: string
  status_text: string
  status_emoji: string
  status_expiration: number
  real_name: string
  display_name: string
  real_name_normalized: string
  display_name_normalized: string
  email: string
  image_24: string
  image_32: string
  image_48: string
  image_72: string
  image_192: string
  image_512: string
  team: string
}

export interface ITopic {
  value: string
  creator: string
  last_set: number
}

export interface IPurpose {
  value: string
  creator: string
  last_set: number
}

export interface IChannel {
  id: string
  name: string
  is_channel: boolean
  created: number
  creator: string
  is_archived: boolean
  is_general: boolean
  name_normalized: string
  is_shared: boolean
  is_org_shared: boolean
  is_member: boolean
  is_private: boolean
  is_mpim: boolean
  members: string[]
  topic: ITopic
  purpose: IPurpose
  previous_names: any[]
  num_members: number
}

export interface IEvent {
  [key: string]: any
  type: string
  user: string | IUser
  item: {
    type: string
    channel: string
    ts: number
  }
  event_ts: number
}
export function isEvent (arg: any): arg is IEvent {
  return arg.type !== undefined
}
