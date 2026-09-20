// absolute paths
export const LC_ASSETS_BASE_URL = 'https://assets.leetcode.com/static_assets/media/original_images';
export const LC_PROBLEM_BASE_URL = 'https://leetcode.com/problems';
export const GITHUB_LCS_URL = 'https://raw.githubusercontent.com/shivanshsanoria1/LeetcodeSolutions/main';

// relative external paths
export const PATH_LC_SOLVED_PROBLEM_LIST = '/stats/lc-solved-problems-list.json';

// Dynamically calculate the relative path to the root directory
// to support both local Live Server and GitHub Pages subdirectory hosting.
const isInHtmlDir = window.location.pathname.includes('/html/');
const basePath = isInHtmlDir ? '../' : './';

// relative internal paths
export const PATH_LC_PROBLEM_LIST = basePath + 'backend/generated/json-min/lc-problem-list-min.json';
export const PATH_LC_TOPIC_TAGS = basePath + 'backend/generated/json-min/lc-topic-tag-min.json';
export const PATH_JSON_DIR = basePath + 'backend/generated/json';