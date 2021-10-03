const { firebaseConfig } = require('./firebaseConfig');
const admin = require('firebase-admin');

const DB_KEY_LAST_KNOWN_MEMBER_LIST_OBJECT = 'last-known-member-list';
const DB_KEY_LAST_KNOWN_BATTLE_DAY_OBJECT = 'last-known-battle-day-data';
const DB_KEY_DISCORD_ID_TO_CR_ACCOUNTS_MAP_OBJECT = 'discord-id-to-cr-accounts-map';

exports.connectRealtimeDatabase = () => {
	admin.initializeApp({
		credential: admin.credential.cert(firebaseConfig),
		databaseURL: process.env.FIREBASE_DATABASE_URL,
	});

	const database = admin.database();
	return database;
};

// last-known-member-list
exports.getLastKnownMembersListData = (clanTag, database) => {
	return database.ref(`/${DB_KEY_LAST_KNOWN_MEMBER_LIST_OBJECT}/${clanTag.substring(1)}`).once('value');
};

exports.setLastKnownMembersListData = (data, database) => {
	database.ref(`/${DB_KEY_LAST_KNOWN_MEMBER_LIST_OBJECT}/${data.clan.substring(1)}`).set(data, (error) => {
		if (error) {
			console.log('Data could not be saved.' + error);
		}
		else {
			console.log('Data saved successfully.');
		}
	});
};

// last-known-battle-day-data
exports.getLastKnownBattleDayData = (database) => {
	return database.ref(`/${DB_KEY_LAST_KNOWN_BATTLE_DAY_OBJECT}`).once('value');
};

exports.setLastKnownBattleDayData = (data, database) => {
	let returnValue = false;
	database.ref(`/${DB_KEY_LAST_KNOWN_BATTLE_DAY_OBJECT}`).update(data, (error) => {
		if (error) {
			console.log('Data could not be saved.' + error);
		}
		else {
			console.log('Data saved successfully.');
			returnValue = true;
		}
	});
	return returnValue;
};

// discord-id-to-cr-accounts-map
exports.getDiscordIdToCrAccountsMap = (database) => {
	return database.ref(`/${DB_KEY_DISCORD_ID_TO_CR_ACCOUNTS_MAP_OBJECT}`).once('value');
};

exports.setDiscordIdToCrAccountsMap = (userDiscordId, playerTags, database) => {
	let returnValue = false;
	database.ref(`/${DB_KEY_LAST_KNOWN_BATTLE_DAY_OBJECT}/${userDiscordId}`).update(playerTags, (error) => {
		if (error) {
			console.log('Data could not be saved.' + error);
		}
		else {
			console.log('Data saved successfully.');
			returnValue = true;
		}
	});
	return returnValue;
};