import {
	GITHUB_LCS_URL,
	PATH_LC_SOLVED_PROBLEM_LIST,
	PATH_LC_PROBLEM_LIST,
	PATH_LC_TOPIC_TAGS,
	COLOR_PALETTE,
	DEFAULT_PAGE_SIZE
} from './config.js';

// ==========================================
// 1. STATE MANAGEMENT & VARIABLES
// ==========================================
let allProblems = [];
let currentProblems = [];
let currentSort = { column: 'id', direction: 'asc' };
const STORAGE_KEY = 'leetcode_lite_settings';

// Pagination & Filtering Variables
let pageSize = DEFAULT_PAGE_SIZE;
let currentPage = 1;
let selectedTags = [];
let tagLogic = 'OR';
let masterTagsList = [];
const topicTagMap = new Map();

// ==========================================
// 2. DOM ELEMENTS
// ==========================================
const DOM = {
	// Core Table & Inputs
	tableBody: document.getElementById('tableBody'),
	searchInput: document.getElementById('searchInput'),
	diffFilter: document.getElementById('diffFilter'),
	paidFilter: document.getElementById('paidFilter'),
	categoryFilter: document.getElementById('categoryFilter'),
	pageSizeSelect: document.getElementById('pageSizeSelect'),
	solutionFilter: document.getElementById('solutionFilter'),
	resetBtn: document.getElementById('resetBtn'),

	// Tag Dropdown
	tagDropdownMenu: document.getElementById('tagDropdownMenu'),
	tagDropdownText: document.getElementById('tagDropdownText'),
	tagSearchInput: document.getElementById('tagSearchInput'),
	tagLogicToggle: document.getElementById('tagLogicToggle'),
	tagLogicLabel: document.getElementById('tagLogicLabel'),

	// Stats
	statTotal: document.getElementById('stat-total'),
	statFree: document.getElementById('stat-free'),
	statPaid: document.getElementById('stat-paid'),
	statEasy: document.getElementById('stat-easy'),
	statMedium: document.getElementById('stat-medium'),
	statHard: document.getElementById('stat-hard'),

	// Pagination
	btnFirst: document.getElementById('btn-first'),
	btnPrev: document.getElementById('btn-prev'),
	btnNext: document.getElementById('btn-next'),
	btnLast: document.getElementById('btn-last'),
	pageInfo: document.getElementById('page-info')
};

// ==========================================
// 3. INITIALIZATION & DATA FETCHING
// ==========================================

/**
 * Initializes the application by fetching data and setting up listeners.
 */
async function init() {
	setupEventListeners();
	await loadProblems();
}

/**
 * Fetches all required JSON files concurrently, maps solved status, and triggers initial UI render.
 */
async function loadProblems() {
	try {
		const [probRes, tagsRes, solvedRes] = await Promise.all([
			fetch(PATH_LC_PROBLEM_LIST),
			fetch(PATH_LC_TOPIC_TAGS),
			fetch(GITHUB_LCS_URL + PATH_LC_SOLVED_PROBLEM_LIST)
		]);

		if (!probRes.ok || !tagsRes.ok || !solvedRes.ok) throw new Error(`HTTP error! status: ${probRes.status}`);

		allProblems = await probRes.json();
		masterTagsList = await tagsRes.json();
		const solvedList = await solvedRes.json();

		// Create a fast lookup set for solved problems
		const solvedMap = new Set();
		solvedList.forEach(p => {
			if (p.isAccepted) solvedMap.add(p.quesId);
		});

		// Map tag metadata for table coloring and sorting
		masterTagsList.forEach((tag, index) => {
			topicTagMap.set(tag.slug, { ...tag, order: index });
		});

		// Append robust solution availability flags
		allProblems.forEach(p => {
			const officialAvailable = p.meta?.hasSolution || p.hasSolution || p.solution?.canSeeDetail;
			p.hasLeetcodeSolution = (officialAvailable === true || String(officialAvailable).toLowerCase() === 'true');
			p.hasLeetLiteSolution = solvedMap.has(p.quesId);
		});

		currentProblems = [...allProblems];

		populateTagDropdown();
		populateCategoryDropdown();
		loadSettings();
		applyFilters();

	} catch (error) {
		console.error("Failed to load problem list:", error);
		DOM.tableBody.innerHTML = `<tr><td colspan="8" class="text-center text-danger py-4">Error loading problem data. Please check your data directory.</td></tr>`;
	}
}

