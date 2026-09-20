const GITHUB_LCS_URL = 'https://raw.githubusercontent.com/shivanshsanoria1/LeetcodeSolutions/main';
const PATH_LC_PROBLEM_LIST = '/util/web/generated/json-min/lc-problem-list-min.json';
const PATH_LC_TOPIC_TAGS = '/util/web/generated/json-min/lc-topic-tag-min.json';
const PATH_LC_SOLVED_PROBLEM_LIST = '/util/web/generated/json-min/lc-solved-problems-list-min.json';

// --- 1. State Management ---
let allProblems = [];
let currentProblems = [];
let currentSort = { column: 'id', direction: 'asc' };
const STORAGE_KEY = 'leetcode_lite_settings';

// Pagination & Tag variables
let pageSize = 50;
let currentPage = 1;
let selectedTags = []; // Stores slugs
let tagLogic = 'OR';
let masterTagsList = []; // Will store the raw array from backend
const topicTagMap = new Map(); // Maps slug -> { name, color, order }

// DOM Elements: Tag Dropdown
const tagDropdownMenu = document.getElementById('tagDropdownMenu');
const tagDropdownText = document.getElementById('tagDropdownText');
const tagSearchInput = document.getElementById('tagSearchInput');
const tagLogicToggle = document.getElementById('tagLogicToggle');
const tagLogicLabel = document.getElementById('tagLogicLabel');

// DOM Elements
const tableBody = document.getElementById('tableBody');
const searchInput = document.getElementById('searchInput');
const diffFilter = document.getElementById('diffFilter');
const paidFilter = document.getElementById('paidFilter');
const categoryFilter = document.getElementById('categoryFilter');
const pageSizeSelect = document.getElementById('pageSizeSelect');
const solutionFilter = document.getElementById('solutionFilter');
const resetBtn = document.getElementById('resetBtn');

// DOM Elements: Stats
const statTotal = document.getElementById('stat-total');
const statFree = document.getElementById('stat-free');
const statPaid = document.getElementById('stat-paid');
const statEasy = document.getElementById('stat-easy');
const statMedium = document.getElementById('stat-medium');
const statHard = document.getElementById('stat-hard');

// DOM Elements: Pagination
const btnFirst = document.getElementById('btn-first');
const btnPrev = document.getElementById('btn-prev');
const btnNext = document.getElementById('btn-next');
const btnLast = document.getElementById('btn-last');
const pageInfo = document.getElementById('page-info');

