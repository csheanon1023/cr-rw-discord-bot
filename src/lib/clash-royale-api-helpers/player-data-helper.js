const axios = require('axios');

exports.getPlayerData = async (playerTag) => {
	if (!playerTag) {return;}
	const options = {
		method: 'GET',
		url: `https://proxy.royaleapi.dev/v1/players/%23${playerTag.substring(1)}`,
		headers: {
			Authorization: `Bearer ${process.env.CLASH_ROYALE_API_TOKEN}`,
		},
	};

	// Make the API call
	return axios.request(options);
};
