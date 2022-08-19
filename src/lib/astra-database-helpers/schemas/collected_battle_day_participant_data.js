const schema = {
	tableName: 'collected_battle_day_participant_data',
	columns: [
		{ name: 'clan_tag', typeDefinition: 'text' },
		{ name: 'collection_type', typeDefinition: 'text' },
		{ name: 'season', typeDefinition: 'int' },
		{ name: 'week', typeDefinition: 'int' },
		{ name: 'day', typeDefinition: 'int' },
		{ name: 'player_name', typeDefinition: 'text' },
		{ name: 'player_tag', typeDefinition: 'text' },
		{ name: 'clan_name', typeDefinition: 'text' },
		{ name: 'updated_at', typeDefinition: 'timestamp' },
		{ name: 'boat_attacks', typeDefinition: 'int' },
		{ name: 'decks_used', typeDefinition: 'int' },
		{ name: 'decks_used_today', typeDefinition: 'int' },
		{ name: 'fame', typeDefinition: 'int' },
	],
	partitionKeys: ['clan_tag', 'collection_type', 'season'],
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
		defaultTimeToLive: 2419200,
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