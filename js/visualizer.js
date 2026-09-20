// const GITHUB_LCS_URL = 'https://raw.githubusercontent.com/shivanshsanoria1/LeetcodeSolutions/main';

// const PATH_LC_PROBLEM_LIST = '/backend/generated/json-min/lc-problem-list-min.json';
// const PATH_LC_TOPIC_TAGS = '/backend/generated/json-min/lc-topic-tag-min.json';

import {
	GITHUB_LCS_URL,
	PATH_LC_PROBLEM_LIST,
	PATH_LC_TOPIC_TAGS,
} from './config.js';

// Configuration
const HISTORY_SIZE = 6;
const STORAGE_KEY_HISTORY = 'leetcode_lite_vis_history';
const STORAGE_KEY_CURRENT_ROOT = 'leetcode_lite_vis_current_root'; // New constant

let problemMap = new Map();
let currentRootId = null;
let clickTimeout = null;
let errorTimeout = null;
let searchHistory = []; // Stack for LRU

const topicTagMap = new Map();

const searchInput = document.getElementById('quesIdInput');
const searchBtn = document.getElementById('searchGraphBtn');
const errorMsg = document.getElementById('search-error');
const container = document.getElementById('nodesContainer');
const svg = document.getElementById('svgEdges');
const viewport = document.getElementById('graphContainer');
const rootDetails = document.getElementById('root-details');
const historyStack = document.getElementById('history-stack');
const clearHistoryBtn = document.getElementById('clear-history-btn');

// --- Dynamic Autocomplete Search ---
const searchAutocomplete = document.getElementById('search-autocomplete');

searchInput.addEventListener('input', (e) => {
	const term = e.target.value.toLowerCase().trim();
	searchAutocomplete.innerHTML = '';

	if (!term) {
		searchAutocomplete.classList.remove('show');
		return;
	}

	// Filter problems by ID or Title dynamically[cite: 2]
	const allProbs = Array.from(problemMap.values());
	const matches = allProbs.filter(p => {
		return p.quesId.toString() === term || p.title.toLowerCase().includes(term);
	}).slice(0, 15); // Limit to top 15 results to prevent DOM overflow

	if (matches.length === 0) {
		searchAutocomplete.classList.remove('show');
		return;
	}

	// Populate the dropdown with matching results
	matches.forEach(p => {
		const li = document.createElement('li');

		// Add yellow lock SVG for premium problems[cite: 2]
		const lockIcon = p.isPaidOnly ? `
            <span class="text-warning ms-1 align-middle" title="Premium Problem">
                <svg xmlns="http://www.w3.org/2000/svg" width="13" height="13" fill="currentColor" class="bi bi-lock-fill" viewBox="0 0 16 16">
                  <path d="M8 1a2 2 0 0 1 2 2v4H6V3a2 2 0 0 1 2-2zm3 6V3a3 3 0 0 0-6 0v4a2 2 0 0 0-2 2v5a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2z"/>
                </svg>
            </span>` : '';

		// Inherit difficulty color for both ID and Title, but make the period secondary
		li.innerHTML = `
            <button class="dropdown-item text-truncate fw-semibold diff-${p.difficulty}" type="button">
                ${p.quesId}<span class="text-secondary fw-normal me-1">.</span> ${p.title} ${lockIcon}
            </button>
        `;

		// Handle selection
		li.addEventListener('click', () => {
			searchInput.value = '';
			searchAutocomplete.classList.remove('show');
			renderGraph(p.quesId, true); // True marks it as an explicit search for sessionStorage
		});

		searchAutocomplete.appendChild(li);
	});

	searchAutocomplete.classList.add('show');
});

// Hide autocomplete dropdown when clicking anywhere outside
document.addEventListener('click', (e) => {
	if (!searchInput.contains(e.target) && !searchAutocomplete.contains(e.target)) {
		searchAutocomplete.classList.remove('show');
	}
});

// --- History Management (LRU Policy) ---
function loadHistory() {
	const saved = localStorage.getItem(STORAGE_KEY_HISTORY);
	if (saved) {
		try {
			searchHistory = JSON.parse(saved);
		} catch (e) {
			console.error("Failed to parse history", e);
			searchHistory = [];
		}
	}
	renderHistory();
}

