import 'mocha'
import * as bot from 'bbot'
import { expect } from 'chai'
import { RTMClient, WebClient, MemoryDataStore } from '@slack/client'
import { SlackClient } from '../src/client'
let client: SlackClient
let token = process.env.BOT_SLACK_USER_TOKEN

describe('[client]', () => {
  beforeEach(() => {
    client = new SlackClient({ token }, bot)
  })
  describe('constructor', () => {
    // @todo RTM seems to have change structure - does this work in hubot?
    // it('Should initialize with an RTM client', () => {
    //   (client.rtm instanceof RTMClient).should.equal(true)
    //   expect(client.rtm.token).to.equal(token)
    // })
    it('Should initialize with a Web client', () => {
      expect(client.web instanceof WebClient).to.equal(true)
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
      console.log(users)
    })
  })
})
