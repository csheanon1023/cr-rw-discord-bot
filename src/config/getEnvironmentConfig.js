exports.getEnvironmentConfig = (environment) => {
	switch (environment) {
	case 'production' :
		return {
			isSelfRolesEnabled: true,
			isByLevelCommandEnabled: true,
			isVerifyDiscordCrLinkEnabled: false,
			isLegacyInOutLogEnabled: false,
			isInLogEnabled: false,
			isOutLogEnabled: false,
			isInOutLogsComputationEnabled: true,
			isCollectDailyRiverRaceDataEnabled: true,
			isGenerateDailyUnusedDecksReportEnabled: true,
			isSendActionDailyUnusedDecksReportEnabled: true,
			isGenerateEndOfRiverRaceReportEnabled: true,
			isSendActionEndOfRiverRaceReportEnabled: true,
			isUpcomingChestsCommandEnabled: false,
			isToKickListCronEnabled: false,
			isCollectBattleDayInitialParticipantDataEnabled: false,
			isCollectEndOfBattleDayParticipantDataEnabled: false,
			isGenerateDailyBattleDayReportEnabled: false,
			isSendActionDailyBattleDayReportEnabled: false,
			isCurrentRaceConsolidatedReportCommandEnabled: false,
			isTempScrapeCommandEnabled: true,
		};
	case 'staging':
		return {
			isSelfRolesEnabled: false,
			isByLevelCommandEnabled: false,
			isVerifyDiscordCrLinkEnabled: true,
			isLegacyInOutLogEnabled: false,
			isInLogEnabled: true,
			isOutLogEnabled: true,
			isInOutLogsComputationEnabled: true,
			isCollectDailyRiverRaceDataEnabled: false,
			isGenerateDailyUnusedDecksReportEnabled: false,
			isSendActionDailyUnusedDecksReportEnabled: false,
			isGenerateEndOfRiverRaceReportEnabled: false,
			isSendActionEndOfRiverRaceReportEnabled: false,
			isUpcomingChestsCommandEnabled: true,
			isToKickListCronEnabled: false,
			isCollectBattleDayInitialParticipantDataEnabled: true,
			isCollectEndOfBattleDayParticipantDataEnabled: true,
			isGenerateDailyBattleDayReportEnabled: true,
			isSendActionDailyBattleDayReportEnabled: true,
			isCurrentRaceConsolidatedReportCommandEnabled: true,
			isTempScrapeCommandEnabled: false,
		};
	case 'dev':
		return {
			isSelfRolesEnabled: true,
			isByLevelCommandEnabled: true,
			isVerifyDiscordCrLinkEnabled: true,
			isLegacyInOutLogEnabled: true,
			isInLogEnabled: true,
			isOutLogEnabled: true,
			isInOutLogsComputationEnabled: true,
			isCollectDailyRiverRaceDataEnabled: true,
			isGenerateDailyUnusedDecksReportEnabled: true,
			isSendActionDailyUnusedDecksReportEnabled: true,
			isGenerateEndOfRiverRaceReportEnabled: true,
			isSendActionEndOfRiverRaceReportEnabled: true,
			isUpcomingChestsCommandEnabled: true,
			isToKickListCronEnabled: true,
			isCollectBattleDayInitialParticipantDataEnabled: true,
			isCollectEndOfBattleDayParticipantDataEnabled: true,
			isGenerateDailyBattleDayReportEnabled: true,
			isSendActionDailyBattleDayReportEnabled: true,
			isCurrentRaceConsolidatedReportCommandEnabled: true,
			isTempScrapeCommandEnabled: false,
		};
	default:
		return {
			isSelfRolesEnabled: false,
			isByLevelCommandEnabled: false,
			isVerifyDiscordCrLinkEnabled: false,
			isLegacyInOutLogEnabled: false,
			isInLogEnabled: false,
			isOutLogEnabled: false,
			isInOutLogsComputationEnabled: false,
			isCollectDailyRiverRaceDataEnabled: false,
			isGenerateDailyUnusedDecksReportEnabled: false,
			isSendActionDailyUnusedDecksReportEnabled: false,
			isGenerateEndOfRiverRaceReportEnabled: false,
			isSendActionEndOfRiverRaceReportEnabled: false,
			isUpcomingChestsCommandEnabled: false,
			isToKickListCronEnabled: false,
			isCollectBattleDayInitialParticipantDataEnabled: false,
			isCollectEndOfBattleDayParticipantDataEnabled: false,
			isGenerateDailyBattleDayReportEnabled: false,
			isSendActionDailyBattleDayReportEnabled: false,
			isCurrentRaceConsolidatedReportCommandEnabled: false,
			isTempScrapeCommandEnabled: false,
		};
	}
};