// --- 2. Data Fetching & Storage ---
async function loadProblems() {
	try {
		// Fetch all three JSON files concurrently
		const [probRes, tagsRes, solvedRes] = await Promise.all([
			fetch(GITHUB_LCS_URL + PATH_LC_PROBLEM_LIST),
			fetch(GITHUB_LCS_URL + PATH_LC_TOPIC_TAGS),
			fetch(GITHUB_LCS_URL + PATH_LC_SOLVED_PROBLEM_LIST)
		]);

		if (!probRes.ok || !tagsRes.ok || !solvedRes.ok) throw new Error(`HTTP error! status: ${probRes.status}`);

		allProblems = await probRes.json();
		masterTagsList = await tagsRes.json();
		const solvedList = await solvedRes.json();

		// Create a fast Set for solved problems (isAccepted: true)
		const solvedMap = new Set();
		solvedList.forEach(p => {
			if (p.isAccepted) solvedMap.add(p.quesId);
		});

		masterTagsList.forEach((tag, index) => {
			topicTagMap.set(tag.slug, { ...tag, order: index });
		});

		// Append solution availability flags to the master problem list
		// Append solution availability flags to the master problem list
		allProblems.forEach(p => {
			// Robust check: handles booleans, strings, and flattened JSON structures
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
		tableBody.innerHTML = `<tr><td colspan="8" class="text-center text-danger py-4">Error loading problem data. Please check your data directory.</td></tr>`;
	}
}

function saveSettings() {
	const settings = {
		search: searchInput.value,
		diff: diffFilter.value,
		paid: paidFilter.value,
		category: categoryFilter.value,
		solution: solutionFilter.value,
		tags: selectedTags,
		tagLogic: tagLogic, // Save the state
		sort: currentSort,
		page: currentPage,
		pageSize: pageSize
	};
	localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
}

function loadSettings() {
	const saved = localStorage.getItem(STORAGE_KEY);
	if (saved) {
		try {
			const settings = JSON.parse(saved);

			searchInput.value = settings.search || '';
			diffFilter.value = settings.diff || 'All';
			paidFilter.value = settings.paid || 'All';
			categoryFilter.value = settings.category || 'All';
			solutionFilter.value = settings.solution || 'All';

			if (settings.sort) currentSort = settings.sort;
			if (settings.page) currentPage = settings.page;
			if (settings.pageSize) {
				pageSize = settings.pageSize;
				pageSizeSelect.value = pageSize;
			}
			if (settings.tags) {
				selectedTags = settings.tags;
				updateTagDropdownText();

				document.querySelectorAll('.tag-checkbox').forEach(cb => {
					if (selectedTags.includes(cb.value)) {
						cb.checked = true;
					}
				});
			}
			if (settings.tagLogic) {
				tagLogic = settings.tagLogic;
				tagLogicToggle.checked = (tagLogic === 'AND');
				tagLogicLabel.textContent = tagLogic;
				if (tagLogic === 'AND') {
					tagLogicLabel.classList.replace('text-secondary', 'text-primary');
				}
			}

		} catch (e) {
			console.error("Failed to parse local settings", e);
		}
	}
}

// --- 3. Tag Dropdown Setup ---
function populateTagDropdown() {
	tagDropdownMenu.innerHTML = '';

	// Directly iterate over the pre-sorted list from the backend
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
		tagDropdownMenu.appendChild(li);
	});

	// Checkbox change listener
	document.querySelectorAll('.tag-checkbox').forEach(cb => {
		cb.addEventListener('change', (e) => {
			if (e.target.checked) {
				selectedTags.push(e.target.value);
			} else {
				selectedTags = selectedTags.filter(t => t !== e.target.value);
			}
			updateTagDropdownText();
			currentPage = 1;
			applyFilters();
			saveSettings();
		});
	});

	// Search Input listener for real-time filtering
	tagSearchInput.addEventListener('input', (e) => {
		const term = e.target.value.toLowerCase();
		document.querySelectorAll('#tagDropdownMenu .tag-item').forEach(li => {
			if (li.dataset.name.includes(term)) {
				li.style.display = '';
			} else {
				li.style.display = 'none';
			}
		});
	});
}

function updateTagDropdownText() {
	if (selectedTags.length === 0) {
		tagDropdownText.textContent = 'Select Tags...';
	} else if (selectedTags.length === 1) {
		const tagData = topicTagMap.get(selectedTags[0]);
		tagDropdownText.textContent = tagData ? tagData.name : selectedTags[0];
	} else {
		tagDropdownText.textContent = `${selectedTags.length} Tags Selected`;
	}
}

// --- 4. Helper Functions ---
function calculateLikeRate(likes, dislikes) {
	const total = likes + dislikes;
	if (total === 0) return 0;
	return ((likes / total) * 100);
}

// Strictly truncates a number to 2 decimal places without rounding
function truncateToTwoDecimals(num) {
	return Math.trunc(num * 100) / 100;
}

function getRateColor(rate) {
	if (rate >= 75) return 'color-green';
	if (rate >= 50) return 'color-yellow';
	return 'color-red';
}

function getDifficultyColor(difficulty) {
	if (difficulty === 'Easy') return 'color-green';
	if (difficulty === 'Medium') return 'color-yellow';
	return 'color-red';
}

function updateStats() {
	let easy = 0, medium = 0, hard = 0;
	let free = 0, paid = 0;

	currentProblems.forEach(p => {
		if (p.difficulty === 'Easy') easy++;
		else if (p.difficulty === 'Medium') medium++;
		else if (p.difficulty === 'Hard') hard++;

		if (p.isPaidOnly) paid++;
		else free++;
	});

	statTotal.textContent = currentProblems.length;
	statFree.textContent = free;
	statPaid.textContent = paid;
	statEasy.textContent = easy;
	statMedium.textContent = medium;
	statHard.textContent = hard;
}

