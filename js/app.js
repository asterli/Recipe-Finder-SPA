// TheMealDB API base URL (free, no key required)
const API_BASE = "https://www.themealdb.com/api/json/v1/1";

// DOM element references
const searchForm = document.getElementById("search-form");
const searchInput = document.getElementById("search-input");
const resultsSection = document.getElementById("results");
const detailSection = document.getElementById("recipe-detail");
const errorTooltip = document.getElementById("error-tooltip");
const clearBtn = document.getElementById("clear-btn");

// Search recipes by name
async function searchRecipes(query) {
  const res = await fetch(`${API_BASE}/search.php?s=${encodeURIComponent(query)}`);
  const data = await res.json();
  return data.meals || [];
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

// Render search results as cards
function renderResults(meals) {
  resultsSection.innerHTML = "";
  detailSection.classList.add("hidden");
  resultsSection.style.display = "";

  if (meals.length === 0) {
    resultsSection.innerHTML = '<p class="message">No recipes found. Try a different search.</p>';
    return;
  }

  meals.forEach((meal) => {
    const card = document.createElement("div");
    card.className = "card";
    card.innerHTML = `
      <img src="${meal.strMealThumb}" alt="${meal.strMeal}">
      <h3>${meal.strMeal}</h3>
      <span class="card-category">${meal.strCategory}</span>
    `;
    card.addEventListener("click", () => showDetail(meal.idMeal));
    resultsSection.appendChild(card);
  });
}

// Render the full recipe detail view
async function showDetail(id) {
  const meal = await getRecipeById(id);
  if (!meal) return;

  const ingredients = getIngredients(meal);

  resultsSection.style.display = "none";
  detailSection.classList.remove("hidden");

  detailSection.innerHTML = `
    <button class="back-btn">Back to results</button>
    <h2>${meal.strMeal}</h2>
    <p class="meta">${meal.strCategory} &mdash; ${meal.strArea}</p>
    <div class="detail-grid">
      <div>
        <img src="${meal.strMealThumb}" alt="${meal.strMeal}">
        <h3>Ingredients</h3>
        <ul>
          ${ingredients.map((ing) => `<li>${ing}</li>`).join("")}
        </ul>
      </div>
      <div>
        <h3>Instructions</h3>
        <p class="instructions">${meal.strInstructions}</p>
        ${meal.strYoutube ? `<a class="video-link" href="${meal.strYoutube}" target="_blank" rel="noopener noreferrer">Watch on YouTube</a>` : ""}
      </div>
    </div>
  `;

  detailSection.querySelector(".back-btn").addEventListener("click", () => {
    detailSection.classList.add("hidden");
    resultsSection.style.display = "";
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
  detailSection.classList.add("hidden");
  resultsSection.style.display = "";
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
  resultsSection.innerHTML = '<div class="spinner"></div>';
  const meals = await searchRecipes(query);
  renderResults(meals);
});