function saveHistory() {
	localStorage.setItem(STORAGE_KEY_HISTORY, JSON.stringify(searchHistory));
}

function updateHistory(oldId, newId) {
	if (!oldId || oldId === newId) return;

	// Push the previously active ID to the top (front) of the history
	searchHistory.unshift(oldId);

	// Filter out the new ID to ensure it is not in the history while active
	searchHistory = searchHistory.filter(id => id !== newId);

	// Maintain the maximum configured size
	if (searchHistory.length > HISTORY_SIZE) {
		searchHistory = searchHistory.slice(0, HISTORY_SIZE);
	}

	saveHistory();
	renderHistory();
}

// Clear Button Event Listener
clearHistoryBtn.addEventListener('click', () => {
	searchHistory = [];
	saveHistory();
	renderHistory();
});

function renderHistory() {
	historyStack.innerHTML = '';

	// Safely manage the disabled state using strict DOM attributes
	if (searchHistory.length === 0) {
		// Leave the innerHTML empty instead of showing the "Empty" badge
		if (clearHistoryBtn) {
			clearHistoryBtn.setAttribute('disabled', 'true');
		}
		return;
	}

	// Forcefully remove the disabled attribute when history exists
	if (clearHistoryBtn) {
		clearHistoryBtn.removeAttribute('disabled');
	}

	// Generate LRU stack buttons (newest at top)
	searchHistory.forEach(id => {
		const btn = document.createElement('button');
		btn.className = 'btn btn-outline-secondary border-secondary bg-dark text-light fw-bold p-0 shadow-sm d-flex align-items-center justify-content-center';
		btn.style.width = '42px';
		btn.style.height = '42px';
		btn.textContent = id;

		// Lookup the problem in the master map to show its title on hover
		const probData = problemMap.get(Number(id));
		btn.title = probData ? probData.title : `Problem ${id}`;

		btn.addEventListener('click', () => {
			renderGraph(id);
		});

		historyStack.appendChild(btn);
	});
}

// --- Initialization & Default Fallback ---
async function initGraph() {
	try {
		// Fetch both JSON files concurrently
		const [probRes, tagsRes] = await Promise.all([
			fetch(PATH_LC_PROBLEM_LIST),
			fetch(PATH_LC_TOPIC_TAGS)
		]);

		if (!probRes.ok || !tagsRes.ok) throw new Error("Could not load data files");

		const allProblems = await probRes.json();
		const masterTagsList = await tagsRes.json();

		// Map tags and problems
		masterTagsList.forEach((tag, index) => {
			topicTagMap.set(tag.slug, { ...tag, order: index });
		});
		allProblems.forEach(p => problemMap.set(Number(p.quesId), p));

		// Load History from localStorage
		loadHistory();

		// Check Local Storage for persistent reload state
		const savedRoot = localStorage.getItem(STORAGE_KEY_CURRENT_ROOT);
		let startId = 1; // Default to Two Sum (ID 1)

		if (savedRoot && problemMap.has(Number(savedRoot))) {
			startId = Number(savedRoot);
		} else if (!problemMap.has(1)) {
			// Safety fallback if ID 1 somehow doesn't exist in the fetched map
			const allIds = Array.from(problemMap.keys());
			if (allIds.length > 0) startId = allIds[0];
		}

		renderGraph(startId);

	} catch (err) {
		console.error("Graph initialization failed:", err);
	}
}

function getRateColor(rate) {
	if (rate >= 75) return 'color-green';
	if (rate >= 50) return 'color-yellow';
	return 'color-red';
}

function getCategoryColor(category) {
	if (!category) return 'text-secondary';
	const cat = category.toLowerCase();

	if (cat === 'algorithms') return 'color-green';
	if (cat === 'database') return 'color-blue';
	if (cat.includes('javascript') || cat.includes('typescript')) return 'color-yellow';

	return 'text-secondary';
}

