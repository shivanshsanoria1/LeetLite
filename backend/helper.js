const path = require("path");
const fs = require("fs");
const fsPromises = require('node:fs/promises')

const config = require("./config.json");
const webConfig = require("./web/web-config.json");

const ROOT = __dirname; // ./backend
const PROJECT_ROOT = path.resolve(__dirname, "..");

function getPath(section, key) {
	try {
		const relPath = config[section]?.[key];

		if (!relPath) {
			throw new Error(`Unknown ${section} key: ${key}`);
		}

		return path.resolve(ROOT, relPath);
	} catch (err) {
		throw err;
	}
}

function getRootRelativePath(filePath) {
	try {
		return path.relative(ROOT, filePath);
	} catch (err) {
		throw err
	}
}

function getDirPath(key) {
	try {
		const dir = getPath("dirPaths", key);

		fs.mkdirSync(dir, { recursive: true });

		return dir;
	} catch (err) {
		throw err;
	}
}

function getFilePath(key) {
	try {
		const file = getPath("filePaths", key);

		fs.mkdirSync(path.dirname(file), { recursive: true });

		if (!fs.existsSync(file)) {
			const defaultVal = file.endsWith(".json") ? "[]\n" : "";
			fs.writeFileSync(file, defaultVal, "utf8");
		}

		return file;
	} catch (err) {
		throw err;
	}
}

// Reads JSON data from a file path.
// Writes defaultValue if the existing file is empty.
async function readFromJSON(filePath, defaultValue = []) {
	try {
		const jsonData = await fsPromises.readFile(filePath, 'utf8');

		if (!jsonData.trim()) {
			await writeToJSON(filePath, defaultValue);
			return defaultValue;
		}

		return JSON.parse(jsonData);
	} catch (err) {
		if (err.code === 'ENOENT') {
			throw new Error(
				`JSON file does not exist: ${filePath}. ` +
				`Use helper.getFilePath() to obtain the file path.`
			);
		}

		throw err;
	}
}

async function writeToJSON(filePath, data = {}, minifiedFlag = false) {
	try {
		if (minifiedFlag) {
			await fsPromises.writeFile(filePath, JSON.stringify(data), 'utf8');
		} else {
			await fsPromises.writeFile(filePath, JSON.stringify(data, null, 4), 'utf8');
		}
	} catch (err) {
		throw err;
	}
}

module.exports = {
	ROOT,
	getDirPath,
	getFilePath,
	getRootRelativePath,
	readFromJSON,
	writeToJSON
};