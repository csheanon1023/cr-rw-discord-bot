const databaseRepository = require('../database-helpers/database-repository');
const currentRiverRaceDataHelper = require('../clash-royale-api-helpers/current-river-race-data-helper');
const riverRaceLogDataHelper = require('../clash-royale-api-helpers/river-race-log-data-helper');
const membersDataHelper = require('../clash-royale-api-helpers/members-data-helper');
const cron = require('node-cron');
const { getCurrentTime } = require('../utils/dateTimeUtils');

const clanListCache = [ '#2PYUJUL', '#P9QQVJVG' ];

const scheduleCronToCollectRiverRaceData = (database) => {
	let isRiverRaceDataSnapSaved = clanListCache.reduce((obj, clanTag) => ({ ...obj, [clanTag]: false }), {});

	// At every minute from 15 through 20 past hour 12 on Sunday, Thursday, Friday, and Saturday [offset 3] Data collection
	cron.schedule('3 15-20 12 * * 0,4,5,6', async () => {
		const currentDate = new Date();
		const currentDay = currentDate.getDay();
		/**
     * Relation between periodIndex and date
     * Time in 24Hr format
     * Javascript Date object gives day as an integer number, between 0 and 6, 0 for Sunday, 1 for Monday, and so on.
     * periodIndex field is also an integer but, monday is referenced by 0(periodIndex % 7).
     * Also, CR War days start at ~10:00AM UTC so in the format "(currentDay + offset) % 7", offset for the same period depends on which day the cron is scheduled.
     * Consider periodIndex % 7 == 3, this should start at ~10:00 Thursday and end at ~10:00 Friday.
     * A task at 12:00 Thursday will use offset 6 but, a task at 8:00 Friday will use offset 5.
     */
		const currentRiverRacePeriodIndex = (currentDay + 6) % 7;
		const formattedCurrentTime = getCurrentTime(currentDate);

		if (clanListCache == null || clanListCache.length == 0) {
			console.log(`${formattedCurrentTime} Skipping river race data collection, clanListCache is empty`);
			return;
		}

		if (Object.values(isRiverRaceDataSnapSaved).find(val => val == false) == undefined) {
			console.log(`${formattedCurrentTime} Skipping river race data collection, data has been updated to next day for all clans`);
			return;
		}

		try {
			const currentRiverRaceData = await Promise.all(clanListCache.map(clan => currentRiverRaceDataHelper.getCurrentRiverRaceData(clan)));
			currentRiverRaceData.forEach(({ data }) => {
				const clanRiverRaceDataSnap = {};
				if (data?.periodIndex % 7 != currentRiverRacePeriodIndex) {
					console.log(`${formattedCurrentTime} Skipping river race data collection for ${data?.clan?.tag}, periodIndex value was unexpected`);
					return;
				}
				clanRiverRaceDataSnap[data?.clan?.tag?.substring(1)] = {
					clan: data.clan,
					periodLogs: data.periodLogs,
					timestamp: currentDate.getTime(),
				};
				const isDataSnapSavedSuccessfully = databaseRepository.setLastKnownBattleDayData(clanRiverRaceDataSnap, database);
				isRiverRaceDataSnapSaved[data?.clan?.tag] = isDataSnapSavedSuccessfully;
			});
		}
		catch (e) {
			console.error(e);
			console.log(`${formattedCurrentTime} river race data collection cron failed`);
			return;
		}
	});

	// At minute 15, 30, and 45 past hour 11 on Sunday, Monday, Thursday, Friday, and Saturday [Offset 9] Reset flags
	cron.schedule('9 15,30,45 11 * * 0,1,4,5,6', async () => {
		const currentdate = getCurrentTime();
		console.log(`Reset counts and flags at ${currentdate}`);
		isRiverRaceDataSnapSaved = clanListCache.reduce((obj, clanTag) => ({ ...obj, [clanTag]: false }), {});
	});

};

