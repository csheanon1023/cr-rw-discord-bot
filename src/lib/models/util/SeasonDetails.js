class SeasonDetails {
	constructor(seasonId, sectionIndex, periodIndex) {
		this.seasonId = seasonId ?? -1;
		this.sectionIndex = sectionIndex ?? -1;
		this.periodIndex = periodIndex ?? -1;
	}
}

module.exports = { SeasonDetails };