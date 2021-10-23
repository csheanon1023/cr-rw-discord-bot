// to run script: node -r dotenv/config ./src/lib/bot-events-helpers/player-verification-command.js
const { MessageEmbed } = require('discord.js');
const Jimp = require('jimp');
const playerDataHelper = require('../clash-royale-api-helpers/player-data-helper');
const playerBattleLogDataHelper = require('../clash-royale-api-helpers/player-battle-logs-data-helper');
const { createSyntaxErrorHelpEmbed } = require('../utils/genericEmbeds');
const {
	getAlreadyLinkedPlayerTags,
	setAlreadyLinkedPlayerTags,
	getPendingVerificationRequests,
	setPendingVerificationRequests,
	getPendingMappingRequestDetailsData,
	setPendingMappingRequestDetailsData,
	removePendingMappingRequestDetailsData,
	getDiscordIdToCrAccountsMap,
	setDiscordIdToCrAccountsMap,
} = require('../database-helpers/database-repository');

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
		.setDescription('Use this deck in a battle and reply in here with `$verify` to complete verification')
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

const checkBattleLogsToVerifyPlayer = async (playerTag, verificationDeckCommaSeparated) => {
	try {
		const verificationDeckArray = verificationDeckCommaSeparated.split(',').map(card => parseInt(card));
		if (verificationDeckArray.length != 8) {
			console.error('Failure in discord-cr mapping, deck from DB seems invalid');
			return false;
		}
		const { data: playerBattleLogData } = await playerBattleLogDataHelper.getPlayerBattleLogData(playerTag);
		let verificationStatus = false;
		playerBattleLogData.forEach(({ team }) => {
			if (verificationStatus)
				return;
			const { cards } = team.find(({ tag }) => tag == playerTag);
			const cardIds = cards.map(card => card.id);
			// megadeck challenge
			if (cardIds.length != 8)
				return;
			verificationStatus = cardIds.every(cardId => verificationDeckArray.includes(cardId));
		});
		return verificationStatus;
	}
	catch (error) {
		console.error('Failure in discord-cr mapping, fetch player battle log probably failed' + error);
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
	const alreadyLinkedPlayerTagsPromise = await getAlreadyLinkedPlayerTags(database);
	const alreadyLinkedPlayerTags = alreadyLinkedPlayerTagsPromise.val();
	if (alreadyLinkedPlayerTags && alreadyLinkedPlayerTags.find(tag => tag == playerTag)) {
		return message.reply('Whoops! Looks like the player tag is already linked to a discord account, please contact admin to check who has registered this tag or to have the link removed in case you are trying to link it to a new discord ID.');
		// TODO add command to allow check who it is linked to
	}
	// if playertag verification has already been initialted, send proper message
	const pendingVerificationRequestsPromise = await getPendingVerificationRequests(database);
	let pendingVerificationRequests = pendingVerificationRequestsPromise.val();
	if (pendingVerificationRequests && pendingVerificationRequests.find(tag => tag == playerTag)) {
		return message.reply('Whoops! Looks like verification for this player tag is already in progress, please play a battle with the verification deck and reply with `$verify` to complete account verification. If someone else has triggered verification with your tag, please notify admin');
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
		// Persist the deck, imageid, player tag, discordID and other relavant info in DB
		// TODO implement retry mechanism if db requests fail
		const verificationRequestDetails = {
			deck: randomDeck.deckCardIdsStringCommaSeparated,
			imageFileName: filename,
			playerTag: playerTag,
			discordId: discordId,
		};
		pendingVerificationRequests = pendingVerificationRequests || [];
		const isPendingVerificationRequestpersisted = setPendingVerificationRequests([...pendingVerificationRequests, playerTag], database);
		const isPendingMappingRequestDetailsPersisted = setPendingMappingRequestDetailsData(discordId, playerTag, verificationRequestDetails, database);
		// send the embed
		if (isPendingVerificationRequestpersisted && isPendingMappingRequestDetailsPersisted) {
			const embed = createVerificationDeckEmbed(filename, randomDeck.deckCardNames, randomDeck.deckLink, playerTag, discordUserName);
			await message.channel.send(embed);
		}
		else {
			return message.reply('Whoops! Looks like something failed unexpectedly, retries mai not work, please report this to admin');
		}
		// TODO PLAN garbage collection for images created
	}
	catch (error) {
		console.error('get player data likely failed, check, \nerror:' + error);
		// TODO add check for error and selectively send error reply, rn just sending it whenever fails
		return message.reply('Whoops! Looks like the payer tag is invalid, please check.');
	}
};

const completePendingVerificationRequest = async (message, database) => {
	try {
		const discordUserName = message.author.username;
		const discordId = message.author.id;
		// if not found send proper message
		const pendingVerificationRequestDetailsPromise = await getPendingMappingRequestDetailsData(database);
		const pendingVerificationRequestDetails = pendingVerificationRequestDetailsPromise.val();
		if (!pendingVerificationRequestDetails) {
			return message.reply('Whoops! Looks like you don\'t have any pending verification requests, to initiate a new verification use this command: `$verify [playerTag]`, if you have already requested one please check with admin.');
		}
		const pendingRequestsForThisUser = pendingVerificationRequestDetails[discordId];
		if (!pendingRequestsForThisUser) {
			return message.reply('Whoops! Looks like you don\'t have any pending verification requests, to initiate a new verification use this command: `$verify [playerTag]`, if you have already requested one please check with admin.');
		}
		// if found, trigger a check for the last 10 battles
		for (const pendingRequests in pendingRequestsForThisUser) {
			const pendingRequestDetails = pendingRequestsForThisUser[pendingRequests];
			// if verification passes, update the discord-cracc object, remove from pending verification, send the completed message
			if (await checkBattleLogsToVerifyPlayer(pendingRequestDetails.playerTag, pendingRequestDetails.deck)) {
				// TODO do batch or transaction writes
				const alreadyLinkedPlayerTagsPromise = await getAlreadyLinkedPlayerTags(database);
				let alreadyLinkedPlayerTags = alreadyLinkedPlayerTagsPromise.val();
				alreadyLinkedPlayerTags = alreadyLinkedPlayerTags || [];
				const issetAlreadyLinkedPlayerTagsPersisted = await setAlreadyLinkedPlayerTags([...alreadyLinkedPlayerTags, pendingRequestDetails.playerTag], database);

				const isPendingMappingRequestDetailsDataRemoved = await removePendingMappingRequestDetailsData(pendingRequestDetails.discordId, pendingRequestDetails.playerTag, database);

				const pendingVerificationRequestsPromise = await getPendingVerificationRequests(database);
				const pendingVerificationRequests = pendingVerificationRequestsPromise.val();
				const isPendingVerificationRequestRemoved = await setPendingVerificationRequests(pendingVerificationRequests.filter(tag => tag != pendingRequestDetails.playerTag), database);

				const discordIdToCrAccountsMapPromise = await getDiscordIdToCrAccountsMap(database);
				const discordIdToCrAccountsMap = discordIdToCrAccountsMapPromise.val();
				let linkedCrAccountsForThisUser = discordIdToCrAccountsMap ? discordIdToCrAccountsMap[pendingRequestDetails.discordId] : null;
				linkedCrAccountsForThisUser = linkedCrAccountsForThisUser ? [...linkedCrAccountsForThisUser, pendingRequestDetails.playerTag] : [pendingRequestDetails.playerTag];
				const isdiscordIdToCrAccountsMapRemoved = await setDiscordIdToCrAccountsMap(pendingRequestDetails.discordId, linkedCrAccountsForThisUser, database);

				// if verification fails, send proper message
				if (!(isPendingMappingRequestDetailsDataRemoved || issetAlreadyLinkedPlayerTagsPersisted || isPendingVerificationRequestRemoved || isdiscordIdToCrAccountsMapRemoved)) {
					console.error('verification discord-cr has some bugs, something during completion step didn\'t get persisted');
				}
				// TODO send in an embed
				message.reply(`Player Tag ${pendingRequestDetails.playerTag} is now linked to Discord user ${discordUserName}`);
			}
			else {
				message.reply(`Verification failed for Player Tag ${pendingRequestDetails.playerTag}`);
			}
		}
	}
	catch (error) {
		console.error(error);
		console.info('verification discord-cr has some bugs, something during completion step didn\'t get persisted');
	}
};

const verifyPlayerOrFault = async (message, args, database) => {
	const syntaxObject = {
		syntax: '$verify [?playerTag]',
		argumentList: {
			playerTag: {
				message: 'tag of the CR account that you want to verify',
				isOptional: true,
			},
		},
		usages: {
			initiate: {
				useCase: 'To initiate verification of your account',
				syntax: '$verify [playerTag]',
			},
			complete: {
				useCase: 'To complete account verification after using the verification deck in a battle',
				syntax: '$verify',
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
	if (args.length === 0) {
		await completePendingVerificationRequest(message, database);
	}
};

module.exports = { verifyPlayerOrFault };