const scheduleCronToGenerateDailyMissedBattleDecksReport = (database, client, channelList, isSendAction = false) => {
	let isDailyReportSent = clanListCache.reduce((obj, clanTag) => ({ ...obj, [clanTag]: false }), {});

	// At every minute from 15 through 20 past hour 10 on Sunday, Monday, Friday, and Saturday [offset 6] Report generation
	cron.schedule('6 15-20 10 * * 0,1,5,6', async () => {
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
						const isReportSentSuccessfully = sendMissedDeckReport(clanUnusedDecksReport.unusedDecksReport, channelList[clanUnusedDecksReport.clanTag]);
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
		return channel.send(`\`\`\`${tableHead}\n${listOfPlayersWithUnusedDeckCount.map(formatPlayerReportData).join('\n')}\`\`\``)
			.then(() => true)
			.catch((e) => {
				console.log(e);
				return false;
			});
	};
};

const scheduleCronToGenerateEndOfRaceMissedBattleDecksReport = (database, client, channelList, isSendAction = false) => {
	let isWeeklyEndOfRaceReportSent = clanListCache.reduce((obj, clanTag) => ({ ...obj, [clanTag]: false }), {});

	// At minute 15, 30, and 45 past hour 11 on Sunday, Monday, Thursday, Friday, and Saturday [Offset 9] Reset flags
	cron.schedule('9 15,30,45 11 * * 0,1,4,5,6', async () => {
		const currentdate = getCurrentTime();
		console.log(`Reset counts and flags at ${currentdate}`);
		isWeeklyEndOfRaceReportSent = clanListCache.reduce((obj, clanTag) => ({ ...obj, [clanTag]: false }), {});
		// TODO reset the end of war DB entries
	});

	// At every minute from 30 through 35 past hour 10 on Monday [offset 12] End of race report
	cron.schedule('12 30-35 10 * * 1', async () => {
		// Get the 4 day's reports from DB
		const currentDate = new Date();
		// const currentDay = currentDate.getDay();  TODO will be used for validation
		const formattedCurrentTime = getCurrentTime(currentDate);
		const endOfWeekRiverRaceReport = clanListCache.reduce((obj, clanTag) => ({ ...obj, [clanTag]: {} }), {});

		if (clanListCache == null || clanListCache.length == 0) {
			console.log(`${formattedCurrentTime} Skipping end of race report generation, clanListCache is empty`);
			return;
		}

		if (Object.values(isWeeklyEndOfRaceReportSent).find(val => val == false) == undefined) {
			console.log(`${formattedCurrentTime} Skipping end of race report generation, all reports have already been sent`);
			return;
		}

		try {
			// Aggregate data
			for (const cacheClanTag of clanListCache) {
				if (isWeeklyEndOfRaceReportSent[cacheClanTag]) {
					console.log(`${formattedCurrentTime} End of race report for ${cacheClanTag} has already been sent`);
					continue;
				}

				const previousRiverRaceReportsSnpashot = await databaseRepository.getCurrentWarMissedDecksData(cacheClanTag, database);
				const previousRiverRaceReportsSnpashotValue = previousRiverRaceReportsSnpashot.val();
				const clanEndOfWeekRiverRaceReport = endOfWeekRiverRaceReport[cacheClanTag];
				const currentClanMemberList = await membersDataHelper.getMembers(cacheClanTag);
				const currentClanMemberListTags = currentClanMemberList.data.items.map(member => member.tag);

				// aggregate the data into one report with player name, unused decks X/Total and in clan
				for (const [dayId, clanPreviousRiverRaceReport] of Object.entries(previousRiverRaceReportsSnpashotValue)) {
					// TODO Validate the data
					if (!clanPreviousRiverRaceReport || clanPreviousRiverRaceReport.length == 0) {
						console.log(`${formattedCurrentTime} End of race report, Skipping aggregation for day ${dayId}, no data`);
						continue;
					}
					clanPreviousRiverRaceReport.forEach(playerPreviousRiverRaceReport => {
						if (!clanEndOfWeekRiverRaceReport[playerPreviousRiverRaceReport.tag]) {
							clanEndOfWeekRiverRaceReport[playerPreviousRiverRaceReport.tag] = {
								name: playerPreviousRiverRaceReport.name,
								unusedDecks: playerPreviousRiverRaceReport.unusedDecks,
								totalAvailable: 4,
								isInClan: currentClanMemberListTags.includes(playerPreviousRiverRaceReport.tag),
							};
						}
						else {
							clanEndOfWeekRiverRaceReport[playerPreviousRiverRaceReport.tag].unusedDecks += playerPreviousRiverRaceReport.unusedDecks;
							clanEndOfWeekRiverRaceReport[playerPreviousRiverRaceReport.tag].totalAvailable += 4;
						}
					});
				}
			}

			if (isSendAction) {
				// Send Report
				for (const [clanKey, clanEndOfWeekRiverRaceReport] of Object.entries(endOfWeekRiverRaceReport)) {
					if (Object.keys(channelList).includes(clanKey)) {
						const allPagesKeys = Object.keys(clanEndOfWeekRiverRaceReport);
						const numberOfPages = Math.ceil(allPagesKeys.length / 30);
						const pageFlagsIsReportSentSuccessfully = new Array(numberOfPages).fill(false);
						for (let index = 0; pageFlagsIsReportSentSuccessfully.find(val => val == false) != null && index < 5 ; index++) {
							pageFlagsIsReportSentSuccessfully.forEach((flag, i, flagsArray) => {
								if (flag) return;
								flagsArray[i] = sendWeeklyEndOfRaceMissedDeckReport(allPagesKeys.slice(30 * i, 30 * (i + 1)), clanEndOfWeekRiverRaceReport, channelList[clanKey]);
							});
						}
						if (pageFlagsIsReportSentSuccessfully.find(val => val == false) != null) {
							console.log(`${formattedCurrentTime} end of race report generation cron failed, not able to properly send all pages 5 retries: ${pageFlagsIsReportSentSuccessfully.find(val => val == false)}`);
							// TODO handle this, maybe send a message that report is incomplete
							isWeeklyEndOfRaceReportSent[clanKey] = true;
						}
						else
							isWeeklyEndOfRaceReportSent[clanKey] = true;
					}
					else {console.log(`${formattedCurrentTime} end of race report generation cron failed, clan ${clanKey} was not listed`);}
				}
			}
			else {
				// set falgs to true to skip retries
				isWeeklyEndOfRaceReportSent = clanListCache.reduce((obj, clanTag) => ({ ...obj, [clanTag]: true }), {});
			}
		}
		catch (e) {
			console.error(e);
			console.log(`${formattedCurrentTime} end of race report generation cron failed`);
			return;
		}
	});

	// Helpers
	const sendWeeklyEndOfRaceMissedDeckReport = async (pageKeys, unusedDecksReport, channelId) => {
		if (!pageKeys || pageKeys.length == 0) {return false;}
		if (channelList == null || Object.keys(channelList).length == 0) {
			console.log('No channels defined for river race report');
			return false;
		}
		const channel = await client.channels.fetch(channelId);
		const listOfPlayersWithUnusedDeckCount = pageKeys
			.map(pageKey => ({
				name: unusedDecksReport[pageKey].name,
				unusedDecks: `${unusedDecksReport[pageKey].unusedDecks}/${unusedDecksReport[pageKey].totalAvailable}`,
				isInClan: unusedDecksReport[pageKey].isInClan ? 'Yes' : 'No',
			}))
			.sort((player1, player2) => {
				if (player2.isInClan != player1.isInClan)
					return parseInt(player2?.unuesdDecks?.split('/')[0]) - parseInt(player1?.unuesdDecks?.split('/')[0]);
				return player1.isInClan == 'Yes' ? 1 : -1;
			});
		const tableHead = 'Player Name     UnusedDecks  In Clan';
		const removeEmojisFromString = (text) => text.replace(/([\u2700-\u27BF]|[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2011-\u26FF]|\uD83E[\uDD10-\uDDFF])/g, '');
		const formatPlayerReportData = (playerData) => `${removeEmojisFromString(playerData.name.length > 15 ? playerData.name.substring(0, 15) : playerData.name).padEnd(15)} ${(playerData.unusedDecks.toString()).padStart(11)}  ${(playerData.isInClan).padStart(7)}`;
		return channel.send(`\`\`\`${tableHead}\n${listOfPlayersWithUnusedDeckCount.map(formatPlayerReportData).join('\n')}\`\`\``)
			.then(() => true)
			.catch((e) => {
				console.log(e);
				return false;
			});
	};
};

module.exports = {
	scheduleCronToCollectRiverRaceData,
	scheduleCronToGenerateDailyMissedBattleDecksReport,
	scheduleCronToGenerateEndOfRaceMissedBattleDecksReport,
};