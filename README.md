# Instructions

To use this code, follow the instructions:

1) Install all dependencies:

    `npm i`

2) Create a .env file for environment variables in the root directory of this repository, not inside the `src` folder!

3) Create three environment variables:
    - **DISCORDJS_BOT_TOKEN** - Your Bot Token (Required) `Steps: https://discordjs.guide/preparations/setting-up-a-bot-application.html`
    - **CLASH_ROYALE_API_TOKEN** - Your CR API token (Required) `You can generate one here https://developer.clashroyale.com/#/getting-started`
    - **WEBHOOK_ID** - For webhooks, not required unless you want to use the webhook command
    - **WEBHOOK_TOKEN** - The token for your webhook client.

4) Run `npm run start` or `npm run dev` in the project directory

# Notes

- Keep in mind all of the role IDs, channel IDs, etc. were all for my test server. You must configure it yourself by changing the IDs to meet your needs.
