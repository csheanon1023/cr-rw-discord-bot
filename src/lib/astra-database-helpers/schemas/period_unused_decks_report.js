const schema = {
	tableName: 'period_unused_decks_report',
	columns: [
		{ name: 'clan_tag', typeDefinition: 'text' },
		{ name: 'season', typeDefinition: 'int' },
		{ name: 'week', typeDefinition: 'int' },
		{ name: 'day', typeDefinition: 'int' },
		{ name: 'clan_name', typeDefinition: 'text' },
		{ name: 'player_name', typeDefinition: 'text' },
		{ name: 'player_tag', typeDefinition: 'text' },
		{ name: 'unused_decks', typeDefinition: 'int' },
		{ name: 'updated_at', typeDefinition: 'timestamp' },
		{ name: 'collection_time_start', typeDefinition: 'timestamp' },
		{ name: 'collection_time_end', typeDefinition: 'timestamp' },
	],
	partitionKeys: ['clan_tag', 'season'],
	primaryKey: [
		{
			column: 'clan_tag',
			type: 'partition',
		},
		{
			column: 'season',
			type: 'partition',
		},
		{
			column: 'week',
			type: 'clustering',
		},
		{
			column: 'day',
			type: 'clustering',
		},
		{
			column: 'player_tag',
			type: 'clustering',
		},
	],
	TableOptions: {
		defaultTimeToLive: 10512000,
		clusteringExpression: [
			{
				column: 'week',
				order: 'asc',
			},
			{
				column: 'day',
				order: 'asc',
			},
			{
				column: 'player_tag',
				order: 'asc',
			},
		],
	},
};

module.exports = { schema };