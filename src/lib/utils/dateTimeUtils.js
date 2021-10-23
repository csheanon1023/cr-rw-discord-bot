exports.getCurrentTime = (currentDate = new Date()) => {
	const datetime = 'Last Sync: ' + currentDate.getDate() + '/'
                               + (currentDate.getMonth() + 1) + '/'
                               + currentDate.getFullYear() + ' @ '
                               + currentDate.getHours() + ':'
                               + currentDate.getMinutes() + ':'
                               + currentDate.getSeconds();
	return datetime;
};