/** A little (manual) test bBot using the Slack adapter */
import * as bot from 'bbot'
import * as slack from '../src'

bot.adapters.message = slack.use(bot)

// Wave hello when user calls out the bot/s
bot.global.text(/(hi|hello).*bots?/, (b) => b.respond('Hello :wave:'), {
  id: 'hello-bots'
})

// Respond directly when user says hello to this bot
bot.global.direct(/hi|hello/i, (b) => b.reply('Hey there.'), {
  id: 'hello-direct'
})

// Use the special Slack ephemeral message response
bot.global.text({ contains: ['hi', 'hello'] }, (b) => b.respondVia('react', ':wave:'), {
  id: 'hello-react'
})

// Use the Slack ephemeral message response (only they will see the ghost)
bot.global.text({ contains: ['ghost', 'spooky', 'halloween'] }, (b) => {
  return b.respondVia('ephemeral', '👻')
}, {
  id: 'hello-ephemeral'
})

bot.start()
