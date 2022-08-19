// to run script: node -r dotenv/config ./src/lib/bot-events-helpers/war-reports-module/generate-section-missed-deck-report.js
const { getPreviousSeasonDetailsUptoSpecificBattleDayPeriod } = require('../../utils/warSeasonDetailsUtils');
const membersDataHelper = require('../../clash-royale-api-helpers/members-data-helper');
// const cron = require('node-cron');
// const { getCurrentTime } = require('../../utils/dateTimeUtils');
const { MessageEmbed } = require('discord.js');
const { getRows } = require('../../astra-database-helpers/rest-api-wrapper/getRows');

// const clanListCache = [ '#2PYUJUL', '#P9QQVJVG', '#QRVUCJVP', '#Q02UV0C0', '#LUVY2QY2' ];

const createObjectOfAllParticipantsWithTotalDecks = (startOfDayData) => {
	try {
		if (Object.values(startOfDayData).length == 0) {
			throw 'unable to find any records in startOfDayData';
		}
		const returnObject = startOfDayData.reduce((acc, { player_tag, player_name }) => {
			const tag = player_tag.substring(1);
			if (tag in acc) {
				acc[tag].totalAvailableDecks = (acc[tag].totalAvailableDecks ?? 0) + 4;
			}
			else {
				acc[tag] = {
					name: player_name,
					tag: player_tag,
					totalAvailableDecks: 4,
				};
			}
			return acc;
		}, {});
		return returnObject;
	}
	catch (error) {
		console.error(`generate section missed decks report failed, create object from start data \n${error}`);
		return false;
	}
};

const createObjectOfAllParticipantsWithTotalUnusedDecks = (unusedDecksReport) => {
	try {
		if (Object.values(unusedDecksReport).length == 0) {
			throw 'unable to find any records in unusedDecksReport';
		}
		const returnObject = unusedDecksReport.reduce((acc, { player_tag, unused_decks }) => {
			const tag = player_tag.substring(1);
			acc[tag] = (acc[tag] ?? 0) + unused_decks;
			return acc;
		}, {});
		return returnObject;
	}
	catch (error) {
		console.error(`generate section missed decks report failed, generate report \n${error}`);
		return false;
	}
};

// generate report
const generateSectionMissedDeckReport = async (clanTag, seasonDetails) => {
	try {
		const { seasonId, periodIndex } = seasonDetails;
		const week = Math.floor(Number(periodIndex) / 7) + 1;
		// const day = (Number(previousSeasonDetails.periodIndex) + 5) % 7;
		const { data: astraStartOfDayData } = await getRows('war_reports', 'collected_battle_day_participant_data', [`${clanTag.substring(1)}`, 'start', `${seasonId}`, `${week}`], 2000, null, ['player_tag', 'player_name']);
		const { data: astraUnusedDecksReport } = await getRows('war_reports', 'period_unused_decks_report', [`${clanTag.substring(1)}`, `${seasonId}`, `${week}`], 2000, null, ['player_tag', 'unused_decks']);
		if (!astraStartOfDayData?.count || !astraUnusedDecksReport?.count)
			throw `Collection data / daily reports not avalable. clan: ${clanTag} participantCount:${astraStartOfDayData.count} daily rep recoeds count:${astraUnusedDecksReport.count} season:${seasonId} week:${week}`;
		const participantList = createObjectOfAllParticipantsWithTotalDecks(astraStartOfDayData.data);
		const totalSectionUnusedDeckCounts = createObjectOfAllParticipantsWithTotalUnusedDecks(astraUnusedDecksReport.data);
		if (!participantList || !totalSectionUnusedDeckCounts)
			throw `Not able to generate participant list / total unused decks object clantag: ${clanTag}`;
		for (const playerTag in participantList.participants) {
			participantList.participants[playerTag].unusedDecks = totalSectionUnusedDeckCounts?.[playerTag] ?? 0;
		}
		return participantList;
	}
	catch (error) {
		console.error(`generate section missed decks report failed, generate report \n${error}`);
		return false;
	}
};

