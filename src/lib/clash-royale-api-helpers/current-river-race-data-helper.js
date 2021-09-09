const axios = require('axios');

exports.getCurrentRiverRaceData = async (clanTag) => {
  if(!clanTag)
    return;
  const options = {
    method: 'GET',
    url: `https://proxy.royaleapi.dev/v1/clans/%23${clanTag.substring(1)}/currentriverrace`,
    headers: {
      Authorization: `Bearer ${process.env.CLASH_ROYALE_API_TOKEN}`
    }
  };

  //Make the API call
  return axios.request(options);
}