function updatePaginationUI(totalPages) {
	if (totalPages === 0) totalPages = 1;
	pageInfo.textContent = `Page ${currentPage} of ${totalPages}`;

	btnFirst.disabled = currentPage === 1;
	btnPrev.disabled = currentPage === 1;
	btnNext.disabled = currentPage === totalPages;
	btnLast.disabled = currentPage === totalPages;
}

// --- Category Dropdown Setup ---
function populateCategoryDropdown() {
	const categorySet = new Set();

	// Extract unique categories, ignoring empty or null values
	allProblems.forEach(p => {
		if (p.categoryTitle && p.categoryTitle.trim() !== '') {
			categorySet.add(p.categoryTitle);
		}
	});

	// Alphabetize the categories
	const sortedCategories = Array.from(categorySet).sort();

	// Preserve the default "All Categories" option, then append dynamic options
	categoryFilter.innerHTML = '<option value="All">All Categories</option>';

	sortedCategories.forEach(cat => {
		const option = document.createElement('option');
		option.value = cat;
		option.textContent = cat;
		categoryFilter.appendChild(option);
	});
}

function renderTable() {
	tableBody.innerHTML = '';

	if (currentProblems.length === 0) {
		tableBody.innerHTML = '<tr><td colspan="8" class="text-center text-muted py-4">No problems found.</td></tr>';
		updatePaginationUI(0);
		updateStats(); // <-- Added this to fix the counter bug!
		return;
	}

	const totalPages = Math.ceil(currentProblems.length / pageSize) || 1;
	if (currentPage > totalPages) currentPage = totalPages;

	const startIndex = (currentPage - 1) * pageSize;
	const endIndex = startIndex + pageSize;
	const paginatedProblems = currentProblems.slice(startIndex, endIndex);

	console.log(paginatedProblems[0])

	paginatedProblems.forEach(p => {
		const totalVotes = (p.stats.likes || 0) + (p.stats.dislikes || 0);
		const likeRate = calculateLikeRate(p.stats.likes || 0, p.stats.dislikes || 0);

		const likeRateDisplay = totalVotes === 0 ? "NA" : `${likeRate.toFixed(2)}%`;
		const likeRateClass = totalVotes === 0 ? "text-secondary" : getRateColor(likeRate);

		const acRate = p.stats.acRateRaw || 0;

		// Replace the star with a Bootstrap lock SVG for premium problems
		const premiumLock = p.isPaidOnly ? `
            <span class="text-warning ms-1 align-middle" title="Premium Problem">
                <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" fill="currentColor" class="bi bi-lock-fill" viewBox="0 0 16 16">
                  <path d="M8 1a2 2 0 0 1 2 2v4H6V3a2 2 0 0 1 2-2zm3 6V3a3 3 0 0 0-6 0v4a2 2 0 0 0-2 2v5a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2z"/>
                </svg>
            </span>` : '';

		const tags = p.topicTags || [];

		let tagsHTML = '<span class="text-muted fw-semibold">N/A</span>';
		let tagsTitle = 'N/A';

		if (tags.length > 0) {
			// Sort tags using the exact order index from the backend master list
			tags.sort((a, b) => {
				const orderA = topicTagMap.has(a.slug) ? topicTagMap.get(a.slug).order : 9999;
				const orderB = topicTagMap.has(b.slug) ? topicTagMap.get(b.slug).order : 9999;
				return orderA - orderB;
			});

			// Build HTML using standard badge classes but overriding the background color dynamically
			tagsHTML = tags.map(t => {
				const tagColor = topicTagMap.has(t.slug) ? topicTagMap.get(t.slug).color : '#343a40';
				return `<span class="badge" style="background-color: ${tagColor} !important; border: 1px solid #495057; margin-right: 5px; font-weight: 400; color: #fff;">${t.name}</span>`;
			}).join('');

			tagsTitle = tags.map(t => t.name).join(', ');
		}

		const category = p.categoryTitle || '';

		// Generate Solution Availability HTML string based on flags
		let solHtml = '<span class="text-secondary fw-semibold">N/A</span>';

		// Pill formatting exactly matching topic tags: colored background, white text, and border[cite: 4]
		const badgeLeetLite = `<span class="badge" style="background-color: #2cbb5d !important; border: 1px solid #495057; font-weight: 500; color: #fff;">LeetLite</span>`;
		const badgeLeetcode = `<span class="badge" style="background-color: #ffc01e !important; border: 1px solid #495057; font-weight: 500; color: #fff;">Leetcode</span>`;

		if (p.hasLeetcodeSolution && p.hasLeetLiteSolution) {
			// LeetLite (custom) comes strictly before Leetcode (official) when both are present[cite: 4]
			solHtml = `${badgeLeetLite} <span class="ms-1">${badgeLeetcode}</span>`;
		} else if (p.hasLeetLiteSolution) {
			solHtml = badgeLeetLite;
		} else if (p.hasLeetcodeSolution) {
			solHtml = badgeLeetcode;
		}

		const tr = document.createElement('tr');
		tr.innerHTML = `
            <td class="text-secondary fw-bold">${p.quesId}</td>
            <td>
                <a href="problem.html?quesId=${p.quesId}" class="text-decoration-none text-reset fw-semibold" target="_blank">
                    ${p.title}
                </a>${premiumLock}
            </td>
            <td class="${getDifficultyColor(p.difficulty)}">${p.difficulty}</td>
            <td class="${likeRateClass}">${likeRateDisplay}</td>
            <td class="${getRateColor(acRate)}">${acRate.toFixed(2)}%</td>
            <td class="${getCategoryColor(category)}">${category}</td>
            <td>${solHtml}</td>
            <td>
                <div class="tags-wrapper" title="${tagsTitle}">
                    ${tagsHTML}
                </div>
            </td>
        `;

		tableBody.appendChild(tr);
	});

	updateSortIcons();
	updateStats();
	updatePaginationUI(totalPages);
}

