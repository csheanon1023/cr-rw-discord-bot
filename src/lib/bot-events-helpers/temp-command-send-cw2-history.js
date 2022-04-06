// to run script: node -r dotenv/config ./src/lib/bot-events-helpers/send-cw2-history.js
const membersDataHelper = require('../clash-royale-api-helpers/members-data-helper');
const playerDataHelper = require('../clash-royale-api-helpers/player-data-helper');
const { MessageEmbed } = require('discord.js');
const royaleApiTokenHelper = require('../scraping-helpers/royale-api-token-helper');
const playerClanWars2HistoryHelper = require('../scraping-helpers/player-clan-wars2-history-helper');
const { timePassedBetweenTwoMillisecondTimestamps } = require('../utils/dateTimeUtils');

// const clanListCache = [ '#2PYUJUL' ];
// const clanListCache = [ '#P9QQVJVG' ];
// const clanListCache = [ '#QRVUCJVP' ];
// const clanNameByKeyCache = {
// 	'#2PYUJUL': 'ROYAL WARRIORS!',
// 	'#P9QQVJVG': 'HARAMI_CLASHERS',
// };
const clanCodeByKeyCache = {
	'2PYUJUL': 'RW',
	'P9QQVJVG': 'HC',
	'QRVUCJVP': 'NOVA',
};
const embedBannerColours = {
	COLOUR_ORANGE: '#f56200',
	COLOUR_RED: '#f52700',
	COLOUR_YELLOW: '#ca9a00',
	COLOUR_DULL_GREEN : '#ddf000',
	COLOUR_BRIGHT_GREEN: '#56f000',
	COLOUR_PURPLE: '#a114ff',
	COLOUR_DEFAULT: '#f56200',
};
let rApiToken = null;
const ROYALE_API_BASE_URL = 'https://royaleapi.com/';

