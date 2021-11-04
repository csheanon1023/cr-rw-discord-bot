// to run script: node -r dotenv/config ./src/lib/bot-events-helpers/to-kick-list-cron-job.js
const { MessageEmbed } = require('discord.js');
const databaseRepository = require('../database-helpers/database-repository');
const membersDataHelper = require('../clash-royale-api-helpers/members-data-helper');
const cron = require('node-cron');

const messageEmbedByClan = {
	'2PYUJUL': {
		id: '905913670633160706',
		messageObject: null,
	},
	'P9QQVJVG': {
		id: '905913672155672586',
		messageObject: null,
	},
};

const toKickBoardChannel = {
	channelObject: null,
};
const clanListCache = [ '#2PYUJUL', '#P9QQVJVG' ];

const clanCodeByKeyCache = {
	'2PYUJUL': 'RW',
	'P9QQVJVG': 'HC',
};

// Mock data
const memberList = {
	'2PYUJUL' : {
		'clan' : '#2PYUJUL',
		'members' : [ '#PQVV898P2', '#GVQGRL9U', '#U80J98P2', '#8RL8C9YCJ', '#YV9JQYP08', '#22QUVQPGQ', '#8P89Q8Y9Y', '#GYUQV0J2J', '#G2C2YL2JR', '#PQ9G08C0', '#PL29G9Q92', '#Q0V9V2GGG', '#28V2GV2YY', '#YYRLRRV90', '#2G829C8P', '#RGQYUY9QQ', '#RUGJGGJR8', '#GQPQGUYJ2', '#8LVCYJUCY', '#9JRPG8999', '#9RQYCCQJ2', '#2QCCV9U', '#QVP0JRV0', '#GG9CQR8LY', '#Q0JJ99GYY', '#JR2RJYU8P', '#LVUY02VGR', '#28JRYR8L0', '#LLYV8UVUJ', '#8YY8U892G', '#RQPLUQC9C', '#QVCGQ0Q09', '#98UVG0CVP', '#2UUQ08PLV', '#G2QVG89YL', '#GGUCCLC0C', '#8QRVYJ99R', '#CP2GCUL', '#QP0J8CPYR', '#LRVLGYV0J', '#2QY00UPCY', '#LUJP2VUG8', '#90GP8GUCC', '#8G89VU9YC', '#CG22RLJ0', '#GUGUYUQYP', '#RCR088J28', '#28PPCCR2Y', '#PUP29VGR8' ],
	},
	'P9QQVJVG' : {
		'clan' : '#P9QQVJVG',
		'members' : [ '#YL9YY9Y8', '#9UVRC9LC0', '#99VUQP2VJ', '#QQ0GJ8UPV', '#280LYRYP', '#RR9YVJRUG', '#90G8LQGV8', '#GYYJ8VQ0', '#2Y0Q0UGCC', '#2Q8RVPC22', '#98Q0VCQLL', '#J2LL9P8L8', '#PJ9V2VGRQ', '#RGUJ000Q8', '#LQ08VURJG', '#LLQJ20UQV', '#RPUVR2VGG', '#8QP8Q8R0Y', '#RV9Y29Q00', '#2LLYG0UV', '#2U2JV0JUR', '#RRGJPPQL9', '#V8UVGJYV', '#J0ULRCVRJ', '#P8V2CGYV9', '#G9VR9LU0', '#LL98CRC88', '#90LQ0RQC9', '#QQP80JURP', '#RUUCL0R', '#J90CJ9VYY', '#22Y0JVC29', '#828VR002V', '#9URCVU9RC', '#Y8LCY00UQ', '#22YLUCGY9', '#QCULVGQQR', '#8UC0CQRVY', '#999CLCY2C', '#9Q90Y8CUU', '#PVQPL9GV8', '#RULJG0VG9', '#R808GC8LC', '#RPGLGRUU2', '#RJ8920LP9', '#92LJYYRJ2', '#RY9P8P0PJ' ],
	},
};

const toKickPlayerTagsByClan = {
	'2PYUJUL': ['#PQVV898P2', '#GVQGRL9U', '#U80J98P2', '#8RL8C9YCJ', '#YV9JQYP08', '#22QUVQPGQ'],
	'P9QQVJVG': ['#YL9YY9Y8', '#9UVRC9LC0', '#99VUQP2VJ', '#QQ0GJ8UPV', '#280LYRYP', '#RR9YVJRUG'],
};

const kickingTeamMemberPendingKicks = {
	'2PYUJUL' : {
		'PQVV898P2': '#YV9JQYP08',
		'U80J98P2': '#YV9JQYP08',
		'YV9JQYP08': '#YV9JQYP08',
		'22QUVQPGQ': '#LVUY02VGR',
	},
	'P9QQVJVG' : {
		'9UVRC9LC0': '#G9VR9LU0',
		'99VUQP2VJ': '#RY9P8P0PJ',
		'QQ0GJ8UPV': '#RY9P8P0PJ',
		'RR9YVJRUG': '#G9VR9LU0',
	},
};

const clanTeams = {
	'2PYUJUL': {
		'kicking': ['#YV9JQYP08', '#LVUY02VGR', '#2G829C8P'],
		'boat': ['#22QUVQPGQ', '#GQPQGUYJ2', '#2G829C8P'],
		'promotions': ['#8RL8C9YCJ', '#Q0JJ99GYY', '#2G829C8P'],
	},
	'P9QQVJVG': {
		'kicking': ['#RY9P8P0PJ', '#QCULVGQQR', '#G9VR9LU0'],
		'boat': ['#RY9P8P0PJ', '#QCULVGQQR', '#G9VR9LU0'],
		'promotions': ['#RY9P8P0PJ', '#QCULVGQQR', '#G9VR9LU0'],
	},
};

