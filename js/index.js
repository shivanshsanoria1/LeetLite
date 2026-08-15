// --- 1. State Management ---
let allProblems = [];
let currentProblems = [];
let currentSort = { column: 'id', direction: 'asc' };
const STORAGE_KEY = 'leetcode_lite_settings';

// Pagination & Tag variables
let pageSize = 50;
let currentPage = 1;
let selectedTags = []; // Now strictly stores 'slugs' (e.g. 'dynamic-programming')
const tagMap = new Map(); // Maps slug -> name for UI display

const GITHUB_LCS_URL = 'https://raw.githubusercontent.com/shivanshsanoria1/LeetcodeSolutions/main';
const PATH_LC_PROBLEM_LIST = '/util/web/generated/lc-problem-list.json';

// DOM Elements
const tableBody = document.getElementById('tableBody');
const searchInput = document.getElementById('searchInput');
const diffFilter = document.getElementById('diffFilter');
const paidFilter = document.getElementById('paidFilter');
const categoryFilter = document.getElementById('categoryFilter');
const pageSizeSelect = document.getElementById('pageSizeSelect');
const resetBtn = document.getElementById('resetBtn');

// DOM Elements: Tag Dropdown
const tagDropdownMenu = document.getElementById('tagDropdownMenu');
const tagDropdownText = document.getElementById('tagDropdownText');

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
		// const response = await fetch('./data/lc-problem-list.json');
		const response = await fetch(GITHUB_LCS_URL + PATH_LC_PROBLEM_LIST);

		if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);

		allProblems = await response.json();
		currentProblems = [...allProblems];

		// Generate the tags list dynamically from the data
		populateTagDropdown();

		// Load settings, which will automatically check the correct tag boxes
		loadSettings();
		applyFilters();

	} catch (error) {
		console.error("Failed to load problem list:", error);
		tableBody.innerHTML = `<tr><td colspan="7" class="text-center text-danger py-4">Error loading problem data. Please check your data directory.</td></tr>`;
	}
}

function saveSettings() {
	const settings = {
		search: searchInput.value,
		diff: diffFilter.value,
		paid: paidFilter.value,
		category: categoryFilter.value,
		tags: selectedTags, // Saves array of slugs
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

			if (settings.sort) currentSort = settings.sort;
			if (settings.page) currentPage = settings.page;
			if (settings.pageSize) {
				pageSize = settings.pageSize;
				pageSizeSelect.value = pageSize;
			}
			if (settings.tags) {
				selectedTags = settings.tags;
				updateTagDropdownText();

				// Tick the boxes that were previously saved (matching by slug)
				document.querySelectorAll('.tag-checkbox').forEach(cb => {
					if (selectedTags.includes(cb.value)) {
						cb.checked = true;
					}
				});
			}

		} catch (e) {
			console.error("Failed to parse local settings", e);
		}
	}
}

// --- 3. Tag Dropdown Setup ---
function populateTagDropdown() {
	// Extract unique tags and map their slugs to names
	allProblems.forEach(p => {
		if (p.topicTags) {
			p.topicTags.forEach(t => {
				if (t.slug && t.name) {
					tagMap.set(t.slug, t.name);
				}
			});
		}
	});

	// Convert map to array and alphabetize by name for UI
	const sortedTags = Array.from(tagMap.entries()).sort((a, b) => a[1].localeCompare(b[1]));

	tagDropdownMenu.innerHTML = '';

	sortedTags.forEach(([slug, name]) => {
		const li = document.createElement('li');
		li.innerHTML = `
            <div class="dropdown-item form-check ms-3 me-3 mb-0">
                <input class="form-check-input tag-checkbox" type="checkbox" value="${slug}" id="tag-${slug}">
                <label class="form-check-label w-100" for="tag-${slug}">
                    ${name}
                </label>
            </div>
        `;
		tagDropdownMenu.appendChild(li);
	});

	// Add listeners to newly created checkboxes
	document.querySelectorAll('.tag-checkbox').forEach(cb => {
		cb.addEventListener('change', (e) => {
			if (e.target.checked) {
				selectedTags.push(e.target.value); // Push the slug
			} else {
				selectedTags = selectedTags.filter(t => t !== e.target.value);
			}
			updateTagDropdownText();
			currentPage = 1;
			applyFilters();
			saveSettings();
		});
	});
}

