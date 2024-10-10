window.subscribers = [];

const defaultState = {
  products: [],
  cart: {},
};

// Proxy to manage state and notify subscribers on state changes
const state = new Proxy(defaultState, {
  set(state, key, value) {
    const oldState = { ...state };
    state[key] = value;

    // Notify all subscribers about the state change
    window.subscribers.forEach((callback) => callback(state, oldState));
    return true;
  },
});

// Function to generate a unique key for a product
function generateProductKey(product) {
  return `${product.name}-${product.price}`.replace(/\s+/g, "-").toLowerCase();
}

// Fetch the products from the JSON file and update state
async function getProducts() {
  try {
    const response = await fetch("../data.json");
    if (!response.ok) {
      throw new Error(`HTTP error! Status: ${response.status}`);
    }
    state.products = await response.json();
  } catch (error) {
    console.error("Error fetching products:", error);
  }
}

// Initialize products on page load
document.addEventListener("DOMContentLoaded", () => {
  getProducts();
});

// Render the product list based on the current state
function renderProductList(currentState, oldState = null) {
  if (oldState && oldState.products === currentState.products) {
    return; // Skip rendering if products haven't changed
  }

  const product_list = document.querySelector(".product-list");
  product_list.innerHTML = ""; // Clear existing list

  currentState.products.forEach((product) => {
    const product_html = document.createElement("div");
    product_html.classList.add("product");

    const productKey = generateProductKey(product);
    product_html.setAttribute("data-product-key", productKey);

    product_html.innerHTML = `
      <div class="product-image">
        <picture>
          <source srcset="${product.image.desktop}" media="(min-width: 1024px)">
          <source srcset="${product.image.tablet}" media="(min-width: 768px)">
          <img src="${product.image.mobile}" alt="">
        </picture>
        <div class="product-buttons" data-instance-in-cart="false">
          <button class="add-to-cart js-add-to-cart"><img src="./assets/images/icon-add-to-cart.svg" alt="">Add to cart</button>
          <div class="change-quantity-in-cart">
            <button class="js-decrement"><svg xmlns="http://www.w3.org/2000/svg" width="10" height="2" fill="none" viewBox="0 0 10 2"><path fill="currentColor" d="M0 .375h10v1.25H0V.375Z"/></svg></button>
            <span class="js-item-quantity"></span>
            <button class="js-increment"><svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" fill="none" viewBox="0 0 10 10"><path fill="currentColor" d="M10 4.375H5.625V0h-1.25v4.375H0v1.25h4.375V10h1.25V5.625H10v-1.25Z"/></svg></button>
          </div>
        </div>
      </div>
      <p class="product-category">${product.category}</p>
      <p class="product-name">${product.name}</p>
      <p class="product-price">${product.price.toFixed(2)}</p>
    `;

    // Add event listeners for buttons
    product_html
      .querySelector(".add-to-cart")
      .addEventListener("click", addToCart(productKey, product));
    product_html
      .querySelector(".js-decrement")
      .addEventListener("click", () => decrementQuantity(productKey));
    product_html
      .querySelector(".js-increment")
      .addEventListener("click", () => incrementQuantity(productKey));

    product_list.appendChild(product_html);
  });
}

// Render cart items and order summary
function renderCartItems() {
  const cart_content = document.querySelector(".cart-content");

  if (Object.keys(state.cart).length === 0) {
    cart_content.innerHTML = `
      <div class="cart-empty">
        <img src="./assets/images/illustration-empty-cart.svg" alt="" />
        <p>Your added items will appear here</p>
      </div>
    `;
    return;
  }

  cart_content.innerHTML = `
    <div class="cart-item-list"></div>
    <p class="cart-order-total">Order Total<span>0.00</span></p>
    <p class="carbon-neutral">
      <img src="./assets/images/icon-carbon-neutral.svg" alt="" />
      This is a <strong>carbon-neutral</strong> delivery.
    </p>
    <button class="confirm-order">Confirm Order</button>
  `;

  const cart_item_list = cart_content.querySelector(".cart-item-list");
  let totalOrderAmount = 0;

  for (let productKey in state.cart) {
    const cart_item = state.cart[productKey];
    const totalItemPrice = cart_item.price * cart_item.quantity;
    totalOrderAmount += totalItemPrice;

    const cart_item_html = document.createElement("div");
    cart_item_html.classList.add("cart-item");

    cart_item_html.innerHTML = `
      <div>
        <p class="cart-item-name">${cart_item.name}</p>
        <p>
          <span class="cart-item-quantity">${cart_item.quantity}x</span>
          <span class="cart-item-price">@ $${cart_item.price.toFixed(2)}</span>
          <span class="cart-item-total">= $${totalItemPrice.toFixed(2)}</span>
        </p>
      </div>
      <button class="cart-item-remove">
        <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" fill="currentColor" viewBox="0 0 10 10"><path fill="currentColor" d="M8.375 9.375 5 6 1.625 9.375l-1-1L4 5 .625 1.625l1-1L5 4 8.375.625l1 1L6 5l3.375 3.375-1 1Z"/></svg>
      </button>
    `;

    // Add event listener to remove item
    cart_item_html
      .querySelector(".cart-item-remove")
      .addEventListener("click", () => removeFromCart(productKey));
    cart_item_list.appendChild(cart_item_html);
  }

  const orderTotalElement = cart_content.querySelector(
    ".cart-order-total span"
  );
  orderTotalElement.textContent = totalOrderAmount.toFixed(2);

  cart_content
    .querySelector(".confirm-order")
    .addEventListener("click", renderDialog);
}