const onLeaveMembersByClan = [];

const scheduleCronToRefreshKickingBoardData = (database, client, channelIds) => {
	// At every 5th minute [offset 15]
	// cron.schedule('15 */5 * * * *', async () => {
	cron.schedule('15,30,45 * * * * *', async () => {
		for (const clanTag of clanListCache) {
			try {
				// TODO get from DB
				let clanToKickPlayerTagsByClan = toKickPlayerTagsByClan[clanTag.substring(1)];
				const clanKickingTeamMemberPendingKicks = kickingTeamMemberPendingKicks[clanTag?.substring(1)];

				// get the current clan members and check against that
				const clanMemberList = memberList?.[clanTag.substring(1)]?.members;
				clanToKickPlayerTagsByClan = clanToKickPlayerTagsByClan.filter(playerTag => clanMemberList.includes(playerTag));
				Object.keys(clanKickingTeamMemberPendingKicks).forEach(playerTag => {
					if (!clanMemberList.includes(`#${playerTag}`))
						delete clanKickingTeamMemberPendingKicks[playerTag];
				});
				clanToKickPlayerTagsByClan = clanToKickPlayerTagsByClan.filter(playerTag => clanMemberList.includes(playerTag));

				// check in kicking team member pending kicks list if not assigned, add assignment
				for (const playerTag of clanToKickPlayerTagsByClan) {
					if (Object.hasOwnProperty.call(clanKickingTeamMemberPendingKicks, playerTag?.substring(1)))
						continue;
					const randomlyAssignedTeamMember = await findRandomTeamMemberToAssign(clanTeams?.[clanTag?.substring(1)]?.['kicking'] || [], clanTag);
					clanKickingTeamMemberPendingKicks[playerTag?.substring(1)] = randomlyAssignedTeamMember;
				}

				// update the DB


				// update|send the embed
				const clanKickBoardEmbed = new MessageEmbed()
				// COLOUR_RED
					.setColor('#f52700')
					.setTitle(`[${clanCodeByKeyCache[clanTag.substring(1)] || 'Clan Code NA'}] - Kick these players!`)
					.setTimestamp();

				// TODO put player details
				const groupedByAssignee = Object.keys(clanKickingTeamMemberPendingKicks).length != 0 ?
					Object.entries(clanKickingTeamMemberPendingKicks)
						.reduce((grouped, [key, value]) => {
							if (grouped?.[value]?.length != 0)
								grouped[value] = [ `#${key}` ];
							grouped[value] = [...grouped[value], `#${key}`];
							return grouped;
						}, {})
					: {};
				for (const assigneeTag in groupedByAssignee) {
					clanKickBoardEmbed.addField(assigneeTag, groupedByAssignee[assigneeTag].join(', '), false);
				}

				// When the channel doesn't have a message for this clan
				if (!messageEmbedByClan?.[clanTag.substring(1)]?.id) {
					if (toKickBoardChannel?.id != channelIds.toKickBoardChannelId) {
						toKickBoardChannel.channelObject = await client.channels.fetch(channelIds.toKickBoardChannelId);
					}
					// send a new message andregister the ID
					const message = await toKickBoardChannel.channelObject.send(clanKickBoardEmbed);
					messageEmbedByClan[clanTag.substring(1)].id = message.id;
					messageEmbedByClan[clanTag.substring(1)].messageObject = message;
				}

				// when message object for this clan is not available or the id doesn't match the saved one
				else if (messageEmbedByClan?.[clanTag.substring(1)]?.messageObject?.id != messageEmbedByClan?.[clanTag.substring(1)]?.id) {
					// fetch
					if (toKickBoardChannel?.id != channelIds.toKickBoardChannelId) {
						toKickBoardChannel.channelObject = await client.channels.fetch(channelIds.toKickBoardChannelId);
					}
					messageEmbedByClan[clanTag.substring(1)].messageObject = await toKickBoardChannel?.channelObject?.messages?.fetch(messageEmbedByClan?.[clanTag.substring(1)]?.id);
					messageEmbedByClan[clanTag.substring(1)].messageObject.edit(clanKickBoardEmbed);
				}

				else
					messageEmbedByClan[clanTag.substring(1)].messageObject.edit(clanKickBoardEmbed);
			}
			catch (error) {
				console.error(`Something failed clanTag: ${clanTag}\n${error}`);
				return false;
			}
		}
	});
};

const findRandomTeamMemberToAssign = async (teamMembersTags, clanTag) => {
	try {
		if (teamMembersTags?.length == 0) {
			// TODO get leader of the clan and assign it to him and return
		}
		// TODO get members on leave
		let filteredTeamMembersTags = [];
		if (onLeaveMembersByClan?.length != 0)
			filteredTeamMembersTags = teamMembersTags.filter(teamMemberTag => !onLeaveMembersByClan.includes(teamMemberTag));
		if (filteredTeamMembersTags?.length == 0)
			return teamMembersTags[Math.floor((Math.random() * 100) % teamMembersTags.length)];
		return filteredTeamMembersTags[Math.floor((Math.random() * 100) % filteredTeamMembersTags.length)];
	}
	catch (error) {
		console.error(`Something failed \n${error}`);
		return false;
	}
};

module.exports = { scheduleCronToRefreshKickingBoardData };
const { Client } = require('discord.js');

(async () => {
	const client = new Client({
		partials: ['MESSAGE', 'REACTION'],
	});
	await client.login(process.env.DISCORDJS_BOT_TOKEN);
	scheduleCronToRefreshKickingBoardData(null, client, { toKickBoardChannelId: '905514122827948042' });
})();