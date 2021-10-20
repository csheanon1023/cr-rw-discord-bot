// to run script: node -r dotenv/config ./src/lib/bot-events-helpers/player-verification-command.js
const { MessageEmbed } = require('discord.js');
const Jimp = require('jimp');
const playerDataHelper = require('../clash-royale-api-helpers/player-data-helper');
const { createSyntaxErrorHelpEmbed } = require('../utils/genericEmbeds');
const { getAlreadyLinkedPlayerTags, setAlreadyLinkedPlayerTags, getPendingVerificationRequests, setPendingVerificationRequests } = require('../database-helpers/database-repository');

const generateRandomDeck = async (playerData) => {
	const cards = playerData.cards;
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
	returnObject.deckCardIdsStringCommaSeparated = cardArray.map(card => card.id).join(',');

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

const startNewVerificationFlow = async (message, playerTag, database) => {
	// TODO add validation to prevent someone to initiate multiple verifications at the same time, or implement it in a way to make this a non issue
	// const playerTag = '#JGGCL2Q22';
	const discordUserName = message.author.username;
	const discordId = message.author.id;
	// if player is not in one of the clans, send proper message
	if (!playerTag.startsWith('#') || !playerTag.substring(1).match(/^[0-9A-Z]+$/)) {
		return message.reply('Whoops! Looks like the payer tag is invalid, please check.');
	}
	// if player tag is already linked, send proper message
	const alreadyLinkedPlayerTagsPromise = getAlreadyLinkedPlayerTags();
	const alreadyLinkedPlayerTags = alreadyLinkedPlayerTagsPromise.val();
	if (alreadyLinkedPlayerTags.find(playerTag)) {
		return message.reply('Whoops! Looks like the player tag is already linked to a discord account, please contact admin to check who has registered this tag or to have the link removed in case you are trying to link it to a new discord ID.');
		// TODO add command to allow check who it is linked to
	}
	// if playertag verification has already been initialted, send proper message
	const pendingVerificationRequestsPromise = getPendingVerificationRequests();
	const pendingVerificationRequests = pendingVerificationRequestsPromise.val();
	if (pendingVerificationRequests.find(playerTag)) {
		return message.reply('Whoops! Looks like verification for this player tag is already in progress, please play a battle with the verification deck and reply with `$verify` to complete account verification. If someone else have triggered verification with your tag, please notify admin');
		// TODO add ability to fetch the verification deck
	}
	// if all checks passed
	try {
		const playerResponse = await playerDataHelper.getPlayerData(playerTag);
		const playerData = playerResponse.data;
		// generate a verification deck
		const randomDeck = await generateRandomDeck(playerData);
		const filename = await createDeckImage(discordId, randomDeck);
		if (!filename)
			return false;
		// persist the deck, imageid, player tag, discordID and other relavant info in DB
		// TODO implement retry mechanism if db requests fail
		const isPendingVerificationRequestpersisted = setPendingVerificationRequests([...pendingVerificationRequests, playerTag], database);
		const someNameObject = {
			deck: randomDeck.deckCardIdsStringCommaSeparated,
			imageFileName: filename,
			playerTag: playerTag,
			discordId: discordId,
		};
		// TODO create another DB object to persist this data
		// send the embed
		const embed = createVerificationDeckEmbed(filename, randomDeck.deckCardNames, randomDeck.deckLink, playerTag, discordUserName);
		await message.channel.send(embed);
		// sendEmbedsGroupedByTargetChannelIds(client, { '879114632420278284': [embed] });
		// PLAN garbage collection for images created
	}
	catch (error) {
		console.error('get player data likely failed, check, \nerror:' + error);
		// TODO add check for error and selectively send error reply, rn just sending it whenever fails
		return message.reply('Whoops! Looks like the payer tag is invalid, please check.');
	}
};

const verifyPlayerOrFault = async (message, args, database) => {
	const syntaxObject = {
		syntax: '!verify [?playerTag]',
		argumentList: {
			playerTag: {
				message: 'tag of the CR account that you want to verify',
				isOptional: true,
			},
		},
		usages: {
			initiate: {
				useCase: 'To initiate verification of your account',
				syntax: '!verify [playerTag]',
			},
			complete: {
				useCase: 'To complete account verification after using the verification deck in a battle',
				syntax: '!verify',
			},
		},
	};

	// check syntax and send proper syntax if invalid
	if (args.length > 1) {
		const syntaxEmbed = createSyntaxErrorHelpEmbed(syntaxObject.syntax, syntaxObject.argumentList, syntaxObject.usages);
		await message.channel.send(syntaxEmbed);
	}

	// if args has player tag, initiate verification process
	if (args.length === 1) {
		await startNewVerificationFlow(message, args[0], database);
	}

	// if args does not have a player tag, check the pending verification log for the id-tag pair
	// if (args.length === 0) {}
	// if not found send proper message
	// if found trigger a check for the last 10 battles
	// if verification fails, send proper message
	// if verification passes, update the discord-cracc object, remove from pending verification, send the completed message
};

module.exports = { verifyPlayerOrFault };