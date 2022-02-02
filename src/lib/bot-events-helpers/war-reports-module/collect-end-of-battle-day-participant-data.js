// to run script: node -r dotenv/config ./src/lib/bot-events-helpers/war-reports-module/collect-end-of-battle-day-participant-data.js
const { setCurrentWarEndOfBattleDayParticipantData } = require('../../database-helpers/database-repository');
const currentRiverRaceDataHelper = require('../../clash-royale-api-helpers/current-river-race-data-helper');
const riverRaceLogDataHelper = require('../../clash-royale-api-helpers/river-race-log-data-helper');
const { getPreviousSeasonDetailsUptoSpecificBattleDayPeriod } = require('../../utils/warSeasonDetailsUtils');
const cron = require('node-cron');
const { getCurrentTime } = require('../../utils/dateTimeUtils');

const clanListCache = [ '#2PYUJUL', '#P9QQVJVG', '#QRVUCJVP' ];

const scheduleCronToCollectEndOfBattleDayParticipantData = (database) => {
	let isEndOfBattleDayParticipantDataSnapSaved = clanListCache.reduce((obj, clanTag) => ({ ...obj, [clanTag]: false }), {});

	// At every minute from 15 through 20 past hour 10 on Sunday, Monday, Friday, and Saturday [offset 35] Report generation
	cron.schedule('35 15-20 10 * * 0,1,5,6', async () => {
		const currentDate = new Date();
		const currentDay = currentDate.getDay();
		const formattedCurrentTime = getCurrentTime(currentDate);

		if (clanListCache == null || clanListCache.length == 0) {
			console.info(`${formattedCurrentTime} Skipping end of battle day data collection, clanListCache is empty`);
			return;
		}

		if (Object.values(isEndOfBattleDayParticipantDataSnapSaved).find(val => val == false) == undefined) {
			console.info(`${formattedCurrentTime} Skipping end of battle day data collection, data collection has been completed for all clans`);
			return;
		}

		for (const clanTag of clanListCache) {
			try {
				if (isEndOfBattleDayParticipantDataSnapSaved[clanTag]) {
					console.info(`${formattedCurrentTime} Skipping end of battle day data collection for ${clanTag}, data has already been updated`);
					continue;
				}

				const previousSeasonDetails = await getPreviousSeasonDetailsUptoSpecificBattleDayPeriod(clanTag);
				const normalizedPreviousRiverRacePeriodIndex = Number(previousSeasonDetails.periodIndex) % 7;
				if (normalizedPreviousRiverRacePeriodIndex !== (currentDay + 5) % 7) {
					console.info(`${formattedCurrentTime} Skipping end of battle day data collection, current data's period index suggests that war has not ended yet`);
					continue;
				}

				const endOfDayRiverRaceData = {};
				if ([3, 4, 5].includes(normalizedPreviousRiverRacePeriodIndex)) {
					const { data: currentRiverRaceData } = await currentRiverRaceDataHelper.getCurrentRiverRaceData(clanTag);
					// this will give the exact value of total decks used at the end of previous battle day
					currentRiverRaceData.clan?.participants?.forEach(participant => participant.decksUsed = participant.decksUsed - participant.decksUsedToday);
					endOfDayRiverRaceData.participants = currentRiverRaceData.clan?.participants;
					endOfDayRiverRaceData.clanName = currentRiverRaceData.clan?.name;
					endOfDayRiverRaceData.clanTag = currentRiverRaceData.clan?.tag;
					endOfDayRiverRaceData.timestamp = currentDate.getTime();
					endOfDayRiverRaceData.seasonDetails = previousSeasonDetails;
				}

				else if (normalizedPreviousRiverRacePeriodIndex == 6) {
					const { data: currentRiverRaceData } = await riverRaceLogDataHelper.getRiverRaceLogData(clanTag);
					const mostRecentEntryInRiverRaceLogs = currentRiverRaceData.items[0];
					const clanStandings = mostRecentEntryInRiverRaceLogs.standings.filter(clanStandingsElement => clanListCache.includes(clanStandingsElement.clan.tag));
					if (clanStandings.length != 1) {
						console.info(`${formattedCurrentTime} Skipping end of battle day data collection for ${clanTag}, getRiverRaceLogData clanStanding array doesn't have clan data`);
						continue;
					}
					endOfDayRiverRaceData.participants = clanStandings[0].clan?.participants;
					endOfDayRiverRaceData.clanTag = clanStandings[0].clan?.tag;
					endOfDayRiverRaceData.clanName = clanStandings[0].clan?.name;
					endOfDayRiverRaceData.timestamp = currentDate.getTime();
					endOfDayRiverRaceData.seasonDetails = previousSeasonDetails;
				}

				if (endOfDayRiverRaceData && Object.keys(endOfDayRiverRaceData).length !== 0) {
					setCurrentWarEndOfBattleDayParticipantData(clanTag, previousSeasonDetails.seasonId, previousSeasonDetails.periodIndex, endOfDayRiverRaceData, database).then((isSaved) => {
						isEndOfBattleDayParticipantDataSnapSaved[clanTag] = isSaved;
					}).catch((error) => {
						console.error(`${formattedCurrentTime} end of battle day data collection cron failed, saving to DB step \n${error}`);
						return;
					});
				}
			}
			catch (error) {
				console.error(`${formattedCurrentTime} end of battle day data collection cron failed, main body \n${error}`);
				continue;
			}
		}
	});

	// At minute 15, 30, and 45 past hour 11 on Sunday, Monday, Thursday, Friday, and Saturday [Offset 42] Reset flags
	cron.schedule('42 15,30,45 11 * * 0,1,4,5,6', async () => {
		console.info(`Reset battle day collection counts and flags at ${getCurrentTime()}`);
		isEndOfBattleDayParticipantDataSnapSaved = clanListCache.reduce((obj, clanTag) => ({ ...obj, [clanTag]: false }), {});
	});
};

module.exports = { scheduleCronToCollectEndOfBattleDayParticipantData };