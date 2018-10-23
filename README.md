[guide]: https://slackapi.github.io/hubot-slack/#basic-setup
[faq]: https://api.slack.com/faq#slack_apps

# bBot Slack Chat Adapter

[![npm version](https://img.shields.io/npm/v/bbot-rasa-nlu.svg?style=flat)](https://www.npmjs.com/package/bbot-slack-chat-adapter)

Chat adapter for connecting bBot to Slack.

## `~(O_O)~`

Visit [bBot.chat](http://bbot.chat/) for info on the conversation engine.

## Connecting to Slack

> Docs TBD...

While in development, please see [the Hubot guide][guide]. bBot
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

### Running Tests

For questions about testing Slack Apps and Bot Users, see the [Slack FAQ][faq]

> BEWARE: Currently tests run with the same token and workspace configured for
> the LIVE bot, as stubs and mock responses yet haven't been developed.

While in active development, I recommend working on and running tests for one
method at a time, using grep for the method name, e.g:

```mocha test/client.spec.ts --grep loadUsers```

#### Bot Permissions

The Bot User needs to be authorised to:
- `users:read` Access your workspace profile information 
- `channels:read` Access information about user's public channels
- `channels:write` Modify your public channels