// Mobile menu toggle
const toggle = document.querySelector(".nav-toggle");
const nav = document.querySelector(".site-nav");

if (toggle) {
  toggle.addEventListener("click", () => {
    const expanded = toggle.getAttribute("aria-expanded") === "true";
    toggle.setAttribute("aria-expanded", !expanded);
    nav.classList.toggle("open");
  });
}

// Breadcrumb auto label
const breadcrumbCurrent = document.getElementById("breadcrumb-current");
if (breadcrumbCurrent) {
  const title = document.querySelector("h1");
  if (title) breadcrumbCurrent.textContent = title.textContent;
}
