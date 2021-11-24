// to run script: node -r dotenv/config ./src/lib/bot-events-helpers/war-reports-module/generate-section-missed-deck-report.js
const {
	getCurrentWarBattleDayParticipantDataByPeriodIndexRange,
	getCurrentWarEndOfBattleDayParticipantDataByPeriodIndexRange,
	getSeasonWiseBattleDayGeneratedReportsByPeriodIndexRange,
	// setSeasonWiseBattleDayGeneratedReports,
} = require('../../database-helpers/database-repository');
const { getPreviousSeasonDetailsUptoSpecificBattleDayPeriod } = require('../../utils/warSeasonDetailsUtils');
const membersDataHelper = require('../../clash-royale-api-helpers/members-data-helper');
const cron = require('node-cron');
const { getCurrentTime } = require('../../utils/dateTimeUtils');
const { MessageEmbed } = require('discord.js');

const clanListCache = [ '#2PYUJUL', '#P9QQVJVG' ];

// check if it is possible to generate a report
const getStartAndEndCollectionDataBySectionIndex = async (database, clanTag, seasonId, sectionIndex, isReturnDataAction = true) => {
	try {
		const periodIndexStart = sectionIndex * 7;
		const periodIndexEnd = (sectionIndex * 7) + 6;
		const [startOfDayData, unusedDecksReport] = (await Promise.all([
			getCurrentWarBattleDayParticipantDataByPeriodIndexRange(database, clanTag, seasonId, periodIndexStart, periodIndexEnd),
			getSeasonWiseBattleDayGeneratedReportsByPeriodIndexRange(database, clanTag, seasonId, periodIndexStart, periodIndexEnd),
		])).map(data => data.val());
		const returnObject = {
			success: startOfDayData && unusedDecksReport,
		};
		if (isReturnDataAction) {
			returnObject.startOfDayData = startOfDayData;
			returnObject.unusedDecksReport = unusedDecksReport;
		}
		return returnObject;
	}
	catch (error) {
		console.error(`generate section missed decks report failed, get collection data \n${error}`);
		return false;
	}
};

const createObjectOfAllParticipantsWithTotalDecks = async (startOfDayData, clanTag, seasonId, sectionIndex) => {
	try {
		if (Object.values(startOfDayData).length == 0) {
			throw 'unable to find any records in startOfDayData';
		}
		const returnObject = {
			clanTag,
			seasonId,
			sectionIndex,
			participants: {},
		};
		Object.values(startOfDayData).forEach(periodData => {
			periodData?.participants?.forEach(participant => {
				if (Object.hasOwnProperty.call(returnObject?.participants, participant?.tag?.substring(1))) {
					if (Object.hasOwnProperty.call(returnObject?.participants[participant?.tag?.substring(1)], 'totalAvailableDecks')) {
						returnObject.participants[participant?.tag?.substring(1)].totalAvailableDecks += 4;
					}
					else {
						returnObject.participants[participant?.tag?.substring(1)].totalAvailableDecks = 4;
						returnObject.participants[participant?.tag?.substring(1)].name = participant.name;
						returnObject.participants[participant?.tag?.substring(1)].tag = participant.tag;
					}
				}
				else {
					returnObject.participants[participant?.tag?.substring(1)] = {
						name: participant.name,
						tag: participant.tag,
						totalAvailableDecks: 4,
					};
				}
			});
		});
		return returnObject;
	}
	catch (error) {
		console.error(`generate section missed decks report failed, create object from start data \n${error}`);
		return false;
	}
};

