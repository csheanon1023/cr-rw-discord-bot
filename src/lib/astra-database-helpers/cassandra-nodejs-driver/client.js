const { Client } = require('cassandra-driver');
const { clientConfig } = require('./clientConfig');
let client;

const getClient = async () => {
	try {
		if (client) return client;
		client = new Client(clientConfig);
		await client.connect();
		console.log('DB client created');
		return client;
	}
	catch (error) {
		client = null;
		console.error(error);
		return false;
	}
};

const query = (q) => {
	if (!client)
		getClient();
	return client.query(q);
};

const close = async () => {
	try {
		await client.shutdown();
		client = null;
		console.log('DB client destroyed');
	}
	catch (error) {
		console.error(error);
		return false;
	}
};

module.exports = {
	getClient,
	query,
	close,
};
