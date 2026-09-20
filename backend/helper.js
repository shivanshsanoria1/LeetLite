const path = require("path");
const fs = require("fs");

const config = require("./config.json");

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

module.exports = {
	ROOT,
	getDirPath,
	getFilePath,
	getRootRelativePath
};










/*const path = require("path");
const fs = require("fs");
const fs = require('node:fs/promises');

const helper = require('../helper.js')
const config = Object.freeze(require("./config.json"));

const ROOT = path.resolve(__dirname, "..");

function getPath(section, key) {
	const relPath = config[section]?.[key];

	if (!relPath) {
		throw new Error(`Unknown ${section} key: ${key}`);
	}

	return path.resolve(ROOT, relPath);
}

const getRootRelativePath = (filePath) => path.relative(ROOT, filePath);

const getDirPath = (key) => getPath("dirPaths", key);
const getFilePath = (key) => getPath("filePaths", key);

function ensureDir(key) {
	const dir = getDirPath(key);
	fs.mkdirSync(dir, { recursive: true });
	return dir;
}

function ensureFileDir(key) {
	const file = getFilePath(key);
	fs.mkdirSync(path.dirname(file), { recursive: true });
	return file;
}

// reads JSON data from a path; 
// creates a JSON file with default-value if file not found
async function readFromJSON(filePath, defaultValue = []) {
	try {
		await fs.mkdir(path.dirname(filePath), { recursive: true });
		const problemsJSON = await fs.readFile(filePath, { encoding: "utf8" })

		return JSON.parse(problemsJSON)
	} catch (err) {
		if (err.code === 'ENOENT') {
			logger.info(`JSON file not found. Creating new file at: ${filePath}`);
			await fs.writeFile(filePath, JSON.stringify(defaultValue, null, 4));

			return defaultValue;
		}
		throw err
	}
}

// writes JSON data into the file at path
async function writeToJSON(filePath, data = {}) {
	try {
		await fs.mkdir(path.dirname(filePath), { recursive: true });
		await fs.writeFile(filePath, JSON.stringify(data, null, 4));
	} catch (err) {
		throw err
	}
}

// moves the source file (if exists) to a timestamped backup
async function createBackupJSON(sourceFilePath) {
	// ensure source file exists, create if missing
	try {
		await fs.access(sourceFilePath);
	} catch (err) {
		if (err.code === "ENOENT") {
			logger.info("Source file does not exist. No backup created");
			return null
		}
		throw err;
	}

	try {
		await helper.ensureDir('webBackup')
		const backupDirPath = helper.getDirPath('webBackup')

		const ext = path.extname(sourceFilePath); // file-extension
		const sourceFileName = path.basename(sourceFilePath, ext); // filename without extension
		const timestamp = timer.getFileSafeISOTimestamp();
		const backupFileName = `${sourceFileName} [${timestamp}]${ext}`; // timestamped backup filename
		const backupFilePath = path.join(backupDirPath, backupFileName)

		// create the backup file and delete the source file
		await fs.copyFile(sourceFilePath, backupFilePath);

		logger.info(`Backup created: ${helper.getRootRelativePath(backupFilePath)}`)
	} catch (err) {
		throw err
	}
}

async function createBackupDir(sourceDirPath) {
	// ensure source directory exists
	try {
		await fs.access(sourceDirPath);
	} catch (err) {
		if (err.code === "ENOENT") {
			logger.info("Source directory does not exist. No backup created");
			return null;
		}
		throw err;
	}

	try {
		await helper.ensureDir("webBackup");

		const backupDirPath = helper.getDirPath("webBackup");

		const sourceDirName = path.basename(sourceDirPath);
		const timestamp = timer.getFileSafeISOTimestamp();

		const backupDirName = `${sourceDirName} [${timestamp}]`;
		const backupDirFullPath = path.join(backupDirPath, backupDirName);

		// rename + move directory
		await fs.rename(sourceDirPath, backupDirFullPath);

		logger.info(`Backup created: ${helper.getRootRelativePath(backupDirFullPath)}`);

		return backupDirFullPath;
	} catch (err) {
		throw err;
	}
}

async function updateConfig() {
	try {
		const filePathConfig = path.join(__dirname, 'web-config.json');
		await writeToJSON(filePathConfig, webConfig)
	} catch (err) {
		throw err;
	}
}

module.exports = {
	ROOT,
	getDirPath,
	getFilePath,
	ensureDir,
	ensureFileDir,
	getRootRelativePath
};*/