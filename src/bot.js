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
  console.log(`${user.username} reacted with ${name}`);
  if (reaction.message.id === '874040719495544862') {
    switch (name) {
      case '1️⃣':
        member.roles.add('873489388338810921');
        console.log(`${user.username} was given the role ${reaction.message.guild.roles.cache.find(r => r.id === '873489388338810921').name}`);
        break;
      case '2️⃣':
        member.roles.add('873489468466823218');
        console.log(`${user.username} was given the role ${reaction.message.guild.roles.cache.find(r => r.id === '873489468466823218').name}`);
        break;
    }
  }
});

client.on('messageReactionRemove', (reaction, user) => {
  const { name } = reaction.emoji;
  const member = reaction.message.guild.members.cache.get(user.id);
  console.log(`${user.username} removed reaction: ${name}`);
  if (reaction.message.id === '874040719495544862') {
    switch (name) {
      case '1️⃣':
        member.roles.remove('873489388338810921');
        console.log(`${reaction.message.guild.roles.cache.find(r => r.id === '873489388338810921').name} role was taken away from ${user.username}`);
        break;
      case '2️⃣':
        member.roles.remove('873489468466823218');
        console.log(`${reaction.message.guild.roles.cache.find(r => r.id === '873489468466823218').name} role was taken away from ${user.username}`);
        break;
    }
  }
});

client.login(process.env.DISCORDJS_BOT_TOKEN);
