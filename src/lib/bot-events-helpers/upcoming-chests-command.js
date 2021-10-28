// to run script: node -r dotenv/config ./src/lib/bot-events-helpers/upcoming-chests-command.js
const { MessageEmbed } = require('discord.js');
const playerUpcomingChestsDataHelper = require('../clash-royale-api-helpers/player-upcoming-chests-helper');
const { createSyntaxErrorHelpEmbed } = require('../utils/genericEmbeds');
const {
	getDiscordIdToCrAccountsMap,
} = require('../database-helpers/database-repository');

const ROYALE_API_PLAYER_PROFILE_BASE_URL = 'https://royaleapi.com/player/';

const CURRENT_CHEST_TYPES = {
	'Golden_Chest': '901911638792351804',
	'Silver_Chest': '901913413838585877',
	'Gold_Crate': '901911639450878023',
	'Plentiful_Gold_Crate': '901911640558149683',
	'Overflow_Gold_Crate': '901911640558149683',
	'Giant_Chest': '901911640394575972',
	'Magical_Chest': '901911639857717298',
	'Legendary_Chest': '901911638796562432',
	'Epic_Chest': '901911640612691978',
	'Mega_Lightning_Chest': '901911639736090634',
	'Lightning_Chest': '901911639979348099',
	'Info_Icon_For_Undefined': '893819306763239524',
};

const sendChestsEmbed = async (message, playerTag, upcomingChestsData) => {
	try {
		const upcomingChests = upcomingChestsData.map(chest => {
			const formattedName = chest.name.replace(/\s/g, '_');
			const chestEmojiId = CURRENT_CHEST_TYPES[formattedName] || CURRENT_CHEST_TYPES['Info_Icon_For_Undefined'];
			return `<:emoji:${chestEmojiId}> **${chest.index + 1}**`;
		});
		const UpcomingChestsEmbed = new MessageEmbed()
			.setColor('#ae00ff')
			.setTitle(`Upcoming Chests for: ${playerTag}`)
			.setURL(`${ROYALE_API_PLAYER_PROFILE_BASE_URL}${playerTag.substring(1)}`)
			.addField('Chests', `${upcomingChests.join(' ')}`, false)
			.setTimestamp();

		await message.channel.send(UpcomingChestsEmbed);
		return true;
	}
	catch (error) {
		console.error('send upcoming chest embed failed, check, \nerror:' + error);
		return message.reply('Whoops! Something went wrong, please try again, report to admin if the problem persists.');
	}
};

const getPlayerTagsLinkedToDiscordAccountOrFault = async (message, discordId, database, verificationChannelId) => {
	const discordIdToCrAccountsMapPromise = await getDiscordIdToCrAccountsMap(database);
	const discordIdToCrAccountsMap = discordIdToCrAccountsMapPromise.val();
	const linkedCrAccountsForThisUser = discordIdToCrAccountsMap ? discordIdToCrAccountsMap[discordId] : null;
	if (!linkedCrAccountsForThisUser) {
		message.reply(`Please go to <#${verificationChannelId}> and run \`$verify [playerTag]\` to associate your player tags with your Discord account first.`);
		return false;
	}
	return linkedCrAccountsForThisUser;
};

const upcomingChestsOrFault = async (message, args, database, verificationChannelId) => {
	const syntaxObject = {
		syntax: '$chests',
		usages: {
			chests: {
				useCase: 'To get upcoming chest details for your linked account(s)',
				syntax: '$chests',
			},
		},
	};

	// check syntax and send proper syntax if invalid
	if (args.length != 0) {
		const syntaxEmbed = createSyntaxErrorHelpEmbed(syntaxObject.syntax, syntaxObject.argumentList, syntaxObject.usages);
		await message.channel.send(syntaxEmbed);
	}

	if (args.length === 0) {
		const linkedPlayerTags = await getPlayerTagsLinkedToDiscordAccountOrFault(message, message.author.id, database, verificationChannelId);
		if (!linkedPlayerTags)
			return;
		for (const playerTag of linkedPlayerTags) {
			try {
				const { data: upcomingChestsData } = await playerUpcomingChestsDataHelper.getPlayerUpcomingChestsData(playerTag);
				await sendChestsEmbed(message, playerTag, upcomingChestsData.items);
			}
			catch (error) {
				console.error('get player upcoming chests data likely failed, check, \nerror:' + error);
				return message.reply('Whoops! Something went wrong, please try again, report to admin if the problem persists.');
			}
		}
	}
};

module.exports = { upcomingChestsOrFault };