// --- 5. Filtering & Searching ---
function applyFilters() {
	const searchTerm = searchInput.value.toLowerCase();
	const diff = diffFilter.value;
	const paid = paidFilter.value;
	const cat = categoryFilter.value;
	const sol = solutionFilter.value; // Get the solution value

	currentProblems = allProblems.filter(p => {
		const matchesSearch = p.quesId.toString() === searchTerm || p.title.toLowerCase().includes(searchTerm);
		if (searchTerm && !matchesSearch) return false;

		// Compound Difficulty Filter Logic
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

		// TAG FILTERING LOGIC: OR / AND condition
		if (selectedTags.length > 0) {
			const problemTags = p.topicTags || [];

			if (tagLogic === 'OR') {
				const hasAnySelectedTag = selectedTags.some(selectedTagSlug =>
					problemTags.some(pt => pt.slug === selectedTagSlug)
				);
				if (!hasAnySelectedTag) return false;
			} else {
				const hasAllSelectedTags = selectedTags.every(selectedTagSlug =>
					problemTags.some(pt => pt.slug === selectedTagSlug)
				);
				if (!hasAllSelectedTags) return false;
			}
		}

		return true;
	});

	currentPage = 1;
	applySort();
}

// --- 6. Sorting ---
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
			// Apply strict truncation for comparison
			valA = truncateToTwoDecimals(calculateLikeRate(a.stats.likes || 0, a.stats.dislikes || 0));
			valB = truncateToTwoDecimals(calculateLikeRate(b.stats.likes || 0, b.stats.dislikes || 0));
		} else if (currentSort.column === 'acRate') {
			// Apply strict truncation for comparison
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

		return a.quesId - b.quesId;
	});

	renderTable();
}

