require('dotenv').config();
const { Client } = require('discord.js');
const selfRoles = require('./lib/bot-events-helpers/self-roles');
const warTeamEvents = require('./lib/bot-events-helpers/war-team-helpers');
const playerVerificationCommand = require('./lib/bot-events-helpers/player-verification-command');
const upcomingChestsCommand = require('./lib/bot-events-helpers/upcoming-chests-command');
const databaseRepository = require('./lib/database-helpers/database-repository');
const inOutCronJob = require('./lib/bot-events-helpers/in-out-cron-job');
const checkMissedBattleDayDecksCronJob = require('./lib/bot-events-helpers/check-missed-battle-day-decks-cron-job');
const toKickListCronJob = require('./lib/bot-events-helpers/to-kick-list-cron-job');

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
const LINK_DISCOD_TO_CR_ACCOUNTS_CHANNEL_ID = '899384962128707616';
const CLAN1_ROLE_ID = '873489388338810921';
const CLAN2_ROLE_ID = '873489468466823218';
const SELF_ROLE_MESSAGE_ID = '874040719495544862';
const COLEADER_ROLE_ID = '814834289613996082';
const LEADER_ROLE_ID = '815152089201246244';
const TEST_ROLE_ID = '880484404424753233';
// const TEST_CHANNEL_ID = '870792677472489515'; // Add this to the array for testing
const IN_OUT_LOG_CHANNEL_IDS = {
	LEGACY_IN_OUT_LOG_CHANNEL_ID: '879119156665016400',
	IN_LOG_CHANNEL_ID_RW: '903346349892861982',
	OUT_LOG_CHANNEL_ID_RW: '903345957557633114',
	IN_LOG_CHANNEL_ID_HC: '907336661451546725',
	OUT_LOG_CHANNEL_ID_HC: '907336720662548531',
};
const CLAN_WISE_CHANNEL_IDS = {
	'#2PYUJUL': CLAN1_CHAT_CHANNEL_ID,
	'#P9QQVJVG': CLAN2_CHAT_CHANNEL_ID,
};
const CLAN_WISE_ROLE_IDS = {
	'#2PYUJUL': CLAN1_ROLE_ID,
	'#P9QQVJVG': CLAN2_ROLE_ID,
};

let ENVIRONMENT_SPECIFIC_APPLICATION_CONFIG = {};
switch (process.env.ENVIRONMENT_TYPE) {
case 'production' :
	ENVIRONMENT_SPECIFIC_APPLICATION_CONFIG = {
		isSelfRolesEnabled: true,
		isByLevelCommandEnabled: true,
		isVerifyDiscordCrLinkEnabled: false,
		isLegacyInOutLogEnabled: true,
		isInLogEnabled: false,
		isOutLogEnabled: false,
		isInOutLogsComputationEnabled: true,
		isCollectDailyRiverRaceDataEnabled: true,
		isGenerateDailyUnusedDecksReportEnabled: true,
		isSendActionDailyUnusedDecksReportEnabled: true,
		isGenerateEndOfRiverRaceReportEnabled: false,
		isSendActionEndOfRiverRaceReportEnabled: false,
		isUpcomingChestsCommandEnabled: false,
		isToKickListCronEnabled: false,
	};
	break;
case 'staging':
	ENVIRONMENT_SPECIFIC_APPLICATION_CONFIG = {
		isSelfRolesEnabled: false,
		isByLevelCommandEnabled: false,
		isVerifyDiscordCrLinkEnabled: true,
		isLegacyInOutLogEnabled: false,
		isInLogEnabled: true,
		isOutLogEnabled: true,
		isInOutLogsComputationEnabled: true,
		isCollectDailyRiverRaceDataEnabled: true,
		isGenerateDailyUnusedDecksReportEnabled: true,
		isSendActionDailyUnusedDecksReportEnabled: false,
		isGenerateEndOfRiverRaceReportEnabled: true,
		isSendActionEndOfRiverRaceReportEnabled: true,
		isUpcomingChestsCommandEnabled: true,
		isToKickListCronEnabled: true,
	};
	break;
case 'dev':
	ENVIRONMENT_SPECIFIC_APPLICATION_CONFIG = {
		isSelfRolesEnabled: true,
		isByLevelCommandEnabled: true,
		isVerifyDiscordCrLinkEnabled: true,
		isLegacyInOutLogEnabled: true,
		isInLogEnabled: true,
		isOutLogEnabled: true,
		isInOutLogsComputationEnabled: true,
		isCollectDailyRiverRaceDataEnabled: true,
		isGenerateDailyUnusedDecksReportEnabled: true,
		isSendActionDailyUnusedDecksReportEnabled: true,
		isGenerateEndOfRiverRaceReportEnabled: true,
		isSendActionEndOfRiverRaceReportEnabled: true,
		isUpcomingChestsCommandEnabled: true,
		isToKickListCronEnabled: true,
	};
	break;
default:
	ENVIRONMENT_SPECIFIC_APPLICATION_CONFIG = {
		isSelfRolesEnabled: false,
		isByLevelCommandEnabled: false,
		isVerifyDiscordCrLinkEnabled: false,
		isLegacyInOutLogEnabled: false,
		isInLogEnabled: false,
		isOutLogEnabled: false,
		isInOutLogsComputationEnabled: false,
		isCollectDailyRiverRaceDataEnabled: false,
		isGenerateDailyUnusedDecksReportEnabled: false,
		isSendActionDailyUnusedDecksReportEnabled: false,
		isGenerateEndOfRiverRaceReportEnabled: false,
		isSendActionEndOfRiverRaceReportEnabled: false,
		isUpcomingChestsCommandEnabled: false,
		isToKickListCronEnabled: false,
	};
}

