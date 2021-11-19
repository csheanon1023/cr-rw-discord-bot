// to run script: node -r dotenv/config ./src/lib/bot-events-helpers/process-missed-battle-day-decks-report-cron-job.js
const databaseRepository = require('../database-helpers/database-repository');
const currentRiverRaceDataHelper = require('../clash-royale-api-helpers/current-river-race-data-helper');
const riverRaceLogDataHelper = require('../clash-royale-api-helpers/river-race-log-data-helper');
const membersDataHelper = require('../clash-royale-api-helpers/members-data-helper');
const cron = require('node-cron');
const { getCurrentTime } = require('../utils/dateTimeUtils');

const clanListCache = [ '#2PYUJUL', '#P9QQVJVG' ];

const scheduleCronToGenerateDailyMissedBattleDayDecksReport = (database, client, channelList, isSendAction = false) => {
	let isDailyReportSent = clanListCache.reduce((obj, clanTag) => ({ ...obj, [clanTag]: false }), {});

	// At every minute from 15 through 20 past hour 10 on Sunday, Monday, Friday, and Saturday [offset 35] Report generation
	cron.schedule('35 15-20 10 * * 0,1,5,6', async () => {
		const currentDate = new Date();
		const currentDay = currentDate.getDay();
		const previousRiverRacePeriodIndex = (currentDay + 5) % 7;
		const formattedCurrentTime = getCurrentTime(currentDate);
		const unusedDecksReport = [];

		if (clanListCache == null || clanListCache.length == 0) {
			console.log(`${formattedCurrentTime} Skipping river race report generation as clanListCache is empty`);
			return;
		}

		if (Object.values(isDailyReportSent).find(val => val == false) == undefined) {
			console.log(`${formattedCurrentTime} Skipping river race report generation cron, all reports have already been sent`);
			return;
		}

		try {
			const previousRiverRaceDataSnpashot = await databaseRepository.getLastKnownBattleDayData(database);
			const previousRiverRaceDataSnpashotValue = previousRiverRaceDataSnpashot.val();
			const endOfDayRiverRaceData = [];

			if ([3, 4, 5].includes(previousRiverRacePeriodIndex)) {
				const currentRiverRaceData = await Promise.all([ ...clanListCache.map(clan => currentRiverRaceDataHelper.getCurrentRiverRaceData(clan)) ]);
				currentRiverRaceData.forEach(({ data }) => {
					if (data.periodIndex % 7 == previousRiverRacePeriodIndex) {
						console.log(`${formattedCurrentTime} River race report generation, current data's period index suggests that war has not ended yet`);
						return;
					}
					data.clan?.participants?.forEach(participant => participant.decksUsed = participant.decksUsed - participant.decksUsedToday);
					endOfDayRiverRaceData.push({
						participants: data.clan?.participants,
						clanTag: data.clan?.tag,
					});
				});
			}

			else if (previousRiverRacePeriodIndex == 6) {
				const currentRiverRaceData = await Promise.all([ ...clanListCache.map(clan => riverRaceLogDataHelper.getRiverRaceLogData(clan)) ]);
				currentRiverRaceData.forEach(clanCurrentRiverRaceData => {
					const clanMostRecentEntryInRiverRaceLogs = clanCurrentRiverRaceData.data.items[0];
					const clanStandings = clanMostRecentEntryInRiverRaceLogs.standings.filter(clanStandingsElement => clanListCache.includes(clanStandingsElement.clan.tag));
					if (clanStandings.length != 1) {return;}
					// const createdDate = clanMostRecentEntryInRiverRaceLogs.createdDate;
					// TODO some validation
					endOfDayRiverRaceData.push({
						participants: clanStandings[0].clan?.participants,
						clanTag: clanStandings[0].clan?.tag,
					});
				});
			}

			if (!clanListCache.every(cacheClanTag => endOfDayRiverRaceData.find(({ clanTag }) => clanTag == cacheClanTag))) {
				console.log(`${formattedCurrentTime} River race report generation, river race log doesn't have data for all clans`);
			}

			// Generate Report
			for (const [, clanPreviousRiverRaceData] of Object.entries(previousRiverRaceDataSnpashotValue)) {
				if (isDailyReportSent[clanPreviousRiverRaceData.clan.tag]) {
					console.log(`${formattedCurrentTime} River race report for ${clanPreviousRiverRaceData.clan.tag} has already been sent`);
					continue;
				}
				const clanEndOfDayRiverRaceData = endOfDayRiverRaceData.find(({ clanTag }) => clanTag == clanPreviousRiverRaceData.clan.tag);

				// TODO check if return is needed
				if (clanEndOfDayRiverRaceData == undefined) {
					console.log(`${formattedCurrentTime} river race report generation cron failed, not able to match clans in previousSnap and current data returned from the API for ${clanPreviousRiverRaceData.clan.tag}`);
					return;
				}

				const currentClanMemberList = await membersDataHelper.getMembers(clanPreviousRiverRaceData?.clan?.tag);
				const participantList = clanPreviousRiverRaceData?.clan?.participants?.filter(participant => currentClanMemberList.data.items.find(member => member.tag == participant.tag));
				participantList.forEach(participant => {
					const currentParticipantData = clanEndOfDayRiverRaceData.participants.find(player => player.tag == participant.tag);
					if (currentParticipantData == undefined) {
						console.error(`${formattedCurrentTime} Unexpected: not able to find player in new river race data: ${participant.tag}`);
						return;
					}
					const unuesdDecks = 4 - (participant.decksUsedToday + currentParticipantData.decksUsed - participant.decksUsed);
					if (unuesdDecks < 0 || unuesdDecks > 4) {
						console.log(`${formattedCurrentTime} river race report generation cron failed, something wrong with the calculations, invalid value for unuesdDecks: ${unuesdDecks}, player: ${participant.name}, ID: ${participant.tag}`);
						return;
					}
					if (unuesdDecks != 0) {
						const reportPlayerData = {
							tag: participant.tag,
							name: participant.name,
							unusedDecks: unuesdDecks,
						};
						const clanUnusedDecksReport = unusedDecksReport.find(e => e.clanTag == clanEndOfDayRiverRaceData.clanTag);
						if (clanUnusedDecksReport) {
							clanUnusedDecksReport.unusedDecksReport.push(reportPlayerData);
						}
						else {
							unusedDecksReport.push({
								clanTag: clanEndOfDayRiverRaceData.clanTag,
								unusedDecksReport: [ reportPlayerData ],
							});
						}
					}
				});
			}

			// Send Report
			for (const clanUnusedDecksReport of unusedDecksReport) {
				if (clanUnusedDecksReport.unusedDecksReport?.length <= 50 && Object.keys(channelList).includes(clanUnusedDecksReport.clanTag)) {
					if (isSendAction) {
						const isReportSentSuccessfully = await sendMissedDeckReport(clanUnusedDecksReport.unusedDecksReport, channelList[clanUnusedDecksReport.clanTag]);
						if (!isReportSentSuccessfully) {return;}
						// persist report sent flag state in DB
						let isFlagSavedInDatabase = false;
						for (let index = 0; !isFlagSavedInDatabase && index < 5; index++) {
							isFlagSavedInDatabase = await databaseRepository.bulkSetApplicationFlag({ [`isDailyReportSent-${clanUnusedDecksReport.clanTag.substring(1)}`]: true }, database);
						}
						if (!isFlagSavedInDatabase) {
							console.log(`${formattedCurrentTime} river race report generation cron failed, not able to save isDailyReportSent flag 5 retries: ${clanUnusedDecksReport.clanTag}`);
							// TODO handle this, for now just setting the flag to true
							isDailyReportSent[clanUnusedDecksReport.clanTag] = true;
						}
						else {isDailyReportSent[clanUnusedDecksReport.clanTag] = true;}
					}
					else {
						// set falgs to true to skip retries
						isDailyReportSent = clanListCache.reduce((obj, clanTag) => ({ ...obj, [clanTag]: true }), {});
					}
					// save the report in DB for calculation at the war ends
					let isReportSavedInDatabase = false;
					for (let index = 0; !isReportSavedInDatabase && index < 5; index++) {
						isReportSavedInDatabase = databaseRepository.setCurrentWarMissedDecksData(clanUnusedDecksReport.clanTag, currentDay.toString(), clanUnusedDecksReport.unusedDecksReport, database);
					}
					if (!isReportSavedInDatabase) {
						console.log(`${formattedCurrentTime} river race report generation cron failed, not able to save unused deck report in DB 5 retries: ${clanUnusedDecksReport.clanTag}`);
						// TODO handle this, for now just setting the flag to true
					}
				}
				else {console.log(`${formattedCurrentTime} river race report generation failed, clan ${clanUnusedDecksReport.clanTag} was either not listed or report had more than 50 players`);}
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
		console.log(`Reset counts and flags at ${currentdate}`);
		isDailyReportSent = clanListCache.reduce((obj, clanTag) => ({ ...obj, [clanTag]: false }), {});
		// TODO reset the end of war DB entries
	});

	// Helpers
	const sendMissedDeckReport = async (unusedDecksReport, channelId) => {
		if (!unusedDecksReport || unusedDecksReport.length == 0) {return false;}
		if (channelList == null || Object.keys(channelList).length == 0) {
			console.log('No channels defined for river race report');
			return false;
		}
		const channel = await client.channels.fetch(channelId);
		const listOfPlayersWithUnusedDeckCount = unusedDecksReport
			.map(playerUnusedDecksReport => ({
				name: playerUnusedDecksReport.name,
				unusedDecks: playerUnusedDecksReport.unusedDecks,
			}))
			.sort((player1, player2) => player2.unuesdDecks - player1.unuesdDecks);
		const tableHead = 'Player Name     UnusedDecks';
		const removeEmojisFromString = (text) => text.replace(/([\u2700-\u27BF]|[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2011-\u26FF]|\uD83E[\uDD10-\uDDFF])/g, '');
		const formatPlayerReportData = (playerData) => `${removeEmojisFromString(playerData.name.length > 15 ? playerData.name.substring(0, 15) : playerData.name).padEnd(15)} ${(playerData.unusedDecks.toString()).padStart(11)}`;
		return channel.send(`\`\`\`\n${tableHead}\n${listOfPlayersWithUnusedDeckCount.map(formatPlayerReportData).join('\n')}\n\`\`\``)
			.then(() => true)
			.catch((e) => {
				console.log(e);
				return false;
			});
	};
};

module.exports = { scheduleCronToGenerateDailyMissedBattleDayDecksReport };