const sendInEmbed = async (playerTag, clanTag, client, channelIds) => {
	try {
		const baseChannelIdKey = 'IN_LOG_CHANNEL_ID';
		const channelIdKey = `${baseChannelIdKey}_${clanCodeByKeyCache[clanTag.substring(1)]}`;
		if (!playerTag || playerTag == '') {return false;}
		const response = await playerDataHelper.getPlayerData(playerTag);
		const playerDetails = response.data;
		if (!(channelIds && channelIds[channelIdKey])) {
			console.log('No channels defined for in-log');
			return false;
		}
		const channel = await client.channels.fetch(channelIds[channelIdKey]);
		const playerJoinedEmbed = new MessageEmbed()
			.setTitle(`[${clanCodeByKeyCache[clanTag.substring(1)] || 'Clan Code NA'}] -> ${playerDetails.name || 'Player Name NA'}`)
			.addFields(
				{ name: 'King Level', value: `${playerDetails.expLevel ?? 'Player Level NA'}`, inline: true },
				{ name: 'Current Trophies', value: `${playerDetails.trophies ?? 'Player Trophies NA'}`, inline: true },
			)
			.setURL(`${ROYALE_API_BASE_URL}player/${playerTag.substring(1)}`)
			.setTimestamp();

		const clanWar2History = await getClanWars2History(rApiToken, playerTag, playerDetails.name);
		if (clanWar2History) {
			if (!clanWar2History.success || clanWar2History.rows.length == 0) {
				playerJoinedEmbed
					.setColor(embedBannerColours.COLOUR_ORANGE)
					.addFields(
						{ name: 'CW2 History', value: 'NA(0)', inline: true },
						{ name: 'CW2 Last 10', value: 'NA(0)', inline: true },
						{ name: 'CW2 Best 10', value: 'NA(0)', inline: true },
						{ name: 'CW2 Worst 10', value: 'NA(0)', inline: true },
						{ name: 'Recommended action (*not reliable for stale timelines)', value: 'We don\'t have enough data on this player to make a prediction.', inline: false },
					);
				console.error(`In log, get clan war 2 history succeeded but success flag is false or data is empty status:${clanWar2History.success}, rows: ${clanWar2History.rows.length}, pTag: ${playerTag}`);
			}

			else {
				// Overall
				const contributions = clanWar2History.rows.map(raceStats => raceStats.fame || raceStats.contribution);
				const totalRecordsFound = contributions.length;
				const totalFame = contributions.reduce((sum, fame) => sum + fame, 0);
				const overallAverage = Math.ceil(totalFame / totalRecordsFound);

				// Last 10 records
				const lastTenContributions = contributions.slice(0, 10);
				const lastTenTotalRecordsFound = lastTenContributions.length;
				const lastTenTotalFame = lastTenContributions.reduce((sum, fame) => sum + fame, 0);
				const lastTenOverallAverage = Math.ceil(lastTenTotalFame / lastTenTotalRecordsFound);

				// Best 10 records
				const bestTenContributions = contributions.sort((a, b) => b - a).slice(0, 10);
				const bestTenTotalRecordsFound = bestTenContributions.length;
				const bestTenTotalFame = bestTenContributions.reduce((sum, fame) => sum + fame, 0);
				const bestTenOverallAverage = Math.ceil(bestTenTotalFame / bestTenTotalRecordsFound);

				// Worst 10 records
				const worstTenContributions = contributions.sort((a, b) => a - b).slice(0, 10);
				const worstTenTotalRecordsFound = worstTenContributions.length;
				const worstTenTotalFame = worstTenContributions.reduce((sum, fame) => sum + fame, 0);
				const worstTenOverallAverage = Math.ceil(worstTenTotalFame / worstTenTotalRecordsFound);

				// Timeline of last 10 records
				const date = Date.now();
				const timeline = clanWar2History.rows
					.slice(0, 10)
					.map(raceStats => timePassedBetweenTwoMillisecondTimestamps(raceStats.log_created_date_dt * 1000, date))
					.join(', ');

				// Find correct banner colour and recommendation message
				let bannerColour = embedBannerColours.COLOUR_DEFAULT;
				let recommendationMessage = 'NA';
				if (lastTenTotalRecordsFound <= 5) {
					bannerColour = embedBannerColours.COLOUR_ORANGE;
					recommendationMessage = `We don't have enough data on this player to make a prediction. (Only ${lastTenTotalRecordsFound} records found)`;
				}
				else if (lastTenOverallAverage < 800) {
					bannerColour = embedBannerColours.COLOUR_RED;
					recommendationMessage = 'CW2 score is too low, player should be kicked out.';
				}
				else if (lastTenOverallAverage >= 800 && lastTenOverallAverage < 1400) {
					bannerColour = embedBannerColours.COLOUR_YELLOW;
					recommendationMessage = 'Player\'s CW2 score is not very promising, monitor for 1-2 weeks then kick if they are missing battles frequently.';
				}
				else if (lastTenOverallAverage >= 1400 && lastTenOverallAverage < 2000) {
					bannerColour = embedBannerColours.COLOUR_DULL_GREEN;
					recommendationMessage = 'Decent CW2 score, we should retain the player.';
				}
				else if (lastTenOverallAverage >= 2000 && lastTenOverallAverage < 2600) {
					bannerColour = embedBannerColours.COLOUR_BRIGHT_GREEN;
					recommendationMessage = 'Very good CW2 history, we should retain the player.';
				}
				else {
					bannerColour = embedBannerColours.COLOUR_PURPLE;
					recommendationMessage = 'Exceptional CW2 history, expected to boost our clan performance significantly.';
				}

				playerJoinedEmbed
					.setColor(bannerColour)
					.addFields(
						{ name: 'CW2 History', value: totalRecordsFound != 0 ? `${overallAverage} (${totalRecordsFound})` : 'NA(0)', inline: true },
						{ name: 'CW2 Last 10', value: lastTenTotalRecordsFound != 0 ? `${lastTenOverallAverage} (${lastTenTotalRecordsFound})` : 'NA(0)', inline: true },
						{ name: 'CW2 Best 10', value: bestTenTotalRecordsFound != 0 ? `${bestTenOverallAverage} (${bestTenTotalRecordsFound})` : 'NA(0)', inline: true },
						{ name: 'CW2 Worst 10', value: worstTenTotalRecordsFound != 0 ? `${worstTenOverallAverage} (${worstTenTotalRecordsFound})` : 'NA(0)', inline: true },
						{ name: 'Timeline of last 10 records', value: timeline, inline: false },
						{ name: 'Recommended action (*not reliable for stale timelines)', value: recommendationMessage, inline: false },
					);

				// Left
				if (!(!clanWar2History.success || clanWar2History.rows.length == 0 || !clanWar2History.rows.some(rs => rs.clan_tag == clanTag.substring(1)))) {

					const filteredClanWar2History = clanWar2History.rows
						.filter(raceStats => raceStats.clan_tag == clanTag.substring(1));
					const totalRecordsFoundLeft = filteredClanWar2History.length;
					const timelineLeft = filteredClanWar2History
						// .slice(0, 10)
						.map(raceStats => timePassedBetweenTwoMillisecondTimestamps(raceStats.log_created_date_dt * 1000, date))
						.join(', ');

					// Group by Seasons
					const groupBySeasons = (warHistory) => {
						return warHistory.reduce((acc, raceStats) => {
							if (!(raceStats.season_id in acc))
								acc[raceStats.season_id] = {};
							acc[raceStats.season_id][raceStats.section_index] = {
								fame: raceStats.fame,
								decksUsed: raceStats.decks_used,
								timePassed: timePassedBetweenTwoMillisecondTimestamps(raceStats.log_created_date_dt * 1000, date),
							};
							return acc;
						}, {});
					};

					playerJoinedEmbed
						.addFields(
							{ name: 'Races', value: totalRecordsFoundLeft, inline: true },
							{ name: 'Timeline of contributed races', value: timelineLeft, inline: false },
						);

					const groupedSeasonStats = groupBySeasons(filteredClanWar2History);
					const latestFiveSeasonStats = Object.keys(groupedSeasonStats).sort((a, b) => b - a).slice(0, 5);
					latestFiveSeasonStats?.forEach(seasonStats => {
						const sections = Object.keys(groupedSeasonStats[seasonStats]);
						if (sections.length == 0)
							return;
						playerJoinedEmbed.addField(
							`${seasonStats} [${sections.map(s => `${Number(s) + 1} (${groupedSeasonStats[seasonStats]?.[s]?.timePassed ?? 'NA'})`)?.join(', ')}]`,
							sections.map(s => `${groupedSeasonStats[seasonStats]?.[s]?.fame ?? 'NA'}(${groupedSeasonStats[seasonStats]?.[s]?.decksUsed ?? 'NA'})`)?.join(', '),
							false,
						);
					});
				}
			}
		}
		else {
			playerJoinedEmbed
				.setColor(embedBannerColours.COLOUR_ORANGE)
				.addField('Something went wrong', 'Failed to fetch player info, title of this message links to this player\'s profile on RoyaleAPI, click on that to get details about this player', false);
		}
		channel.send(playerJoinedEmbed);
		console.log(`${playerDetails.name} has joined ${clanCodeByKeyCache[clanTag.substring(1)] || 'Clan Code NA'}`);
	}
	catch (error) {
		console.error('In log, send embed failed\nerror:' + error);
		console.info(`Params: change:Join;playerTag:${playerTag};clanTag:${clanTag}` + error);
		return false;
	}
};

