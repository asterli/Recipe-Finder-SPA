// TheMealDB API base URL (free, no key required)
const API_BASE = "https://www.themealdb.com/api/json/v1/1";

// DOM element references
const searchForm = document.getElementById("search-form");
const searchInput = document.getElementById("search-input");
const resultsSection = document.getElementById("results");
const detailSection = document.getElementById("recipe-detail");
const errorTooltip = document.getElementById("error-tooltip");
const clearBtn = document.getElementById("clear-btn");
const emptyState = document.getElementById("empty-state");

// Map cuisine names to flag emojis
const CUISINE_FLAGS = {
  American: "🇺🇸", British: "🇬🇧", Canadian: "🇨🇦", Chinese: "🇨🇳",
  Croatian: "🇭🇷", Dutch: "🇳🇱", Egyptian: "🇪🇬", Filipino: "🇵🇭",
  French: "🇫🇷", Greek: "🇬🇷", Indian: "🇮🇳", Irish: "🇮🇪",
  Italian: "🇮🇹", Jamaican: "🇯🇲", Japanese: "🇯🇵", Kenyan: "🇰🇪",
  Malaysian: "🇲🇾", Mexican: "🇲🇽", Moroccan: "🇲🇦", Polish: "🇵🇱",
  Portuguese: "🇵🇹", Russian: "🇷🇺", Spanish: "🇪🇸", Thai: "🇹🇭",
  Tunisian: "🇹🇳", Turkish: "🇹🇷", Vietnamese: "🇻🇳", Ukrainian: "🇺🇦",
  Australian: "🇦🇺", Uruguayan: "🇺🇾", Venezuelan: "🇻🇪", Venezulan: "🇻🇪",
  Algerian: "🇩🇿", Argentinian: "🇦🇷", Syrian: "🇸🇾", "Saudi Arabian": "🇸🇦",
};

// Pagination state
const CARDS_PER_PAGE = 6;
let allMeals = [];
let visibleCount = 0;

// Category and area lists for enhanced search
let allCategories = [];
let allAreas = [];

// Fetch category and area lists on startup
async function loadCategoryAndAreaLists() {
  const [catRes, areaRes] = await Promise.all([
    fetch(`${API_BASE}/list.php?c=list`),
    fetch(`${API_BASE}/list.php?a=list`),
  ]);
  const [catData, areaData] = await Promise.all([catRes.json(), areaRes.json()]);
  allCategories = catData.meals ? catData.meals.map((m) => m.strCategory) : [];
  allAreas = areaData.meals ? areaData.meals.map((m) => m.strArea) : [];
}

loadCategoryAndAreaLists();

// Search recipes by name
async function searchRecipes(query) {
  const res = await fetch(`${API_BASE}/search.php?s=${encodeURIComponent(query)}`);
  const data = await res.json();
  return data.meals || [];
}

// Filter recipes by category
async function filterByCategory(category) {
  const res = await fetch(`${API_BASE}/filter.php?c=${encodeURIComponent(category)}`);
  const data = await res.json();
  return (data.meals || []).map((m) => ({
    ...m, strCategory: category, strArea: "",
  }));
}

// Filter recipes by area/cuisine
async function filterByArea(area) {
  const res = await fetch(`${API_BASE}/filter.php?a=${encodeURIComponent(area)}`);
  const data = await res.json();
  return (data.meals || []).map((m) => ({
    ...m, strArea: area, strCategory: "",
  }));
}

// Enhanced search: by name + matching category + matching area, deduplicated
async function enhancedSearch(query) {
  const q = query.toLowerCase();
  const matchedCategory = allCategories.find((c) => c.toLowerCase() === q);
  const matchedArea = allAreas.find((a) => a.toLowerCase() === q);

  const promises = [searchRecipes(query)];
  if (matchedCategory) promises.push(filterByCategory(matchedCategory));
  if (matchedArea) promises.push(filterByArea(matchedArea));

  const results = await Promise.all(promises);

  // Merge and deduplicate (name search results take priority — they have full data)
  const seen = new Set();
  const merged = [];
  for (const list of results) {
    for (const meal of list) {
      if (!seen.has(meal.idMeal)) {
        seen.add(meal.idMeal);
        merged.push(meal);
      }
    }
  }

  // Fetch full details for meals missing category or area (from filter endpoints)
  const incomplete = merged.filter((m) => !m.strCategory || !m.strArea);
  if (incomplete.length > 0) {
    const details = await Promise.all(
      incomplete.map((m) => getRecipeById(m.idMeal))
    );
    for (let i = 0; i < incomplete.length; i++) {
      if (details[i]) {
        const idx = merged.indexOf(incomplete[i]);
        merged[idx] = details[i];
      }
    }
  }

  return merged;
}

// Look up a single recipe by ID
async function getRecipeById(id) {
  const res = await fetch(`${API_BASE}/lookup.php?i=${id}`);
  const data = await res.json();
  return data.meals ? data.meals[0] : null;
}

// Extract ingredient/measure pairs from a meal object
function getIngredients(meal) {
  const ingredients = [];
  for (let i = 1; i <= 20; i++) {
    const ingredient = meal[`strIngredient${i}`];
    const measure = meal[`strMeasure${i}`];
    if (ingredient && ingredient.trim()) {
      ingredients.push(`${measure ? measure.trim() : ""} ${ingredient.trim()}`);
    }
  }
  return ingredients;
}

