const { firebaseConfig } = require('./firebaseConfig');
const admin = require('firebase-admin');

const DB_KEY_LAST_KNOWN_MEMBER_LIST_OBJECT = 'last-known-member-list';
const DB_KEY_LAST_KNOWN_BATTLE_DAY_OBJECT = 'last-known-battle-day-data';
const DB_KEY_DISCORD_ID_TO_CR_ACCOUNTS_MAP_OBJECT = 'discord-id-to-cr-accounts-map';
const DB_KEY_APPLICATION_LEVEL_FLAGS_OBJECT = 'application-level-flags';
const DB_KEY_CURRENT_WAR_MISSED_DECKS_OBJECT = 'current-war-missed-decks';

const connectRealtimeDatabase = () => {
	admin.initializeApp({
		credential: admin.credential.cert(firebaseConfig),
		databaseURL: process.env.FIREBASE_DATABASE_URL,
	});

	const database = admin.database();
	return database;
};

// last-known-member-list
const getLastKnownMembersListData = (clanTag, database) => {
	return database.ref(`/${DB_KEY_LAST_KNOWN_MEMBER_LIST_OBJECT}/${clanTag.substring(1)}`).once('value');
};

const setLastKnownMembersListData = (data, database) => {
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
const getLastKnownBattleDayData = (database) => {
	return database.ref(`/${DB_KEY_LAST_KNOWN_BATTLE_DAY_OBJECT}`).once('value');
};

const setLastKnownBattleDayData = (data, database) => {
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
const getDiscordIdToCrAccountsMap = (database) => {
	return database.ref(`/${DB_KEY_DISCORD_ID_TO_CR_ACCOUNTS_MAP_OBJECT}`).once('value');
};

const setDiscordIdToCrAccountsMap = (userDiscordId, playerTags, database) => {
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

// application-flags
const getApplicationFlagByKey = (flagKey, database) => {
	return database.ref(`/${DB_KEY_APPLICATION_LEVEL_FLAGS_OBJECT}/${flagKey}`).once('value');
};

const bulkSetApplicationFlag = (data, database) => {
	let returnValue = false;
	if (Object.values(data).find(val => typeof val == 'boolean' == false) != undefined) {
		console.log('Flags need boolean values');
		return false;
	}
	database.ref(`/${DB_KEY_APPLICATION_LEVEL_FLAGS_OBJECT}`).update(data, (error) => {
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

// current-war-missed-decks
const getCurrentWarMissedDecksData = (clanTag, database) => {
	return database.ref(`/${DB_KEY_CURRENT_WAR_MISSED_DECKS_OBJECT}/${clanTag.substring(1)}`).once('value');
};

const setCurrentWarMissedDecksData = (clanTag, dayId, data, database) => {
	let returnValue = false;
	database.ref(`/${DB_KEY_CURRENT_WAR_MISSED_DECKS_OBJECT}/${clanTag.substring(1)}/${dayId}`).set(data, (error) => {
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

module.exports = {
	connectRealtimeDatabase,
	getLastKnownMembersListData,
	setLastKnownMembersListData,
	getLastKnownBattleDayData,
	setLastKnownBattleDayData,
	getDiscordIdToCrAccountsMap,
	setDiscordIdToCrAccountsMap,
	getApplicationFlagByKey,
	bulkSetApplicationFlag,
	getCurrentWarMissedDecksData,
	setCurrentWarMissedDecksData,
};