// --- Search & Input Validation ---
function handleSearch() {
	const val = searchInput.value.trim();

	// 1. Handle empty input
	if (!val) {
		errorMsg.textContent = "please enter quesid or title to search";
		errorMsg.classList.remove('d-none');

		if (errorTimeout) clearTimeout(errorTimeout);
		errorTimeout = setTimeout(() => {
			errorMsg.classList.add('d-none');
		}, 5000);
		return;
	}

	// 2. Check if input is a valid positive integer for graph generation
	if (!/^[1-9]\d*$/.test(val)) {
		errorMsg.textContent = "invalid quesid/title";
		errorMsg.classList.remove('d-none');

		if (errorTimeout) clearTimeout(errorTimeout);
		errorTimeout = setTimeout(() => {
			errorMsg.classList.add('d-none');
		}, 5000);

		searchInput.value = '';
		return;
	}

	// Pass 'true' to indicate this was an explicit search
	renderGraph(Number(val), true);
	searchInput.value = '';
}

// --- Render Graph Logic ---
function renderGraph(rootId, isExplicitSearch = false) {
	const rootData = problemMap.get(Number(rootId));

	if (!rootData) {
		errorMsg.textContent = "Problem not found.";
		errorMsg.classList.remove('d-none');

		if (errorTimeout) clearTimeout(errorTimeout);
		errorTimeout = setTimeout(() => {
			errorMsg.classList.add('d-none');
		}, 5000);

		return;
	}

	if (errorTimeout) clearTimeout(errorTimeout);
	errorMsg.classList.add('d-none');

	// Update LRU History stack before assigning the new active root
	if (currentRootId) {
		updateHistory(currentRootId, rootData.quesId);
	}

	currentRootId = rootData.quesId;

	// Persist the current root ID in local storage for page reloads
	localStorage.setItem(STORAGE_KEY_CURRENT_ROOT, currentRootId);

	populateSidePanel(rootData);

	container.innerHTML = '';
	svg.innerHTML = '';

	const width = viewport.clientWidth;
	const height = viewport.clientHeight;
	const centerX = width / 2;
	const centerY = height / 2;

	// Base radius (R)
	const baseRadius = Math.min(centerX, centerY) * 0.40;

	createNode(rootData, centerX, centerY, centerX, centerY, true);

	// Limit to 24 maximum similar problems
	const neighbours = (rootData.similarQuesIds || [])
		.map(id => problemMap.get(Number(id)))
		.filter(p => p !== undefined)
		.slice(0, 24);

	const total = neighbours.length;
	const innerCount = Math.min(12, total); // Up to 12 nodes in the inner ring

	neighbours.forEach((prob, i) => {
		let angle, currentRadius;

		if (i < innerCount) {
			// Inner Ring: Spread equally based on the actual number of inner nodes
			const angleStep = (2 * Math.PI) / innerCount;
			angle = (i * angleStep) - (Math.PI / 2);
			currentRadius = baseRadius * 1.0;
		} else {
			// Outer Ring: Only exists if inner is full (12 slots).
			// Start filling at the 0th gap (between 12 and 1 o'clock) sequentially.
			const outerIndex = i - innerCount;
			const angleStep = (2 * Math.PI) / 12; // Fixed 12-slot geometry

			// Apply 50% phase shift to perfectly bisect the inner ring gaps
			angle = (outerIndex * angleStep) + (angleStep / 2) - (Math.PI / 2);
			currentRadius = baseRadius * 1.5;
		}

		const nodeX = centerX + currentRadius * Math.cos(angle);
		const nodeY = centerY + currentRadius * Math.sin(angle);

		const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
		line.setAttribute('x1', centerX);
		line.setAttribute('y1', centerY);
		line.setAttribute('x2', centerX);
		line.setAttribute('y2', centerY);
		line.setAttribute('class', 'edge-line');
		svg.appendChild(line);

		createNode(prob, centerX, centerY, nodeX, nodeY, false);

		setTimeout(() => {
			line.setAttribute('x2', nodeX);
			line.setAttribute('y2', nodeY);
		}, 10);
	});
}