function updateSortIcons() {
	document.querySelectorAll('.sort-icon').forEach(icon => {
		icon.innerHTML = '▲▼';
		icon.classList.remove('active');
	});
	const activeIcon = document.getElementById(`icon-${currentSort.column}`);
	if (activeIcon) {
		activeIcon.innerHTML = currentSort.direction === 'asc' ? '▲' : '▼';
		activeIcon.classList.add('active');
	}
}

// --- 7. Event Listeners ---
searchInput.addEventListener('keyup', () => { applyFilters(); saveSettings(); });

document.querySelectorAll('select.filter-ctrl:not(#pageSizeSelect)').forEach(select => {
	select.addEventListener('change', () => { applyFilters(); saveSettings(); });
});

pageSizeSelect.addEventListener('change', () => {
	pageSize = parseInt(pageSizeSelect.value, 10);
	currentPage = 1;
	renderTable();
	saveSettings();
});

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

resetBtn.addEventListener('click', () => {
	searchInput.value = '';
	diffFilter.value = 'All';
	paidFilter.value = 'All';
	categoryFilter.value = 'All';
	solutionFilter.value = 'All'; // Reset solution filter
	pageSizeSelect.value = '50';

	// Reset Tag Selection & Search
	selectedTags = [];
	tagSearchInput.value = '';
	document.querySelectorAll('.tag-checkbox').forEach(cb => cb.checked = false);
	document.querySelectorAll('#tagDropdownMenu .tag-item').forEach(li => li.style.display = ''); // Show all items
	updateTagDropdownText();

	// Reset Tag Logic Toggle
	tagLogic = 'OR';
	tagLogicToggle.checked = false;
	tagLogicLabel.textContent = 'OR';
	tagLogicLabel.classList.replace('text-primary', 'text-secondary');

	currentSort = { column: 'id', direction: 'asc' };
	currentPage = 1;
	pageSize = 50;

	applyFilters();
	saveSettings();
});

// Pagination Event Listeners
btnFirst.addEventListener('click', () => {
	currentPage = 1;
	renderTable();
	saveSettings();
});

btnPrev.addEventListener('click', () => {
	if (currentPage > 1) {
		currentPage--;
		renderTable();
		saveSettings();
	}
});

btnNext.addEventListener('click', () => {
	const totalPages = Math.ceil(currentProblems.length / pageSize) || 1;
	if (currentPage < totalPages) {
		currentPage++;
		renderTable();
		saveSettings();
	}
});

btnLast.addEventListener('click', () => {
	currentPage = Math.ceil(currentProblems.length / pageSize) || 1;
	renderTable();
	saveSettings();
});

// tagLogicToggle.addEventListener('click', () => {
// 	tagLogic = tagLogic === 'OR' ? 'AND' : 'OR';
// 	tagLogicToggle.textContent = tagLogic;

// 	if (tagLogic === 'AND') {
// 		tagLogicToggle.classList.replace('btn-outline-secondary', 'btn-outline-primary');
// 	} else {
// 		tagLogicToggle.classList.replace('btn-outline-primary', 'btn-outline-secondary');
// 	}

// 	currentPage = 1;
// 	applyFilters();
// 	saveSettings();
// });

tagLogicToggle.addEventListener('change', (e) => {
	if (e.target.checked) {
		tagLogic = 'AND';
		tagLogicLabel.textContent = 'AND';
		tagLogicLabel.classList.replace('text-secondary', 'text-primary');
	} else {
		tagLogic = 'OR';
		tagLogicLabel.textContent = 'OR';
		tagLogicLabel.classList.replace('text-primary', 'text-secondary');
	}
	currentPage = 1;
	applyFilters();
	saveSettings();
});

// --- 8. Initialization ---
loadProblems();

function getCategoryColor(category) {
	if (!category) return 'text-secondary';
	const cat = category.toLowerCase();

	if (cat === 'algorithms') return 'color-green';
	if (cat === 'database') return 'color-blue';
	if (cat.includes('javascript') || cat.includes('typescript')) return 'color-yellow';

	return 'text-secondary'; // Fallback for any other categories
}