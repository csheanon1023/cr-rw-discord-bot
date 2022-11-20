exports.handleRoleAdd = (reaction, user, roleIds) => {
	const { name } = reaction.emoji;
	const member = reaction.message.guild.members.cache.get(user.id);
	switch (name) {
	case '1️⃣':
		member.roles.add(roleIds['#2PYUJUL'])
			.then(({ user: userDetails }) => {
				console.log(`added role ${reaction.message.guild.roles.cache.find(r => r.id === roleIds['#2PYUJUL']).name} to ${userDetails.username}`);
			})
			.catch((e) => {
				console.error(e);
				console.log(`Failed to add clan 1 role to ${user.username}`);
			});
		break;
	case '2️⃣':
		member.roles.add(roleIds['#P9QQVJVG'])
			.then(({ user: userDetails }) => {
				console.log(`added role ${reaction.message.guild.roles.cache.find(r => r.id === roleIds['#P9QQVJVG']).name} to ${userDetails.username}`);
			})
			.catch((e) => {
				console.error(e);
				console.log(`Failed to add clan 2 role to ${user.username}`);
			});
		break;
	case '3️⃣':
		member.roles.add(roleIds['#QRVUCJVP'])
			.then(({ user: userDetails }) => {
				console.log(`added role ${reaction.message.guild.roles.cache.find(r => r.id === roleIds['#QRVUCJVP']).name} to ${userDetails.username}`);
			})
			.catch((e) => {
				console.error(e);
				console.log(`Failed to add clan 3 role to ${user.username}`);
			});
		break;
	case '4️⃣':
		member.roles.add(roleIds['#Q02UV0C0'])
			.then(({ user: userDetails }) => {
				console.log(`added role ${reaction.message.guild.roles.cache.find(r => r.id === roleIds['#Q02UV0C0']).name} to ${userDetails.username}`);
			})
			.catch((e) => {
				console.error(e);
				console.log(`Failed to add clan 4 role to ${user.username}`);
			});
		break;
	case '5️⃣':
		member.roles.add(roleIds['#LUVY2QY2'])
			.then(({ user: userDetails }) => {
				console.log(`added role ${reaction.message.guild.roles.cache.find(r => r.id === roleIds['#LUVY2QY2']).name} to ${userDetails.username}`);
			})
			.catch((e) => {
				console.error(e);
				console.log(`Failed to add clan 5 role to ${user.username}`);
			});
		break;
	case '6️⃣':
		member.roles.add(roleIds['#Q882YVV2'])
			.then(({ user: userDetails }) => {
				console.log(`added role ${reaction.message.guild.roles.cache.find(r => r.id === roleIds['#Q882YVV2']).name} to ${userDetails.username}`);
			})
			.catch((e) => {
				console.error(e);
				console.log(`Failed to add clan 5 role to ${user.username}`);
			});
		break;
	}
};

exports.handleRoleRemove = (reaction, user, roleIds) => {
	const { name } = reaction.emoji;
	const member = reaction.message.guild.members.cache.get(user.id);
	switch (name) {
	case '1️⃣':
		member.roles.remove(roleIds['#2PYUJUL'])
			.then(({ user: userDetails }) => {
				console.log(`removed role ${reaction.message.guild.roles.cache.find(r => r.id === roleIds['#2PYUJUL']).name} from ${userDetails.username} `);
			})
			.catch((e) => {
				console.error(e);
				console.log(`Failed to remove clan 1 role from ${user.username}`);
			});
		break;
	case '2️⃣':
		member.roles.remove(roleIds['#P9QQVJVG'])
			.then(({ user: userDetails }) => {
				console.log(`removed role ${reaction.message.guild.roles.cache.find(r => r.id === roleIds['#P9QQVJVG']).name} from ${userDetails.username}`);
			})
			.catch((e) => {
				console.error(e);
				console.log(`Failed to remove clan 2 role from ${user.username}`);
			});
		break;
	case '3️⃣':
		member.roles.remove(roleIds['#QRVUCJVP'])
			.then(({ user: userDetails }) => {
				console.log(`removed role ${reaction.message.guild.roles.cache.find(r => r.id === roleIds['#QRVUCJVP']).name} from ${userDetails.username}`);
			})
			.catch((e) => {
				console.error(e);
				console.log(`Failed to remove clan 3 role from ${user.username}`);
			});
		break;
	case '4️⃣':
		member.roles.remove(roleIds['#Q02UV0C0'])
			.then(({ user: userDetails }) => {
				console.log(`removed role ${reaction.message.guild.roles.cache.find(r => r.id === roleIds['#Q02UV0C0']).name} from ${userDetails.username}`);
			})
			.catch((e) => {
				console.error(e);
				console.log(`Failed to remove clan 4 role from ${user.username}`);
			});
		break;
	case '5️⃣':
		member.roles.remove(roleIds['#LUVY2QY2'])
			.then(({ user: userDetails }) => {
				console.log(`removed role ${reaction.message.guild.roles.cache.find(r => r.id === roleIds['#LUVY2QY2']).name} from ${userDetails.username}`);
			})
			.catch((e) => {
				console.error(e);
				console.log(`Failed to remove clan 5 role from ${user.username}`);
			});
		break;
	case '6️⃣':
		member.roles.remove(roleIds['#Q882YVV2'])
			.then(({ user: userDetails }) => {
				console.log(`removed role ${reaction.message.guild.roles.cache.find(r => r.id === roleIds['#Q882YVV2']).name} from ${userDetails.username}`);
			})
			.catch((e) => {
				console.error(e);
				console.log(`Failed to remove clan 5 role from ${user.username}`);
			});
		break;
	}
};
