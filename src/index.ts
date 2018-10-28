import * as bBot from 'bbot'
import { SlackClient } from './client'
import {
  ChatPostMessageArguments,
  AttachmentAction,
  MessageAttachment
} from '@slack/client'
import { IEvent, isUser, IUser, IBot, isChannel } from './interfaces'
import * as cache from './cache'

/** Slack adapter processes incoming/outgoing and queries via Slack RTM API. */
export class Slack extends bBot.MessageAdapter {
  /** Name of adapter, used for logs */
  name = 'slack-message-adapter'
  client: SlackClient

  /** Singleton pattern instance */
  private static instance: Slack

  /** Prevent direct access to constructor for singleton adapter */
  private constructor (bot: typeof bBot) {
    super(bot)
    this.bot.settings.extend({
      'slack-user-token': {
        type: 'string',
        description: 'Your Slack Bot User OAuth Access Token',
        required: true
      },
      'slack-user-sync': {
        type: 'boolean',
        description: 'Sync users in workspace with bBot user memory',
        default: false
      }
    })
    this.client = new SlackClient({
      token: this.bot.settings.get('slack-user-token')
    }, this.bot)
  }

  /** Singleton instance init */
  static getInstance (bot: typeof bBot) {
    if (!Slack.instance) Slack.instance = new Slack(bot)
    return Slack.instance
  }

  /** Connect and confirm RTM API access on startup */
  async start () {
    await this.client.connect()
    this.client.onEvent(this.process.bind(this))
  }

  /** Close conversations, disconnect RTM API */
  async shutdown () {
    await this.client.disconnect()
  }

  /** Dispatch envelopes to Slack via defined methods */
  async dispatch (envelope: bBot.Envelope) {
    switch (envelope.method) {
      case 'send' :
        for (let message of this.parseEnvelope(envelope)) {
          await this.client.send(message)
        }
        break
    }
  }

  /** Collect attributes to receive incoming events, including messages */
  async process (e: IEvent) {
    this.bot.logger.debug(`[slack] event: ${JSON.stringify(e)}`)

    // if it's just a user update, handle and be done
    if (e.type === 'user_change' && isUser(e.user)) {
      const { user } = e
      cache.reset('userById', user.id)
      this.bot.userById(user.id, user)
      return
    }

    // populate user from event user data, bot or null (add to memory on )
    let slackUser: IUser | IBot

    // use given user if available (not in most event types)
    if (e.user && isUser(e.user)) {
      slackUser = this.bot.userById(e.user.id, e.user)

    // get full user attributes if only ID given
    } else if (e.user) {
      slackUser = (await this.client.userById(e.user) as IUser)

    // get user as bot if message from bot
    } else if (e.bot_id) {
      const bot = await this.client.botById(e.bot_id)
      if (bot) slackUser = bot
      else slackUser = { id: e.bot_id, team_id: e.team_id } as IUser

    // use null user (may be custom integration without bot user)
    } else slackUser = { id: 'null' } as IUser

    // put user in room from channel info
    let room
    if (e.channel) {
      const channel = (isChannel(e.channel))
        ? e.channel
        : await this.client.channelById(e.channel)
      if (channel) {
        let type = '?'
        if (channel.is_channel) type = 'c'
        else if (channel.is_im) type = 'd'
        else if (channel.is_mpim) type = 'm'
        else if (channel.is_shared) type = 's'
        else if (channel.is_private) type = 'p'
        room = { id: channel.id, name: channel.name, type }
      }
    }

    // populate bot user from slack user and channel info
    const user = this.bot.userById(slackUser.id, Object.assign({}, slackUser, { room }))

    // receive appropriate bot message type
    if (e.type === 'member_joined_channel') {
      this.bot.logger.debug(`[slack] ${user.name} joined ${user.room.name}`)
      return this.bot.receive(new bBot.EnterMessage(user, e.event_id))

    } else if (e.type === 'member_left_channel') {
      this.bot.logger.debug(`[slack] ${user.name} joined ${e.channel}`)
      return this.bot.receive(new bBot.LeaveMessage(user, e.event_id))

    } else if (e.type === 'message') {
      this.bot.logger.debug(`[slack] message from ${user.name}`)

      if (Array.isArray(e.attachments) && e.attachments.length) {
        this.bot.logger.debug('[rocketchat] hear type RichMessage')
        return this.bot.receive(new bBot.RichMessage(user, {
          attachments: e.attachments,
          text: e.text
        }, e.client_msg_id))
      }

      return this.bot.receive(new bBot.TextMessage(user, e.text, e.client_msg_id))
    }
  }

  /**
   * Parsing envelope content to an array of Slack message schemas.
   * Channel argument is only required to override the original envelope room
   * ID or if the envelope isn't in response to incoming message with room ID.
   */
  parseEnvelope (envelope: bBot.Envelope, channel?: string) {
    if (!channel) channel = (envelope.room) ? envelope.room.id : undefined
    if (!channel) throw new Error('[slack] cannot parse envelope without channel ID')
    const messages: ChatPostMessageArguments[] = []
    const attachments: MessageAttachment[] = []
    const actions: AttachmentAction[] = []
    // Create basic message for each string
    if (envelope.strings) {
      for (let text of envelope.strings) messages.push({ text, channel })
    }
    // Convert attachments to Slack schema from bBot payload attachment schema
    if (envelope.payload && Array.isArray(envelope.payload.attachments)) {
      for (let attachment of envelope.payload.attachments) {
        attachments.push(this.parseSchema(attachment, {
          'thumb_url': 'thumbUrl',
          'author_name': 'author.name',
          'author_link': 'author.link',
          'author_icon': 'author.icon',
          'title': 'title.text',
          'title_link': 'title.link',
          'image_url': 'image'
        }, attachment))
      }
    }
    // bBot actions schema is same as Slack, parseSchema not required
    if (envelope.payload && Array.isArray(envelope.payload.actions)) {
      for (let action of envelope.payload.actions) actions.push(action as AttachmentAction)
    }
    // Append actions to existing attachment if only one,
    // otherwise create new attachment for actions.
    if (actions.length) {
      if (attachments.length === 1) attachments[0].actions = actions
      else attachments.push({ actions })
    }
    // Append attachments to existing message if only one,
    // otherwise create new message for attachments.
    if (attachments.length) {
      if (messages.length === 1) messages[0].attachments = attachments
      else messages.push({ text: '', channel, attachments })
    }
    return messages
  }
}

export const use = (bot: any) => Slack.getInstance(bot)
