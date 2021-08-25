require("dotenv").config();
const { Client } = require('discord.js');
const selfRoles = require('./lib/bot-events-helpers/self-roles');
const membersDataHelper = require('./lib/clash-royale-api-helpers/members-data-helper');

const client = new Client({
  partials: ['MESSAGE', 'REACTION']
});

//Constants
const PREFIX = "$";
const SELF_ROLE_MESSAGE_ID = '874040719495544862';
const SELF_ROLE_CLAN_ROLE_IDS = [ '873489388338810921', '873489468466823218' ];

//Event Handlers
client.on('ready', () => {
  console.log(`${client.user.tag} has logged in.`);
});

selfRoles.handleRoleAdd(client, SELF_ROLE_MESSAGE_ID, SELF_ROLE_CLAN_ROLE_IDS);
selfRoles.handleRoleRemove(client, SELF_ROLE_MESSAGE_ID, SELF_ROLE_CLAN_ROLE_IDS);

//Bot login
client.login(process.env.DISCORDJS_BOT_TOKEN);