const createObjectOfAllParticipantsWithTotalUnusedDecks = async (unusedDecksReport) => {
	try {
		if (Object.values(unusedDecksReport).length == 0) {
			throw 'unable to find any records in unusedDecksReport';
		}
		const returnObject = {};
		Object.values(unusedDecksReport).forEach(periodData => {
			periodData?.unusedDecksReport?.forEach(participant => {
				if (Object.hasOwnProperty.call(returnObject, participant?.tag?.substring(1))) {
					if (Object.hasOwnProperty.call(returnObject[participant?.tag?.substring(1)], 'totalUnusedDecks')) {
						returnObject[participant?.tag?.substring(1)].totalUnusedDecks += participant?.unusedDecks;
					}
					else {
						returnObject[participant?.tag?.substring(1)].totalUnusedDecks = participant?.unusedDecks;
					}
				}
				else {
					returnObject[participant?.tag?.substring(1)] = {
						totalUnusedDecks: participant?.unusedDecks,
						name: participant?.tag,
						tag: participant?.tag,
					};
				}
			});
		});
		return returnObject;
	}
	catch (error) {
		console.error(`generate section missed decks report failed, generate report \n${error}`);
		return false;
	}
};

// generate report
const generateSectionMissedDeckReport = async (database, clanTag, seasonId, sectionIndex) => {
	try {
		const collectionData = await getStartAndEndCollectionDataBySectionIndex(database, clanTag, seasonId, sectionIndex, true);
		if (!collectionData || !collectionData.success) {
			throw 'get collection data was not successful';
		}
		const { startOfDayData, unusedDecksReport } = collectionData;
		const participantList = await createObjectOfAllParticipantsWithTotalDecks(startOfDayData, clanTag, seasonId, sectionIndex);
		const consolidatedUnusedDeckReport = await createObjectOfAllParticipantsWithTotalUnusedDecks(unusedDecksReport);
		if (!participantList || !consolidatedUnusedDeckReport)
			throw `Not able to generate participant list / consolidated report object clantag: ${clanTag}`;
		Object.keys(participantList.participants).forEach(playerTag => {
			participantList.participants[playerTag].unuesdDecks = consolidatedUnusedDeckReport?.[playerTag]?.totalUnusedDecks || 0;
		});
		return participantList;
	}
	catch (error) {
		console.error(`generate section missed decks report failed, generate report \n${error}`);
		return false;
	}
};

// save to DB
// const saveBattleDayReportByPeriodIndex = async (database, clanTag, seasonId, periodIndex, unusedDecksReport) => {
// 	if (unusedDecksReport)
// 		return setSeasonWiseBattleDayGeneratedReports(clanTag, seasonId, periodIndex, unusedDecksReport, database);
// 	else {
// 		console.error(`generate section missed decks report failed, save to DB clan tag (invalid report value): ${clanTag}`);
// 		return false;
// 	}
// };