function addToCart(productKey, product) {
  return (event) => {
    event.preventDefault();

    state.cart[productKey] = { ...product, quantity: 1 }; // Add new product with quantity 1
    const product_html = document.querySelector(
      `[data-product-key="${productKey}"]`
    );

    product_html
      .querySelector("[data-instance-in-cart]")
      .setAttribute("data-instance-in-cart", true);
    product_html.classList.add("selected");

    updateProductButtons(productKey); // Update UI buttons
    renderCartItems(); // Update cart display
    updateCartCounter();
  };
}

function updateProductButtons(productKey) {
  const product_html = document.querySelector(
    `[data-product-key="${productKey}"]`
  );

  if (!state.cart[productKey]) {
    product_html.classList.remove("selected");
    product_html
      .querySelector(".product-buttons")
      .setAttribute("data-instance-in-cart", false);
    return;
  }

  // Update button text based on cart state
  product_html.querySelector(".js-item-quantity").textContent =
    state.cart[productKey].quantity;
}

function decrementQuantity(productKey) {
  if (state.cart[productKey]) {
    state.cart[productKey].quantity--;

    if (state.cart[productKey].quantity === 0) {
      removeFromCart(productKey); // Remove product if quantity is 0
    }

    updateProductButtons(productKey); // Update UI buttons
    renderCartItems(); // Re-render cart
    updateCartCounter();
  }
}

function incrementQuantity(productKey) {
  if (state.cart[productKey]) {
    state.cart[productKey].quantity++;
    updateProductButtons(productKey); // Update UI buttons
    renderCartItems(); // Re-render cart
    updateCartCounter();
  }
}

function removeFromCart(productKey) {
  delete state.cart[productKey]; // Remove product from cart
  updateProductButtons(productKey); // Update UI buttons
  renderCartItems(); // Re-render cart
  updateCartCounter();
}

function updateCartCounter() {
  const cartCounter = document.querySelector(".cart-counter");
  let totalItems = 0;

  // Loop through the cart and sum the quantities
  for (let productKey in state.cart) {
    totalItems += state.cart[productKey].quantity;
  }

  // Update the cart counter in the title
  cartCounter.textContent = totalItems;
}

function renderDialog() {
  let dialog = document.querySelector("dialog");
  let cart_item_list = dialog.querySelector(".cart-item-list");
  let order_total = dialog.querySelector(".cart-order-total span");

  let totalOrderAmount = 0;

  // Loop through each cart item and create its HTML
  for (let productKey in state.cart) {
    let cart_item = state.cart[productKey];
    let totalItemPrice = cart_item.price * cart_item.quantity;
    totalOrderAmount += totalItemPrice;

    let cart_item_html = document.createElement("div");
    cart_item_html.classList.add("cart-item");

    // Create the HTML structure for each cart item
    cart_item_html.innerHTML = `
      <div>
        <img src="${cart_item.image.thumbnail}" alt="">
        <div>
          <span class="cart-item-name">${cart_item.name}</span>
          <p>
            <span class="cart-item-quantity">${cart_item.quantity}x</span>
            <span class="cart-item-price">@ $${cart_item.price.toFixed(
              2
            )}</span>
          </p>
        </div>
      </div>
      <span class="cart-item-total">$${totalItemPrice.toFixed(2)}</span>
    `;

    // Append the cart item to the list in the dialog
    cart_item_list.appendChild(cart_item_html);
  }

  // Update the total order amount in the dialog
  order_total.textContent = totalOrderAmount.toFixed(2);
  dialog.showModal();
}

document.querySelector(".start-new-order").addEventListener("click", () => {
  document.querySelector("dialog").close();
  state.cart = [];
  state.products.forEach((product) => {
    const productKey = generateProductKey(product);
    updateProductButtons(productKey); // Reset button states for all products
  });

  updateCartCounter();
});

window.subscribers.push(renderProductList, renderCartItems);
