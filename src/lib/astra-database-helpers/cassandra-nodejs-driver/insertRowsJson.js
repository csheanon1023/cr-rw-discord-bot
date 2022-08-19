// node -r dotenv/config ./src/lib/astra-database-helpers/cassandra-nodejs-driver/insertRowsJson.js
const { getClient, close } = require('./client');

const insertRowsJson = async (keyspace, table, rows) => {
	try {
		const client = await getClient();
		const insertQueries = rows.reduce((query, row) => {
			query.push(`INSERT INTO ${keyspace}.${table} JSON '${JSON.stringify(row)}'`);
			return query;
		}, []);
		// const rs = await client.batch(insertQueries);
		await client.batch(insertQueries);
		console.log('Data saved successfully');

		// TODO validation
		// `SELECT COUNT(*) FROM collected_battle_day_participant_data
		// WHERE clan_tag = 'QRVUCJVP' AND collection_type = 'start' AND  season = 2;`;
		// new Set(lll.map(e=>`${e.clan_tag}/${e.collection_type}/${e.season}/${e.week}/${e.day}/${e.player_tag}`)).size

		await close();
		return true;
	}
	catch (error) {
		console.error(error);
	}
};

module.exports = { insertRowsJson };