/* eslint-disable no-unused-vars */
// DO NOT REFERENCE THIS OUTSIDE /scripts DIRECTORY
// CHANGE THIS ONLY IF YOU KNOW WHAT YOU'RE DOING
// ONLY TO BE USED WHEN DB NEEDS TO BE INITIALIZED/RESET (uncomment only the sections that you need)
// to run script: node -r dotenv/config ./src/lib/database-helpers/scripts/clan-names.js

const databaseRepository = require('../database-repository');
const clanDataHelper = require('../../clash-royale-api-helpers/clan-data-helper');

// SECTION helper functions
// generate clan-names object
const resetClanList = async (database, clanTags) => {
	for (const tag of clanTags) {
		const { data } = await clanDataHelper.getClanData(tag);
		if (data == null || data.name == '' || !data) {return;}
		const ref = database.ref(`/clan-names/${tag.substring(1)}`);
		// ~
		ref.set(data.name, (error) => {
			if (error) {
				console.log('Data could not be saved.' + error);
			}
			else {
				console.log('Data saved successfully.');
			}
		});
	}
};

// SECTION clan-names object (uncomment only the parts that you need, this will mutate the DB)
/*
// const databaseOperations = () => {
//   const database = databaseRepository.connectRealtimeDatabase();
//   // uncomment this to generate/reset clan-names object
//   resetClanList(currentClans);

//   // uncomment this to get clan data from clan-names object
//   database.ref(`/clan-names/${currentClans[0].substring(1)}`).once('value', (data) => {
//     console.log(data.val());
//   });

//   // async await implementation for the same for reference
//   (async () => {
//     const snap = await database.ref(`/clan-names/${currentClans[0].substring(1)}`).once('value')
//     console.log(snap.val());
//   })();
// }

// databaseOperations();
*/

// SECTION export
exports.initializeClanNames = (database, currentClans = [ '#2PYUJUL', '#P9QQVJVG' ]) => {
	resetClanList(database, currentClans);
};
