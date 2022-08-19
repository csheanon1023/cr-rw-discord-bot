// to run script: node -r dotenv/config ./src/lib/bot-events-helpers/war-reports-module-astra/generate-daily-battle-day-report.js
const { getPreviousSeasonDetailsUptoSpecificBattleDayPeriod } = require('../../utils/warSeasonDetailsUtils');
const membersDataHelper = require('../../clash-royale-api-helpers/members-data-helper');
const cron = require('node-cron');
const { getCurrentTime } = require('../../utils/dateTimeUtils');
const { MessageEmbed } = require('discord.js');
const { getRows } = require('../../astra-database-helpers/rest-api-wrapper/getRows');
const { insertRowsJson } = require('../../astra-database-helpers/cassandra-nodejs-driver/insertRowsJson.js');

const clanListCache = [ '#2PYUJUL', '#P9QQVJVG', '#QRVUCJVP', '#Q02UV0C0', '#LUVY2QY2' ];

// generate report
const generateBattleDayReportByPeriodIndex = async (clanTag, seasonId, periodIndex) => {
	try {
		const week = Math.floor(Number(periodIndex) / 7) + 1;
		const { data: startOfDayData } = await getRows('war_reports', 'collected_battle_day_participant_data', [`${clanTag.substring(1)}`, 'start', `${seasonId}`, `${week}`], 2000, null, ['player_tag', 'player_name', 'decks_used_today', 'decks_used', 'clan_name', 'updated_at']);
		const { data: endOfDayData } = await getRows('war_reports', 'collected_battle_day_participant_data', [`${clanTag.substring(1)}`, 'end', `${seasonId}`, `${week}`], 2000, null, ['player_tag', 'decks_used', 'updated_at']);

		// TODO some validation because the flow didn't break here
		if (!startOfDayData || !endOfDayData || !startOfDayData.data || !endOfDayData.data || startOfDayData.data.length == 0 || endOfDayData.length == 0) {
			throw 'get start/end collection data was not successful';
		}

		if (startOfDayData.data.clanTag != endOfDayData.data.clanTag) {
			throw 'not able to match clans in both snaps';
		}
		// Generate Report
		// TODO getting clan name is hacky
		const unusedDecksReport = {
			seasonDetails: {
				seasonId: seasonId,
				periodIndex: periodIndex,
				sectionIndex: Math.floor(periodIndex / 7),
			},
			clanTag: clanTag,
			clanName: startOfDayData?.data?.[0]?.clan_name,
			unusedDecksReport: [],
		};
		startOfDayData.data.forEach(participant => {
			const currentParticipantData = endOfDayData.data.find(player => player.player_tag == participant.player_tag);
			if (currentParticipantData == undefined) {
				console.error(`generate daily battle day report failed, not able to find player in new river race data: ${participant.player_tag}`);
				return;
			}
			const unuesdDecks = 4 - (participant.decks_used_today + currentParticipantData.decks_used - participant.decks_used);
			if (unuesdDecks < 0 || unuesdDecks > 4) {
				console.log(`generate daily battle day report failed, something wrong with the calculations, invalid value for unuesdDecks: ${unuesdDecks}, player: ${participant.player_name}, ID: ${participant.player_tag}`);
				return;
			}
			if (unuesdDecks != 0) {
				const reportPlayerData = {
					tag: participant.player_tag,
					name: participant.player_name,
					unusedDecks: unuesdDecks,
					collection_time_start: participant.updated_at,
					collection_time_end: currentParticipantData.updated_at,
				};
				unusedDecksReport.unusedDecksReport.push(reportPlayerData);
			}
		});
		return unusedDecksReport;
	}
	catch (error) {
		console.error(`generate daily battle day report failed, generate report \n${error}`);
		return false;
	}
};

// save to DB
const saveBattleDayReportByPeriodIndex = async (clanTag, seasonId, periodIndex, unusedDecksReport, updated_at) => {
	// TODO improve check
	if (!unusedDecksReport) {
		console.error(`generate daily battle day report failed, save to DB clan tag (invalid report value): ${clanTag}`);
		return false;
	}

	const clan_tag = clanTag.substring(1);
	const clan_name = unusedDecksReport?.clanName ?? 'Default Name';
	const season = seasonId;
	const week = Math.floor(Number(periodIndex) / 7) + 1;
	const day = (Number(periodIndex) + 5) % 7;
	const validationKeys = {
		countQueryKeys: [
			{ column: 'clan_tag', value: clan_tag, type: 'text' },
			{ column: 'season', value: season, type: 'int' },
			{ column: 'week', value: week, type: 'int' },
			{ column: 'day', value: day, type: 'int' },
		],
		uniqueKeys: [
			{ column: 'player_tag', type: 'text' },
		],
	};
	const unusedDecksReportData = unusedDecksReport?.unusedDecksReport
		?.map(({ tag: player_name, name: player_tag, unusedDecks: unused_decks, collection_time_end, collection_time_start }) => (
			{ clan_tag, clan_name, season, week, day, player_name, player_tag, unused_decks, updated_at, collection_time_start, collection_time_end }));
	return await insertRowsJson('war_reports', 'period_unused_decks_report', unusedDecksReportData, validationKeys);
};

