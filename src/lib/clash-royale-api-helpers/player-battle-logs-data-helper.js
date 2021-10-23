const axios = require('axios');

exports.getPlayerBattleLogData = async (playerTag) => {
	if (!playerTag) {return;}
	const options = {
		method: 'GET',
		url: `https://proxy.royaleapi.dev/v1/players/%23${playerTag.substring(1)}/battlelog`,
		headers: {
			Authorization: `Bearer ${process.env.CLASH_ROYALE_API_TOKEN}`,
		},
	};

	// Make the API call
	return axios.request(options);
};
