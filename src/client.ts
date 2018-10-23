import * as bBot from 'bbot'
import { ISlackUser } from './interfaces'
import {
  RTMClient,
  WebClient,
  RTMClientOptions,
  RTMStartArguments,
  RTMConnectArguments,
  RTMCallResultCallback,
  WebAPICallResult,
  WebAPICallError
} from '@slack/client'

interface IUsersListResult extends WebAPICallResult {
  members: ISlackUser[]
}

/**
 * @todo Extend bBot prototypes
 * Cannot assign to const (bBot needs update)
 */
// abstract class SlackMessage extends bBot.Message {
//   thread?: string // thread ID : https://api.slack.com/docs/message-threading
// }
// bBot.Message = SlackMessage

/** Options for Slack RTM and Web Client connection. */
export interface ISlackClientOptions {
  token: string
  rtm?: RTMClientOptions
  rtmStart?: RTMStartArguments | RTMConnectArguments
}

/** Connection handler for Slack RTM and Web clients. */
export class SlackClient {
  rtm: RTMClient
  web: WebClient
  rtmStartOpts: RTMStartArguments | RTMConnectArguments
  botUserIdMap: any
  channelData: any
  eventHandler: any
  pageSize = 100

  /** Client initialisation. */
  constructor (options: ISlackClientOptions, private bot: typeof bBot) {
    this.rtm = new RTMClient(options.token, options.rtm)
    this.web = new WebClient(options.token, { maxRequestConcurrency: 1 })

    bot.logger.debug(`[slack] client initialized with options ${JSON.stringify(options.rtm)}`)
    this.rtmStartOpts = options.rtmStart || {}

    // Map to convert bot user IDs (BXXXXXXXX) to user representations for
    // events from custom integrations and apps without a bot user.
    this.botUserIdMap = { 'B01': { id: 'B01', user_id: 'USLACKBOT' } }

    // Map to convert conversation IDs to conversation representations.
    this.channelData = {}

    // Event handling
    this.rtm.on('message', this.eventWrapper, this)
    this.rtm.on('reaction_added', this.eventWrapper, this)
    this.rtm.on('reaction_removed', this.eventWrapper, this)
    this.rtm.on('presence_change', this.eventWrapper, this)
    this.rtm.on('member_joined_channel', this.eventWrapper, this)
    this.rtm.on('member_left_channel', this.eventWrapper, this)
    this.rtm.on('user_change', this.updateUserInMemory, this)
    this.eventHandler = undefined
  }

  /** Set event handler. */
  onEvent (callback: RTMCallResultCallback) {
    if (this.eventHandler !== callback) this.eventHandler = callback
  }

  /** Open connection to the Slack RTM API. */
  connect () {
    this.bot.logger.debug(`[slack] start client with options: ${JSON.stringify(this.rtmStartOpts)}`)
    return this.rtm.start(this.rtmStartOpts)
      .catch((err) => {
        this.bot.logger.error(`[slack] failed to start RTM API: ${err.message}`)
        throw err
      })
  }

  /** Disconnect from the Slack RTM API */
  disconnect () {
    this.rtm.disconnect()
    this.rtm.removeAllListeners()
  }

  /** Set a channel's topic */
  setTopic (channel: string, topic: string) {
    this.bot.logger.debug(`[slack] set topic to ${topic}`)
    return this.web.conversations.setTopic({ channel, topic })
      .catch((err) => {
        this.bot.logger.error(`[slack] failed setting topic in ${channel}: ${err.message}`)
      })
  }

  /**
   * Respond to incoming Slack message or dispatch unprompted, using Web API.
   * @todo Add interface/s for Slack postMessage object schema
   */
  send (envelope: bBot.Envelope, message: any) {
    if (!envelope.room.id && !message.channel) {
      this.bot.logger.error('[slack] Cannot send without valid room/conversation ID')
      return
    }

    // Slack client post message options
    const defaults = { as_user: true, link_names: 1 }

    // @todo enable threading after bBot update allows prototype changes
    // if (envelope.message && envelope.message.thread) {
    //   options.thread_ts = envelope.message.thread
    // }

    let promise: Promise<WebAPICallResult | WebAPICallError>
    if (typeof message === 'string') {
      this.bot.logger.debug(`[slack] client sending message to channel ${envelope.room.id}`)
      promise = this.web.chat.postMessage(Object.assign({
        text: message,
        channel: envelope.room.id!
      }, defaults))
    } else {
      this.bot.logger.debug(`[slack] client sending string to channel ${message.channel}`)
      promise = this.web.chat.postMessage(Object.assign(message, defaults))
    }
    return promise
      .catch((err) => this.bot.logger.error(`[slack] send error: ${err.message}`))
  }

  /** Fetch users from Slack API using pagination. */
  async loadUsers () {
    const members: ISlackUser[] = []
    const limit = this.pageSize
    let cursor: string | undefined
    let done: boolean = false
    do {
      const results = (await this.web.users.list({ limit, cursor }) as IUsersListResult)
      if (!results) return done = true
      if (results.response_metadata) cursor = results.response_metadata.next_cursor
      if (results.members && results.members.length) members.concat(results.members)
      else done = true
    } while (!done)
  }

  fetchUser (id: string) {
    // @todo
  }

  fetchBotUser (id: string) {
    // @todo
  }

  fetchConversation () {
    // @todo
  }

  updateUserInBrain () {
    // @todo
  }

  /**
   * Processes events to fetch additional data or rearrange the shape of an
   * event before handing off to the eventHandler.
   * @todo Add typings for RTM events listed in <https://api.slack.com/events>
   */
  async eventWrapper (e: any) {
    if (!this.eventHandler) return

    // Handle parallel async requests
    const props: any = {}
    if (e.user) props.user = this.fetchUser(e.user)
    if (e.bot_id) props.bot = this.fetchBotUser(e.bot_id)
    if (e.item_user) props.itemUser = this.fetchUser(e.item_user)
    await Promise.all(props.values())

    // Start augmenting the event with the fetched data
    if (props.itemUser) e.item_user = e.item_user

    // Assigning `event.user` properly depends on how the message was sent
    if (props.user) {
      e.user = props.user
    } else if (props.bot) {
      if (this.botUserIdMap[e.bot_id]) e.user = props.bot
    } else if (props.bot.user_id) {
      // @todo YOU ARE HERE 👉 client.coffee:344
    }
  }

  updateUserInMemory () {
    //
  }
}
