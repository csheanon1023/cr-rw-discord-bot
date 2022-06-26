// DO NOT REFERENCE THIS OUTSIDE /scripts DIRECTORY
// CHANGE THIS ONLY IF YOU KNOW WHAT YOU'RE DOING
// ONLY TO BE USED WHEN DB NEEDS TO BE INITIALIZED/RESET (uncomment only the sections that you need)
// to run script: node -r dotenv/config ./src/lib/database-helpers/scripts/last-known-member-list.js

// SECTION helper functions
// eslint-disable-next-line no-unused-vars
const databaseRepository = require('../database-repository');
const membersDataHelper = require('../../clash-royale-api-helpers/members-data-helper');

const currentClans = [ '#2PYUJUL', '#P9QQVJVG', '#QRVUCJVP', '#Q02UV0C0' ];

// generate last-known-members-list object
const resetMembersList = async (database, clanTag) => {
	if (!currentClans.includes(clanTag)) {
		console.log('This clan tag is not in list of existing tags');
		return;
	}
	const clanMembersCache = [];
	const res = await membersDataHelper.getMembers(clanTag);
	const membersList = res.data.items;
	if (!membersList || membersList.length == 0) {
		console.log('reset clan members list failed, get members data didn\'t get resolved');
		return;
	}
	clanMembersCache.push({
		members: membersList.map(member => member.tag),
		clan: clanTag,
	});
	if (clanMembersCache && clanMembersCache.length != 0) {
		const ref = database.ref(`/last-known-member-list/${clanTag.substring(1)}`);
		ref.set(clanMembersCache[0], (error) => {
			if (error) {
				console.log('Data could not be saved.' + error);
			}
			else {
				console.log('Data saved successfully.');
			}
		});
	}
};

// SECTION last-known-members-list object (uncomment only the parts that you need, this will mutate the DB)
/*
// const databaseOperations = () => {
  // const database = databaseRepository.connectRealtimeDatabase();
  // // uncomment this to generate/reset last-known-members-list object
  // currentClans.forEach(clan => resetMembersList(clan));

  // // uncomment this to get clan data from last-known-members-list object
  // database.ref(`/last-known-member-list/${currentClans[0].substring(1)}`).once('value', (data) => {
  //   console.log(data.val());
  // });

  // // async await implementation for the same for reference
  // (async () => {
  //   const snap = await database.ref(`/last-known-member-list/${currentClans[0].substring(1)}`).once('value')
  //   console.log(snap.val());
  // })();
// }

// databaseOperations();
*/

// SECTION export
exports.initializeLastKnownMemberList = (database, currentClansParam = currentClans) => {
	currentClansParam.forEach(clan => resetMembersList(database, clan));
};
