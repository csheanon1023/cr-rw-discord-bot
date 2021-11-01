const membersDataHelper = require('../clash-royale-api-helpers/members-data-helper');
const playerDataHelper = require('../clash-royale-api-helpers/player-data-helper');

exports.getMembersByLevel = async (message, args, accessLevel) => {
	const clanCodes = {
		'rw': '#2PYUJUL',
		'hc': '#P9QQVJVG',
	};
	const memberRoles = await message.member.roles.cache;
	let flag = false;
	accessLevel.forEach(roleId => {
		if (memberRoles.get(roleId)) {flag = true;}
	});

	// Validations
	if (!flag) {return message.reply('Whoops! Looks like you are not authorized to use this command.');}
	if (args.length != 2) {return message.reply('Please specify clan code and level!');}
	if (args[1] < 1 || args[1] > 14) {return message.reply('Level should be between 1-14!');}
	if (!Object.keys(clanCodes)?.includes(args[0].toLowerCase())) {return message.reply(`Please check the clan code! Valid codes are ${clanCodes.keys.join(',')}`);}

	// Get and process data
	const allPlayers = await membersDataHelper.getMembers(clanCodes[args[0]]);
	const filteredByLevel = membersDataHelper.getMembersByLevel(allPlayers.data.items, args[1]);
	if (filteredByLevel == null || filteredByLevel == '') {return message.reply(`There are no level ${args[1]} players`);}
	const responseData = [];
	for (let index = 0; index < filteredByLevel.length; index++) {
		const res = await playerDataHelper.getPlayerData(filteredByLevel[index].tag);
		const playerData = res.data;
		responseData.push(formatPlayerData(playerData));
	}
	message.reply('Here\'s the data you requested:\n');
	responseData.forEach(res => message.channel.send(`\`\`\`\n${res}\n\`\`\``));
};

const formatPlayerData = (playerData) => {
	// Normalize card levels
	const playerCards = playerData.cards;
	playerCards.forEach(card => {
		card.level = card.level + (13 - card.maxLevel);
	});

	// Compute the other cards with the same level as lowest level in top 12 but didn't make the top 12
	playerCards.sort((a, b) => b.level - a.level);
	const lowerLevelCount = playerCards[11].level;
	const groupedByLevel = {};
	const otherCardsWithSameLevel = [];
	for (let i = 0; i < playerCards.length; i++) {
		const card = playerCards[i];
		if (i < 12) {
			if (groupedByLevel[card.level] == null) {groupedByLevel[card.level] = [];}
			groupedByLevel[card.level].push(card.name);
			continue;
		}
		if (card.level == lowerLevelCount) {otherCardsWithSameLevel.push(card.name);}
		else {break;}
	}

	const firstLine = `${playerData.name} ${playerData.tag}`;
	const tableHead = 'level count';
	const list = [];
	const keysOfGroupedByLevel = Object.keys(groupedByLevel).sort((a, b) => a - b);
	keysOfGroupedByLevel.forEach(level => {
		const cards = groupedByLevel[level];
		list.push(`${String(level).padStart(5)} ${String(cards.length).padStart(5)}`);
	});
	keysOfGroupedByLevel.forEach(level => {
		const cards = groupedByLevel[level];
		list.push(`${String(level).padEnd(4)}: ${cards.join(',')}`);
	});

	return `${firstLine}\n${tableHead}\n${list.join('\n')}\nOther Cards at levle ${lowerLevelCount}: ${otherCardsWithSameLevel.join(', ')}`;
};