// ==========================================
// 4. CORE LOGIC (FILTER, SORT, RENDER)
// ==========================================

/**
 * Filters the master problem list based on search term, category, difficulty, tags, and solution availability.
 */
function applyFilters() {
	const searchTerm = DOM.searchInput.value.toLowerCase();
	const diff = DOM.diffFilter.value;
	const paid = DOM.paidFilter.value;
	const cat = DOM.categoryFilter.value;
	const sol = DOM.solutionFilter.value;

	currentProblems = allProblems.filter(p => {
		const matchesSearch = p.quesId.toString() === searchTerm || p.title.toLowerCase().includes(searchTerm);
		if (searchTerm && !matchesSearch) return false;

		// Compound Difficulty Filter
		if (diff !== "All") {
			if (diff === "Easy and Medium" && p.difficulty === "Hard") return false;
			else if (diff === "Medium and Hard" && p.difficulty === "Easy") return false;
			else if (diff !== "Easy and Medium" && diff !== "Medium and Hard" && p.difficulty !== diff) return false;
		}

		if (paid === "Free" && p.isPaidOnly) return false;
		if (paid === "Paid" && !p.isPaidOnly) return false;
		if (cat !== "All" && p.categoryTitle !== cat) return false;

		// Solution Availability Logic
		if (sol !== "All") {
			if (sol === "LeetLite" && !p.hasLeetLiteSolution) return false;
			if (sol === "Leetcode" && !p.hasLeetcodeSolution) return false;
			if (sol === "LeetLite Only" && (!p.hasLeetLiteSolution || p.hasLeetcodeSolution)) return false;
			if (sol === "Leetcode Only" && (!p.hasLeetcodeSolution || p.hasLeetLiteSolution)) return false;
			if (sol === "LeetLite and Leetcode" && !(p.hasLeetLiteSolution && p.hasLeetcodeSolution)) return false;
		}

		// Tag Filter Logic (OR / AND)
		if (selectedTags.length > 0) {
			const problemTags = p.topicTags || [];
			if (tagLogic === 'OR') {
				const hasAnySelectedTag = selectedTags.some(selectedTagSlug => problemTags.some(pt => pt.slug === selectedTagSlug));
				if (!hasAnySelectedTag) return false;
			} else {
				const hasAllSelectedTags = selectedTags.every(selectedTagSlug => problemTags.some(pt => pt.slug === selectedTagSlug));
				if (!hasAllSelectedTags) return false;
			}
		}

		return true;
	});

	currentPage = 1;
	applySort();
}

/**
 * Sorts the filtered problems based on the active column and direction.
 */
function applySort() {
	currentProblems.sort((a, b) => {
		let valA, valB;

		if (currentSort.column === 'id') {
			valA = a.quesId; valB = b.quesId;
		} else if (currentSort.column === 'title') {
			valA = a.title.toLowerCase(); valB = b.title.toLowerCase();
		} else if (currentSort.column === 'difficulty') {
			const weight = { "Easy": 1, "Medium": 2, "Hard": 3 };
			valA = weight[a.difficulty] || 0; valB = weight[b.difficulty] || 0;
		} else if (currentSort.column === 'likeRate') {
			valA = truncateToTwoDecimals(calculateLikeRate(a.stats.likes || 0, a.stats.dislikes || 0));
			valB = truncateToTwoDecimals(calculateLikeRate(b.stats.likes || 0, b.stats.dislikes || 0));
		} else if (currentSort.column === 'acRate') {
			valA = truncateToTwoDecimals(a.stats.acRateRaw || 0);
			valB = truncateToTwoDecimals(b.stats.acRateRaw || 0);
		} else if (currentSort.column === 'category') {
			valA = (a.categoryTitle || '').toLowerCase();
			valB = (b.categoryTitle || '').toLowerCase();
		} else if (currentSort.column === 'solution') {
			const getSolWeight = (prob) => {
				if (prob.hasLeetcodeSolution && prob.hasLeetLiteSolution) return 3;
				if (prob.hasLeetLiteSolution) return 2;
				if (prob.hasLeetcodeSolution) return 1;
				return 0;
			};
			valA = getSolWeight(a);
			valB = getSolWeight(b);
		}

		if (valA < valB) return currentSort.direction === 'asc' ? -1 : 1;
		if (valA > valB) return currentSort.direction === 'asc' ? 1 : -1;

		return a.quesId - b.quesId; // Default tie-breaker
	});

	renderTable();
}

