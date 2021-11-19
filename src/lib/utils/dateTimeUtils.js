const getCurrentTime = (currentDate = new Date()) => {
	const datetime = 'Last Sync: ' + currentDate.getDate() + '/'
                               + (currentDate.getMonth() + 1) + '/'
                               + currentDate.getFullYear() + ' @ '
                               + currentDate.getHours() + ':'
                               + currentDate.getMinutes() + ':'
                               + currentDate.getSeconds();
	return datetime;
};

const convertCrTimeStampsToDateObject = (timestamp) => {
	return isValidCrTimestamp(timestamp) ? new Date(convertCrTimeStampsToDateString(timestamp)) : false;
};

const isValidCrTimestamp = (timestamp) => {
	return isNaN(Date.parse(convertCrTimeStampsToDateString(timestamp)));
};

const convertCrTimeStampsToDateString = (timestamp) => {
	return `${timestamp.substring(0, 4)}-${timestamp.substring(4, 6)}-${timestamp.substring(6, 11)}:${timestamp.substring(11, 13)}:${timestamp.substring(13)}`;
};

module.exports = {
	getCurrentTime,
	convertCrTimeStampsToDateObject,
	isValidCrTimestamp,
	convertCrTimeStampsToDateString,
};