const paginateAndSendReport = async (client, clanTag, channelId, previousSeasonDetails, unusedDecksReport) => {
	const memberList = (await membersDataHelper.getMembers(clanTag))?.data?.items?.map(member => member.tag);
	const riverRaceReport = Object.values(unusedDecksReport).filter(player => player.unusedDecks > 0);
	riverRaceReport.forEach(player => player.isInClan = memberList.includes(player.tag) ? 1 : -1);
	riverRaceReport.sort((player1, player2) => {
		if (player2.isInClan == player1.isInClan)
			return player2?.unusedDecks - player1?.unusedDecks;
		return player1.isInClan * -1;
	});
	const allPagesKeys = Object.keys(riverRaceReport);
	const numberOfPages = Math.ceil(allPagesKeys.length / 15);
	const pageFlagsIsReportSentSuccessfully = new Array(numberOfPages).fill(false);
	let retryCount = 0;
	while (pageFlagsIsReportSentSuccessfully.find(val => val == false) != null && retryCount++ < 5) {
		for (const index of pageFlagsIsReportSentSuccessfully.keys()) {
			if (pageFlagsIsReportSentSuccessfully[index]) return;
			pageFlagsIsReportSentSuccessfully[index] = await sendBattleDayReport(client, allPagesKeys.slice(15 * index, 15 * (index + 1)), riverRaceReport, channelId, previousSeasonDetails);
		}
	}
	return pageFlagsIsReportSentSuccessfully?.every(val => val == true) || false;
};

const sendBattleDayReport = async (client, pageKeys, unusedDecksReport, channelId, { seasonId, sectionIndex, periodIndex }) => {
	const channel = await client.channels.fetch(channelId);
	const listOfPlayersWithUnusedDeckCount = pageKeys.map(pageKey => ({
		name: unusedDecksReport[pageKey].name,
		unusedDecks: `${unusedDecksReport[pageKey].unusedDecks}/${unusedDecksReport[pageKey].totalAvailableDecks}`,
		isInClan: unusedDecksReport[pageKey].isInClan,
	}));
	const tableHead = 'Player Name     UnusedDecks  In Clan';
	const removeEmojisFromString = (text) => text.replace(/([\u2700-\u27BF]|[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2011-\u26FF]|\uD83E[\uDD10-\uDDFF])/g, '');
	const formatPlayerReportData = (playerData) => `${removeEmojisFromString(playerData.name.length > 15 ? playerData.name.substring(0, 15) : playerData.name).padEnd(15)} ${(playerData.unusedDecks.toString()).padStart(11)}  ${((playerData.isInClan == 1) ? 'Yes' : 'No').padStart(7)}`;
	const reportField = `\`\`\`\n${tableHead}\n${listOfPlayersWithUnusedDeckCount.map(formatPlayerReportData).join('\n')}\n\`\`\``;
	const riverRaceReportEmbed = new MessageEmbed()
		.setColor('#cc7900')
		.setTitle(`Season ${seasonId || 'NA'}|Week ${sectionIndex + 1 || 'NA'}|Day(s) ${[...Array((periodIndex + 5) % 7).keys()].map(e => e + 1).join(', ') || 'NA'}`)
		.setDescription('River-race consolidated unused decks report')
		.addField('Report', reportField, false)
		.setTimestamp();
	return channel.send(riverRaceReportEmbed)
		.then(() => true)
		.catch((e) => {
			console.error(`send action daily battle day report failed, send embed\n${e}`);
			return false;
		});
};

const triggerCurrentRiverRaceReport = async (message, args, accessLevel, channelIdByClan) => {
	try {
		const clanTag = Object.keys(channelIdByClan)?.find(key => channelIdByClan[key] == message.channel.id);
		if (!clanTag) {
			message.reply('This command can only be used in clan chat channel');
			throw 'no clanTag mapped to this channel';
		}
		const memberRoles = await message.member.roles.cache;
		let flag = false;
		for (const roleId of accessLevel) {
			if (memberRoles.get(roleId)) {
				flag = true;
				break;
			}
		}
		if (!flag)
			return message.reply('Whoops! Looks like you are not authorized to use this command.');
		let targetSeasonDetails = null;
		if (args.length == 2) {
			targetSeasonDetails = {
				seasonId: args[0],
				sectionIndex: args[1] - 1,
				periodIndex: 6 + (args[1] - 1) * 7,
			};
		}
		else {
			targetSeasonDetails = await getPreviousSeasonDetailsUptoSpecificBattleDayPeriod(clanTag);
		}
		const unusedDecksReport = await generateSectionMissedDeckReport(clanTag, targetSeasonDetails);
		paginateAndSendReport(message.client, clanTag, message.channel.id, targetSeasonDetails, unusedDecksReport);
	}
	catch (error) {
		console.error(`generate section missed decks report failed, trigger report command \n${error}`);
		message.reply(error);
		return false;
	}
};

