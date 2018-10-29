/** Starts bbot using the adapter, for testing from command line. */

import * as bot from 'bbot'
import * as slack from './index'

bot.adapters.message = slack.use(bot)

// Test basic branch callbacks of different types
bot.global.text(/ping/i, (b) => b.respond('pong 🏓'))
bot.global.direct(/ping/i, (b) => b.respondVia('reply', 'pong 🏓'))
bot.global.text(/dm/i, (b) => b.respondVia('direct', '_pong_ 🤫'))
bot.global.text(/pong/i, (b) => b.respondVia('react', 'table_tennis_paddle_and_ball'))
bot.global.text(/boo/i, (b) => b.respondVia('ephemeral', 'boo 👻'))
bot.global.text(/attach/i, (b) => {
  return b.respond({
    fallback: `See: https://www.wikiwand.com/en/Three_Laws_of_Robotics`,
    image: `https://upload.wikimedia.org/wikipedia/en/8/8e/I_Robot_-_Runaround.jpg`,
    title: {
      text: `Asimov's Three Laws of Robotics`,
      link: `https://www.wikiwand.com/en/Three_Laws_of_Robotics`
    }
  })
})

module.exports = bot.start().then(() => bot)
