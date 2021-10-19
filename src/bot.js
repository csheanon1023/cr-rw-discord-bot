require('dotenv').config();
const { Client } = require('discord.js');
const selfRoles = require('./lib/bot-events-helpers/self-roles');
const warTeamEvents = require('./lib/bot-events-helpers/war-team-helpers');
const playerVerificationCommand = require('./lib/bot-events-helpers/player-verification-command');
const databaseRepository = require('./lib/database-helpers/database-repository');
const inOutCronJob = require('./lib/bot-events-helpers/in-out-cron-job');
const checkMissedBattleDayDecksCronJob = require('./lib/bot-events-helpers/check-missed-battle-day-decks-cron-job');

// Database connection
const database = databaseRepository.connectRealtimeDatabase();

// Init discord client
const client = new Client({
	partials: ['MESSAGE', 'REACTION'],
});

// Constants
const PREFIX = '$';
// TODO update channel IDS before deploying
// const CLAN1_CHAT_CHANNEL_ID = '886248413769895987';
// const CLAN2_CHAT_CHANNEL_ID = '886248413769895987';
const CLAN1_CHAT_CHANNEL_ID = '873489644753420328';
const CLAN2_CHAT_CHANNEL_ID = '873489702286655508';
const CLAN1_ROLE_ID = '873489388338810921';
const CLAN2_ROLE_ID = '873489468466823218';
const SELF_ROLE_MESSAGE_ID = '874040719495544862';
const COLEADER_ROLE_ID = '814834289613996082';
const LEADER_ROLE_ID = '815152089201246244';
const TEST_ROLE_ID = '880484404424753233';
// const TEST_CHANNEL_ID = '870792677472489515'; // Add this to the array for testing
const IN_OUT_LOG_CHANNEL_IDS = [ '879119156665016400' ];
const CLAN_WISE_CHANNEL_IDS = {
	'#2PYUJUL': CLAN1_CHAT_CHANNEL_ID,
	'#P9QQVJVG': CLAN2_CHAT_CHANNEL_ID,
};
const CLAN_WISE_ROLE_IDS = {
	'#2PYUJUL': CLAN1_ROLE_ID,
	'#P9QQVJVG': CLAN2_ROLE_ID,
};

if (process.env.ENVIRONMENT_TYPE === 'production') {
	// Event Handlers
	client.on('ready', () => {
		console.log(`${client.user.tag} has logged in.[PRODUCTION]`);
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

			if (CMD_NAME === 'verify' && message.channelId === '899384962128707616') {
				// check syntax and send proper syntax if invalid

				// if args has player tag, initiate verification process
				// if player is not in one of the clans, send proper message
				// if player tag is already linked, send proper message
				// if playertag verification has already been initialted, send proper message
				// if all checks passed
				// generate a verification deck
				// persist the deck, imageid, player tag, discordID and other relavant info in DB
				// send the embed
				// PLAN garbage collection for images created

				// if args does not have a player tag, check the pending verification log for the id-tag pair
				// if not found send proper message
				// if found trigger a check for the last 10 battles
				// if verification fails, send proper message
				// if verification passes, update the discord-cracc object, remove from pending verification, send the completed message
				playerVerificationCommand.verifyPlayer(message, args, [COLEADER_ROLE_ID, LEADER_ROLE_ID, TEST_ROLE_ID]);
				return;
			}
		}
	});

	client.on('messageReactionAdd', (reaction, user) => {
		if (user.bot) return;
		console.log(`${user.username} reacted with ${reaction.emoji.name}`);
		if (reaction.message.id === SELF_ROLE_MESSAGE_ID)
			selfRoles.handleRoleAdd(reaction, user, CLAN_WISE_ROLE_IDS);
	});

	client.on('messageReactionRemove', (reaction, user) => {
		if (user.bot) return;
		console.log(`${user.username} removed reaction ${reaction.emoji.name}`);
		if (reaction.message.id === SELF_ROLE_MESSAGE_ID)
			selfRoles.handleRoleRemove(reaction, user, CLAN_WISE_ROLE_IDS);
	});

	// Bot login
	client.login(process.env.DISCORDJS_BOT_TOKEN);

	// Start CRON Jobs
	inOutCronJob.startInOutLogCronEachMinute(database, client, IN_OUT_LOG_CHANNEL_IDS);
	checkMissedBattleDayDecksCronJob.scheduleCronToCollectRiverRaceData(database);
	checkMissedBattleDayDecksCronJob.scheduleCronToGenerateDailyMissedBattleDecksReport(database, client, CLAN_WISE_CHANNEL_IDS, true);
	checkMissedBattleDayDecksCronJob.scheduleCronToGenerateEndOfRaceMissedBattleDecksReport(database, client, CLAN_WISE_CHANNEL_IDS);
}

