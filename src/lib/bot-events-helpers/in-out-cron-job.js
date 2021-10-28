const databaseRepository = require('../database-helpers/database-repository');
const membersDataHelper = require('../clash-royale-api-helpers/members-data-helper');
const playerDataHelper = require('../clash-royale-api-helpers/player-data-helper');
const cron = require('node-cron');
const { MessageEmbed } = require('discord.js');

exports.startInOutLogCronEachMinute = (database, client, channelIds, flags) => {
	const clanListCache = [ '#2PYUJUL', '#P9QQVJVG' ];
	let clanMembersCache = [];
	let lastInOutCronSuccessTimestamp = -1;
	// const clanNameByKeyCache = {
	// 	'#2PYUJUL': 'ROYAL WARRIORS!',
	// 	'#P9QQVJVG': 'HARAMI_CLASHERS',
	// };
	const clanCodeByKeyCache = {
		'#2PYUJUL': 'RW',
		'#P9QQVJVG': 'HC',
	};
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
			channel.send(`[${clanCodeByKeyCache.clanTag || 'Clan Code NA'}] This player has ${change}: ${playerDetails.name}.`);
			console.log(`[${clanCodeByKeyCache.clanTag || 'Clan Code NA'}] This player has ${change}: ${playerDetails.name}.`);
		}
		catch (error) {
			console.error('Legacy in-out send message failed\nerror:' + error);
			console.info(`Params: change:${change};playerTag:${playerTag};clan:${clan}` + error);
			return false;
		}
	};

	const sendInEmbed = async (playerTag, clanTag) => {
		try {
			if (!playerTag || playerTag == '') {return false;}
			const response = await playerDataHelper.getPlayerData(playerTag);
			const playerDetails = response.data;
			if (!(channelIds && channelIds.IN_LOG_CHANNEL_ID)) {
				console.log('No channels defined for in-log');
				return false;
			}
			const channel = await client.channels.fetch(channelIds.IN_LOG_CHANNEL_ID);
			const playerJoinedEmbed = new MessageEmbed()
				.setColor('#15f501')
				.setTitle(playerDetails.name || 'Player Name NA')
				.setDescription(`${playerDetails.name} has joined ${clanCodeByKeyCache.clanTag || 'Clan Code NA'}`)
				.setURL(`${ROYALE_API_BASE_URL}player/${playerTag.substring(1)}`)
				// .addFields(
				// 	{ name: 'Discord User', value: `${discordUserName}`, inline: true },
				// 	{ name: 'Player Tag', value: `${playerTag}`, inline: true },
				// 	{ name: 'Deck Link', value: `[Copy Deck](${deckLink})`, inline: true },
				// 	{ name: 'Deck', value: deckCardNames, inline: false },
				// 	// { name: 'Avg. Elixir', value: '3.0', inline: true },
				// )
				.setTimestamp();
			channel.send(playerJoinedEmbed);
			console.log(`${playerDetails.name} has joined ${clanCodeByKeyCache.clanTag || 'Clan Code NA'}`);
		}
		catch (error) {
			console.error('in log send embed failed\nerror:' + error);
			console.info(`Params: change:Join;playerTag:${playerTag};clanTag:${clanTag}` + error);
			return false;
		}
	};

	const sendOutEmbed = async (playerTag, clanTag) => {
		try {
			if (!playerTag || playerTag == '') {return false;}
			const response = await playerDataHelper.getPlayerData(playerTag);
			const playerDetails = response.data;
			if (!(channelIds && channelIds.IN_LOG_CHANNEL_ID)) {
				console.log('No channels defined for in-log');
				return false;
			}
			const channel = await client.channels.fetch(channelIds.OUT_LOG_CHANNEL_ID);
			const playerLeftEmbed = new MessageEmbed()
				.setColor('#15f501')
				.setTitle(playerDetails.name || 'Player Name NA')
				.setDescription(`${playerDetails.name} has left ${clanCodeByKeyCache.clanTag || 'Clan Code NA'}`)
				.setURL(`${ROYALE_API_BASE_URL}player/${playerTag.substring(1)}`)
				// .addFields(
				// 	{ name: 'Discord User', value: `${discordUserName}`, inline: true },
				// 	{ name: 'Player Tag', value: `${playerTag}`, inline: true },
				// 	{ name: 'Deck Link', value: `[Copy Deck](${deckLink})`, inline: true },
				// 	{ name: 'Deck', value: deckCardNames, inline: false },
				// 	// { name: 'Avg. Elixir', value: '3.0', inline: true },
				// )
				.setTimestamp();
			channel.send(playerLeftEmbed);
			console.log(`${playerDetails.name} has left ${clanCodeByKeyCache.clanTag || 'Clan Code NA'}`);
		}
		catch (error) {
			console.error('in log send embed failed\nerror:' + error);
			console.info(`Params: change:Left;playerTag:${playerTag};clanTag:${clanTag}` + error);
			return false;
		}
	};
};