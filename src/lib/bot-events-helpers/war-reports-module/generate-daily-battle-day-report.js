// to run script: node -r dotenv/config ./src/lib/bot-events-helpers/war-reports-module/generate-daily-battle-day-report.js
const {
	getCurrentWarBattleDayParticipantDataByPeriodIndex,
	getCurrentWarEndOfBattleDayParticipantDataByPeriodIndex,
	setSeasonWiseBattleDayGeneratedReports,
} = require('../../database-helpers/database-repository');
const { getPreviousSeasonDetailsUptoSpecificBattleDayPeriod } = require('../../utils/warSeasonDetailsUtils');
const cron = require('node-cron');
const { getCurrentTime } = require('../../utils/dateTimeUtils');

const clanListCache = [ '#2PYUJUL', '#P9QQVJVG' ];

// check if it is possible to generate a report
const getStartAndEndCollectionDataByPeriodIndex = async (database, clanTag, seasonId, periodIndex, isReturnDataAction = true) => {
	try {
		const [startOfDayData, endOfDayData] = (await Promise.all([
			getCurrentWarBattleDayParticipantDataByPeriodIndex(database, clanTag, seasonId, periodIndex),
			getCurrentWarEndOfBattleDayParticipantDataByPeriodIndex(database, clanTag, seasonId, periodIndex),
		])).map(data => data.val());
		const returnObject = {
			success: true,
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
		const collectionData = await getStartAndEndCollectionDataByPeriodIndex(database, clanTag, seasonId, periodIndex, true);
		if (!collectionData || !collectionData.success) {
			throw 'get collection data was not successful';
		}
		const { startOfDayData, endOfDayData } = collectionData;
		if (startOfDayData.clanTag != endOfDayData.clanTag) {
			throw 'not able to match clansin both snaps';
		}
		// Generate Report
		const unusedDecksReport = {
			seasonDetails: {
				SeasonId: seasonId,
				periodIndex: periodIndex,
				sectionIndex: Math.floor((periodIndex + 1) / 7),
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
	}
	catch (error) {
		console.error(`generate daily battle day report failed, generate report \n${error}`);
		return false;
	}
};

// save to DB
const saveBattleDayReportByPeriodIndex = async (database, clanTag, seasonId, periodIndex, unusedDecksReport) => {
	return setSeasonWiseBattleDayGeneratedReports(clanTag, seasonId, periodIndex, unusedDecksReport, database);
};

const scheduleCronToGenerateDailyMissedBattleDecksReport = (database) => {
	let isDailyBattleDayReportSaved = clanListCache.reduce((obj, clanTag) => ({ ...obj, [clanTag]: false }), {});

	// At every minute from 15 through 20 past hour 10 on Sunday, Monday, Friday, and Saturday [offset 48] Report generation
	cron.schedule('48 30-35 10 * * 0,1,5,6', async () => {
		const currentDate = new Date();
		const formattedCurrentTime = getCurrentTime(currentDate);

		if (clanListCache == null || clanListCache.length == 0) {
			console.log(`${formattedCurrentTime} Skipping river race report generation as clanListCache is empty`);
			return;
		}

		if (Object.values(isDailyBattleDayReportSaved).find(val => val == false) == undefined) {
			console.log(`${formattedCurrentTime} Skipping river race report generation cron, all reports have already been sent`);
			return;
		}

		try {
			// Generate Report
			for (const clanTag of clanListCache) {
				// TODO check if db has a report already
				if (isDailyBattleDayReportSaved[clanTag]) {
					console.log(`${formattedCurrentTime} report for ${clanTag} has already been generated`);
					continue;
				}
				const previousSeasonDetails = await getPreviousSeasonDetailsUptoSpecificBattleDayPeriod(clanTag);
				const unusedDecksReport = await generateBattleDayReportByPeriodIndex(database, clanTag, previousSeasonDetails.seasonId, previousSeasonDetails.periodIndex);
				saveBattleDayReportByPeriodIndex(database, clanTag, previousSeasonDetails.seasonId, previousSeasonDetails.periodIndex, unusedDecksReport).then(isSaved => {
					isDailyBattleDayReportSaved[clanTag] = isSaved;
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
		console.log(`Reset counts and flags (isDailyBattleDayReportSaved) at ${currentdate}`);
		isDailyBattleDayReportSaved = clanListCache.reduce((obj, clanTag) => ({ ...obj, [clanTag]: false }), {});
	});
};

module.exports = {
	scheduleCronToGenerateDailyMissedBattleDecksReport,
	generateBattleDayReportByPeriodIndex,
	getStartAndEndCollectionDataByPeriodIndex,
};