const sendBattleDayReport = async (client, channelId, unusedDecksReport) => {
	if (!unusedDecksReport.unusedDecksReport || unusedDecksReport.unusedDecksReport.length == 0) {
		console.error('send action daily battle day report failed, unusedDecksReport not valid value');
		return false;
	}
	const { seasonDetails } = unusedDecksReport;
	const channel = await client.channels.fetch(channelId);
	const currentClanMemberList = (await membersDataHelper.getMembers(unusedDecksReport.clanTag))?.data?.items?.map(member => member.tag);
	// TODO fix sort, and put star in players who have left
	// Note sort should be at the separate as it mutates the array
	const listOfPlayersWithUnusedDeckCount = unusedDecksReport.unusedDecksReport.map(player => ({
		name: `${currentClanMemberList.includes(player.tag) ? '' : '*'}${player.name}`,
		unusedDecks: player.unusedDecks,
	}));
	listOfPlayersWithUnusedDeckCount.sort((player1, player2) => player2.unuesdDecks - player1.unuesdDecks);
	const tableHead = 'Player Name     UnusedDecks';
	const removeEmojisFromString = (text) => text.replace(/([\u2700-\u27BF]|[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2011-\u26FF]|\uD83E[\uDD10-\uDDFF])/g, '');
	const formatPlayerReportData = (playerData) => `${removeEmojisFromString(playerData.name.length > 15 ? playerData.name.substring(0, 15) : playerData.name).padEnd(15)} ${(playerData.unusedDecks.toString()).padStart(11)}`;
	const reportField = `\`\`\`\n${tableHead}\n${listOfPlayersWithUnusedDeckCount.map(formatPlayerReportData).join('\n')}\n\`\`\``;
	const dailyReportEmbed = new MessageEmbed()
		.setColor('#cc7900')
		.setTitle(`Season ${seasonDetails.seasonId || 'NA'}|Week ${seasonDetails.sectionIndex + 1 || 'NA'}|Day ${(seasonDetails.periodIndex + 5) % 7 || 'NA'}`)
		.setDescription('Daily unused decks report report')
		.addField('Report', reportField, false)
		.setTimestamp();
	channel.send(dailyReportEmbed)
		.then(() => true)
		.catch((e) => {
			console.error(`send action daily battle day report failed, send embed\n${e}`);
			return false;
		});
};

const scheduleCronToGenerateDailyMissedBattleDecksReport = (client, channelIds, isSendAction = false) => {
	let isDailyBattleDayReportSaved = clanListCache.reduce((obj, clanTag) => ({ ...obj, [clanTag]: false }), {});
	let isDailyBattleDayReportSent = clanListCache.reduce((obj, clanTag) => ({ ...obj, [clanTag]: false }), {});

	// At every minute from 15 through 20 past hour 10 on Sunday, Monday, Friday, and Saturday [offset 48] Report generation
	cron.schedule('48 30-35 10 * * 0,1,5,6', async () => {
		const currentDate = new Date();
		const formattedCurrentTime = getCurrentTime(currentDate);
		const astraTimestamp = currentDate.toISOString().split('.')[0] + 'Z';

		if (clanListCache == null || clanListCache.length == 0) {
			console.log(`${formattedCurrentTime} Skipping river race report generation as clanListCache is empty`);
			return;
		}

		if (
			Object.values(isDailyBattleDayReportSaved).find(val => val == false) == undefined &&
			Object.values(isDailyBattleDayReportSent).find(val => val == false) == undefined
		) {
			console.log(`${formattedCurrentTime} Skipping river race report generation cron, all reports have already been saved and sent`);
			return;
		}

		try {
			// Generate Report
			for (const clanTag of clanListCache) {
				// TODO check if db has a report already, with astra it doesn't matter, it'll be overwritten, writes are idempotent
				if (isDailyBattleDayReportSaved[clanTag] && isDailyBattleDayReportSent[clanTag]) {
					console.log(`${formattedCurrentTime} Skipping river race report generation cron, report for ${clanTag} has already been saved and sent`);
					continue;
				}
				const previousSeasonDetails = await getPreviousSeasonDetailsUptoSpecificBattleDayPeriod(clanTag);
				const unusedDecksReport = await generateBattleDayReportByPeriodIndex(clanTag, previousSeasonDetails.seasonId, previousSeasonDetails.periodIndex);
				isDailyBattleDayReportSaved[clanTag] ?
					console.log(`${formattedCurrentTime} Skipping river race report save to DB, report for ${clanTag} has already been saved`) :
					saveBattleDayReportByPeriodIndex(clanTag, previousSeasonDetails.seasonId, previousSeasonDetails.periodIndex, unusedDecksReport, astraTimestamp).then(isSaved => {
						isDailyBattleDayReportSaved[clanTag] = isSaved;
					});
				isDailyBattleDayReportSent[clanTag] || !isSendAction ?
					console.log(`${formattedCurrentTime} Skipping river race report send action, report for ${clanTag} has already been saved OR sendAction:${isSendAction}`) :
					sendBattleDayReport(client, channelIds[clanTag], unusedDecksReport).then(isSent => {
						isDailyBattleDayReportSent[clanTag] = isSent;
					});
			}
		}
		catch (e) {
			console.error(e);
			console.log(`${formattedCurrentTime} river race report generation cron failed`);
			return;
		}
	});

	// At minute 15, 30, and 45 past hour 11 on Sunday, Monday, Thursday, Friday, and Saturday [Offset 9] Reset flags
	cron.schedule('9 15,30,45 11 * * 0,1,4,5,6', async () => {
		const currentdate = getCurrentTime();
		console.log(`Reset counts and flags (isDailyBattleDayReportSaved, isDailyBattleDayReportSent) at ${currentdate}`);
		isDailyBattleDayReportSaved = clanListCache.reduce((obj, clanTag) => ({ ...obj, [clanTag]: false }), {});
		isDailyBattleDayReportSent = clanListCache.reduce((obj, clanTag) => ({ ...obj, [clanTag]: false }), {});
	});
};

module.exports = { scheduleCronToGenerateDailyMissedBattleDecksReport };