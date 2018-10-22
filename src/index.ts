import * as bBot from 'bbot'
import { SlackClient } from './client'
import { RTMClient } from '@slack/client'

/** Slack adapter processes incoming/outgoing and queries via Slack RTM API. */
export class Slack extends bBot.MessageAdapter {
  /** Name of adapter, used for logs */
  name = 'slack-chat-adapter'
  rtm = RTMClient // exposed for scripts
  client = new SlackClient()

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

  /** Parsing envelope content to an array of Slack message schemas */
  parseEnvelope (envelope: bBot.Envelope, roomId?: string) {
    console.log('[parseEnvelope]', { envelope, roomId })
  }
}

export const use = (bot: any) => Slack.getInstance(bot)