// --- Side Panel Population ---
function populateSidePanel(data) {
	rootDetails.classList.remove('d-none');

	document.getElementById('det-id').textContent = data.quesId;
	document.getElementById('det-title-link').href = `problem.html?quesId=${data.quesId}`;

	// 1. Build the Title HTML starting with the raw title
	let titleHtml = data.title;

	// 2. Append Lock for Premium Problems
	if (data.isPaidOnly) {
		titleHtml += `
            <span class="text-warning ms-1 align-middle" title="Premium Problem">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-lock-fill" viewBox="0 0 16 16">
                  <path d="M8 1a2 2 0 0 1 2 2v4H6V3a2 2 0 0 1 2-2zm3 6V3a3 3 0 0 0-6 0v4a2 2 0 0 0-2 2v5a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2z"/>
                </svg>
            </span>`;
	}

	// 3. Append Sync Timestamp Info Circle
	const syncIso = data.LC_SYNC_ISO || data.LAST_UPDATED_ISO;
	if (syncIso) {
		const d = new Date(syncIso);

		const day = String(d.getUTCDate()).padStart(2, '0');
		const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
		const month = monthNames[d.getUTCMonth()];
		const year = d.getUTCFullYear();

		const hours = String(d.getUTCHours()).padStart(2, '0');
		const minutes = String(d.getUTCMinutes()).padStart(2, '0');
		const seconds = String(d.getUTCSeconds()).padStart(2, '0');

		const syncDate = `${day}-${month}-${year} ${hours}:${minutes}:${seconds} (UTC)`;

		titleHtml += ` 
            <span title="Last synced with LeetCode: ${syncDate}" style="cursor: help;" class="text-secondary align-middle ms-1">
                <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-info-circle" viewBox="0 0 16 16">
                  <path d="M8 15A7 7 0 1 1 8 1a7 7 0 0 1 0 14m0 1A8 8 0 1 0 8 0a8 8 0 0 0 0 16"/>
                  <path d="m8.93 6.588-2.29.287-.082.38.45.083c.294.07.352.176.288.469l-.738 3.468c-.194.897.105 1.319.808 1.319.545 0 1.178-.252 1.465-.598l.088-.416c-.2.176-.492.246-.686.246-.275 0-.375-.193-.304-.533zM9 4.5a1 1 0 1 1-2 0 1 1 0 0 1 2 0"/>
                </svg>
            </span>`;
	}
	document.getElementById('det-title').innerHTML = titleHtml;

	// Row 1
	const diffEl = document.getElementById('det-difficulty');
	diffEl.textContent = data.difficulty;
	diffEl.className = `fw-bold diff-${data.difficulty}`;

	const categoryEl = document.getElementById('det-type');
	const categoryTitle = data.meta?.categoryTitle || data.categoryTitle || 'Unknown';
	categoryEl.textContent = categoryTitle;
	categoryEl.className = `fw-bold badge bg-dark border border-secondary ${getCategoryColor(categoryTitle)}`;

	// Row 2
	const likes = data.stats?.likes || 0;
	const dislikes = data.stats?.dislikes || 0;
	document.getElementById('det-likes').textContent = likes;
	document.getElementById('det-dislikes').textContent = dislikes;

	const totalVotes = likes + dislikes;
	const likeRate = totalVotes === 0 ? 0 : (likes / totalVotes) * 100;
	const likeRateEl = document.getElementById('det-like-rate');
	likeRateEl.textContent = totalVotes === 0 ? "NA" : `${likeRate.toFixed(2)}%`;
	likeRateEl.className = `fw-bold ${totalVotes === 0 ? 'text-secondary' : getRateColor(likeRate)}`;

	// Row 3: Accepted, Submissions, Acceptance Rate
	const acceptedEl = document.getElementById('det-accepted');
	acceptedEl.textContent = data.stats?.totalAccepted || '0';
	acceptedEl.title = `Accepted: ${Number(data.stats?.totalAcceptedRaw || 0).toLocaleString('en-US')}`;
	acceptedEl.style.cursor = 'help';

	const submissionsEl = document.getElementById('det-submissions');
	submissionsEl.textContent = data.stats?.totalSubmission || '0';
	submissionsEl.title = `Submissions: ${Number(data.stats?.totalSubmissionRaw || 0).toLocaleString('en-US')}`;
	submissionsEl.style.cursor = 'help';

	const acRateRaw = data.stats?.acRateRaw || 0;
	const acRateEl = document.getElementById('det-ac');
	acRateEl.textContent = `${acRateRaw.toFixed(2)}%`;
	acRateEl.className = `fw-bold ${getRateColor(acRateRaw)}`;

	// Row 4 (Solutions)
	const hasSol = data.meta?.hasSolution || false;
	const solEl = document.getElementById('det-has-solution');
	solEl.textContent = hasSol ? 'Yes' : 'No';
	solEl.className = `fw-bold ${hasSol ? 'text-primary' : 'text-secondary'}`;

	const hasVid = data.meta?.hasVideoSolution || false;
	const vidEl = document.getElementById('det-has-video');
	vidEl.textContent = hasVid ? 'Yes' : 'No';
	vidEl.className = `fw-bold ${hasVid ? 'text-primary' : 'text-secondary'}`;

	// Topic Tags
	const tagsContainer = document.getElementById('det-tags');
	const tags = data.topicTags || [];

	if (tags.length > 0) {
		// Sort tags using the exact order index from the backend master list[cite: 1]
		tags.sort((a, b) => {
			const orderA = topicTagMap.has(a.slug) ? topicTagMap.get(a.slug).order : 9999;
			const orderB = topicTagMap.has(b.slug) ? topicTagMap.get(b.slug).order : 9999;
			return orderA - orderB;
		});

		// Build HTML using the custom color[cite: 1]
		tagsContainer.innerHTML = tags.map(t => {
			const tagColor = topicTagMap.has(t.slug) ? topicTagMap.get(t.slug).color : '#6c757d';
			return `<span class="badge" style="background-color: ${tagColor} !important; color: #fff; font-weight: 500;">${t.name}</span>`;
		}).join('');
	} else {
		tagsContainer.innerHTML = '<span class="text-muted">None</span>';
	}
}

