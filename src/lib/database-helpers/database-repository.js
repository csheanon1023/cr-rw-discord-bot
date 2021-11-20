// to run script: node -r dotenv/config ./src/lib/database-helpers/database-repository.js
const { firebaseConfig } = require('./firebaseConfig');
const admin = require('firebase-admin');

// Flags
const DB_KEY_APPLICATION_LEVEL_FLAGS_OBJECT = 'application-level-flags';
// In-Out log
const DB_KEY_LAST_KNOWN_MEMBER_LIST_OBJECT = 'last-known-member-list';
// Unused decks
const DB_KEY_LAST_KNOWN_BATTLE_DAY_OBJECT = 'last-known-battle-day-data';
const DB_KEY_CURRENT_WAR_MISSED_DECKS_OBJECT = 'current-war-missed-decks';
const DB_KEY_CURRENT_WAR_BATTLE_DAY_INITIAL_PARTICIPANT_DATA_OBJECT = 'current-war-battle-day-initial-participant-data';
const DB_KEY_CURRENT_WAR_END_OF_BATTLE_DAY_PARTICIPANT_DATA_OBJECT = 'current-war-end-of-battle-day-participant-data';
// Discord - CR mapping
const DB_KEY_PENDING_VERIFICATION_REQUESTS_OBJECT = 'pending-verification-requests';
const DB_KEY_ALREADY_LINKED_PLAYER_TAGS_OBJECT = 'already-linked-player-tags';
const DB_KEY_PENDING_MAPPING_REQUEST_DETAILS_OBJECT = 'pending-mapping-request-details';
const DB_KEY_DISCORD_ID_TO_CR_ACCOUNTS_MAP_OBJECT = 'discord-id-to-cr-accounts-map';
const DB_KEY_TO_KICK_PLAYER_TAGS_BY_CLAN_OBJECT = 'to-kick-player-tags-by-clan';
const DB_KEY_KICKING_TEAM_MEMBER_PENDING_KICKS_OBJECT = 'kicking-team-member-pending-kicks';

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
	return database.ref(`/${DB_KEY_LAST_KNOWN_MEMBER_LIST_OBJECT}/${data.clan.substring(1)}`).set(data)
		.then(() => {
			console.log('Data saved successfully.');
			return true;
		})
		.catch(error => {
			console.log('Data could not be saved.' + error);
			return false;
		});
};

// last-known-battle-day-data
const getLastKnownBattleDayData = (database) => {
	return database.ref(`/${DB_KEY_LAST_KNOWN_BATTLE_DAY_OBJECT}`).once('value');
};

const setLastKnownBattleDayData = (data, database) => {
	return database.ref(`/${DB_KEY_LAST_KNOWN_BATTLE_DAY_OBJECT}`).update(data)
		.then(() => {
			console.log('Data saved successfully.');
			return true;
		})
		.catch(error => {
			console.log('Data could not be saved.' + error);
			return false;
		});
};

// discord-id-to-cr-accounts-map
const getDiscordIdToCrAccountsMap = (database) => {
	return database.ref(`/${DB_KEY_DISCORD_ID_TO_CR_ACCOUNTS_MAP_OBJECT}`).once('value');
};

const setDiscordIdToCrAccountsMap = (userDiscordId, playerTags, database) => {
	return database.ref(`/${DB_KEY_DISCORD_ID_TO_CR_ACCOUNTS_MAP_OBJECT}/${userDiscordId}`).set(playerTags)
		.then(() => {
			console.log('Data saved successfully.');
			return true;
		})
		.catch(error => {
			console.log('Data could not be saved.' + error);
			return false;
		});
};

// pending-verification-requests
const getPendingVerificationRequests = (database) => {
	return database.ref(`/${DB_KEY_PENDING_VERIFICATION_REQUESTS_OBJECT}`).once('value');
};

const setPendingVerificationRequests = (verificationRequests, database) => {
	return database.ref(`/${DB_KEY_PENDING_VERIFICATION_REQUESTS_OBJECT}`).set(verificationRequests)
		.then(() => {
			console.log('Data saved successfully.');
			return true;
		})
		.catch(error => {
			console.log('Data could not be saved.' + error);
			return false;
		});
};

