import * as bBot from 'bbot'
import { IUser, IChannel, IEvent, isEvent, isUser } from './interfaces'
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

    // Create caches
    this.setupCache()
  }

  /** Setup cache for specific methods before they are called. */
  setupCache () {
    // cache.use(this.web)
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

  /** Get channel by its name. */
  async channelByName (name: string) {
    const channels = await this.loadChannels()
    return channels.find((channel) => channel.name === name)
  }

  /** Get just the ID from a channel by name */
  async channelIdByName (name: string) {
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

  /** Fetch user info from the brain. If not available, call users.info */
  fetchUser (id: string) {
    // User exists in the brain - retrieve this representation
    if (this.bot.userById(id)) return Promise.resolve(this.bot.userById(id))
    // User is not in brain - call users.info
    // The user will be added to the brain in EventHandler
    return this.web.users.info({ user: id }).then((r) => {
      return this.updateUserInMemory((r as any).user)
    })
  }

  /** Fetch bot user info from the bot -> user map */
  fetchBotUser (id: string) {
    if (this.botUserIdMap[id]) return Promise.resolve(this.botUserIdMap[id])
    // Bot user is not in mapping - call bots.info
    this.web.bots.info({ bot: id }).then((r) => (r as any).bot)
  }

  /** Fetch conversation from map. If not available, call conversations.info */
  async fetchConversation (id: string) {
    // Current date minus 5 minutes (time of expiration for conversation info)
    const expiration = Date.now() - (5 * 60 * 1000)
    // Check whether conversation is held in client's channelData map and whether information is expired
    if (
      this.channelData[id] &&
      this.channelData[id].channel &&
      expiration < this.channelData[id].updated
    ) return Promise.resolve(this.channelData[id].channel)
    // Delete data from map if it's expired
    if (this.channelData[id]) delete this.channelData[id]
    // Return conversations.info promise
    const { channel } = (await this.web.conversations.info({ channel: id }) as any)
    if (channel) this.channelData[id] = { channel, updated: Date.now() }
    return channel
  }

  /**
   * Will return a bBot user object in memory.
   * User can represent a Slack human user or bot user.
   * This may be called as a handler for `user_change` events or to update a
   * a single user with its latest SlackUserInfo object.
   */
  updateUserInMemory (userOrEvent: IEvent | IUser) {
    // if invoked as a `user_change` handler, unwrap the user from the event
    const user = (isEvent(userOrEvent) && isUser(userOrEvent.user))
      ? userOrEvent.user
      : userOrEvent
    return this.bot.userById(user.id, user)
  }

  /**
   * Processes events to fetch additional data or rearrange the shape of an
   * event before handing off to the eventHandler.
   */
  async eventWrapper (e: IEvent) {
    if (!this.eventHandler) return

    // Handle parallel async requests
    const props: any = {}
    if (e.user) {
      props.user = isUser(e.user)
        ? this.fetchUser(e.user.id)
        : this.fetchUser(e.user)
    }
    if (e.bot_id) props.bot = this.fetchBotUser(e.bot_id)
    if (e.item_user) props.itemUser = this.fetchUser(e.item_user)
    await Promise.all(props.values())
      .catch((err) => {
        this.bot.logger.error(`[slack] RTM error fetching info for a property: ${err.message}.`)
      })

    // Start augmenting the event with the fetched data
    if (props.itemUser) e.item_user = props.itemUser

    // Assigning `event.user` properly depends on how the message was sent
    if (props.user) {
      // messages sent from human users, apps with a bot user and using the bot
      // token, and slackbot have the user property: this is preferred if its available
      e.user = props.user
    // props.bot will exist and be false if bot_id in `botUserIdMap` but is
    // from custom integration or app without bot user
    } else if (props.bot) {
      // props.bot is user representation of bot since it exists in botToUserMap
      if (this.botUserIdMap[e.bot_id]) {
        e.user = props.bot
      // bot_id exists on all messages with subtype bot_message
      // these messages only have a user_id property if sent from a bot user
      // therefore the above assignment will not happen for all messages from
      // custom integrations or apps without a bot user
      } else if (props.bot.user_id) {
        return this.web.users.info(props.bot.user_id).then((res) => {
          e.user = (res as any).user
          this.botUserIdMap[e.bot_id] = (res as any).user
          return e
        })
      // bot doesn't have an associated user id
      } else {
        this.botUserIdMap[e.bot_id] = false
        e.user = { id: e.bot_id, team_id: e.team_id } as IUser
      }
    } else {
      e.user = {} as IUser
    }
    // once the event is fully populated, hand off to the eventHandler
    if (this.eventHandler) {
      return this.eventHandler(e)
        .catch((err: Error) => {
          this.bot.logger.error(`[slack] Error processing an RTM event: ${err.message}.`)
        })
    }
  }
}
