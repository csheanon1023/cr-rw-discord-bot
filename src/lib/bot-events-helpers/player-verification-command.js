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
(async () => {
	const randomDeck = await generateRandomDeck('#JGGCL2Q22');
	const discordID = '40849234893';
	const URLS = randomDeck.cardImageUrls;

	new Jimp(1236, 210, '#36393E', async (err, image) => {
		// const FONT = await Jimp.loadFont(Jimp.FONT_SANS_16_WHITE);
		for (let index = 0; index < URLS.length; index++) {
			const IMG_OFFSET = 25;
			const cardImg = await Jimp.read(URLS[index]);
			cardImg.resize(130, Jimp.AUTO);
			image.blit(cardImg, IMG_OFFSET + 130 * index + 20 * index, 25);

			// image.print(
			//   FONT,
			//   IMG_OFFSET + 130 * index + 20 * index,
			//   200,
			//   {
			//     text: NAMES[index],
			//     alignmentX: Jimp.HORIZONTAL_ALIGN_CENTER,
			//     alignmentY: Jimp.VERTICAL_ALIGN_MIDDLE
			//   },
			//   120
			// );
		}
		const filename = `verify${discordID}-${Math.ceil(Math.random() * 10000)}.png`;
		await image.writeAsync(`./assets/player-verification-deck-images/${filename}`);
		sendEmbed(filename, randomDeck.deckCardNames, randomDeck.deckLink);
	});
})();

const sendEmbed = (filename, deckCardNames, deckLink) => {
	const exampleEmbed = new MessageEmbed()
		.setColor('#ae00ff')
		.setTitle('Player Verification')
		.setDescription('Use this deck in a battle and reply in here with `!verify` to complete verification')
		.addFields(
			{ name: 'Deck Link', value: `[Copy Deck](${deckLink})`, inline: true },
			{ name: 'Deck', value: deckCardNames, inline: true },
			// { name: 'Avg. Elixir', value: '3.0', inline: true },
		)
		.attachFiles([ `./assets/player-verification-deck-images/${filename}` ])
		.setImage(`attachment://${filename}`)
		.setTimestamp();

	const client = new Client({
		partials: ['MESSAGE', 'REACTION'],
	});

	client.login(process.env.DISCORDJS_BOT_TOKEN).then(() => {
		client.channels.fetch('879114632420278284').then((channel) => {
			// TODO this will be modified when we update to discord 13
			channel.send(exampleEmbed);
		});
	});
};
