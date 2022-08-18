const axios = require('axios');

const getRows = async (keyspace, table, primaryKey, pageSize, pageState, fields, raw = false, sort) => {

	if (!keyspace || !table || !primaryKey) {
		return;
		// throw
	}

	if (Array.isArray(primaryKey)) {
		// TODO validate
		if (primaryKey.some(key => typeof key !== 'string')) {
			return;
			// throw
		}
		primaryKey = primaryKey.join('/');
	}

	const endpoint = `${process.env.ASTRA_DB_REST_API_BASE_URL}api/rest/v2/keyspaces/${keyspace}/${table}/${primaryKey}`;

	const params = {};
	if (fields) {
		params['fields'] = fields.join(',');
	}

	if (pageSize) {
		params['page-size'] = pageSize;
	}

	if (pageState) {
		params['page-state'] = pageState;
	}

	if (raw) {
		params['raw'] = raw;
	}

	if (sort) {
		params['sort'] = sort;
	}

	const headers = {
		'accept': 'application/json',
		'X-Cassandra-Token': process.env.ASTRA_DB_TOKEN,
	};

	const options = {
		method: 'GET',
		url: endpoint,
		params: params,
		headers: headers,
	};

	// Make the API call
	return axios.request(options);
};


// (async () => {
// 	try {
// 		const res = await getRows('war_reports', 'collected_battle_day_participant_data', ['2PYUJUL', 'end', '78', '3'], 2000);
// 		console.log(res.data.length);
// 	}
// 	catch (e) {
// 		console.log(e);
// 	}
// })();

module.exports = { getRows };