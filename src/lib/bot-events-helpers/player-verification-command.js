// to run script: node -r dotenv/config ./src/lib/bot-events-helpers/player-verification-command.js
const { Client, MessageEmbed } = require('discord.js');
const Jimp = require('jimp');
const playerDataHelper = require('../clash-royale-api-helpers/player-data-helper');

const generateRandomDeck = async (playerTag) => {
	const response = await playerDataHelper.getPlayerData(playerTag);
	const cards = response?.data?.cards;
	const DECK_LINK_BASE_URL = 'https://link.clashroyale.com/deck/en?deck=';
	const totalCards = cards.length;
	const returnObject = {};
	const cardSet = new Set();
	while (cardSet.size != 8) {
		const randomNumber = Math.floor(Math.random() * totalCards);
		cardSet.add(cards[randomNumber]);
	}
	const cardArray = [...cardSet];
	returnObject.deckLink = DECK_LINK_BASE_URL + cardArray.map(card => card.id).join(';');
	returnObject.cardImageUrls = cardArray.map(card => card.iconUrls.medium);
	returnObject.deckCardNames = cardArray.map(card => card.name).join(', ');

	return returnObject;
};

const createVerificationDeckEmbed = (filename, deckCardNames, deckLink, playerTag, discordUserName) => {
	const verificatioDeckEmbed = new MessageEmbed()
		.setColor('#ae00ff')
		.setTitle('Player Verification')
		.setDescription('Use this deck in a battle and reply in here with `!verify` to complete verification')
		.addFields(
			{ name: 'Discord User', value: `${discordUserName}`, inline: true },
			{ name: 'Player Tag', value: `${playerTag}`, inline: true },
			{ name: 'Deck Link', value: `[Copy Deck](${deckLink})`, inline: true },
			{ name: 'Deck', value: deckCardNames, inline: false },
			// { name: 'Avg. Elixir', value: '3.0', inline: true },
		)
		.attachFiles([ `./assets/player-verification-deck-images/${filename}` ])
		.setImage(`attachment://${filename}`)
		.setTimestamp();

	return verificatioDeckEmbed;
};

const sendEmbedsGroupedByTargetChannelIds = (client, embedsGroupedByTargetChannelIds) => {
	const getChannelPromises = Object.keys(embedsGroupedByTargetChannelIds)?.map(channelId => client.channels.fetch(channelId));
	return Promise.all(getChannelPromises).then(channels => {
		const sendMessagesPromises = channels.reduce((sendPromises, channel) => {
			return [sendPromises, ...embedsGroupedByTargetChannelIds[channel.id]?.map(embed => channel.send(embed))];
		}, []);
		Promise.all(sendMessagesPromises)
			.then(() => true)
			.catch(error => console.error(error.message));
	});
};

const createDeckImage = async (discordId, randomDeck) => {
	const URLS = randomDeck.cardImageUrls;

	try {
		const image = await new Jimp(1236, 210, '#36393E');
		for (let index = 0; index < URLS.length; index++) {
			const IMG_OFFSET = 25;
			const cardImg = await Jimp.read(URLS[index]);
			cardImg.resize(130, Jimp.AUTO);
			image.blit(cardImg, IMG_OFFSET + 130 * index + 20 * index, 25);
		}
		const filename = `verify${discordId}-${Math.ceil(Math.random() * 10000)}.png`;
		await image.writeAsync(`./assets/player-verification-deck-images/${filename}`);
		return filename;
	}
	catch (error) {
		console.error(error);
		return false;
	}
};

(async () => {
	const playerTag = '#JGGCL2Q22';
	const discordUserName = 'Pranjal';
	const discordId = '40849234893';
	const randomDeck = await generateRandomDeck(playerTag);
	const filename = await createDeckImage(discordId, randomDeck);
	if (!filename)
		return false;
	const client = new Client({
		partials: ['MESSAGE', 'REACTION'],
	});
	await client.login(process.env.DISCORDJS_BOT_TOKEN);
	const embed = createVerificationDeckEmbed(filename, randomDeck.deckCardNames, randomDeck.deckLink, playerTag, discordUserName);
	sendEmbedsGroupedByTargetChannelIds(client, { '879114632420278284': [embed] });
})();

const verifyPlayerOrFault = (message, args) {
	// check syntax and send proper syntax if invalid

	// if args has player tag, initiate verification process
	// if player is not in one of the clans, send proper message
	// if player tag is already linked, send proper message
	// if playertag verification has already been initialted, send proper message
	// if all checks passed
	// generate a verification deck
	// persist the deck, imageid, player tag, discordID and other relavant info in DB
	// send the embed
	// PLAN garbage collection for images created

	// if args does not have a player tag, check the pending verification log for the id-tag pair
	// if not found send proper message
	// if found trigger a check for the last 10 battles
	// if verification fails, send proper message
	// if verification passes, update the discord-cracc object, remove from pending verification, send the completed message
}

module.exports = { verifyPlayerOrFault };