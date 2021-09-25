require("dotenv").config();
const { Client } = require('discord.js');
const selfRoles = require('./lib/bot-events-helpers/self-roles');
const warTeamEvents = require('./lib/bot-events-helpers/war-team-helpers')
const databaseRepository = require('./lib/database-helpers/database-repository');
const inOutCronJob = require('./lib/bot-events-helpers/in-out-cron-job');
const checkMissedBattleDayDecksCronJob = require('./lib/bot-events-helpers/check-missed-battle-day-decks-cron-job');

//Database connection
const database = databaseRepository.connectRealtimeDatabase();

//Init discord client
const client = new Client({
  partials: ['MESSAGE', 'REACTION']
});

//Constants
const PREFIX = "$";
const SELF_ROLE_MESSAGE_ID = '874040719495544862';
const SELF_ROLE_CLAN_ROLE_IDS = [ '873489388338810921', '873489468466823218' ];
const COLEADER_ROLE_ID = '814834289613996082';
const LEADER_ROLE_ID = '815152089201246244';
const TEST_ROLE_ID = '880484404424753233';
const TEST_CHANNEL_ID = '870792677472489515'; //Add this to the array for testing
const IN_OUT_LOG_CHANNEL_IDS = [ '879119156665016400' ];
const CLAN1_CHAT_CHANNEL_ID = '873489644753420328';
const CLAN2_CHAT_CHANNEL_ID = '873489702286655508';

//Event Handlers
client.on('ready', () => {
  console.log(`${client.user.tag} has logged in.`);
});

client.on('message', async (message) => {
  if (message.author.bot) return;
  if (message.content.startsWith(PREFIX)) {
    const [CMD_NAME, ...args] = message.content
      .trim()
      .substring(PREFIX.length)
      .split(/\s+/);
    if (CMD_NAME === 'bylevel') {
      warTeamEvents.getMembersByLevel(message, args, [COLEADER_ROLE_ID, LEADER_ROLE_ID, TEST_ROLE_ID]);
      return;
    }
  }
});

selfRoles.handleRoleAdd(client, SELF_ROLE_MESSAGE_ID, SELF_ROLE_CLAN_ROLE_IDS);
selfRoles.handleRoleRemove(client, SELF_ROLE_MESSAGE_ID, SELF_ROLE_CLAN_ROLE_IDS);

//Bot login
client.login(process.env.DISCORDJS_BOT_TOKEN);

//Start CRON Jobs
inOutCronJob.startInOutLogCronEachMinute(database, client, IN_OUT_LOG_CHANNEL_IDS);
checkMissedBattleDayDecksCronJob.scheduleCronsTOCollectDataAboutMissedBattleDecks(database, client, {
  "#2PYUJUL": CLAN1_CHAT_CHANNEL_ID,
  "#P9QQVJVG": CLAN2_CHAT_CHANNEL_ID
});