// already-linked-player-tags
const getAlreadyLinkedPlayerTags = (database) => {
	return database.ref(`/${DB_KEY_ALREADY_LINKED_PLAYER_TAGS_OBJECT}`).once('value');
};

// TODO for now sending the full object, in future just do a push and use security rules for duplicates
const setAlreadyLinkedPlayerTags = (playerTags, database) => {
	return database.ref(`/${DB_KEY_ALREADY_LINKED_PLAYER_TAGS_OBJECT}`).set(playerTags)
		.then(() => {
			console.log('Data saved successfully.');
			return true;
		})
		.catch(error => {
			console.log('Data could not be saved.' + error);
			return false;
		});
};

// application-flags
const getApplicationFlagByKey = (flagKey, database) => {
	return database.ref(`/${DB_KEY_APPLICATION_LEVEL_FLAGS_OBJECT}/${flagKey}`).once('value');
};

const bulkSetApplicationFlag = (data, database) => {
	if (Object.values(data).find(val => typeof val == 'boolean' == false) != undefined) {
		console.log('Flags need boolean values');
		return false;
	}
	return database.ref(`/${DB_KEY_APPLICATION_LEVEL_FLAGS_OBJECT}`).update(data)
		.then(() => {
			console.log('Data saved successfully.');
			return true;
		})
		.catch(error => {
			console.log('Data could not be saved.' + error);
			return false;
		});
};

// current-war-missed-decks
const getCurrentWarMissedDecksData = (clanTag, database) => {
	return database.ref(`/${DB_KEY_CURRENT_WAR_MISSED_DECKS_OBJECT}/${clanTag.substring(1)}`).once('value');
};

const setCurrentWarMissedDecksData = (clanTag, dayId, data, database) => {
	return database.ref(`/${DB_KEY_CURRENT_WAR_MISSED_DECKS_OBJECT}/${clanTag.substring(1)}/${dayId}`).set(data)
		.then(() => {
			console.log('Data saved successfully.');
			return true;
		})
		.catch(error => {
			console.log('Data could not be saved.' + error);
			return false;
		});
};

// pending-mapping-request-details
const getPendingMappingRequestDetailsData = (database) => {
	return database.ref(`/${DB_KEY_PENDING_MAPPING_REQUEST_DETAILS_OBJECT}`).once('value');
};

const setPendingMappingRequestDetailsData = (discordId, playerTag, data, database) => {
	return database.ref(`/${DB_KEY_PENDING_MAPPING_REQUEST_DETAILS_OBJECT}/${discordId}/${playerTag.substring(1)}`).set(data)
		.then(() => {
			console.log('Data saved successfully.');
			return true;
		})
		.catch(error => {
			console.log('Data could not be saved.' + error);
			return false;
		});
};

const removePendingMappingRequestDetailsData = (discordId, playerTag, database) => {
	// TODO do nested delete fo disocrd ID as well
	return database.ref(`/${DB_KEY_PENDING_MAPPING_REQUEST_DETAILS_OBJECT}/${discordId}/${playerTag.substring(1)}`).remove()
		.then(() => {
			console.log(`Pending Mapping Request Details Data removed successfully. ${discordId} ${playerTag}`);
			return true;
		})
		.catch(error => {
			console.log(`Pending Mapping Request Details Data could not be removed. ${discordId} ${playerTag}` + error);
			return false;
		});
};

// to-kick-player-tags-by-clan
const getToKickPlayerTagsByClan = (database) => {
	return database.ref(`/${DB_KEY_TO_KICK_PLAYER_TAGS_BY_CLAN_OBJECT}`).once('value');
};

const setToKickPlayerTagsByClan = (clanTag, playerTags, database) => {
	return database.ref(`/${DB_KEY_TO_KICK_PLAYER_TAGS_BY_CLAN_OBJECT}/${clanTag.substring(1)}`).set(playerTags)
		.then(() => {
			console.log('Data saved successfully.');
			return true;
		})
		.catch(error => {
			console.log('Data could not be saved.' + error);
			return false;
		});
};

