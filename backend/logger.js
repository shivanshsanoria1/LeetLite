const fs = require('fs');
const path = require('path');
const util = require('util');

const helper = require('./helper.js')
const timer = require('./timer.js')

const LOG_DIR = helper.getDirPath('logs')

let ERROR_FOUND_COUNT = 0;
const getErrorCount = () => ERROR_FOUND_COUNT

function getLogFilePath() {
	const fileName = `logs_${timer.getYYYYMMDD()}.log`;

	return path.join(LOG_DIR, fileName);
}

function writeLine(line) {
	const filePath = getLogFilePath();

	try {
		fs.appendFileSync(filePath, line + '\n', { encoding: 'utf8' });
	} catch (err) {
		console.error(`Failed to write to log file (${filePath}): ${err.message}`);
	}
}

function serialize(payload) {
	if (payload instanceof Error) {
		return payload.stack ?? payload.message;
	}

	if (typeof payload === 'string') {
		return payload;
	}

	return util.inspect(payload, {
		depth: null,
		colors: false,
		compact: false,
		breakLength: Infinity,
		maxArrayLength: null,
		maxStringLength: null
	});
}

function write(level, data) {
	const message = serialize(data);
	const line = `[${timer.getTimestamp()}] [${level}] ${message}`;

	writeLine(line);
}

function info(data) {
	write('INFO', data);
}

function error(data) {
	write('ERROR', data);
	ERROR_FOUND_COUNT++
}

function time(msg) {
	console.log(`[${timer.getTimestamp()}]: ${msg}`);
	write('INFO', msg);
}

module.exports = {
	info,
	error,
	time,
	getErrorCount
};

// function ensureLogDir() {
// 	try {
// 		fs.mkdirSync(LOG_DIR, { recursive: true });
// 	} catch (err) {
// 		throw new Error(`Failed to create log directory: ${err.message}`);
// 	}
// }
