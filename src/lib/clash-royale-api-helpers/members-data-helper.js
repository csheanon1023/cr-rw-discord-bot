const axios = require('axios');

exports.getMembers = async (clanTag) => {
  if(!clanTag)
    return;
  const options = {
    method: 'GET',
    url: `https://proxy.royaleapi.dev/v1/clans/%23${clanTag}/members`,
    headers: {
      Authorization: `Bearer ${process.env.CLASH_ROYALE_API_TOKEN}`
    }
  };

  //Make the API call
  return axios.request(options);
}

exports.getMembersByLevel = (members, level) => {
  if(level > 0 && level <= 13)
    return members.filter(member => member.expLevel == level)
  return;
}