else if (process.env.ENVIRONMENT_TYPE === 'staging') {
	// Event Handlers
	client.on('ready', () => {
		console.log(`${client.user.tag} has logged in.[STAGING]`);
	});

	// client.on('message', async (message) => {
	// 	if (message.author.bot) return;
	// 	if (message.content.startsWith(PREFIX)) {
	// 		const [CMD_NAME, ...args] = message.content
	// 			.trim()
	// 			.substring(PREFIX.length)
	// 			.split(/\s+/);
	// 		if (CMD_NAME === 'bylevel') {
	// 			warTeamEvents.getMembersByLevel(message, args, [COLEADER_ROLE_ID, LEADER_ROLE_ID, TEST_ROLE_ID]);
	// 			return;
	// 		}
	// 	}
	// });

	// client.on('messageReactionAdd', (reaction, user) => {
	// 	if (user.bot) return;
	// 	console.log(`${user.username} reacted with ${reaction.emoji.name}`);
	// 	if (reaction.message.id === SELF_ROLE_MESSAGE_ID)
	// 		selfRoles.handleRoleAdd(reaction, user, CLAN_WISE_ROLE_IDS);
	// });

	// client.on('messageReactionRemove', (reaction, user) => {
	// 	if (user.bot) return;
	// 	console.log(`${user.username} removed reaction ${reaction.emoji.name}`);
	// 	if (reaction.message.id === SELF_ROLE_MESSAGE_ID)
	// 		selfRoles.handleRoleRemove(reaction, user, CLAN_WISE_ROLE_IDS);
	// });

	// Bot login
	client.login(process.env.DISCORDJS_BOT_TOKEN);

	// Start CRON Jobs
	// inOutCronJob.startInOutLogCronEachMinute(database, client, IN_OUT_LOG_CHANNEL_IDS);
	checkMissedBattleDayDecksCronJob.scheduleCronToCollectRiverRaceData(database);
	checkMissedBattleDayDecksCronJob.scheduleCronToGenerateDailyMissedBattleDecksReport(database, client, CLAN_WISE_CHANNEL_IDS);
	checkMissedBattleDayDecksCronJob.scheduleCronToGenerateEndOfRaceMissedBattleDecksReport(database, client, CLAN_WISE_CHANNEL_IDS, true);
}

else if (process.env.ENVIRONMENT_TYPE === 'dev') {
	// Event Handlers
	client.on('ready', () => {
		console.log(`${client.user.tag} has logged in.[DEV]`);
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

	client.on('messageReactionAdd', (reaction, user) => {
		if (user.bot) return;
		console.log(`${user.username} reacted with ${reaction.emoji.name}`);
		if (reaction.message.id === SELF_ROLE_MESSAGE_ID)
			selfRoles.handleRoleAdd(reaction, user, CLAN_WISE_ROLE_IDS);
	});

	client.on('messageReactionRemove', (reaction, user) => {
		if (user.bot) return;
		console.log(`${user.username} removed reaction ${reaction.emoji.name}`);
		if (reaction.message.id === SELF_ROLE_MESSAGE_ID)
			selfRoles.handleRoleRemove(reaction, user, CLAN_WISE_ROLE_IDS);
	});

	// Bot login
	client.login(process.env.DISCORDJS_BOT_TOKEN);

	// Start CRON Jobs
	inOutCronJob.startInOutLogCronEachMinute(database, client, IN_OUT_LOG_CHANNEL_IDS);
	checkMissedBattleDayDecksCronJob.scheduleCronToCollectRiverRaceData(database);
	checkMissedBattleDayDecksCronJob.scheduleCronToGenerateDailyMissedBattleDecksReport(database, client, CLAN_WISE_CHANNEL_IDS, true);
	checkMissedBattleDayDecksCronJob.scheduleCronToGenerateEndOfRaceMissedBattleDecksReport(database, client, CLAN_WISE_CHANNEL_IDS, true);
}
