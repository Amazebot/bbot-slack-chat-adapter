import 'dotenv/config'
import { RTMClient, WebClient } from '@slack/client'
const token = process.env.BOT_SLACK_USER_TOKEN
const rtm = new RTMClient(token)
const web = new WebClient(token, { maxRequestConcurrency: 1 })

async function setup () {
  const channelsRes: any = await web.channels.list()
  if (!channelsRes.ok) throw new Error('Setup failed to list channels.')
  const testChannel = (channelsRes.channels as any[]).find((channel) => {
    return channel.name === 'bbot-test'
  })
  if (!testChannel) throw new Error('Tests require a channel named `bbot-test`')
  else console.log('Setup confirmed `bbot-test` channel exists, ID: ' + testChannel.id)
}
setup()