const getClanWars2History = async (royaleApiToken, playerTag, playerName) => {
	try {

		let clanWar2History = royaleApiToken == null ? false : await playerClanWars2HistoryHelper.getPlayerClanWar2HistoryOrFault(royaleApiToken, playerTag, playerName);
		if (!clanWar2History) {
			royaleApiToken =
				await royaleApiTokenHelper.generateRoyaleApiTokenOrFault() ||
				await royaleApiTokenHelper.generateRoyaleApiTokenOrFault(true);
			if (!royaleApiToken)
				return false;
			rApiToken = royaleApiToken;
			clanWar2History =
				await playerClanWars2HistoryHelper.getPlayerClanWar2HistoryOrFault(royaleApiToken, playerTag, playerName) ||
				await playerClanWars2HistoryHelper.getPlayerClanWar2HistoryOrFault(royaleApiToken, playerTag, playerName, true);
		}
		return clanWar2History;
	}
	catch (error) {
		console.error(`In log, get clan war 2 history failed \n${error}`);
		return false;
	}
};

exports.scrapeAndSendRecords = async (message, args) => {
	const channleIdByClan = {
		'#2PYUJUL': '904461174664470628',
		'#P9QQVJVG': '904472570135457853',
		'#QRVUCJVP': '931255639202746368',
	};

	const clanTagByChannelId = {
		'904461174664470628': '#2PYUJUL',
		'904472570135457853': '#P9QQVJVG',
		'931255639202746368': '#QRVUCJVP',
	};

	const clanTag = clanTagByChannelId[message?.channel?.id];
	if (!clanTag)
		return;

	let offset = 0;
	let members = [];

	if (args.length === 0) {
		const { data: memberListData } = await membersDataHelper.getMembers(clanTag);
		members = memberListData.items;
	}
	else {
		members = args.map(e => ({ tag: e }));
	}

	for (const { tag } of members) {
		offset += Math.floor((Math.random() * 100) % 6);
		const channelIds = {
			IN_LOG_CHANNEL_ID_RW : channleIdByClan[clanTag],
			IN_LOG_CHANNEL_ID_HC : channleIdByClan[clanTag],
			IN_LOG_CHANNEL_ID_NOVA : channleIdByClan[clanTag],
		};
		setTimeout(() => {
			try {
				sendInEmbed(tag, clanTag, message.client, channelIds);
			}
			catch (error) {
				console.error(`In log, get clan war 2 history failed \n${error}`);
			}
		}, offset * 1000);
	}
};