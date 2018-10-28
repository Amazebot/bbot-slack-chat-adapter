const slackMock = require('slack-mock')()

slackMock.web.addResponse({
  url: 'https://slack.com/api/rtm.start',
  status: 200,
  body: {
    ok: true,
    self: { name: 'mockSelf', id: 'mself' },
    team: { name: 'mockTeam', id: 'mteam' }
  }
})

slackMock.web.addResponse({
  url: 'https://slack.com/api/users.list',
  status: 200,
  body: {
    ok: true,
    self: {
      name: 'mockSelf'
    },
    team: {
      name: 'mockTeam'
    }
  }
})

module.exports = slackMock
