// to run script: node -r dotenv/config ./src/lib/utils/warSeasonDetailsUtils.js
const currentRiverRaceDataHelper = require('../clash-royale-api-helpers/current-river-race-data-helper');
const riverRaceLogDataHelper = require('../clash-royale-api-helpers/river-race-log-data-helper');

const getCurrentSeasonDetailsUptoSpecificPeriod = async (clanTag, currentRiverRaceData = null, riverRaceLogData = null) => {
	try {
		const seasonDetails = {};
		if (!currentRiverRaceData) {
			currentRiverRaceData = (await currentRiverRaceDataHelper.getCurrentRiverRaceData(clanTag))?.data;
		}
		if (!riverRaceLogData) {
			riverRaceLogData = (await riverRaceLogDataHelper.getRiverRaceLogData(clanTag))?.data;
		}
		const lastRaceLogData = riverRaceLogData?.items?.[0];
		const currentRaceSectionIndex = currentRiverRaceData?.sectionIndex;
		seasonDetails.sectionIndex = currentRaceSectionIndex;
		seasonDetails.periodIndex = currentRiverRaceData?.periodIndex;
		if (currentRaceSectionIndex === lastRaceLogData?.sectionIndex + 1) {
			seasonDetails.seasonId = lastRaceLogData?.seasonId;
		}
		else {
			seasonDetails.seasonId = lastRaceLogData?.seasonId + 1;
		}
		if (!isValidSeasonDetailsObject(seasonDetails))
			throw 'Not able to generate valid season details object';
		return seasonDetails;
	}
	catch (error) {
		console.error(`Not able to identify current war season details \n${error}`);
		return false;
	}
};

const getPreviousSeasonDetailsUptoSpecificPeriod = async (clanTag, currentRiverRaceData = null, riverRaceLogData = null) => {
	try {
		const seasonDetails = {};
		if (!currentRiverRaceData) {
			currentRiverRaceData = (await currentRiverRaceDataHelper.getCurrentRiverRaceData(clanTag))?.data;
		}
		if (!riverRaceLogData) {
			riverRaceLogData = (await riverRaceLogDataHelper.getRiverRaceLogData(clanTag))?.data;
		}
		const lastRaceLogData = riverRaceLogData?.items?.[0];
		const currentRaceSectionIndex = currentRiverRaceData?.sectionIndex;

		// TODO some scope for reusability
		if ([1, 2, 3, 4, 5, 6].includes(currentRiverRaceData?.periodIndex % 7)) {
			seasonDetails.periodIndex = currentRiverRaceData?.periodIndex - 1;
			seasonDetails.sectionIndex = currentRaceSectionIndex;
			if (currentRaceSectionIndex === lastRaceLogData?.sectionIndex + 1) {
				seasonDetails.seasonId = lastRaceLogData?.seasonId;
			}
			else {
				seasonDetails.seasonId = lastRaceLogData?.seasonId + 1;
			}
		}
		else if ((currentRiverRaceData?.periodIndex % 7) === 0) {
			const perviousRaceSectionIndex = lastRaceLogData?.sectionIndex;
			seasonDetails.periodIndex = 6 + perviousRaceSectionIndex * 7;
			seasonDetails.sectionIndex = lastRaceLogData?.sectionIndex;
			seasonDetails.seasonId = lastRaceLogData?.seasonId;
		}
		if (!isValidSeasonDetailsObject(seasonDetails))
			throw 'Not able to generate valid season details object';
		return seasonDetails;
	}
	catch (error) {
		console.error(`Not able to identify previous BATTLE/TRAINING DAY season details \n${error}`);
		return false;
	}
};

const getPreviousSeasonDetailsUptoSpecificBattleDayPeriod = async (clanTag, currentRiverRaceData = null, riverRaceLogData = null) => {
	try {
		const seasonDetails = {};
		if (!currentRiverRaceData) {
			currentRiverRaceData = (await currentRiverRaceDataHelper.getCurrentRiverRaceData(clanTag))?.data;
		}
		if (!riverRaceLogData) {
			riverRaceLogData = (await riverRaceLogDataHelper.getRiverRaceLogData(clanTag))?.data;
		}
		const lastRaceLogData = riverRaceLogData?.items?.[0];
		const currentRaceSectionIndex = currentRiverRaceData?.sectionIndex;

		if ([0, 1, 2, 3].includes(currentRiverRaceData?.periodIndex % 7)) {
			const perviousRaceSectionIndex = lastRaceLogData?.sectionIndex;
			seasonDetails.periodIndex = 6 + perviousRaceSectionIndex * 7;
			seasonDetails.sectionIndex = lastRaceLogData?.sectionIndex;
			seasonDetails.seasonId = lastRaceLogData?.seasonId;
		}
		else if ([4, 5, 6].includes(currentRiverRaceData?.periodIndex % 7)) {
			seasonDetails.periodIndex = currentRiverRaceData?.periodIndex - 1;
			seasonDetails.sectionIndex = currentRaceSectionIndex;
			if (currentRaceSectionIndex === lastRaceLogData?.sectionIndex + 1) {
				seasonDetails.seasonId = lastRaceLogData?.seasonId;
			}
			else {
				seasonDetails.seasonId = lastRaceLogData?.seasonId + 1;
			}
		}
		if (!isValidSeasonDetailsObject(seasonDetails))
			throw 'Not able to generate valid season details object';
		return seasonDetails;
	}
	catch (error) {
		console.error(`Not able to identify previous BATTLE DAY season details \n${error}`);
		return false;
	}
};

const isValidSeasonDetailsObject = (seasonDetails) => {
	const shouldHaveProperties = ['sectionIndex', 'periodIndex', 'seasonId'];
	return shouldHaveProperties.reduce((isValid, key) => isValid && key in seasonDetails, true) &&
    Object.values(seasonDetails)?.reduce((isValid, value) => isValid || !isNaN(value), true);
};

module.exports = {
	getCurrentSeasonDetailsUptoSpecificPeriod,
	getPreviousSeasonDetailsUptoSpecificPeriod,
	getPreviousSeasonDetailsUptoSpecificBattleDayPeriod,
};