/**
 * Renders the paginated rows into the HTML table and updates layout UI.
 */
function renderTable() {

	// --- Nested UI Formatting Helpers (Restricted to render scope) ---
	const getRateColor = (rate) => rate >= 75 ? 'color-green' : (rate >= 50 ? 'color-yellow' : 'color-red');
	const getDifficultyColor = (diff) => diff === 'Easy' ? 'color-green' : (diff === 'Medium' ? 'color-yellow' : 'color-red');
	const getCategoryColor = (cat) => {
		if (!cat) return 'text-secondary';
		const c = cat.toLowerCase();
		if (c === 'algorithms') return 'color-green';
		if (c === 'database') return 'color-blue';
		if (c.includes('javascript') || c.includes('typescript')) return 'color-yellow';
		return 'text-secondary';
	};

	const updateStats = () => {
		let easy = 0, medium = 0, hard = 0, free = 0, paid = 0;
		currentProblems.forEach(p => {
			if (p.difficulty === 'Easy') easy++;
			else if (p.difficulty === 'Medium') medium++;
			else if (p.difficulty === 'Hard') hard++;
			if (p.isPaidOnly) paid++; else free++;
		});
		DOM.statTotal.textContent = currentProblems.length;
		DOM.statFree.textContent = free;
		DOM.statPaid.textContent = paid;
		DOM.statEasy.textContent = easy;
		DOM.statMedium.textContent = medium;
		DOM.statHard.textContent = hard;
	};

	const updatePaginationUI = (totalPages) => {
		if (totalPages === 0) totalPages = 1;
		DOM.pageInfo.textContent = `Page ${currentPage} of ${totalPages}`;
		DOM.btnFirst.disabled = DOM.btnPrev.disabled = (currentPage === 1);
		DOM.btnNext.disabled = DOM.btnLast.disabled = (currentPage === totalPages);
	};

	const updateSortIcons = () => {
		document.querySelectorAll('.sort-icon').forEach(icon => {
			icon.innerHTML = '▲▼';
			icon.classList.remove('active');
		});
		const activeIcon = document.getElementById(`icon-${currentSort.column}`);
		if (activeIcon) {
			activeIcon.innerHTML = currentSort.direction === 'asc' ? '▲' : '▼';
			activeIcon.classList.add('active');
		}
	};
	// -----------------------------------------------------------------

	DOM.tableBody.innerHTML = '';

	if (currentProblems.length === 0) {
		DOM.tableBody.innerHTML = '<tr><td colspan="8" class="text-center text-muted py-4">No problems found.</td></tr>';
		updatePaginationUI(0);
		updateStats();
		return;
	}

	const totalPages = Math.ceil(currentProblems.length / pageSize) || 1;
	if (currentPage > totalPages) currentPage = totalPages;

	const startIndex = (currentPage - 1) * pageSize;
	const endIndex = startIndex + pageSize;
	const paginatedProblems = currentProblems.slice(startIndex, endIndex);

	paginatedProblems.forEach(p => {
		const totalVotes = (p.stats.likes || 0) + (p.stats.dislikes || 0);
		const likeRate = calculateLikeRate(p.stats.likes || 0, p.stats.dislikes || 0);

		// Apply strict truncation to match the sorting comparator perfectly
		const truncatedLikeRate = truncateToTwoDecimals(likeRate);
		const likeRateDisplay = totalVotes === 0 ? "NA" : `${truncatedLikeRate.toFixed(2)}%`;
		const likeRateClass = totalVotes === 0 ? "text-secondary" : getRateColor(truncatedLikeRate);

		const acRate = p.stats.acRateRaw || 0;
		const truncatedAcRate = truncateToTwoDecimals(acRate);

		// Replace the star with a Bootstrap lock SVG for premium problems
		const premiumLock = p.isPaidOnly ? `
            <span class="text-warning ms-1 align-middle" title="Premium Problem">
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="currentColor" class="bi bi-lock-fill" viewBox="0 0 16 16">
                  <path d="M8 1a2 2 0 0 1 2 2v4H6V3a2 2 0 0 1 2-2zm3 6V3a3 3 0 0 0-6 0v4a2 2 0 0 0-2 2v5a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2z"/>
                </svg>
            </span>` : '';

		// FIX: Extract tags and category before they are evaluated[cite: 8]
		const category = p.categoryTitle || '';
		const tags = p.topicTags || [];

		// Generate Tags HTML
		let tagsHTML = '<span class="text-muted fw-semibold">N/A</span>';
		let tagsTitle = 'N/A';

		if (tags.length > 0) {
			tags.sort((a, b) => {
				const orderA = topicTagMap.has(a.slug) ? topicTagMap.get(a.slug).order : 9999;
				const orderB = topicTagMap.has(b.slug) ? topicTagMap.get(b.slug).order : 9999;
				return orderA - orderB;
			});

			tagsHTML = tags.map(t => {
				const tagColor = topicTagMap.has(t.slug) ? topicTagMap.get(t.slug).color : COLOR_PALETTE.charcoal;
				return `<span class="badge" style="background-color: ${tagColor} !important; border: 1px solid ${COLOR_PALETTE.darkGray}; margin-right: 5px; font-weight: 400; color: ${COLOR_PALETTE.white};">${t.name}</span>`;
			}).join('');
			tagsTitle = tags.map(t => t.name).join(', ');
		}

		// Generate Solution HTML
		let solHtml = '<span class="text-secondary fw-semibold">N/A</span>';
		const badgeLeetLite = `<span class="badge" style="background-color: ${COLOR_PALETTE.green} !important; border: 1px solid ${COLOR_PALETTE.darkGray}; font-weight: 500; color: ${COLOR_PALETTE.white};">LeetLite</span>`;
		const badgeLeetcode = `<span class="badge" style="background-color: ${COLOR_PALETTE.yellow} !important; border: 1px solid ${COLOR_PALETTE.darkGray}; font-weight: 500; color: ${COLOR_PALETTE.white};">Leetcode</span>`;

		if (p.hasLeetcodeSolution && p.hasLeetLiteSolution) solHtml = `${badgeLeetLite} <span class="ms-1">${badgeLeetcode}</span>`;
		else if (p.hasLeetLiteSolution) solHtml = badgeLeetLite;
		else if (p.hasLeetcodeSolution) solHtml = badgeLeetcode;

		// Build Table Row
		const tr = document.createElement('tr');
		tr.innerHTML = `
            <td class="text-secondary fw-bold">${p.quesId}</td>
            <td>
                <a href="html/problem.html?quesId=${p.quesId}" class="text-decoration-none text-reset fw-semibold" target="_blank">
                    ${p.title}
                </a>${premiumLock}
            </td>
            <td class="${getDifficultyColor(p.difficulty)}">${p.difficulty}</td>
            <td class="${likeRateClass}">${likeRateDisplay}</td>
            <td class="${getRateColor(truncatedAcRate)}">${truncatedAcRate.toFixed(2)}%</td>
            <td class="${getCategoryColor(category)}">${category}</td>
            <td>${solHtml}</td>
            <td><div class="tags-wrapper" title="${tagsTitle}">${tagsHTML}</div></td>
        `;
		DOM.tableBody.appendChild(tr);
	});

	updateSortIcons();
	updateStats();
	updatePaginationUI(totalPages);
}

