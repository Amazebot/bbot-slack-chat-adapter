import * as bBot from 'bbot'
import { IUser, IChannel, IEvent, IBot } from './interfaces'
import {
  RTMClient,
  WebClient,
  RTMClientOptions,
  RTMStartArguments,
  RTMConnectArguments,
  RTMCallResultCallback,
  ChatPostMessageArguments
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
    cache.create('channelbyId')
    cache.create('channelIdByName')
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
  setTopic (channelId: string, topic: string) {
    this.bot.logger.debug(`[slack] set topic to ${topic}`)
    return this.web.conversations.setTopic({ channel: channelId, topic })
      .catch((err) => {
        this.bot.logger.error(`[slack] failed setting topic in ${channelId}: ${err.message}`)
      })
  }

  /**
   * Respond to incoming Slack message or dispatch unprompted, using Web API.
   * @todo Add interface/s for Slack postMessage object schema
   */
  send (message: ChatPostMessageArguments) {
    this.bot.logger.debug(`[slack] send to channel: ${message.channel}, message: ${message}`)

    // Slack client post message options
    const defaults = { as_user: true, link_names: 1 }

    // @todo enable threading after bBot update allows prototype changes
    // if (envelope.message && envelope.message.thread) {
    //   options.thread_ts = envelope.message.thread
    // }

    return this.web.chat.postMessage(Object.assign(message, defaults))
      .catch((err) => this.bot.logger.error(`[slack] send error: ${err.message}`))
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

  /** Fetch channels from Slack API. */
  async loadChannels () {
    const channels: IChannel[] = await this.getList('channels')
    return channels
  }

  /** Get channel by its ID (from cache if available). */
  async channelById (channel: string): Promise<IChannel | undefined> {
    // get from cache
    const cachedChannel = cache.get('channelById', channel)
    if (cachedChannel) return cachedChannel as IChannel
    // not in cache
    this.bot.logger.debug(`[slack] getting channel info: ${channel}`)
    const result = await this.web.channels.info({ channel })
    if (result.ok) {
      this.bot.logger.debug(`[slack] channel info ${JSON.stringify((result as any).channel)}`)
      cache.set('channelById', channel, (result as any).channel)
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

  /** Process events with given handler. */
  async eventWrapper (e: IEvent) {
    if (this.eventHandler) {
      return Promise.resolve(this.eventHandler(e))
        .catch((err: Error) => {
          this.bot.logger.error(`[slack] Error processing an RTM event: ${err.message}.`)
        })
    }
  }
}
