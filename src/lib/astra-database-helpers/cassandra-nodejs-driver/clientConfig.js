module.exports.clientConfig = {
	cloud: {
		secureConnectBundle: process?.env?.ASTRA_DB_SECURE_CONNECT_BUNDLE,
	},
	credentials: {
		username: process?.env?.ASTRA_DB_CLIENT_ID,
		password: process?.env?.ASTRA_DB_SECRET,
	},
};