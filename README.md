[hubot-guide]: https://slackapi.github.io/hubot-slack/#basic-setup

# bBot Slack Chat Adapter

[![npm version](https://img.shields.io/npm/v/bbot-rasa-nlu.svg?style=flat)](https://www.npmjs.com/package/bbot-slack-chat-adapter)

Chat adapter for connecting bBot to Slack.

## `~(O_O)~`

Visit [bBot.chat](http://bbot.chat/) for info on the conversation engine.

## Connecting to Slack

> Docs TBD...

While in development, please see [the Hubot guide][hubot-guide]. bBot
architecture is very similar and for the purpose of setting up the App and Bot
User on your Slack workspace, those instructions are fine.

### Configuring the bot

```
BOT_SLACK_USER_TOKEN=YOUR_TOKEN
BOT_SLACK_USER_SYNC=true # default is false (enable only for small workspaces)
```

These options can also be given as CLI args like `--slack-user-sync true` or
as attributes in `package.json` under `"bot"` like `"slack-user-sync": true`.

## Contributing

This adapter is in development to provide MVP utility and needs to be matured
with more "real world" experience. If you're using Slack in production with more
advanced requirements, like custom actions or payloads, please report an issue
to describe your usage and requirements, so we might improve it together.
