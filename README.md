# Instructions

To use this code, follow the instructions:

1) Install all dependencies:

    `npm i`

2) Create a .env file for environment variables in the root directory of this repository, not inside the `src` folder!

3) Create three environment variables:
    - **DISCORDJS_BOT_TOKEN** - Your Bot Token `Required` https://discordjs.guide/preparations/setting-up-a-bot-application.html
    - **CLASH_ROYALE_API_TOKEN** - Your CR API token `Required` https://developer.clashroyale.com/#/getting-started
    - **FIREBASE_DATABASE_URL** - Firebase realtine database URL `Required`
    - **FIREBASE_ADMIN_SDK_CONFIG** - Firebase admin service account config (minified) `Required` https://firebase.google.com/docs/admin/setup#initialize-sdk

4) Initialize data into your realtime database instance using this script `/src/lib/database-helpers/scripts/initialize-database.js`

5) Run `npm run start` or `npm run dev` in the project directory

# Notes

- Keep in mind all of the role IDs, channel IDs, etc. were all for my test server. You must configure it yourself by changing the IDs to meet your needs.