// kicking-team-member-pending-kicks
const getkickingTeamMemberPendingKicksData = (database) => {
	return database.ref(`/${DB_KEY_KICKING_TEAM_MEMBER_PENDING_KICKS_OBJECT}`).once('value');
};

const getkickingTeamMemberPendingKicksByClanData = (clanTag, database) => {
	return database.ref(`/${DB_KEY_KICKING_TEAM_MEMBER_PENDING_KICKS_OBJECT}/${clanTag.substring(1)}`).once('value');
};

const setkickingTeamMemberPendingKicksData = (clanTag, data, database) => {
	return database.ref(`/${DB_KEY_KICKING_TEAM_MEMBER_PENDING_KICKS_OBJECT}/${clanTag.substring(1)}`).set(data)
		.then(() => {
			console.log('Data saved successfully.');
			return true;
		})
		.catch(error => {
			console.log('Data could not be saved.' + error);
			return false;
		});
};

// current-war-battle-day-initial-participant-data
const getCurrentWarBattleDayParticipantData = (clanTag, database) => {
	return database.ref(`/${DB_KEY_CURRENT_WAR_BATTLE_DAY_INITIAL_PARTICIPANT_DATA_OBJECT}/${clanTag.substring(1)}`).once('value');
};

const setCurrentWarBattleDayParticipantData = (clanTag, seasonId, periodIndex, data, database) => {
	return database.ref(`/${DB_KEY_CURRENT_WAR_BATTLE_DAY_INITIAL_PARTICIPANT_DATA_OBJECT}/${clanTag.substring(1)}/${seasonId}/${periodIndex}`).set(data)
		.then(() => {
			console.info(`Data saved successfully. Key:current-war-battle-day-initial-participant-data ClanTag:${clanTag} periodIndex:${periodIndex}`);
			return true;
		})
		.catch(error => {
			console.error(`Data could not be saved. Key:current-war-battle-day-initial-participant-data ClanTag:${clanTag} periodIndex:${periodIndex} \nerror: ${error}`);
			return false;
		});
};

// current-war-end-of-battle-day-participant-data
const getCurrentWarEndOfBattleDayParticipantData = (clanTag, database) => {
	return database.ref(`/${DB_KEY_CURRENT_WAR_END_OF_BATTLE_DAY_PARTICIPANT_DATA_OBJECT}/${clanTag.substring(1)}`).once('value');
};

const setCurrentWarEndOfBattleDayParticipantData = (clanTag, seasonId, periodIndex, data, database) => {
	return database.ref(`/${DB_KEY_CURRENT_WAR_END_OF_BATTLE_DAY_PARTICIPANT_DATA_OBJECT}/${clanTag.substring(1)}/${seasonId}/${periodIndex}`).set(data)
		.then(() => {
			console.info(`Data saved successfully. Key:current-war-end-of-battle-day-participant-data ClanTag:${clanTag} periodIndex:${periodIndex}`);
			return true;
		})
		.catch(error => {
			console.error(`Data could not be saved. Key:current-war-end-of-battle-day-participant-data ClanTag:${clanTag} periodIndex:${periodIndex} \nerror: ${error}`);
			return false;
		});
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
	getPendingVerificationRequests,
	setPendingVerificationRequests,
	getAlreadyLinkedPlayerTags,
	setAlreadyLinkedPlayerTags,
	getPendingMappingRequestDetailsData,
	setPendingMappingRequestDetailsData,
	removePendingMappingRequestDetailsData,
	getToKickPlayerTagsByClan,
	setToKickPlayerTagsByClan,
	getkickingTeamMemberPendingKicksByClanData,
	getkickingTeamMemberPendingKicksData,
	setkickingTeamMemberPendingKicksData,
	getCurrentWarBattleDayParticipantData,
	setCurrentWarBattleDayParticipantData,
	getCurrentWarEndOfBattleDayParticipantData,
	setCurrentWarEndOfBattleDayParticipantData,
};