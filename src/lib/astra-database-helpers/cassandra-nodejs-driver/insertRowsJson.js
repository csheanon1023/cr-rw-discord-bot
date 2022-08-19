// node -r dotenv/config ./src/lib/astra-database-helpers/cassandra-nodejs-driver/insertRowsJson.js
// eslint-disable-next-line no-unused-vars
const { getClient, close } = require('./client');

// validationKeys: Array<{column, value}>
const insertRowsJson = async (keyspace, table, rows, validationKeys = null) => {
	try {
		const client = await getClient();
		// TODO sanitize data
		const insertQueries = rows.reduce((query, row) => {
			query.push(`INSERT INTO ${keyspace}.${table} JSON '${JSON.stringify(row).replace(/'/g, ' ')}'`);
			return query;
		}, []);
		// const rs = await client.batch(insertQueries);
		await client.batch(insertQueries);
		console.log('Insert batch: Data saved successfully');

		if (
			validationKeys &&
			'uniqueKeys' in validationKeys &&
			'countQueryKeys' in validationKeys &&
			Object.keys(validationKeys['uniqueKeys']).length > 0 &&
			Object.keys(validationKeys['countQueryKeys']).length > 0
		) {
			const columns = validationKeys?.countQueryKeys?.map(({ column }) => column);
			const hints = validationKeys?.countQueryKeys?.map(({ type }) => type);
			const uniqueKeys = validationKeys?.uniqueKeys?.map(({ column }) => column);
			const expectedCount = new Set(rows.map(row => uniqueKeys.map(col => row[col]).join('/'))).size;
			// TODO? check rows with schema
			// if (schema does not have each of the columns)
			// 	throw `validationKeys doesn't match the schema ${keyspace}/${table}/${columns.join('/')}`;
			const columnsClause = columns.map(column => `${column} = ?`).join(' AND ');
			const params = validationKeys?.countQueryKeys?.map(({ value }) => value);
			const query = `SELECT COUNT(*) FROM ${keyspace}.${table} WHERE ${columnsClause}`;
			const res = await client.execute(query, params, { hints });
			// await close();
			if (expectedCount != res.rows?.[0]?.count)
				throw `Looks like the batch didn't succeed ${keyspace}/${table}/${columns.join('/')}`;
		}
		// await close();
		return true;
	}
	catch (error) {
		console.error(error);
		return false;
	}
};

module.exports = { insertRowsJson };