// ==========================================
// 5. CALCULATION HELPERS
// ==========================================
function calculateLikeRate(likes, dislikes) {
	const total = likes + dislikes;
	return total === 0 ? 0 : ((likes / total) * 100);
}

function truncateToTwoDecimals(num) {
	return Math.trunc(num * 100) / 100;
}

// ==========================================
// 6. COMPONENT POPULATION & UI UPDATES
// ==========================================

/**
 * Builds the searchable tag dropdown using metadata mapped from the backend.
 */
function populateTagDropdown() {
	DOM.tagDropdownMenu.innerHTML = '';
	masterTagsList.forEach(tag => {
		const li = document.createElement('li');
		li.className = 'tag-item';
		li.dataset.name = tag.name.toLowerCase();
		li.innerHTML = `
            <div class="dropdown-item form-check ms-1 me-1 mb-0 rounded" style="padding-left: 2.2rem;">
                <input class="form-check-input tag-checkbox" type="checkbox" value="${tag.slug}" id="tag-${tag.slug}">
                <label class="form-check-label w-100 d-flex justify-content-between pe-2" for="tag-${tag.slug}">
                    <span class="text-truncate" style="max-width: 80%;">${tag.name}</span>
                    <span class="small fw-semibold" style="color: ${tag.color};">(${tag.freq})</span>
                </label>
            </div>
        `;
		DOM.tagDropdownMenu.appendChild(li);
	});
}

