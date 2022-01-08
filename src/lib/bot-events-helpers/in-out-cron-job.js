// to run script: node -r dotenv/config ./src/lib/bot-events-helpers/in-out-cron-job.js
const databaseRepository = require('../database-helpers/database-repository');
const membersDataHelper = require('../clash-royale-api-helpers/members-data-helper');
const playerDataHelper = require('../clash-royale-api-helpers/player-data-helper');
const cron = require('node-cron');
const { MessageEmbed } = require('discord.js');
const royaleApiTokenHelper = require('../scraping-helpers/royale-api-token-helper');
const playerClanWars2HistoryHelper = require('../scraping-helpers/player-clan-wars2-history-helper');
const { timePassedBetweenTwoMillisecondTimestamps } = require('../utils/dateTimeUtils');

exports.startInOutLogCronEachMinute = (database, client, channelIds, flags) => {
	const clanListCache = [ '#2PYUJUL', '#P9QQVJVG' ];
	let clanMembersCache = [];
	let lastInOutCronSuccessTimestamp = -1;
	// const clanNameByKeyCache = {
	// 	'#2PYUJUL': 'ROYAL WARRIORS!',
	// 	'#P9QQVJVG': 'HARAMI_CLASHERS',
	// };
	const clanCodeByKeyCache = {
		'2PYUJUL': 'RW',
		'P9QQVJVG': 'HC',
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

	// CRON
	cron.schedule('* * * * *', async () => {

		// TODO decide how to add support for new clans. This can be used as a script to detect erroneous DB entries at clan level
		// //Get clans
		// const snapshot = await database.collection('clans').get();
		// const clans = [];
		// snapshot.forEach(doc => {
		//   clans.push(doc.id);
		// });

		// //Check if there is a new clan collection in DB
		// if(clanListCache.length != clans.length) {
		//   const diff = (arr1, arr2) => arr1.filter(item => !arr2.includes(item));
		//   const change = { added: diff(clans, clanListCache), missing: diff(clanListCache, clans) };
		//   //TODO Update caches
		//   //Atleast DM me on discord, should happen very rarely
		//   console.log(`added:${change.added} \nmissing:${change.missing}`)
		// }

		// If clanMembersCache is not populated yet, populate from DB
		if (clanMembersCache.length == 0) {
			const getMemberListPromises = [];
			clanListCache.forEach(clanTag => getMemberListPromises.push(databaseRepository.getLastKnownMembersListData(clanTag, database)));
			if (getMemberListPromises.length == 0) {
				console.error('init clanMembers cache failed, getMembers didn\'t return any promises');
				return;
			}
			const clanMembersData = await Promise.all(getMemberListPromises);
			if (!clanMembersData || clanMembersData.length == 0) {
				console.error('init clanMembers cache failed, get members data didn\'t get resolved');
				return;
			}
			clanMembersData.forEach(clanDataSnap => {
				const clanData = clanDataSnap.val();
				clanMembersCache.push({
					members: clanData.members,
					clan: clanData.clan,
				});
			});
		}

		// Get change in member list in last 1 minute
		const getMemberListPromises = [];
		const dirtyMembersData = [];
		const dirtyMembersClanTag = [];
		clanListCache.forEach(clan => getMemberListPromises.push(membersDataHelper.getMembers(clan)));
		if (getMemberListPromises.length == 0) {
			console.error('find change failed, getMembers didn\'t return any promises');
			return;
		}
		const clanMembersData = await Promise.all(getMemberListPromises);
		if (!clanMembersData || clanMembersData.length == 0) {
			console.error('find change failed, get members data didn\'t get resolved');
			return;
		}
		clanMembersData.forEach(clanData => {
			const clanTag = clanData.request.path.split('/')[3].replace('%23', '#');
			const changeInMemberList = (oldList, newList) => {
				const diff = (arr1, arr2) => arr1.filter(item => !arr2.includes(item));
				return { joined: diff(newList, oldList), left: diff(oldList, newList) };
			};
			const memberList = clanData.data.items.map(member => member.tag);
			const cachedList = clanMembersCache.find(item => item.clan == clanTag).members;
			if (!cachedList) {
				console.error(`failed to find cached members list for clan tag ${clanTag}`);
				return;
			}
			const { joined, left } = changeInMemberList(cachedList, memberList);
			if (joined.length != 0 || left.length != 0) {
				console.log(`joined:${joined} \nleft:${left}`);
				if (flags.isLegacyInOutLogEnabled) {
					if (joined.length != 0) {joined.forEach(player => legacySendInOutMessage('Joined', player, clanTag));}
					if (left.length != 0) {left.forEach(player => legacySendInOutMessage('Left', player, clanTag));}
				}
				if (flags.isInLogEnabled) {
					if (joined.length != 0) {joined.forEach(player => sendInEmbed(player, clanTag));}
				}
				if (flags.isOutLogEnabled) {
					if (left.length != 0) {left.forEach(player => sendOutEmbed(player, clanTag));}
				}
				dirtyMembersData.push({
					members: memberList,
					clan: clanTag,
				});
				dirtyMembersClanTag.push(clanTag);
			}
		});

		// Update cache to clear dirty fields
		if (dirtyMembersClanTag.length != 0) {
			const unchangedClans = clanMembersCache.filter(clanMembers => !dirtyMembersClanTag.includes(clanMembers.clan));
			dirtyMembersData.forEach(data => {
				unchangedClans.push(data);
				databaseRepository.setLastKnownMembersListData(data, database);
			});
			clanMembersCache = unchangedClans;
		}

		// log success
		const currentTimestamp = Date.now();
		const timeSinceLastSuccess = lastInOutCronSuccessTimestamp == -1 ? 0 : Math.round((currentTimestamp - lastInOutCronSuccessTimestamp) / 1000);
		if (timeSinceLastSuccess > 100 || timeSinceLastSuccess < 0)
			console.info(timeSinceLastSuccess + ' in-out cron seems to have skipped some runs, please check');
		lastInOutCronSuccessTimestamp = currentTimestamp;
	});

	const legacySendInOutMessage = async (change, playerTag, clan) => {
		try {
			if (!playerTag || playerTag == '') {return;}
			const response = await playerDataHelper.getPlayerData(playerTag);
			const playerDetails = response.data;
			if (!(channelIds && channelIds.LEGACY_IN_OUT_LOG_CHANNEL_ID)) {
				console.log('No channels defined for in-out log');
				return false;
			}
			const channel = await client.channels.fetch(channelIds.LEGACY_IN_OUT_LOG_CHANNEL_ID);
			channel.send(`[${clanCodeByKeyCache[clan.substring(1)] || 'Clan Code NA'}] This player has ${change}: ${playerDetails.name}.`);
			console.log(`[${clanCodeByKeyCache[clan.substring(1)] || 'Clan Code NA'}] This player has ${change}: ${playerDetails.name}.`);
		}
		catch (error) {
			console.error('Legacy in-out send message failed\nerror:' + error);
			console.info(`Params: change:${change};playerTag:${playerTag};clan:${clan}` + error);
			return false;
		}
	};

	const sendInEmbed = async (playerTag, clanTag) => {
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
						.map(raceStats => `${raceStats.fame || raceStats.contribution || 'NA'}(${timePassedBetweenTwoMillisecondTimestamps(raceStats.log_created_date_dt * 1000, date) || 'NA'})`)
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
						databaseRepository.getToKickPlayerTagsByClan(database).then(data => {
							let toKickListData = data.val();
							if (toKickListData && toKickListData.length !== 0)
								toKickListData = [...toKickListData, playerTag];
							else
								toKickListData = [ playerTag ];
							databaseRepository.setToKickPlayerTagsByClan(clanTag, toKickListData, database);
						}).catch(error => console.error(`[IN-LOG] Something went wrong while saving kick list data. \nerror: ${error}`));
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

	const sendOutEmbed = async (playerTag, clanTag) => {
		try {
			const baseChannelIdKey = 'OUT_LOG_CHANNEL_ID';
			const channelIdKey = `${baseChannelIdKey}_${clanCodeByKeyCache[clanTag.substring(1)]}`;
			if (!playerTag || playerTag == '') {return false;}
			const response = await playerDataHelper.getPlayerData(playerTag);
			const playerDetails = response.data;
			if (!(channelIds && channelIds[channelIdKey])) {
				console.log('No channels defined for out-log');
				return false;
			}
			const channel = await client.channels.fetch(channelIds[channelIdKey]);
			const playerLeftEmbed = new MessageEmbed()
				.addFields(
					{ name: 'King Level', value: `${playerDetails.expLevel ?? 'Player Level NA'}`, inline: true },
					{ name: 'Current Trophies', value: `${playerDetails.trophies ?? 'Player Trophies NA'}`, inline: true },
				)
				.setColor(embedBannerColours.COLOUR_RED)
				.setTitle(`[${clanCodeByKeyCache[clanTag.substring(1)] || 'Clan Code NA'}] -> ${playerDetails.name || 'Player Name NA'} (Kicked by: NA)`)
				.setDescription('War contribution details are in this format\nSeason ID [...Week number(time passed)]\n...Section contribution(section decks used)')
				.setURL(`${ROYALE_API_BASE_URL}player/${playerTag.substring(1)}`)
				.setTimestamp();

			const clanWar2History = await getClanWars2History(rApiToken, playerTag, playerDetails.name);
			if (clanWar2History) {
				if (!clanWar2History.success || clanWar2History.rows.length == 0 || !clanWar2History.rows.some(rs => rs.clan_tag == clanTag.substring(1))) {
					playerLeftEmbed
						.addFields(
							{ name: 'Races', value: `${clanWar2History.rows.length ? 'NA' : '0'}`, inline: true },
							// { name: 'CW2 Last 10', value: 'NA(0)', inline: true },
							// { name: 'CW2 Best 10', value: 'NA(0)', inline: true },
							// { name: 'CW2 Worst 10', value: 'NA(0)', inline: true },
							// { name: 'Recommended action (*not reliable for stale timelines)', value: 'We don\'t have enough data on this player to make a prediction.', inline: false },
						);
					clanWar2History.success || console.error(`Out log, get clan war 2 history succeeded but success flag is:${clanWar2History.success}, rows: ${clanWar2History.rows.length}, pTag: ${playerTag}`);
				}

				else {
					// Overall
					const filteredClanWar2History = clanWar2History.rows
						.filter(raceStats => raceStats.clan_tag == clanTag.substring(1));
					// const contributions = clanWar2History.rows
					// 	.filter(raceStats => raceStats.clan_tag == clanTag.substring(1))
					// 	.map(raceStats => raceStats.fame || raceStats.contribution);
					const totalRecordsFound = filteredClanWar2History.length;
					// const totalFame = contributions.reduce((sum, fame) => sum + fame, 0);
					// const overallAverage = Math.ceil(totalFame / totalRecordsFound);
					const date = Date.now();
					const timeline = filteredClanWar2History
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

					// // Last 10 records
					// const lastTenContributions = contributions.slice(0, 10);
					// const lastTenTotalRecordsFound = lastTenContributions.length;
					// const lastTenTotalFame = lastTenContributions.reduce((sum, fame) => sum + fame, 0);
					// const lastTenOverallAverage = Math.ceil(lastTenTotalFame / lastTenTotalRecordsFound);

					// // Best 10 records
					// const bestTenContributions = contributions.sort((a, b) => b - a).slice(0, 10);
					// const bestTenTotalRecordsFound = bestTenContributions.length;
					// const bestTenTotalFame = bestTenContributions.reduce((sum, fame) => sum + fame, 0);
					// const bestTenOverallAverage = Math.ceil(bestTenTotalFame / bestTenTotalRecordsFound);

					// // Worst 10 records
					// const worstTenContributions = contributions.sort((a, b) => a - b).slice(0, 10);
					// const worstTenTotalRecordsFound = worstTenContributions.length;
					// const worstTenTotalFame = worstTenContributions.reduce((sum, fame) => sum + fame, 0);
					// const worstTenOverallAverage = Math.ceil(worstTenTotalFame / worstTenTotalRecordsFound);

					// // Find correct banner colour and recommendation message
					// let bannerColour = embedBannerColours.COLOUR_DEFAULT;
					// let recommendationMessage = 'NA';
					// if (lastTenTotalRecordsFound <= 5) {
					// 	bannerColour = embedBannerColours.COLOUR_ORANGE;
					// 	recommendationMessage = `We don't have enough data on this player to make a prediction. (Only ${lastTenTotalRecordsFound} records found)`;
					// }
					// else if (lastTenOverallAverage < 800) {
					// 	bannerColour = embedBannerColours.COLOUR_RED;
					// 	recommendationMessage = 'CW2 score is too low, player should be kicked out.';
					// 	databaseRepository.getToKickPlayerTagsByClan(database).then(data => {
					// 		let toKickListData = data.val();
					// 		if (toKickListData && toKickListData.length !== 0)
					// 			toKickListData = [...toKickListData, playerTag];
					// 		else
					// 			toKickListData = [ playerTag ];
					// 		databaseRepository.setToKickPlayerTagsByClan(clanTag, toKickListData, database);
					// 	}).catch(error => console.error(`[IN-LOG] Something went wrong while saving kick list data. \nerror: ${error}`));
					// }
					// else if (lastTenOverallAverage >= 800 && lastTenOverallAverage < 1400) {
					// 	bannerColour = embedBannerColours.COLOUR_YELLOW;
					// 	recommendationMessage = 'Player\'s CW2 score is not very promising, monitor for 1-2 weeks then kick if they are missing battles frequently.';
					// }
					// else if (lastTenOverallAverage >= 1400 && lastTenOverallAverage < 2000) {
					// 	bannerColour = embedBannerColours.COLOUR_DULL_GREEN;
					// 	recommendationMessage = 'Decent CW2 score, we should retain the player.';
					// }
					// else if (lastTenOverallAverage >= 2000 && lastTenOverallAverage < 2600) {
					// 	bannerColour = embedBannerColours.COLOUR_BRIGHT_GREEN;
					// 	recommendationMessage = 'Very good CW2 history, we should retain the player.';
					// }
					// else {
					// 	bannerColour = embedBannerColours.COLOUR_PURPLE;
					// 	recommendationMessage = 'Exceptional CW2 history, expected to boost our clan performance significantly.';
					// }

					playerLeftEmbed
						.addFields(
							{ name: 'Races', value: totalRecordsFound, inline: true },
							// { name: 'CW2 Last 10', value: lastTenTotalRecordsFound != 0 ? `${lastTenOverallAverage} (${lastTenTotalRecordsFound})` : 'NA(0)', inline: true },
							// { name: 'CW2 Best 10', value: bestTenTotalRecordsFound != 0 ? `${bestTenOverallAverage} (${bestTenTotalRecordsFound})` : 'NA(0)', inline: true },
							// { name: 'CW2 Worst 10', value: worstTenTotalRecordsFound != 0 ? `${worstTenOverallAverage} (${worstTenTotalRecordsFound})` : 'NA(0)', inline: true },
							{ name: 'Timeline of contributed races', value: timeline, inline: false },
							// { name: 'Recommended action (*not reliable for stale timelines)', value: recommendationMessage, inline: false },
						);

					const groupedSeasonStats = groupBySeasons(filteredClanWar2History);
					const latestFiveSeasonStats = Object.keys(groupedSeasonStats).sort((a, b) => b - a).slice(0, 5);
					latestFiveSeasonStats?.forEach(seasonStats => {
						const sections = Object.keys(groupedSeasonStats[seasonStats]);
						if (sections.length == 0)
							return;
						playerLeftEmbed.addField(
							`${seasonStats} [${sections.map(s => `${Number(s) + 1} (${groupedSeasonStats[seasonStats]?.[s]?.timePassed ?? 'NA'})`)?.join(', ')}]`,
							sections.map(s => `${groupedSeasonStats[seasonStats]?.[s]?.fame ?? 'NA'}(${groupedSeasonStats[seasonStats]?.[s]?.decksUsed ?? 'NA'})`)?.join(', '),
							false,
						);
					});
				}
			}
			else {
				playerLeftEmbed
					.setColor(embedBannerColours.COLOUR_ORANGE)
					.addField('Something went wrong', 'Failed to fetch player info, title of this message links to this player\'s profile on RoyaleAPI, click on that to get details about this player', false);
			}
			channel.send(playerLeftEmbed);
			console.log(`${playerDetails.name} has left ${clanCodeByKeyCache[clanTag.substring(1)] || 'Clan Code NA'}`);
		}
		catch (error) {
			console.error('out log send embed failed\nerror:' + error);
			console.info(`Params: change:Left;playerTag:${playerTag};clanTag:${clanTag}` + error);
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
};