function updateTagDropdownText() {
	if (selectedTags.length === 0) {
		tagDropdownText.textContent = 'Select Tags...';
	} else if (selectedTags.length === 1) {
		// Look up the display name using the stored slug
		tagDropdownText.textContent = tagMap.get(selectedTags[0]) || selectedTags[0];
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

function renderTable() {
	tableBody.innerHTML = '';

	if (currentProblems.length === 0) {
		tableBody.innerHTML = '<tr><td colspan="7" class="text-center text-muted py-4">No problems found.</td></tr>';
		updatePaginationUI(0);
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

		const likeRateDisplay = totalVotes === 0 ? "NA" : `${likeRate.toFixed(2)}%`;
		const likeRateClass = totalVotes === 0 ? "text-secondary" : getRateColor(likeRate);

		const acRate = p.stats.acRateRaw || 0;
		const star = p.isPaidOnly ? `<span class="paid-star" title="Premium Problem">★</span>` : '';

		const tags = p.topicTags || [];
		const tagsHTML = tags.map(t => `<span class="badge tag-badge">${t.name}</span>`).join('');
		const tagsTitle = tags.map(t => t.name).join(', ');

		const category = p.meta?.categoryTitle || '';

		const tr = document.createElement('tr');
		tr.innerHTML = `
            <td class="text-secondary fw-bold">${p.quesId}</td>
            <td>
                <a href="problem.html?slug=${p.titleSlug}" class="text-decoration-none text-reset fw-semibold" target="_blank">
                    ${p.title}
                </a>${star}
            </td>
            <td class="${getDifficultyColor(p.difficulty)}">${p.difficulty}</td>
            <td class="${likeRateClass}">${likeRateDisplay}</td>
            <td class="${getRateColor(acRate)}">${acRate.toFixed(2)}%</td>
            <td>
                <div class="tags-wrapper" title="${tagsTitle}">
                    ${tagsHTML}
                </div>
            </td>
            <td class="text-secondary">${category}</td>
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

	currentProblems = allProblems.filter(p => {
		const matchesSearch = p.quesId.toString() === searchTerm || p.title.toLowerCase().includes(searchTerm);
		if (searchTerm && !matchesSearch) return false;

		if (diff !== "All" && p.difficulty !== diff) return false;
		if (paid === "Free" && p.isPaidOnly) return false;
		if (paid === "Paid" && !p.isPaidOnly) return false;
		if (cat !== "All" && p.meta?.categoryTitle !== cat) return false;

		// TAG FILTERING LOGIC: Match ANY selected tags (OR condition) explicitly matching pt.slug
		if (selectedTags.length > 0) {
			const problemTags = p.topicTags || [];
			const hasAnySelectedTag = selectedTags.some(selectedTagSlug =>
				problemTags.some(pt => pt.slug === selectedTagSlug)
			);
			if (!hasAnySelectedTag) return false;
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
			valA = calculateLikeRate(a.stats.likes || 0, a.stats.dislikes || 0);
			valB = calculateLikeRate(b.stats.likes || 0, b.stats.dislikes || 0);
		} else if (currentSort.column === 'acRate') {
			valA = a.stats.acRateRaw || 0; valB = b.stats.acRateRaw || 0;
		} else if (currentSort.column === 'category') {
			valA = (a.meta?.categoryTitle || '').toLowerCase();
			valB = (b.meta?.categoryTitle || '').toLowerCase();
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
	// Reset Standard Inputs
	searchInput.value = '';
	diffFilter.value = 'All';
	paidFilter.value = 'All';
	categoryFilter.value = 'All';
	pageSizeSelect.value = '50';

	// Reset Tag Selection
	selectedTags = [];
	document.querySelectorAll('.tag-checkbox').forEach(cb => cb.checked = false);
	updateTagDropdownText();

	// Reset Globals
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

// --- 8. Initialization ---
loadProblems();