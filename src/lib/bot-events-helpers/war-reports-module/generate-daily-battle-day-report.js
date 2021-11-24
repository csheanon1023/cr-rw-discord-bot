// to run script: node -r dotenv/config ./src/lib/bot-events-helpers/war-reports-module/generate-daily-battle-day-report.js
const {
	getCurrentWarBattleDayParticipantDataByPeriodIndex,
	getCurrentWarEndOfBattleDayParticipantDataByPeriodIndex,
	setSeasonWiseBattleDayGeneratedReports,
} = require('../../database-helpers/database-repository');
const { getPreviousSeasonDetailsUptoSpecificBattleDayPeriod } = require('../../utils/warSeasonDetailsUtils');
const membersDataHelper = require('../../clash-royale-api-helpers/members-data-helper');
const cron = require('node-cron');
const { getCurrentTime } = require('../../utils/dateTimeUtils');
const { MessageEmbed } = require('discord.js');

const clanListCache = [ '#2PYUJUL', '#P9QQVJVG' ];

// check if it is possible to generate a report
const getStartAndEndCollectionDataByPeriodIndex = async (database, clanTag, seasonId, periodIndex, isReturnDataAction = true) => {
	try {
		const [startOfDayData, endOfDayData] = (await Promise.all([
			getCurrentWarBattleDayParticipantDataByPeriodIndex(database, clanTag, seasonId, periodIndex),
			getCurrentWarEndOfBattleDayParticipantDataByPeriodIndex(database, clanTag, seasonId, periodIndex),
		])).map(data => data.val());
		const returnObject = {
			success: startOfDayData && endOfDayData,
		};
		if (isReturnDataAction) {
			returnObject.startOfDayData = startOfDayData;
			returnObject.endOfDayData = endOfDayData;
		}
		return returnObject;
	}
	catch (error) {
		console.error(`generate daily battle day report failed, get collection data \n${error}`);
		return false;
	}
};

// generate report
const generateBattleDayReportByPeriodIndex = async (database, clanTag, seasonId, periodIndex) => {
	try {
		// TODO some validation because the flow didn't break here
		const collectionData = await getStartAndEndCollectionDataByPeriodIndex(database, clanTag, seasonId, periodIndex, true);
		if (!collectionData || !collectionData.success) {
			throw 'get collection data was not successful';
		}
		const { startOfDayData, endOfDayData } = collectionData;
		if (startOfDayData.clanTag != endOfDayData.clanTag) {
			throw 'not able to match clans in both snaps';
		}
		// Generate Report
		const unusedDecksReport = {
			seasonDetails: {
				seasonId: seasonId,
				periodIndex: periodIndex,
				sectionIndex: Math.floor(periodIndex / 7),
			},
			clanTag: clanTag,
			unusedDecksReport: [],
		};
		startOfDayData.participants.forEach(participant => {
			const currentParticipantData = endOfDayData.participants.find(player => player.tag == participant.tag);
			if (currentParticipantData == undefined) {
				console.error(`generate daily battle day report failed, not able to find player in new river race data: ${participant.tag}`);
				return;
			}
			const unuesdDecks = 4 - (participant.decksUsedToday + currentParticipantData.decksUsed - participant.decksUsed);
			if (unuesdDecks < 0 || unuesdDecks > 4) {
				console.log(`generate daily battle day report failed, something wrong with the calculations, invalid value for unuesdDecks: ${unuesdDecks}, player: ${participant.name}, ID: ${participant.tag}`);
				return;
			}
			if (unuesdDecks != 0) {
				const reportPlayerData = {
					tag: participant.tag,
					name: participant.name,
					unusedDecks: unuesdDecks,
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
const saveBattleDayReportByPeriodIndex = async (database, clanTag, seasonId, periodIndex, unusedDecksReport) => {
	if (unusedDecksReport)
		return setSeasonWiseBattleDayGeneratedReports(clanTag, seasonId, periodIndex, unusedDecksReport, database);
	else {
		console.error(`generate daily battle day report failed, save to DB clan tag (invalid report value): ${clanTag}`);
		return false;
	}
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
		.setDescription('Daily missed battle day report')
		.addField('Report', reportField, false)
		.setTimestamp();
	channel.send(dailyReportEmbed)
		.then(() => true)
		.catch((e) => {
			console.error(`send action daily battle day report failed, send embed\n${e}`);
			return false;
		});
};

const scheduleCronToGenerateDailyMissedBattleDecksReport = (database, client, channelIds, isSendAction = false) => {
	let isDailyBattleDayReportSaved = clanListCache.reduce((obj, clanTag) => ({ ...obj, [clanTag]: false }), {});
	let isDailyBattleDayReportSent = clanListCache.reduce((obj, clanTag) => ({ ...obj, [clanTag]: false }), {});

	// At every minute from 15 through 20 past hour 10 on Sunday, Monday, Friday, and Saturday [offset 48] Report generation
	cron.schedule('48 30-35 10 * * 0,1,5,6', async () => {
		const currentDate = new Date();
		const formattedCurrentTime = getCurrentTime(currentDate);

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
				// TODO check if db has a report already
				if (isDailyBattleDayReportSaved[clanTag] && isDailyBattleDayReportSent[clanTag]) {
					console.log(`${formattedCurrentTime} Skipping river race report generation cron, report for ${clanTag} has already been saved and sent`);
					continue;
				}
				const previousSeasonDetails = await getPreviousSeasonDetailsUptoSpecificBattleDayPeriod(clanTag);
				const unusedDecksReport = await generateBattleDayReportByPeriodIndex(database, clanTag, previousSeasonDetails.seasonId, previousSeasonDetails.periodIndex);
				isDailyBattleDayReportSaved[clanTag] ?
					console.log(`${formattedCurrentTime} Skipping river race report save to DB, report for ${clanTag} has already been saved`) :
					saveBattleDayReportByPeriodIndex(database, clanTag, previousSeasonDetails.seasonId, previousSeasonDetails.periodIndex, unusedDecksReport).then(isSaved => {
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

module.exports = {
	scheduleCronToGenerateDailyMissedBattleDecksReport,
	generateBattleDayReportByPeriodIndex,
	getStartAndEndCollectionDataByPeriodIndex,
};