/**
 * Extracts unique categories and populates the custom Category dropdown.
 */
function populateCategoryDropdown() {
	const categorySet = new Set();
	allProblems.forEach(p => {
		if (p.categoryTitle && p.categoryTitle.trim() !== '') categorySet.add(p.categoryTitle);
	});

	const sortedCategories = Array.from(categorySet).sort();
	const catMenu = document.getElementById('categoryDropdownMenu');

	catMenu.innerHTML = '<li><button class="dropdown-item" type="button" data-value="All">All Categories</button></li>';
	sortedCategories.forEach(cat => {
		const li = document.createElement('li');
		li.innerHTML = `<button class="dropdown-item" type="button" data-value="${cat}">${cat}</button>`;
		catMenu.appendChild(li);
	});

	const saved = localStorage.getItem(STORAGE_KEY);
	if (saved) {
		try {
			const settings = JSON.parse(saved);
			if (settings.category) setCustomDropdownUI('categoryFilter', settings.category);
		} catch (e) { }
	}
}

/**
 * Updates the text displayed on the tag dropdown button based on selection count.
 */
function updateTagDropdownText() {
	if (selectedTags.length === 0) {
		DOM.tagDropdownText.textContent = 'Select Tags...';
	} else if (selectedTags.length === 1) {
		const tagData = topicTagMap.get(selectedTags[0]);
		DOM.tagDropdownText.textContent = tagData ? tagData.name : selectedTags[0];
	} else {
		DOM.tagDropdownText.textContent = `${selectedTags.length} Tags Selected`;
	}
}

/**
 * Synchronizes custom Bootstrap dropdown UI state with its hidden input.
 */
function setCustomDropdownUI(inputId, value) {
	const input = document.getElementById(inputId);
	const textSpan = document.getElementById(inputId + 'Text');
	if (input) input.value = value;

	const menu = document.querySelector(`.custom-dropdown-menu[data-target="${inputId}"]`);
	if (menu && textSpan) {
		const option = menu.querySelector(`[data-value="${value}"]`);
		if (option) textSpan.textContent = option.textContent;
	}
}

// ==========================================
// 7. STATE PERSISTENCE
// ==========================================
function saveSettings() {
	const settings = {
		search: DOM.searchInput.value,
		diff: DOM.diffFilter.value,
		paid: DOM.paidFilter.value,
		category: DOM.categoryFilter.value,
		solution: DOM.solutionFilter.value,
		tags: selectedTags,
		tagLogic: tagLogic,
		sort: currentSort,
		page: currentPage,
		pageSize: pageSize
	};
	localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}

function loadSettings() {
	const saved = localStorage.getItem(STORAGE_KEY);
	if (!saved) return;

	try {
		const settings = JSON.parse(saved);

		DOM.searchInput.value = settings.search || '';
		setCustomDropdownUI('diffFilter', settings.diff || 'All');
		setCustomDropdownUI('paidFilter', settings.paid || 'All');
		setCustomDropdownUI('solutionFilter', settings.solution || 'All');

		if (settings.sort) currentSort = settings.sort;
		if (settings.page) currentPage = settings.page;
		if (settings.pageSize) {
			pageSize = settings.pageSize;
			setCustomDropdownUI('pageSizeSelect', pageSize);
		}
		if (settings.tags) {
			selectedTags = settings.tags;
			updateTagDropdownText();
			document.querySelectorAll('.tag-checkbox').forEach(cb => {
				if (selectedTags.includes(cb.value)) cb.checked = true;
			});
		}
		if (settings.tagLogic) {
			tagLogic = settings.tagLogic;
			DOM.tagLogicToggle.checked = (tagLogic === 'AND');
			DOM.tagLogicLabel.textContent = tagLogic;
			if (tagLogic === 'AND') DOM.tagLogicLabel.classList.replace('text-secondary', 'text-primary');
		}
	} catch (e) {
		console.error("Failed to parse local settings", e);
	}
}

