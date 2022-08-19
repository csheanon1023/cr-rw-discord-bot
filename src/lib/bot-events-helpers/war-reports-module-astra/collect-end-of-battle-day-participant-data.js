// to run script: node -r dotenv/config ./src/lib/bot-events-helpers/war-reports-module-astra/collect-end-of-battle-day-participant-data.js
const currentRiverRaceDataHelper = require('../../clash-royale-api-helpers/current-river-race-data-helper');
const riverRaceLogDataHelper = require('../../clash-royale-api-helpers/river-race-log-data-helper');
const { getPreviousSeasonDetailsUptoSpecificBattleDayPeriod } = require('../../utils/warSeasonDetailsUtils');
const cron = require('node-cron');
const { getCurrentTime } = require('../../utils/dateTimeUtils');
const { insertRowsJson } = require('../../astra-database-helpers/cassandra-nodejs-driver/insertRowsJson.js');

const clanListCache = [ '#2PYUJUL', '#P9QQVJVG', '#QRVUCJVP', '#Q02UV0C0', '#LUVY2QY2' ];
const collection_type = 'end';

const scheduleCronToCollectEndOfBattleDayParticipantData = () => {
	let isEndOfBattleDayParticipantDataSnapSaved = clanListCache.reduce((obj, clanTag) => ({ ...obj, [clanTag]: false }), {});

	// At every minute from 15 through 20 past hour 10 on Sunday, Monday, Friday, and Saturday [offset 35] Report generation
	cron.schedule('35 15-20 10 * * 0,1,5,6', async () => {
		const currentDate = new Date();
		const currentDay = currentDate.getDay();
		const formattedCurrentTime = getCurrentTime(currentDate);
		const astraTimestamp = currentDate.toISOString().split('.')[0] + 'Z';

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
					const clan_tag = endOfDayRiverRaceData?.clanTag?.substring(1) ?? clanTag.substring(1);
					const clan_name = endOfDayRiverRaceData?.clanName;
					const season = endOfDayRiverRaceData.seasonDetails.seasonId;
					const week = Math.floor(Number(endOfDayRiverRaceData.seasonDetails.periodIndex) / 7) + 1;
					const day = (Number(endOfDayRiverRaceData.seasonDetails.periodIndex) + 5) % 7;
					const validationKeys = {
						countQueryKeys: [
							{ column: 'clan_tag', value: clan_tag, type: 'text' },
							{ column: 'collection_type', value: collection_type, type: 'text' },
							{ column: 'season', value: season, type: 'int' },
							{ column: 'week', value: week, type: 'int' },
							{ column: 'day', value: day, type: 'int' },
						],
						uniqueKeys: [
							{ column: 'player_tag', type: 'text' },
						],
					};

					const currentParticipantsData = endOfDayRiverRaceData.participants
						.map(({ tag: player_tag, name: player_name, fame, boatAttacks: boat_attacks, decksUsed: decks_used, decksUsedToday: decks_used_today }) => (
							{ clan_tag, clan_name, season, week, day, player_name, player_tag, collection_type, boat_attacks, decks_used, decks_used_today, fame, updated_at: astraTimestamp }));

					insertRowsJson('war_reports', 'collected_battle_day_participant_data', currentParticipantsData, validationKeys).then((isSaved) => {
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