// --- Node Creation with Lock ---
function createNode(prob, startX, startY, endX, endY, isRoot) {
	const el = document.createElement('div');
	el.className = `node-card border-${prob.difficulty} diff-${prob.difficulty} ${isRoot ? 'node-root' : ''}`;
	el.style.left = `${startX}px`;
	el.style.top = `${startY}px`;
	el.textContent = prob.quesId;

	const titleText = isRoot ? `${prob.title} (Double-click to open)` : prob.title;
	el.setAttribute('data-title', titleText);

	// Add Lock for Premium Problems
	if (prob.isPaidOnly) {
		const lock = document.createElement('div');
		lock.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="currentColor" class="bi bi-lock-fill" viewBox="0 0 16 16">
              <path d="M8 1a2 2 0 0 1 2 2v4H6V3a2 2 0 0 1 2-2zm3 6V3a3 3 0 0 0-6 0v4a2 2 0 0 0-2 2v5a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2z"/>
            </svg>`;
		lock.className = 'position-absolute text-warning bg-dark rounded-circle d-flex align-items-center justify-content-center p-1';
		lock.style.top = '-10px';
		lock.style.right = '-10px';
		lock.style.pointerEvents = 'none';
		el.appendChild(lock);
	}

	el.addEventListener('click', () => {
		if (clickTimeout) {
			clearTimeout(clickTimeout);
			clickTimeout = null;
			if (isRoot) window.open(`problem.html?quesId=${prob.quesId}`, '_blank');
		} else {
			clickTimeout = setTimeout(() => {
				clickTimeout = null;
				if (!isRoot) renderGraph(prob.quesId);
			}, 250);
		}
	});

	container.appendChild(el);

	if (!isRoot) {
		setTimeout(() => {
			el.style.left = `${endX}px`;
			el.style.top = `${endY}px`;
		}, 10);
	}

	return el;
}

searchBtn.addEventListener('click', handleSearch);
searchInput.addEventListener('keypress', (e) => {
	if (e.key === 'Enter') handleSearch();
});

window.addEventListener('resize', () => {
	if (currentRootId) renderGraph(currentRootId);
});

initGraph();