// Append a batch of card elements to the results grid
function appendCards(meals) {
  meals.forEach((meal, i) => {
    const card = document.createElement("div");
    card.className = "card";
    card.style.opacity = "0";
    card.style.animation = `cardPop 0.4s ease-out ${i * 0.08}s forwards`;
    card.addEventListener("animationend", () => {
      card.style.animation = "";
      card.style.opacity = "1";
    }, { once: true });
    const categoryTag = meal.strCategory
      ? `<span class="card-category">${meal.strCategory}</span>` : "";
    const cuisineTag = meal.strArea
      ? `<span class="card-cuisine" title="${meal.strArea}">${CUISINE_FLAGS[meal.strArea] || meal.strArea}</span>` : "";
    card.innerHTML = `
      <img src="${meal.strMealThumb}" alt="${meal.strMeal}">
      <h3>${meal.strMeal}</h3>
      <div class="card-tags">
        ${categoryTag}
        ${cuisineTag}
      </div>
    `;
    card.addEventListener("click", () => showDetail(meal.idMeal));
    resultsSection.appendChild(card);
  });
}

// Update or remove the "Load more" button
function updateLoadMoreBtn() {
  const existing = document.getElementById("load-more-btn");
  if (existing) existing.remove();

  if (visibleCount < allMeals.length) {
    const remaining = allMeals.length - visibleCount;
    const btn = document.createElement("button");
    btn.id = "load-more-btn";
    btn.className = "load-more-btn";
    btn.textContent = `Load more (${remaining} remaining)`;
    btn.addEventListener("click", () => {
      const nextBatch = allMeals.slice(visibleCount, visibleCount + CARDS_PER_PAGE);
      appendCards(nextBatch);
      visibleCount += nextBatch.length;
      updateLoadMoreBtn();
    });
    resultsSection.insertAdjacentElement("afterend", btn);
  }
}

// Render search results as cards
function renderResults(meals) {
  resultsSection.innerHTML = "";
  detailSection.classList.add("hidden");
  resultsSection.classList.remove("hidden");

  // Clean up any existing load more button
  const existing = document.getElementById("load-more-btn");
  if (existing) existing.remove();

  if (meals.length === 0) {
    resultsSection.innerHTML = `
      <div class="no-results">
        <span class="no-results-emoji">🍽️</span>
        <p class="no-results-text">No recipes found!</p>
        <p class="no-results-hint">Try searching for something else, like "pasta" or "cake"</p>
      </div>
    `;
    return;
  }

  allMeals = meals;
  visibleCount = Math.min(CARDS_PER_PAGE, meals.length);
  appendCards(meals.slice(0, visibleCount));
  updateLoadMoreBtn();
  clearBtn.classList.add("visible");
}

// Render the full recipe detail view
async function showDetail(id) {
  const meal = await getRecipeById(id);
  if (!meal) return;

  const ingredients = getIngredients(meal);

  resultsSection.classList.add("hidden");
  detailSection.classList.remove("hidden");
  clearBtn.classList.add("visible");
  window.scrollTo({ top: 0, behavior: "smooth" });

  detailSection.innerHTML = `
    <button class="back-btn">&larr; Back to results</button>
    <div class="detail-hero">
      <img src="${meal.strMealThumb}" alt="${meal.strMeal}">
      <div class="detail-hero-overlay">
        <h2>${meal.strMeal}</h2>
        <div class="detail-tags">
          <span class="detail-tag category-tag">${meal.strCategory}</span>
          <span class="detail-tag cuisine-tag">${meal.strArea}</span>
        </div>
      </div>
    </div>
    <div class="detail-grid">
      <div class="detail-card">
        <h3>Ingredients</h3>
        <ul>
          ${ingredients.map((ing) => `<li>${ing}</li>`).join("")}
        </ul>
      </div>
      <div class="detail-card">
        <h3>Instructions</h3>
        <p class="instructions">${meal.strInstructions}</p>
        ${meal.strYoutube ? `<a class="video-link" href="${meal.strYoutube}" target="_blank" rel="noopener noreferrer">Watch on YouTube</a>` : ""}
      </div>
    </div>
  `;

  detailSection.querySelector(".back-btn").addEventListener("click", () => {
    detailSection.classList.add("hidden");
    resultsSection.classList.remove("hidden");
  });
}

// Clear error state when the user starts typing
searchInput.addEventListener("input", () => {
  searchInput.classList.remove("input-error");
  errorTooltip.classList.add("hidden");
});

// Reset search input, results, and detail view to initial state
clearBtn.addEventListener("click", (e) => {
  e.preventDefault();
  searchInput.value = "";
  resultsSection.innerHTML = "";
  resultsSection.classList.add("hidden");
  detailSection.classList.add("hidden");
  emptyState.classList.remove("hidden");
  clearBtn.classList.remove("visible");
  const loadMoreBtn = document.getElementById("load-more-btn");
  if (loadMoreBtn) loadMoreBtn.remove();
  searchInput.classList.remove("input-error");
  errorTooltip.classList.add("hidden");
});

// Handle search form submission: validate input, show spinner, fetch and render results
searchForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const query = searchInput.value.trim();
  if (!query) {
    searchInput.classList.add("input-error");
    errorTooltip.classList.remove("hidden");
    return;
  }
  emptyState.classList.add("hidden");
  resultsSection.classList.remove("hidden");
  resultsSection.innerHTML = '<div class="spinner"></div>';
  const meals = await enhancedSearch(query);
  renderResults(meals);
});