const sendBattleDayReport = async (client, pageKeys, unusedDecksReport, channelId, clanTag) => {
	// if (!pageKeys || pageKeys.length == 0 || !unusedDecksReport.unusedDecksReport || unusedDecksReport.unusedDecksReport.length == 0) {
	// 	console.error('send action daily battle day report failed, unusedDecksReport not valid value');
	// 	return false;
	// }
	const { seasonId, sectionIndex } = unusedDecksReport;
	const channel = await client.channels.fetch(channelId);
	const currentClanMemberList = (await membersDataHelper.getMembers(clanTag))?.data?.items?.map(member => member.tag);
	// TODO fix sort, and put star in players who have left
	// Note sort should be at the separate as it mutates the array
	const listOfPlayersWithUnusedDeckCount = pageKeys.map(pageKey => ({
		name: unusedDecksReport[pageKey].name,
		unusedDecks: `${unusedDecksReport[pageKey].unusedDecks}/${unusedDecksReport[pageKey].totalAvailableDecks}`,
		isInClan: currentClanMemberList.includes(`#${unusedDecksReport[pageKey].tag}`) ? 'Yes' : 'No',
	}));
	listOfPlayersWithUnusedDeckCount.sort((player1, player2) => {
		if (player2.isInClan != player1.isInClan)
			return parseInt(player2?.unuesdDecks?.split('/')[0]) - parseInt(player1?.unuesdDecks?.split('/')[0]);
		return player1.isInClan == 'Yes' ? 1 : -1;
	});
	const tableHead = 'Player Name     UnusedDecks  In Clan';
	const removeEmojisFromString = (text) => text.replace(/([\u2700-\u27BF]|[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2011-\u26FF]|\uD83E[\uDD10-\uDDFF])/g, '');
	const formatPlayerReportData = (playerData) => `${removeEmojisFromString(playerData.name.length > 15 ? playerData.name.substring(0, 15) : playerData.name).padEnd(15)} ${(playerData.unusedDecks.toString()).padStart(11)}  ${(playerData.isInClan).padStart(7)}`;
	const reportField = channel.send(`\`\`\`\n${tableHead}\n${listOfPlayersWithUnusedDeckCount.map(formatPlayerReportData).join('\n')}\n\`\`\``)
		.then(() => true)
		.catch((e) => {
			console.log(e);
			return false;
		});
	const dailyReportEmbed = new MessageEmbed()
		.setColor('#cc7900')
		.setTitle(`Season ${seasonId || 'NA'}|Week ${sectionIndex + 1 || 'NA'}`)
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
				const unusedDecksReport = await generateSectionMissedDeckReport(database, clanTag, previousSeasonDetails.seasonId, previousSeasonDetails.sectionIndex);
				// isDailyBattleDayReportSaved[clanTag] ?
				// 	console.log(`${formattedCurrentTime} Skipping river race report save to DB, report for ${clanTag} has already been saved`) :
				// 	saveBattleDayReportByPeriodIndex(database, clanTag, previousSeasonDetails.seasonId, previousSeasonDetails.periodIndex, unusedDecksReport).then(isSaved => {
				// 		isDailyBattleDayReportSaved[clanTag] = isSaved;
				// 	});
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
	generateSectionMissedDeckReport,
	// getStartAndEndCollectionDataByPeriodIndex,
};

const { Client } = require('discord.js');
const { connectRealtimeDatabase } = require('../../database-helpers/database-repository');
(async () => {
	const client = new Client({
		partials: ['MESSAGE', 'REACTION'],
	});
	await client.login(process.env.DISCORDJS_BOT_TOKEN);
	const channleIdByClan = {
		'#2PYUJUL': '904461174664470628',
		'#P9QQVJVG': '904472570135457853',
	};
	const database = await connectRealtimeDatabase();
	for (const clanTag of clanListCache) {
		const previousSeasonDetails = await getPreviousSeasonDetailsUptoSpecificBattleDayPeriod(clanTag);
		const unusedDecksReport = await generateSectionMissedDeckReport(database, clanTag, previousSeasonDetails.seasonId, previousSeasonDetails.sectionIndex);
		// saveBattleDayReportByPeriodIndex(database, clanTag, previousSeasonDetails.seasonId, previousSeasonDetails.periodIndex, unusedDecksReport);
		// sendBattleDayReport(client, channleIdByClan[clanTag], unusedDecksReport);
		const clanEndOfWeekRiverRaceReport = Object.values(unusedDecksReport.participants);
		const allPagesKeys = Object.keys(clanEndOfWeekRiverRaceReport);
		const numberOfPages = Math.ceil(allPagesKeys.length / 30);
		const pageFlagsIsReportSentSuccessfully = new Array(numberOfPages).fill(false);
		for (let index = 0; pageFlagsIsReportSentSuccessfully.find(val => val == false) != null && index < 5 ; index++) {
			pageFlagsIsReportSentSuccessfully.forEach((flag, i, flagsArray) => {
				if (flag) return;
				flagsArray[i] = sendBattleDayReport(client, allPagesKeys.slice(30 * i, 30 * (i + 1)), clanEndOfWeekRiverRaceReport, channleIdByClan[clanTag], clanTag);
			});
		}
	}
})();
