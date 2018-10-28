/* global describe before beforeEach after it */
const { expect } = require('chai')
const { RTMClient } = require('@slack/client')
const slackMock = require('slack-mock')()
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms))
const token = process.env.BOT_SLACK_USER_TOKEN

describe('[client]', () => {
  before(() => {
    slackMock.web.addResponse({
      url: 'https://slack.com/api/rtm.start',
      status: 200,
      body: {
        ok: true,
        self: { name: 'mockSelf', id: 'mself' },
        team: { name: 'mockTeam', id: 'mteam' }
      }
    })
    return delay(50)
  })
  beforeEach(() => {
    slackMock.reset()
  })
  after(() => {
    return slackMock.rtm.stopServer(token)
  })
  describe('connect', () => {
    it('is able to connect', async () => {
      const rtm = new RTMClient(token)
      const connection = await rtm.start({})
      expect(connection.ok).to.equal(true)
      expect(connection).to.include.keys(['url', 'team', 'scopes'])
    })
  })
})
