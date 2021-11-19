// to run script: node -r dotenv/config ./src/lib/bot-events-helpers/collect-battle-day-initial-participant-data.js
const { setCurrentWarBattleDayParticipantData } = require('../database-helpers/database-repository');
const currentRiverRaceDataHelper = require('../clash-royale-api-helpers/current-river-race-data-helper');
const membersDataHelper = require('../clash-royale-api-helpers/members-data-helper');
const { getCurrentSeasonDetailsUptoSpecificPeriod } = require('../utils/warSeasonDetailsUtils');
const cron = require('node-cron');
const { getCurrentTime } = require('../utils/dateTimeUtils');

const clanListCache = [ '#2PYUJUL', '#P9QQVJVG' ];

const scheduleCronToCollectBattleDayInitialParticipantData = (database) => {
	let isBattleDayInitialParticipantDataSnapSaved = clanListCache.reduce((obj, clanTag) => ({ ...obj, [clanTag]: false }), {});

	// At every minute from 15 through 20 past hour 12 on Sunday, Thursday, Friday, and Saturday [offset 21] Data collection
	cron.schedule('21 15-20 12 * * 0,4,5,6', async () => {
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
			console.log(`${formattedCurrentTime} Skipping battle day data collection, clanListCache is empty`);
			return;
		}

		if (Object.values(isBattleDayInitialParticipantDataSnapSaved).find(val => val == false) == undefined) {
			console.info(`${formattedCurrentTime} Skipping battle day data collection, data has been updated to next day for all clans`);
			return;
		}

		for (const clanTag of clanListCache) {
			try {
				if (isBattleDayInitialParticipantDataSnapSaved[clanTag]) {
					console.info(`${formattedCurrentTime} Skipping battle day data collection for ${clanTag}, data has already been updated`);
					continue;
				}

				const currentSeasonDetails = await getCurrentSeasonDetailsUptoSpecificPeriod(clanTag);
				currentRiverRaceDataHelper.getCurrentRiverRaceData(clanTag).then(({ data: clanCurrentRiverRaceData }) => {

					// Skip me for testing or manual triggers (validation)
					if (clanCurrentRiverRaceData?.periodIndex % 7 != currentRiverRacePeriodIndex) {
						console.log(`${formattedCurrentTime} Skipping battle day data collection for ${clanTag}, periodIndex value was unexpected`);
						return;
					}

					membersDataHelper.getMembers(clanTag).then(({ data: currentClanMemberList }) => {
						const memberListTagsArray = currentClanMemberList.items.map(member => member.tag);
						const currentParticipantsData = clanCurrentRiverRaceData?.clan?.participants
							.filter(participant => memberListTagsArray.includes(participant.tag))
							.map(participant => participant);
						const clanBattleDayParticipantDataSnap = {
							clanName: clanCurrentRiverRaceData?.clan?.name,
							currentParticipantsData: currentParticipantsData,
							periodIndex: clanCurrentRiverRaceData?.periodIndex,
							timestamp: currentDate.getTime(),
							currentSeasonDetails: currentSeasonDetails,
						};
						if (clanBattleDayParticipantDataSnap && Object.keys(clanBattleDayParticipantDataSnap).length !== 0) {
							setCurrentWarBattleDayParticipantData(clanTag, currentSeasonDetails.seasonId, currentSeasonDetails.periodIndex, clanBattleDayParticipantDataSnap, database).then((isSaved) => {
								isBattleDayInitialParticipantDataSnapSaved[clanCurrentRiverRaceData?.clan?.tag] = isSaved;
							}).catch((error) => {
								console.error(`${formattedCurrentTime} battle day data collection cron failed, saving to DB step \n${error}`);
								return;
							});
						}
					}).catch((error) => {
						console.error(`${formattedCurrentTime} battle day data collection cron failed, get current members step \n${error}`);
						return;
					});
				}).catch((error) => {
					console.error(`${formattedCurrentTime} battle day data collection cron failed get river race data step \n${error}`);
					return;
				});
			}
			catch (error) {
				console.error(`${formattedCurrentTime} battle day data collection cron failed, get season details step \n${error}`);
			}
		}
	});

	// At minute 15, 30, and 45 past hour 11 on Sunday, Monday, Thursday, Friday, and Saturday [Offset 24] Reset flags
	cron.schedule('24 15,30,45 11 * * 0,1,4,5,6', async () => {
		console.info(`Reset battle day collection counts and flags at ${getCurrentTime()}`);
		isBattleDayInitialParticipantDataSnapSaved = clanListCache.reduce((obj, clanTag) => ({ ...obj, [clanTag]: false }), {});
	});
};

module.exports = { scheduleCronToCollectBattleDayInitialParticipantData };