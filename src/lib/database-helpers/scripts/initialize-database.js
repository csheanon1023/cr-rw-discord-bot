// DO NOT REFERENCE THIS OUTSIDE /scripts DIRECTORY 
// USE THIS ONLY IF YOU KNOW WHAT YOU'RE DOING 
// ONLY TO BE USED WHEN DB NEEDS TO BE INITIALIZED/RESET (uncomment only the parts that you need)
// to run script: node -r dotenv/config ./src/lib/database-helpers/scripts/initialize-database.js

const databaseRepository = require('../database-repository');
const lastKnownMemberList = require('./last-known-member-list');
const clanNames = require('./clan-names');

const database = databaseRepository.connectRealtimeDatabase();

// lastKnownMemberList.initializeLastKnownMemberList(database);
// clanNames.initializeClanNames(database);