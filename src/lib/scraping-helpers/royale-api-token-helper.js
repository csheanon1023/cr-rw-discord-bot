// to run script: node -r dotenv/config ./src/lib/scraping-helpers/royale-api-token-helper.js
const axios = require('axios');

// const ROYALE_API_BASE_URL = 'https://royaleapi.com/';
const ROYALE_API_BASE_URL = 'https://royaleapi-com-wehanijeych3.curlhub.io/';

const generateRoyaleApiToken = async () => {
	const config = {
		method: 'get',
		url: `${ROYALE_API_BASE_URL}player/G9VR9LU0`,
		headers: {
			'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/75.0.3770.100 Safari/537.36',
		},
	};
	try {
		const response = await axios(config);
		const responseString = await JSON.stringify(response.data);
		const startIndex = responseString.indexOf('token');
		const endIndex = responseString.indexOf('\'', startIndex + 10);
		const token = responseString.substring(startIndex + 8, endIndex);
		console.log(token);
		return token;
	}
	catch (error) {
		console.log(error);
		return false;
	}
};

module.exports = { generateRoyaleApiToken };
(async () => {
	const token = await generateRoyaleApiToken();
	console.log(token);
})();