// ==========================================
// 8. EVENT LISTENERS
// ==========================================
function setupEventListeners() {

	// Search Input
	DOM.searchInput.addEventListener('keyup', () => {
		applyFilters();
		saveSettings();
	});

	// Custom Dropdown Menus (Event Delegation)
	document.addEventListener('click', (e) => {
		if (e.target.matches('.custom-dropdown-menu .dropdown-item')) {
			const val = e.target.getAttribute('data-value');
			const text = e.target.textContent;
			const targetId = e.target.closest('.custom-dropdown-menu').getAttribute('data-target');

			const input = document.getElementById(targetId);
			const textSpan = document.getElementById(targetId + 'Text');

			if (input) input.value = val;
			if (textSpan) textSpan.textContent = text;

			if (targetId === 'pageSizeSelect') {
				pageSize = parseInt(val, 10);
				currentPage = 1;
				renderTable();
			} else {
				currentPage = 1;
				applyFilters();
			}
			saveSettings();
		}
	});

	// Sortable Table Headers
	document.querySelectorAll('th.sortable').forEach(th => {
		th.addEventListener('click', () => {
			const column = th.getAttribute('data-sort');
			if (currentSort.column === column) {
				currentSort.direction = currentSort.direction === 'asc' ? 'desc' : 'asc';
			} else {
				currentSort.column = column;
				currentSort.direction = 'asc';
			}
			currentPage = 1;
			applySort();
			saveSettings();
		});
	});

	// Tag Logic Toggle Switch
	DOM.tagLogicToggle.addEventListener('change', (e) => {
		tagLogic = e.target.checked ? 'AND' : 'OR';
		DOM.tagLogicLabel.textContent = tagLogic;
		if (tagLogic === 'AND') {
			DOM.tagLogicLabel.classList.replace('text-secondary', 'text-primary');
		} else {
			DOM.tagLogicLabel.classList.replace('text-primary', 'text-secondary');
		}
		currentPage = 1;
		applyFilters();
		saveSettings();
	});

	// Tag Dropdown Menus (Checkbox Event Delegation)
	DOM.tagDropdownMenu.addEventListener('change', (e) => {
		if (e.target.matches('.tag-checkbox')) {
			if (e.target.checked) {
				selectedTags.push(e.target.value);
			} else {
				selectedTags = selectedTags.filter(t => t !== e.target.value);
			}
			updateTagDropdownText();
			currentPage = 1;
			applyFilters();
			saveSettings();
		}
	});

	// Tag Real-Time Search Filtering
	DOM.tagSearchInput.addEventListener('input', (e) => {
		const term = e.target.value.toLowerCase();
		document.querySelectorAll('#tagDropdownMenu .tag-item').forEach(li => {
			li.style.display = li.dataset.name.includes(term) ? '' : 'none';
		});
	});

	// Reset Button
	DOM.resetBtn.addEventListener('click', () => {
		DOM.searchInput.value = '';
		setCustomDropdownUI('diffFilter', 'All');
		setCustomDropdownUI('paidFilter', 'All');
		setCustomDropdownUI('categoryFilter', 'All');
		setCustomDropdownUI('solutionFilter', 'All');
		setCustomDropdownUI('pageSizeSelect', '50');

		selectedTags = [];
		DOM.tagSearchInput.value = '';
		document.querySelectorAll('.tag-checkbox').forEach(cb => cb.checked = false);
		document.querySelectorAll('#tagDropdownMenu .tag-item').forEach(li => li.style.display = '');
		updateTagDropdownText();

		tagLogic = 'OR';
		DOM.tagLogicToggle.checked = false;
		DOM.tagLogicLabel.textContent = 'OR';
		DOM.tagLogicLabel.classList.replace('text-primary', 'text-secondary');

		currentSort = { column: 'id', direction: 'asc' };
		currentPage = 1;
		pageSize = DEFAULT_PAGE_SIZE;

		applyFilters();
		saveSettings();
	});

	// Pagination Controls
	DOM.btnFirst.addEventListener('click', () => { currentPage = 1; renderTable(); saveSettings(); });
	DOM.btnPrev.addEventListener('click', () => { if (currentPage > 1) { currentPage--; renderTable(); saveSettings(); } });
	DOM.btnNext.addEventListener('click', () => {
		const totalPages = Math.ceil(currentProblems.length / pageSize) || 1;
		if (currentPage < totalPages) { currentPage++; renderTable(); saveSettings(); }
	});
	DOM.btnLast.addEventListener('click', () => {
		currentPage = Math.ceil(currentProblems.length / pageSize) || 1;
		renderTable();
		saveSettings();
	});
}

// Bootstrap Application
init();