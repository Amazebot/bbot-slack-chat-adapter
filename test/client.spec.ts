import 'mocha'
import * as bot from 'bbot'
import { expect } from 'chai'
import { SlackClient } from '../src/client'
import * as faker from 'faker'
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))
const token = process.env.BOT_SLACK_USER_TOKEN
let client: SlackClient

const testID = faker.random.word()
console.log(`\n👋 Slack client tests will be identified by the word... \x1b[45m\x1b[30m ${testID} \x1b[0m`)

describe('[client]', () => {
  before(() => {
    client = new SlackClient({ token }, bot)
  })
  describe('constructor', () => {
    // @todo RTM seems to have change structure - does this work in hubot?
    // it('Should initialize with an RTM client', () => {
    //   expect(client.rtm.token).to.equal(token)
    // })
    it('Should initialize with a Web client', () => {
      expect(client.web.token).to.equal(token)
    })
    // @todo attaches events - use spy for event listener
  })
  describe('.onEvent', () => {
    // @todo as above, from other side
  })
  describe('.connect', () => {
    it('is able to connect', async () => {
      const connection = await client.connect()
      expect(connection.ok).to.equal(true)
      expect(connection).to.include.keys(['url', 'team', 'scopes'])
    })
    it('can query the API once connected', async () => {
      await client.connect()
      const result = await client.web.api.test()
      expect(result).to.have.property('ok', true)
    })
  })
  describe('.disconnect', () => {
    // @todo
  })
  describe('.setTopic', () => {
    // @todo
  })
  describe('.send', () => {
    // @todo
  })
  describe('.loadUsers', () => {
    it('resolves with array of users', async () => {
      await client.connect()
      const users = await client.loadUsers()
        .catch((err) => expect(err).to.equal(undefined))
      expect(users.length).to.be.gte(1)
      expect(users[0]).to.include.keys(['team_id', 'name', 'profile'])
    })
  })
  describe('.loadChannels', () => {
    it('resolves with array of channels', async () => {
      await client.connect()
      const channels = await client.loadChannels()
        .catch((err) => expect(err).to.equal(undefined))
      expect(channels.length).to.be.gte(1)
      expect(channels[0]).to.include.keys(['id', 'name', 'members', 'topic'])
    })
  })
  describe('.channelByName', () => {
    it('resolves with the test channel info', async () => {
      await client.connect()
      const channel = await client.channelByName('bbot-test')
        .catch((err) => expect(err).to.equal(undefined))
      expect(channel).to.have.property('is_channel', true)
    })
  })
  describe.only('.channelIdByName', () => {
    it('resolves with the channel ID', async () => {
      const id = await client.channelIdByName('bbot-test')
        .catch((err) => expect(err).to.equal(undefined))
      expect(id).to.be.a('string')
      expect(id).to.have.lengthOf(9)
    })
    it('uses cache on subsequent calls', async () => {
      const start = Date.now()
      const id = await client.channelIdByName('bbot-test')
        .catch((err) => expect(err).to.equal(undefined))
      const done = Date.now()
      const time = done - start
      expect(id).to.be.a('string')
      expect(id).to.have.lengthOf(9)
      expect(time).to.be.lte(10)
    })
  })
  /** @todo Requires app permissions, not available to Bot User */
  describe('.setTopic', () => {
    it.skip('updates the test channel topic with the test ID', async () => {
      await client.connect()
      const { id } = await client.channelByName('bbot-test')
      const result = await client.setTopic(id, `Testing bBot Slack adapter (${testID})`)
      console.log(result) // don't know what response should look like
    })
  })
})
