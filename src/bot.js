require("dotenv").config();

const { Client } = require('discord.js');

const client = new Client({
  partials: ['MESSAGE', 'REACTION']
});

const PREFIX = "$";

client.on('ready', () => {
  console.log(`${client.user.tag} has logged in.`);
});

client.on('messageReactionAdd', (reaction, user) => {
  const { name } = reaction.emoji;
  const member = reaction.message.guild.members.cache.get(user.id);
  console.log(user.id);
  console.log(reaction.message.id);
  if (reaction.message.id === '874040719495544862') {
    switch (name) {
      case '1️⃣':
        member.roles.add('873489388338810921');
        break;
      case '2️⃣':
        member.roles.add('873489468466823218');
        break;
    }
  }
});

client.on('messageReactionRemove', (reaction, user) => {
  const { name } = reaction.emoji;
  const member = reaction.message.guild.members.cache.get(user.id);
  if (reaction.message.id === '874040719495544862') {
    switch (name) {
      case '1️⃣':
        member.roles.remove('873489388338810921');
        break;
      case '2️⃣':
        member.roles.remove('873489468466823218');
        break;
    }
  }
});

client.login(process.env.DISCORDJS_BOT_TOKEN);