const triggerGetPlayerTagsFromCurrentRiverRaceReport = async (message, args, accessLevel, channelIdByClan) => {
	try {
		const clanTag = Object.keys(channelIdByClan)?.find(key => channelIdByClan[key] == message.channel.id);
		if (!clanTag) {
			message.reply('This command can only be used in clan chat channel');
			throw 'no clanTag mapped to this channel';
		}
		const memberRoles = await message.member.roles.cache;
		let flag = false;
		for (const roleId of accessLevel) {
			if (memberRoles.get(roleId)) {
				flag = true;
				break;
			}
		}
		if (!flag)
			return message.reply('Whoops! Looks like you are not authorized to use this command.');
		let targetSeasonDetails = null;
		if (args.length == 2) {
			targetSeasonDetails = {
				seasonId: args[0],
				sectionIndex: args[1] - 1,
				periodIndex: 6 + (args[1] - 1) * 7,
			};
		}
		else {
			targetSeasonDetails = await getPreviousSeasonDetailsUptoSpecificBattleDayPeriod(clanTag);
		}
		const unusedDecksReport = await generateSectionMissedDeckReport(clanTag, targetSeasonDetails);
		paginateAndSendPlayerTags(message.client, clanTag, message.channel.id, targetSeasonDetails, unusedDecksReport);
	}
	catch (error) {
		console.error(`generate section missed decks report failed, trigger report command \n${error}`);
		return false;
	}
};

const paginateAndSendPlayerTags = async (client, clanTag, channelId, previousSeasonDetails, unusedDecksReport) => {
	const memberList = (await membersDataHelper.getMembers(clanTag))?.data?.items?.map(member => member.tag);
	const riverRaceReport = Object.values(unusedDecksReport).filter(player => player.unusedDecks > 0);
	riverRaceReport.forEach(player => player.isInClan = memberList.includes(player.tag) ? 1 : -1);
	riverRaceReport.sort((player1, player2) => {
		if (player2.isInClan == player1.isInClan)
			return player2?.unusedDecks - player1?.unusedDecks;
		return player1.isInClan * -1;
	});
	const allPagesKeys = Object.keys(riverRaceReport);
	const numberOfPages = Math.ceil(allPagesKeys.length / 50);
	const pageFlagsIsReportSentSuccessfully = new Array(numberOfPages).fill(false);
	let retryCount = 0;
	while (pageFlagsIsReportSentSuccessfully.find(val => val == false) != null && retryCount++ < 5) {
		for (const index of pageFlagsIsReportSentSuccessfully.keys()) {
			if (pageFlagsIsReportSentSuccessfully[index]) return;
			pageFlagsIsReportSentSuccessfully[index] = await sendReportPlayerTags(client, allPagesKeys.slice(50 * index, 50 * (index + 1)), riverRaceReport, channelId);
		}
	}
	return pageFlagsIsReportSentSuccessfully?.every(val => val == true) || false;
};

