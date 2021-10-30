// to run script: node -r dotenv/config ./src/lib/scraping-helpers/player-clan-wars2-history-helper.js
const axios = require('axios');

const ROYALE_API_BASE_URL = 'https://royaleapi.com/';
const PROXY_ROYALE_API_BASE_URL = 'https://royaleapi-com-wehanijeych3.curlhub.io/';

const getPlayerClanWar2HistoryOrFault = async (token, playerTag, playerName, isUseProxyEnabled = false) => {
	const data = `{"player_tag":"${playerTag.substring(
		1,
	)}","player_name":"${playerName}","token":"${token}"}`;
	const useURL = isUseProxyEnabled ? PROXY_ROYALE_API_BASE_URL : ROYALE_API_BASE_URL;

	const config = {
		method: 'post',
		url: `${useURL}data/player/cw2_history`,
		headers: {
			referer: `${ROYALE_API_BASE_URL}player/${playerName}`,
			'user-agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/95.0.4638.54 Safari/537.36',
			'Content-Type': 'text/plain',
		},
		data: data,
	};
	try {
		const response = await axios(config);
		if (response.status != 200) {
			console.error(`Get clan war 2 history response status was ${response.status}, Proxy:${isUseProxyEnabled}`);
			return false;
		}
		console.info(`Get CW2 History passed on proxy: ${isUseProxyEnabled}`);
		return response.data;
	}
	catch (error) {
		console.error(error + `, Proxy:${isUseProxyEnabled}`);
		return false;
	}
};

module.exports = { getPlayerClanWar2HistoryOrFault };