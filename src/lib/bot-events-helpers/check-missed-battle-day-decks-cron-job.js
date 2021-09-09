const databaseRepository = require('../database-helpers/database-repository');
const currentRiverRaceDataHelper = require('../clash-royale-api-helpers/current-river-race-data-helper');
const membersDataHelper = require('../clash-royale-api-helpers/members-data-helper');
const playerDataHelper = require('../clash-royale-api-helpers/player-data-helper');
const cron = require('node-cron');

exports.scheduleCronsTOCollectDataAboutMissedBattleDecks = (database, client, channelList) => {
  let clanListCache = [ '#2PYUJUL', '#P9QQVJVG' ];
  let currentRiverRaceDataCache = [];
  let currentRiverRacePeriodIndex = -1;
  let lastInOutCronSuccessTimestamp = -1;
  let clanNameByKeyCache = {
    '#2PYUJUL': 'ROYAL WARRIORS!',
    '#P9QQVJVG': 'HARAMI_CLASHERS'
  };
  //TODO setup flags
  
  //CRON At each minute between 50-59 of the hours 9:00 on Sun, Mon, Fri, and Sat
  cron.schedule('50-59 9 * * 0,1,5,6', async () => {
    const formattedCurrentTime = getCurrentTime();
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
    currentRiverRaceData.forEach(clanCurrentRiverRaceData => {
      if(clanCurrentRiverRaceData.data.periodIndex != currentRiverRacePeriodIndex) {
        //TODO handle when data is updated for next day
        return;
      }
      //TODO replace DB entry for last-known-battle-day-data
    });
  });

  //CRON At each minute between 00-10 of the hours 10:00 on Sun, Mon, Fri, and Sat
  cron.schedule('0-10 10 * * 0,1,5,6', async () => {
    const formattedCurrentTime = getCurrentTime();
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
    currentRiverRaceData.forEach(clanCurrentRiverRaceData => {
      if(clanCurrentRiverRaceData.data.periodIndex != currentRiverRacePeriodIndex) {
        //TODO handle when data is not yet updated for next day
        return;
      }
      //TODO get DB entry for last-known-battle-day-data and calculate the unused decks and send report in discord
    });
  });

  
  //Helpers
  const getCurrentTime = () => {
    var currentdate = new Date(); 
    var datetime = "Last Sync: " + currentdate.getDate() + "/"
                                 + (currentdate.getMonth()+1)  + "/" 
                                 + currentdate.getFullYear() + " @ "  
                                 + currentdate.getHours() + ":"  
                                 + currentdate.getMinutes() + ":" 
                                 + currentdate.getSeconds();
    return datetime;
  }

  const sendInOutMessage = async (change, playerTag, clan) => {
  }
}