const sendReportPlayerTags = async (client, pageKeys, unusedDecksReport, channelId) => {
	const channel = await client.channels.fetch(channelId);
	const listOfPlayersWithUnusedDeckCount = pageKeys.map(pageKey => ({
		name: unusedDecksReport[pageKey].name,
		tag: unusedDecksReport[pageKey].tag,
		isInClan: unusedDecksReport[pageKey].isInClan,
	}));
	const removeEmojisFromString = (text) => text.replace(/([\u2700-\u27BF]|[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|[\u2011-\u26FF]|\uD83E[\uDD10-\uDDFF])/g, '');
	const formatTags = (listOfPlayers) => listOfPlayers
		.filter(({ isInClan }) => isInClan === 1)
		.map(({ tag }) => tag)
		.join(' ');
	const formatNames = (listOfPlayers, inClanFlag = true) => listOfPlayers
		.filter(({ isInClan }) => {
			const inClanStatus = isInClan === 1;
			return inClanStatus === inClanFlag;
		})
		.map(({ name }) => removeEmojisFromString(name.length > 15 ? name.substring(0, 15) : name))
		.join(', ');
	return channel.send(`$scrape ${formatTags(listOfPlayersWithUnusedDeckCount)}`)
		.then(() => channel.send(`In-game names for above list: ${formatNames(listOfPlayersWithUnusedDeckCount)}`))
		.then(() => channel.send(`Not in clan anymore in current page: ${formatNames(listOfPlayersWithUnusedDeckCount, false)}`))
		.then(() => true)
		.catch((e) => {
			console.error(`send action daily battle day report failed, send embed\n${e}`);
			return false;
		});
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

// const scheduleCronToGenerateDailyMissedBattleDecksReport = (database, client, channelIds, isSendAction = false) => {
// 	let isDailyBattleDayReportSaved = clanListCache.reduce((obj, clanTag) => ({ ...obj, [clanTag]: false }), {});
// 	let isDailyBattleDayReportSent = clanListCache.reduce((obj, clanTag) => ({ ...obj, [clanTag]: false }), {});

// 	// At every minute from 15 through 20 past hour 10 on Sunday, Monday, Friday, and Saturday [offset 48] Report generation
// 	cron.schedule('48 30-35 10 * * 0,1,5,6', async () => {
// 		const currentDate = new Date();
// 		const formattedCurrentTime = getCurrentTime(currentDate);

// 		if (clanListCache == null || clanListCache.length == 0) {
// 			console.log(`${formattedCurrentTime} Skipping river race report generation as clanListCache is empty`);
// 			return;
// 		}

// 		if (
// 			Object.values(isDailyBattleDayReportSaved).find(val => val == false) == undefined &&
// 			Object.values(isDailyBattleDayReportSent).find(val => val == false) == undefined
// 		) {
// 			console.log(`${formattedCurrentTime} Skipping river race report generation cron, all reports have already been saved and sent`);
// 			return;
// 		}

// 		try {
// 			// Generate Report
// 			for (const clanTag of clanListCache) {
// 				// TODO check if db has a report already
// 				if (isDailyBattleDayReportSaved[clanTag] && isDailyBattleDayReportSent[clanTag]) {
// 					console.log(`${formattedCurrentTime} Skipping river race report generation cron, report for ${clanTag} has already been saved and sent`);
// 					continue;
// 				}
// 				const previousSeasonDetails = await getPreviousSeasonDetailsUptoSpecificBattleDayPeriod(clanTag);
// 				const unusedDecksReport = await generateSectionMissedDeckReport(database, clanTag, previousSeasonDetails);
// 				// isDailyBattleDayReportSaved[clanTag] ?
// 				// 	console.log(`${formattedCurrentTime} Skipping river race report save to DB, report for ${clanTag} has already been saved`) :
// 				// 	saveBattleDayReportByPeriodIndex(database, clanTag, previousSeasonDetails.seasonId, previousSeasonDetails.periodIndex, unusedDecksReport).then(isSaved => {
// 				// 		isDailyBattleDayReportSaved[clanTag] = isSaved;
// 				// 	});
// 				isDailyBattleDayReportSent[clanTag] || !isSendAction ?
// 					console.log(`${formattedCurrentTime} Skipping river race report send action, report for ${clanTag} has already been saved OR sendAction:${isSendAction}`) :
// 					sendBattleDayReport(client, channelIds[clanTag], unusedDecksReport).then(isSent => {
// 						isDailyBattleDayReportSent[clanTag] = isSent;
// 					});
// 			}
// 		}
// 		catch (e) {
// 			console.error(e);
// 			console.log(`${formattedCurrentTime} river race report generation cron failed`);
// 			return;
// 		}
// 	});

// 	// At minute 15, 30, and 45 past hour 11 on Sunday, Monday, Thursday, Friday, and Saturday [Offset 9] Reset flags
// 	cron.schedule('9 15,30,45 11 * * 0,1,4,5,6', async () => {
// 		const currentdate = getCurrentTime();
// 		console.log(`Reset counts and flags (isDailyBattleDayReportSaved, isDailyBattleDayReportSent) at ${currentdate}`);
// 		isDailyBattleDayReportSaved = clanListCache.reduce((obj, clanTag) => ({ ...obj, [clanTag]: false }), {});
// 		isDailyBattleDayReportSent = clanListCache.reduce((obj, clanTag) => ({ ...obj, [clanTag]: false }), {});
// 	});
// };

module.exports = {
	// scheduleCronToGenerateDailyMissedBattleDecksReport,
	// generateSectionMissedDeckReport,
	// getStartAndEndCollectionDataByPeriodIndex,
	triggerCurrentRiverRaceReport,
	triggerGetPlayerTagsFromCurrentRiverRaceReport,
};