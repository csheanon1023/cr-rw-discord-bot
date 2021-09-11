const databaseRepository = require('../database-helpers/database-repository');
const currentRiverRaceDataHelper = require('../clash-royale-api-helpers/current-river-race-data-helper');
const membersDataHelper = require('../clash-royale-api-helpers/members-data-helper');
const playerDataHelper = require('../clash-royale-api-helpers/player-data-helper');
const cron = require('node-cron');

exports.scheduleCronsTOCollectDataAboutMissedBattleDecks = (database, client, channelList) => {
  let clanListCache = [ '#2PYUJUL', '#P9QQVJVG' ];
  let isRiverRaceDataUpdatedToNextDay = false;
  let clanNameByKeyCache = {
    '#2PYUJUL': 'ROYAL WARRIORS!',
    '#P9QQVJVG': 'HARAMI_CLASHERS'
  };
  //TODO setup flags
  
  //CRON At each minute between 45-59 of the hours 9:00 on Sun, Mon, Fri, and Sat
  cron.schedule('45-59 9 * * 0,1,5,6', async () => {
    const currentDate = new Date();
    const currentDay = currentDate.getDay();
    const currentRiverRacePeriodIndex = (currentDay + 5) % 7;
    const formattedCurrentTime = getCurrentTime(currentDate);

    if(clanListCache == null || clanListCache.length == 0) {
      console.log(`${formattedCurrentTime} Skipping river race data collection, clanListCache is empty`);
      return;
    }

    if(isRiverRaceDataUpdatedToNextDay) {
      console.log(`${formattedCurrentTime} Skipping river race data collection, data has been updated to next day`);
      return;
    }

    try {
      const currentRiverRaceDataPromises = clanListCache.map(clan => currentRiverRaceDataHelper.getCurrentRiverRaceData(clan));
      const currentRiverRaceData = await Promise.all(currentRiverRaceDataPromises);
      let riverRaceDataSnap = { timestamp: currentDate.getTime() }
      currentRiverRaceData.forEach(({ data }) => {
        if(data?.periodIndex != currentRiverRacePeriodIndex) {
          isRiverRaceDataUpdatedToNextDay = true;
          return;
        }
        riverRaceDataSnap[data?.clan?.tag?.substring(1)] = {
          clan: data.clan,
          periodLogs: data.periodLogs
        };
      });
      databaseRepository.setLastKnownBattleDayData(riverRaceDataSnap, database);
    } catch(e) {
      console.error(e);
      console.log(`${formattedCurrentTime} river race data collection failed, getCurrentRiverRaceData didn\'t get resolved`);
      return;
    }
  });

  //CRON At each minute between 00-10 of the hours 10:00 on Sun, Mon, Fri, and Sat
  cron.schedule('0-10 10 * * 0,1,5,6', async () => {
    const formattedCurrentTime = getCurrentTime(currentDate);
    //TODO set acoording to day
    let currentRiverRacePeriodIndex = 1;
    if(clanListCache == null || clanListCache.length == 0) {
      console.log(`${formattedCurrentTime} Skipping river race data collection as clanListCache is empty`);
      return;
    }
    const currentRiverRaceDataPromises = clanListCache.map(clan => currentRiverRaceDataHelper.getCurrentRiverRaceData(clan));
    const currentRiverRaceData = await Promise.all(currentRiverRaceDataPromises);
    if(!currentRiverRaceData || currentRiverRaceData.length == 0) {
      console.log('find change failed, get members data didn\'t get resolved');
      return;
    }

    if([3, 4, 5].includes(currentRiverRacePeriodIndex)){
    }

    currentRiverRaceData.forEach(clanCurrentRiverRaceData => {
      if(clanCurrentRiverRaceData.data.periodIndex != currentRiverRacePeriodIndex) {
        //TODO handle when data is not yet updated for next day
        return;
      }
      //TODO get DB entry for last-known-battle-day-data and calculate the unused decks and send report in discord
    });
  });

  
  //Helpers
  const getCurrentTime = (currentDate = new Date()) => {
    var datetime = "Last Sync: " + currentDate.getDate() + "/"
                                 + (currentDate.getMonth()+1)  + "/" 
                                 + currentDate.getFullYear() + " @ "  
                                 + currentDate.getHours() + ":"  
                                 + currentDate.getMinutes() + ":" 
                                 + currentDate.getSeconds();
    return datetime;
  }

  const sendMissedDeckReport = async (change, playerTag, clan) => {
  }
}

// this.scheduleCronsTOCollectDataAboutMissedBattleDecks(databaseRepository.connectRealtimeDatabase());