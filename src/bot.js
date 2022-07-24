require('dotenv').config();
const { Client } = require('discord.js');
const selfRoles = require('./lib/bot-events-helpers/self-roles');
const warTeamEvents = require('./lib/bot-events-helpers/war-team-helpers');
const playerVerificationCommand = require('./lib/bot-events-helpers/player-verification-command');
const upcomingChestsCommand = require('./lib/bot-events-helpers/upcoming-chests-command');
const databaseRepository = require('./lib/database-helpers/database-repository');
const inOutCronJob = require('./lib/bot-events-helpers/in-out-cron-job');
// const checkMissedBattleDayDecksCronJob = require('./lib/bot-events-helpers/check-missed-battle-day-decks-cron-job');
// const toKickListCronJob = require('./lib/bot-events-helpers/to-kick-list-cron-job');
const collectBattleDayInitialParticipantData = require('./lib/bot-events-helpers/war-reports-module/collect-battle-day-initial-participant-data');
const collectEndOfBattleDayParticipantData = require('./lib/bot-events-helpers/war-reports-module/collect-end-of-battle-day-participant-data');
const generateDailyBattleDayReport = require('./lib/bot-events-helpers/war-reports-module/generate-daily-battle-day-report');
const { triggerCurrentRiverRaceReport, triggerGetPlayerTagsFromCurrentRiverRaceReport } = require('./lib/bot-events-helpers/war-reports-module/generate-section-missed-deck-report');
const tempScrapeCommand = require('./lib/bot-events-helpers/temp-command-send-cw2-history');
// Database connection
const database = databaseRepository.connectRealtimeDatabase();
const constants = require('./config/constants');
const { getEnvironmentConfig } = require('./config/getEnvironmentConfig');

// Init discord client
const client = new Client({
	partials: ['MESSAGE', 'REACTION'],
});

// Constants
const {
	PREFIX,
	LINK_DISCOD_TO_CR_ACCOUNTS_CHANNEL_ID,
	SELF_ROLE_MESSAGE_ID,
	COLEADER_ROLE_ID,
	LEADER_ROLE_ID,
	TEST_ROLE_ID,
	IN_OUT_LOG_CHANNEL_IDS,
	CLAN_WISE_CHANNEL_IDS,
	CLAN_WISE_ROLE_IDS,
	// TEMP_CHANNEL_IDS, used by legacy reports
	TEMP_CHANNEL_IDS_ARRAY,
	TEMP_CHANNEL_IDS_BY_CLAN,
	CLAN_TAGS_BY_TEMP_CHANNEL_IDS,
	PLAYERS_ALLOWED_TO_USE_SCRAPE,
} = constants;

const ENVIRONMENT_SPECIFIC_APPLICATION_CONFIG = getEnvironmentConfig(process.env.ENVIRONMENT_TYPE || 'default');

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

		if (ENVIRONMENT_SPECIFIC_APPLICATION_CONFIG.isCurrentRaceConsolidatedReportCommandEnabled && CMD_NAME === 'racereport') {
			triggerCurrentRiverRaceReport(message, args, database, [COLEADER_ROLE_ID, LEADER_ROLE_ID], CLAN_WISE_CHANNEL_IDS);
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

		console.log(PLAYERS_ALLOWED_TO_USE_SCRAPE, message.author.id, PLAYERS_ALLOWED_TO_USE_SCRAPE.includes(message.author.id));

		if (ENVIRONMENT_SPECIFIC_APPLICATION_CONFIG.isTempScrapeCommandEnabled && CMD_NAME === 'scrape' && PLAYERS_ALLOWED_TO_USE_SCRAPE.includes(message.author.id) && TEMP_CHANNEL_IDS_ARRAY.includes(message.channel.id)) {
			tempScrapeCommand.scrapeAndSendRecords(message, args, TEMP_CHANNEL_IDS_BY_CLAN, CLAN_TAGS_BY_TEMP_CHANNEL_IDS);
			return;
		}

		if (ENVIRONMENT_SPECIFIC_APPLICATION_CONFIG.isCurrentRaceConsolidatedReportPlayerTagsCommandEnabled && CMD_NAME === 'racetags') {
			triggerGetPlayerTagsFromCurrentRiverRaceReport(message, args, database, [COLEADER_ROLE_ID, LEADER_ROLE_ID], CLAN_WISE_CHANNEL_IDS);
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
// ENVIRONMENT_SPECIFIC_APPLICATION_CONFIG.isCollectDailyRiverRaceDataEnabled && checkMissedBattleDayDecksCronJob.scheduleCronToCollectRiverRaceData(database);
// ENVIRONMENT_SPECIFIC_APPLICATION_CONFIG.isGenerateDailyUnusedDecksReportEnabled && checkMissedBattleDayDecksCronJob.scheduleCronToGenerateDailyMissedBattleDecksReport(database, client, TEMP_CHANNEL_IDS_BY_TAG, ENVIRONMENT_SPECIFIC_APPLICATION_CONFIG.isSendActionDailyUnusedDecksReportEnabled);
// ENVIRONMENT_SPECIFIC_APPLICATION_CONFIG.isGenerateEndOfRiverRaceReportEnabled && checkMissedBattleDayDecksCronJob.scheduleCronToGenerateEndOfRaceMissedBattleDecksReport(database, client, TEMP_CHANNEL_IDS_BY_TAG, ENVIRONMENT_SPECIFIC_APPLICATION_CONFIG.isSendActionEndOfRiverRaceReportEnabled);
// ENVIRONMENT_SPECIFIC_APPLICATION_CONFIG.isToKickListCronEnabled && toKickListCronJob.scheduleCronToRefreshKickingBoardData(database, client);

ENVIRONMENT_SPECIFIC_APPLICATION_CONFIG.isCollectBattleDayInitialParticipantDataEnabled && collectBattleDayInitialParticipantData.scheduleCronToCollectBattleDayInitialParticipantData(database);
ENVIRONMENT_SPECIFIC_APPLICATION_CONFIG.isCollectEndOfBattleDayParticipantDataEnabled && collectEndOfBattleDayParticipantData.scheduleCronToCollectEndOfBattleDayParticipantData(database);
ENVIRONMENT_SPECIFIC_APPLICATION_CONFIG.isGenerateDailyBattleDayReportEnabled && generateDailyBattleDayReport.scheduleCronToGenerateDailyMissedBattleDecksReport(database, client, CLAN_WISE_CHANNEL_IDS, ENVIRONMENT_SPECIFIC_APPLICATION_CONFIG.isSendActionDailyBattleDayReportEnabled);
