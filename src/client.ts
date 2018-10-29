import * as bBot from 'bbot'
import { IUser, IConversation, IEvent, IBot, IConnection } from './interfaces'
import {
  RTMClient,
  WebClient,
  RTMClientOptions,
  RTMStartArguments,
  RTMConnectArguments,
  RTMCallResultCallback,
  ChatPostMessageArguments,
  ChatPostEphemeralArguments
} from '@slack/client'
import * as cache from './cache'

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
  botUserIdMap: { [id: string]: IBot }
  eventHandler: any
  pageSize = 100
  connection?: IConnection

  /** Client initialisation. */
  constructor (options: ISlackClientOptions, private bot: typeof bBot) {
    this.rtm = new RTMClient(options.token, options.rtm)
    this.web = new WebClient(options.token, { maxRequestConcurrency: 1 })

    this.bot.logger.debug(`[slack] client initialized with options ${JSON.stringify(options.rtm)}`)
    this.rtmStartOpts = options.rtmStart || {}

    // Map to convert bot user IDs (BXXXXXXXX) to user representations for
    // events from custom integrations and apps without a bot user.
    this.botUserIdMap = { 'B01': { id: 'B01', user_id: 'USLACKBOT' } }

    // Event handling
    this.rtm.on('message', this.eventWrapper, this)
    this.rtm.on('reaction_added', this.eventWrapper, this)
    this.rtm.on('reaction_removed', this.eventWrapper, this)
    this.rtm.on('member_joined_channel', this.eventWrapper, this)
    this.rtm.on('member_left_channel', this.eventWrapper, this)
    this.rtm.on('user_change', this.eventWrapper, this)
    this.eventHandler = undefined

    // Create caches
    this.setupCache()
  }

  /**
   * Cache user and channel info.
   * Defaults keep 100 results for 5 minutes.
   * Users are kept longer (12hrs) because their data is updated with an event.
   */
  setupCache () {
    cache.create('userById', { maxAge: 60 * 60 * 12 * 1000 })
    cache.create('conversationById')
    cache.create('channelIdByName')
  }

  /** Set event handler. */
  onEvent (callback: RTMCallResultCallback) {
    if (this.eventHandler !== callback) this.eventHandler = callback
  }

  /** Open connection to the Slack RTM API. */
  async connect () {
    this.bot.logger.debug(`[slack] start client with options: ${JSON.stringify(this.rtmStartOpts)}`)
    const result = await this.rtm.start(this.rtmStartOpts)
    if (result.ok) {
      this.connection = (result as any)
      this.bot.logger.info(`[slack] connected as ${this.connection!.self.name} (${this.connection!.self.id})`)
    } else {
      throw new Error(`[slack] connection failed with error: ${result.error}`)
    }
  }

  /** Disconnect from the Slack RTM API */
  disconnect () {
    this.rtm.disconnect()
    this.rtm.removeAllListeners()
  }

  /** Set a channel's topic */
  setTopic (channelId: string, topic: string) {
    this.bot.logger.debug(`[slack] set topic to ${topic}`)
    return this.web.conversations.setTopic({ channel: channelId, topic })
      .catch((err) => {
        this.bot.logger.error(`[slack] failed setting topic in ${channelId}: ${err.message}`)
      })
  }

  /** Respond to incoming Slack message or dispatch unprompted. */
  send (message: ChatPostMessageArguments) {
    this.bot.logger.debug(`[slack] send to channel: ${message.channel}, message: ${message}`)
    const defaults = { as_user: true, link_names: 1 } // post message options
    // @todo enable threading after bBot update allows prototype changes
    // if (envelope.message && envelope.message.thread) {
    //   options.thread_ts = envelope.message.thread
    // }
    return this.web.chat.postMessage(Object.assign(message, defaults))
      .catch((err) => this.bot.logger.error(`[slack] postMessage error: ${err.message}`))
  }

  /** Send an ephemeral message to a user in a given channel */
  ephemeral (message: ChatPostEphemeralArguments) {
    this.bot.logger.debug(`[slack] send ephemeral to user ${message.user} channel ${message.channel}`)
    const defaults = { as_user: true, link_names: 1 } // post message options
    return this.web.chat.postEphemeral(Object.assign(message, defaults))
      .catch((err) => this.bot.logger.error(`[slack] postEphemeral error: ${err.message}`))
  }

  /** Set a reaction (emoji) on a given message. */
  react (name: string, channel: string, timestamp: string) {
    this.bot.logger.debug(`[slack] set reaction :${name}:, on message at ${timestamp} in ${channel}`)
    return this.web.reactions.add({ name, channel, timestamp })
      .catch((err) => this.bot.logger.error(`[slack] add reaction error: ${err.message}`))
  }

  /** Do API list request/s, concatenating paginated results */
  async getList (collection: string) {
    let items: any[] = []
    const limit = this.pageSize
    let cursor: string | undefined
    let pageComplete: boolean = false
    if (Object.keys(this.web).indexOf(collection) === -1) {
      throw new Error(`[slack] client has no list method for ${collection} collection`)
    }
    do {
      const results: any = await (this.web as any)[collection].list({ limit, cursor })
      if (!results || !results.ok) throw new Error(`[slack] no results returned for ${collection} list`)
      if (results.response_metadata) cursor = results.response_metadata.next_cursor
      if (results[collection] && results[collection].length) {
        items = items.concat(results[collection])
      }
      if (
        !results[collection]
        || !results[collection].length
        || cursor === ''
        || typeof cursor === 'undefined'
      ) pageComplete = true // no remaining users/pages, don't continue lookup
    } while (!pageComplete)
    return items
  }

  /** Fetch users from Slack API. */
  async loadUsers () {
    const members: IUser[] = await this.getList('members')
    return members
  }

  /** Get the type of a conversation. */
  conversationType (conversation: IConversation) {
    if (conversation.is_channel) return 'channel'
    else if (conversation.is_im) return 'im'
    else if (conversation.is_mpim) return 'mpim'
    else if (conversation.is_shared) return 'share'
    else if (conversation.is_group) return 'group'
  }

  /** Fetch channels from Slack API. */
  async loadChannels () {
    const channels: IConversation[] = await this.getList('channels')
    return channels
  }

  /** Open direct message channel with a user (or resume cached) */
  async openDirect (user: string): Promise<IConversation | undefined> {
    // get from cache
    // const cachedChannel = cache.get('openDirect', user)
    // if (cachedChannel) return (cachedChannel as string)
    // not in cache
    this.bot.logger.debug(`[slack] opening direct channel with ${user}`)
    const result = await this.web.im.open({ user })
    if (result.ok) {
      this.bot.logger.debug(`[slack] IM info ${JSON.stringify((result as any).channel)}`)
      cache.set('openDirect', user, (result as any).channel)
      return (result as any).channel
    }
  }

  /** Get conversation/channel by its ID (from cache if available). */
  async conversationById (channel: string): Promise<IConversation | undefined> {
    // get from cache
    const cachedChannel = cache.get('conversationById', channel)
    if (cachedChannel) return cachedChannel as IConversation
    // not in cache
    this.bot.logger.debug(`[slack] getting channel info: ${channel}`)
    const result = await this.web.conversations.info({ channel })
    if (result.ok) {
      this.bot.logger.debug(`[slack] channel info ${JSON.stringify((result as any).channel)}`)
      cache.set('conversationById', channel, (result as any).channel)
      return (result as any).channel
    }
  }

  /** Get channel by its name (has to load all and filter). */
  async channelByName (name: string) {
    const channels = await this.loadChannels()
    return channels.find((channel) => channel.name === name)
  }

  /** Get just the ID from a channel by name (from cache if available) */
  async channelIdByName (name: string): Promise<string | undefined> {
    // get from cache
    const cachedId = cache.get('channelIdByName', name)
    if (cachedId) return cachedId
    // not in cache
    const channel = await this.channelByName(name)
    if (channel) {
      cache.set('channelIdByName', name, channel.id)
      return channel.id
    }
  }

  /** Get the user by their ID (from cache if available) */
  async userById (user: string): Promise<IUser | undefined> {
    // get from cache
    const cachedUser = cache.get('userById', user)
    if (cachedUser) return cachedUser
    // not in cache
    const result = await this.web.users.info({ user })
    if (result.ok) cache.set('userById', user, (result as any).user)
    return (result as any).user
  }

  /** Get a bot user by its ID (from internal collection if available) */
  async botById (bot: string): Promise<IBot | undefined> {
    if (!this.botUserIdMap[bot]) {
      const result = await this.web.bots.info({ bot })
      if (result.ok) this.botUserIdMap[bot] = (result as any).bot
    }
    return this.botUserIdMap[bot]
  }

  /** Process events with given handler (ignoring those from bot's self). */
  async eventWrapper (e: IEvent) {
    if (this.connection && e.user === this.connection.self.id) return
    if (this.eventHandler) {
      return Promise.resolve(this.eventHandler(e))
        .catch((err: Error) => {
          this.bot.logger.error(`[slack] Error processing an RTM event: ${err.message}.`)
        })
    }
  }
}
