/** Starts bbot using the adapter, for testing from command line. */

import * as bot from 'bbot'
import * as slack from './index'

bot.adapters.nlu = slack.use(bot)

module.exports = bot.start().then(() => bot)
