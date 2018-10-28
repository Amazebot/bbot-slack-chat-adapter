import * as bBot from 'bbot'
import { SlackClient } from './client'
import {
  RTMClient,
  ChatPostMessageArguments,
  AttachmentAction,
  MessageAttachment
} from '@slack/client'

/** Slack adapter processes incoming/outgoing and queries via Slack RTM API. */
export class Slack extends bBot.MessageAdapter {
  /** Name of adapter, used for logs */
  name = 'slack-message-adapter'
  rtm = RTMClient // exposed for scripts
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
    //
  }

  /** Close conversations, disconnect RTM API */
  async shutdown () {
    //
  }

  async dispatch () {
    //
  }

  /** Collect attributes to receive every incoming message in subscription */
  process (err: Error | null, message: any, meta: any) {
    console.log('[process]', { err, message, meta })
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
      if (attachments.length === 1) {
        attachments[0].actions = actions
      } else {
        attachments.push({ actions })
      }
    }
    // Append attachments to existing message if only one,
    // otherwise create new message for attachments.
    if (attachments.length) {
      if (messages.length === 1) {
        messages[0].attachments = attachments
      } else {
        messages.push({ text: '', channel, attachments })
      }
    }
    return messages
  }
}

export const use = (bot: any) => Slack.getInstance(bot)
