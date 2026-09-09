async function loadComponents() {
	// 1. Load Navbar
	const navPlaceholder = document.getElementById('navbar-placeholder');
	if (navPlaceholder) {
		try {
			const response = await fetch('./components/navbar.html');
			if (!response.ok) throw new Error('Failed to fetch navbar');

			// Inject the HTML directly
			navPlaceholder.innerHTML = await response.text();

			// --- Navbar Highlighting Logic ---
			const currentPath = window.location.pathname;

			// Do nothing if on the homepage (index.html or root)
			if (!currentPath.endsWith('index.html') && currentPath !== '/' && !currentPath.endsWith('/')) {
				const navLinks = document.querySelectorAll('#nav-links .nav-link');
				navLinks.forEach(link => {
					const linkHref = link.getAttribute('href');
					if (linkHref && currentPath.includes(linkHref)) {
						// Apply Bootstrap warning color to highlight the active page
						link.classList.add('text-warning');
					}
				});
			}
		} catch (error) {
			console.error("Error loading navbar:", error);
		}
	}

	// 2. Load Footer
	const footerPlaceholder = document.getElementById('footer-placeholder');
	if (footerPlaceholder) {
		try {
			const response = await fetch('./components/footer.html');
			if (!response.ok) throw new Error('Failed to fetch footer');
			footerPlaceholder.innerHTML = await response.text();
		} catch (error) {
			console.error("Error loading footer:", error);
		}
	}
}

// Call the function when the DOM is ready
document.addEventListener('DOMContentLoaded', loadComponents);