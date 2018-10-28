/** Starts bbot using the adapter, for testing from command line. */

import * as bot from 'bbot'
import * as slack from './index'

bot.adapters.message = slack.use(bot)

bot.global.text(/ping/i, (b) => {
  b.respond('pong')
})

module.exports = bot.start().then(() => bot)
