// to run script: node -r dotenv/config ./src/lib/scraping-helpers/player-clan-wars2-history-helper.js
const axios = require('axios');

const ROYALE_API_BASE_URL = 'https://royaleapi.com/';
// eslint-disable-next-line no-unused-vars
const PROXY_ROYALE_API_BASE_URL =
  'https://royaleapi-com-wehanijeych3.curlhub.io/';

const getPlayerClanWar2History = async (token, playerTag, playerName) => {
	const data = `{"player_tag":"${playerTag.substring(
		1,
	)}","player_name":"${playerName}","token":"${token}"}`;
	const useURL = ROYALE_API_BASE_URL;

	const config = {
		method: 'post',
		url: `${useURL}data/player/cw2_history`,
		headers: {
			referer: 'https://royaleapi.com/player/G9VR9LU0',
			'user-agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/95.0.4638.54 Safari/537.36',
			'Content-Type': 'text/plain',
		},
		data: data,
	};
	try {
		const response = await axios(config);
		// .then(function (response) {
		//   // console.log(JSON.stringify(response.data));
		return response.data;
		// })
	}
	catch (error) {
		console.log(error);
		return false;
	}
};

module.exports = { getPlayerClanWar2History };
(async () => {
	const token =
    'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJhbGxvdyI6ImluYyIsImV4cCI6MTYzNTM3MTI2MX0.Bcte_NA1JgeKl1FfZqJmW649Pu9VF6hU3B_PFyRfmY8';
	const playerTag = '#G9VR9LU0';
	const playerName = 'PRANJAL';
	const data = await getPlayerClanWar2History(token, playerTag, playerName);
	console.log(data);
})();
