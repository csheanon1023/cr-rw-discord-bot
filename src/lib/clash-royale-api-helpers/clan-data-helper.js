const axios = require('axios');

exports.getClanData = async (clanTag) => {
	if (!clanTag) {return;}
	const options = {
		method: 'GET',
		url: `https://proxy.royaleapi.dev/v1/clans/%23${clanTag.substring(1)}`,
		headers: {
			Authorization: `Bearer ${process.env.CLASH_ROYALE_API_TOKEN}`,
		},
	};

	// Make the API call
	return axios.request(options);
};