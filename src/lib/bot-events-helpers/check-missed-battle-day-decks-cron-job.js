const databaseRepository = require('../database-helpers/database-repository');
const currentRiverRaceDataHelper = require('../clash-royale-api-helpers/current-river-race-data-helper');
const membersDataHelper = require('../clash-royale-api-helpers/members-data-helper');
const playerDataHelper = require('../clash-royale-api-helpers/player-data-helper');
const cron = require('node-cron');

exports.scheduleCronsTOCollectDataAboutMissedBattleDecks = (database, client, channelList) => {
  let clanListCache = [ '#2PYUJUL', '#P9QQVJVG' ];
  let isRiverRaceDataUpdatedToNextDay = false;
  let isReportGenerationDone = false;
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

    //TODO handle case when the first cron finds that periodIndex has changed to next period (unlikely now that we're starting at 9:45)
    //check for this is also done in the other cron so this is anyway not very critical but, do this someday to make it more fault tolerant

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
      console.log(`${formattedCurrentTime} river race data collection cron failed`);
      return;
    }
  });

  //CRON At each minute between 00-10 of the hours 10:00 on Sun, Mon, Fri, and Sat
  // cron.schedule('0-5 10 * * 0,1,5,6', async () => {
  cron.schedule('* * * * *', async () => {
    const currentDate = new Date();
    const currentDay = currentDate.getDay();
    const previousRiverRacePeriodIndex = (currentDay + 5) % 7;
    const formattedCurrentTime = getCurrentTime(currentDate);
    const unusedDecksReport = [];

    if(clanListCache == null || clanListCache.length == 0) {
      console.log(`${formattedCurrentTime} Skipping river race report generation as clanListCache is empty`);
      return;
    }
    
    if(isReportGenerationDone) {
      console.log(`${formattedCurrentTime} Skipping river race report generation cron, report has already been sent`);
      return;
    }
    
    if(!isRiverRaceDataUpdatedToNextDay) {
      console.error(`${formattedCurrentTime} isRiverRaceDataUpdatedToNextDay was not true in psot cron`);
    }

    if([3, 4, 5].includes(previousRiverRacePeriodIndex)){
      try {
        const currentRiverRaceDataPromises = clanListCache.map(clan => currentRiverRaceDataHelper.getCurrentRiverRaceData(clan));
        const previousRiverRaceDataSnpashotPromises = databaseRepository.getLastKnownBattleDayData(database);
        const [ previousRiverRaceDataSnpashot, ...currentRiverRaceData ] = await Promise.all([ previousRiverRaceDataSnpashotPromises, ...currentRiverRaceDataPromises]);
        const previousRiverRaceDataSnpashotValue = previousRiverRaceDataSnpashot.val();
        for (const [key, clanPreviousRiverRaceData] of Object.entries(previousRiverRaceDataSnpashotValue)) {
          //TODO add validation to make sure data is fresh
          if(key == 'timestamp')
            continue;
          const clanCurrentRiverRaceData = currentRiverRaceData.find(({ data }) => data.clan.tag == clanPreviousRiverRaceData.clan.tag);
          //TODO check if return is needed
          if(clanCurrentRiverRaceData == undefined) {
            console.log(`${formattedCurrentTime} river race report generation cron failed, not able to match clans in previousSnap and current data returned from the API for ${clanPreviousRiverRaceData.clan.tag}`);
            return;
          }
          let participantList = clanPreviousRiverRaceData?.clan?.participants;
          participantList.forEach(participant => {
            const currentParticipantData = clanCurrentRiverRaceData.data?.clan?.participants.find(player => player.tag == participant.tag);
            if(currentParticipantData == undefined) {
              console.error(`${formattedCurrentTime} Unexpected: not able to find player in new river race data: ${participant.tag}`);
              continue;
            }
            const totalDecksUsedByTheEndOPreviousBattleDay = currentParticipantData.decksUsed - currentParticipantData.decksUsedToday;
            const unuesdDecks = 4 - participant.decksUsedToday + totalDecksUsedByTheEndOPreviousBattleDay - participant.decksUsed;
            if(unuesdDecks < 0 || unuesdDecks > 4) {
              console.log(`${formattedCurrentTime} river race report generation cron failed, something wrong with the calculations, invalid value for unuesdDecks: ${unuesdDecks}`);
              return;
            }
            if(unuesdDecks != 0) {
              const reportPlayerData = {
                tag: participant.tag,
                name: participant.name,
                unusedDecks: unuesdDecks
              };
              unusedDecksReport.push(reportPlayerData);
            }
          });
        }
        unusedDecksReport.forEach(member => console.log(member));
        // databaseRepository.setLastKnownBattleDayData(riverRaceDataSnap, database);
      } catch(e) {
        console.error(e);
        console.log(`${formattedCurrentTime} river race report generation cron failed`);
        return;
      }
    }
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

this.scheduleCronsTOCollectDataAboutMissedBattleDecks(databaseRepository.connectRealtimeDatabase());