const IN_OUT_LOGS_FLAG_COLLECTION = {
	isLegacyInOutLogEnabled: ENVIRONMENT_SPECIFIC_APPLICATION_CONFIG.isLegacyInOutLogEnabled,
	isInLogEnabled: ENVIRONMENT_SPECIFIC_APPLICATION_CONFIG.isInLogEnabled,
	isOutLogEnabled: ENVIRONMENT_SPECIFIC_APPLICATION_CONFIG.isOutLogEnabled,
	isInOutLogsComputationEnabled: ENVIRONMENT_SPECIFIC_APPLICATION_CONFIG.isInOutLogsComputationEnabled,
};

// Event Handlers
client.on('ready', () => {
	console.log(`${client.user.tag} has logged in.[${process.env.ENVIRONMENT_TYPE}]`);
});

client.on('message', async (message) => {
	if (message.author.bot) return;
	if (message.content.startsWith(PREFIX)) {
		const [CMD_NAME, ...args] = message.content
			.trim()
			.substring(PREFIX.length)
			.split(/\s+/);
		if (ENVIRONMENT_SPECIFIC_APPLICATION_CONFIG.isByLevelCommandEnabled && CMD_NAME === 'bylevel') {
			warTeamEvents.getMembersByLevel(message, args, [COLEADER_ROLE_ID, LEADER_ROLE_ID, TEST_ROLE_ID]);
			return;
		}

		if (ENVIRONMENT_SPECIFIC_APPLICATION_CONFIG.isVerifyDiscordCrLinkEnabled && CMD_NAME === 'verify' && message.channel.id === LINK_DISCOD_TO_CR_ACCOUNTS_CHANNEL_ID) {
			playerVerificationCommand.verifyPlayerOrFault(message, args, database);
			return;
		}

		if (ENVIRONMENT_SPECIFIC_APPLICATION_CONFIG.isUpcomingChestsCommandEnabled && CMD_NAME === 'chests' && message.channel.id === '901901247626489917') {
			upcomingChestsCommand.upcomingChestsOrFault(message, args, database, LINK_DISCOD_TO_CR_ACCOUNTS_CHANNEL_ID);
			return;
		}
	}
});

client.on('messageReactionAdd', (reaction, user) => {
	if (user.bot) return;
	console.log(`${user.username} reacted with ${reaction.emoji.name}`);
	if (ENVIRONMENT_SPECIFIC_APPLICATION_CONFIG.isSelfRolesEnabled && reaction.message.id === SELF_ROLE_MESSAGE_ID)
		selfRoles.handleRoleAdd(reaction, user, CLAN_WISE_ROLE_IDS);
});

client.on('messageReactionRemove', (reaction, user) => {
	if (user.bot) return;
	console.log(`${user.username} removed reaction ${reaction.emoji.name}`);
	if (ENVIRONMENT_SPECIFIC_APPLICATION_CONFIG.isSelfRolesEnabled && reaction.message.id === SELF_ROLE_MESSAGE_ID)
		selfRoles.handleRoleRemove(reaction, user, CLAN_WISE_ROLE_IDS);
});

// Bot login
client.login(process.env.DISCORDJS_BOT_TOKEN);

// Start CRON Jobs
Object.values(IN_OUT_LOGS_FLAG_COLLECTION).reduce((isEnabled, flag) => isEnabled || flag, false) && inOutCronJob.startInOutLogCronEachMinute(database, client, IN_OUT_LOG_CHANNEL_IDS, IN_OUT_LOGS_FLAG_COLLECTION);
ENVIRONMENT_SPECIFIC_APPLICATION_CONFIG.isCollectDailyRiverRaceDataEnabled && checkMissedBattleDayDecksCronJob.scheduleCronToCollectRiverRaceData(database);
ENVIRONMENT_SPECIFIC_APPLICATION_CONFIG.isGenerateDailyUnusedDecksReportEnabled && checkMissedBattleDayDecksCronJob.scheduleCronToGenerateDailyMissedBattleDecksReport(database, client, CLAN_WISE_CHANNEL_IDS, ENVIRONMENT_SPECIFIC_APPLICATION_CONFIG.isSendActionDailyUnusedDecksReportEnabled);
ENVIRONMENT_SPECIFIC_APPLICATION_CONFIG.isGenerateEndOfRiverRaceReportEnabled && checkMissedBattleDayDecksCronJob.scheduleCronToGenerateEndOfRaceMissedBattleDecksReport(database, client, CLAN_WISE_CHANNEL_IDS, ENVIRONMENT_SPECIFIC_APPLICATION_CONFIG.isSendActionEndOfRiverRaceReportEnabled);
ENVIRONMENT_SPECIFIC_APPLICATION_CONFIG.isToKickListCronEnabled && toKickListCronJob.scheduleCronToRefreshKickingBoardData(database, client);
